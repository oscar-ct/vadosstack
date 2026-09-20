import { isBefore } from "date-fns";

import { AuthRequiredState } from "@/components/auth-required-state";
import { can, getCurrentDashboardAuthorization, type WorkspaceMembershipSummary } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { formatUtcMonthShort, getUtcMonthKey, startOfUtcMonth } from "@/lib/reporting-month";

import { CommandCenterDashboard, type CommandCenterData } from "./command-center-dashboard";

const WON_ESTIMATE_STATUSES = new Set(["Converted", "Approved", "Accepted", "Won"]);
const LOST_ESTIMATE_STATUSES = new Set(["Declined", "Cancelled", "Lost"]);
const FOLLOW_UP_ESTIMATE_STATUSES = new Set(["Estimate Provided", "Waiting on Customer"]);
const JOB_STATUSES = ["Completed", "Scheduled", "Unscheduled", "On Hold", "Cancelled"] as const;

function money(value: { toString(): string } | number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(part: number, total: number) {
  if (!total) {
    return 0;
  }

  return Math.round((part / total) * 100);
}

export async function getCommandCenterData(
  ownerId: string,
  companyName: string,
  membership?: WorkspaceMembershipSummary,
): Promise<CommandCenterData> {
  const today = new Date();
  const sixMonthStart = startOfUtcMonth(today, -5);
  const twelveMonthStart = startOfUtcMonth(today, -11);
  const mayRead = (permission: Parameters<typeof can>[1]) => !membership || can(membership, permission);
  const canViewEstimates = mayRead("estimates.view");
  const canViewInvoices = mayRead("invoices.view");
  const canViewJobs = mayRead("jobs.view");
  const canViewTime = mayRead("time.view");

  const [jobs, estimates, invoiceTotals, recentInvoices, recentPayments, timeEntries] = await Promise.all([
    canViewJobs
      ? prisma.job.findMany({
          where: { ownerId },
          select: {
            amountPaid: true,
            category: true,
            customerId: true,
            estimatedCost: true,
            finalCost: true,
            status: true,
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    canViewEstimates
      ? prisma.estimateRecord.findMany({
          where: { ownerId },
          select: {
            convertedJobId: true,
            decidedAt: true,
            estimatedTotal: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    canViewInvoices
      ? prisma.invoice.aggregate({
          where: { ownerId },
          _count: { _all: true },
          _sum: {
            amountPaid: true,
            balanceDue: true,
            finalCost: true,
          },
        })
      : Promise.resolve({ _count: { _all: 0 }, _sum: { amountPaid: null, balanceDue: null, finalCost: null } }),
    canViewInvoices
      ? prisma.invoice.findMany({
          where: { ownerId, issuedAt: { gte: twelveMonthStart } },
          select: {
            balanceDue: true,
            customerId: true,
            customerName: true,
            finalCost: true,
            issuedAt: true,
          },
        })
      : Promise.resolve([]),
    canViewInvoices
      ? prisma.jobPayment.findMany({
          where: { ownerId, paidOn: { gte: twelveMonthStart } },
          select: {
            amount: true,
            paidOn: true,
          },
        })
      : Promise.resolve([]),
    canViewTime
      ? prisma.timeEntry.findMany({
          where: {
            ownerId,
            workedOn: {
              gte: twelveMonthStart,
            },
          },
          select: {
            employee: {
              select: {
                accentColor: true,
                active: true,
                id: true,
                name: true,
              },
            },
            hours: true,
            workedOn: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const issuedTotal = money(invoiceTotals._sum.finalCost);
  const receivablesTotal = money(invoiceTotals._sum.balanceDue);
  const collectedTotal = money(invoiceTotals._sum.amountPaid);
  const openJobs = jobs.filter((job) => job.status !== "Completed" && job.status !== "Cancelled");
  const openWorkValue = openJobs.reduce((total, job) => total + money(job.finalCost ?? job.estimatedCost), 0);
  const waitingEstimates = estimates.filter((estimate) => FOLLOW_UP_ESTIMATE_STATUSES.has(estimate.status));
  const waitingEstimateValue = waitingEstimates.reduce((total, estimate) => total + money(estimate.estimatedTotal), 0);
  const collectionRate = percent(collectedTotal, issuedTotal);

  const monthlyFlow = Array.from({ length: 12 }, (_, index) => {
    const monthStart = startOfUtcMonth(today, index - 11);
    const monthKey = getUtcMonthKey(monthStart);
    const monthInvoices = recentInvoices.filter((invoice) => getUtcMonthKey(invoice.issuedAt) === monthKey);
    const monthPayments = recentPayments.filter((payment) => getUtcMonthKey(payment.paidOn) === monthKey);
    const monthEntries = timeEntries.filter((entry) => getUtcMonthKey(entry.workedOn) === monthKey);

    return {
      month: formatUtcMonthShort(monthStart),
      billed: Math.round(monthInvoices.reduce((total, invoice) => total + money(invoice.finalCost), 0)),
      collected: Math.round(monthPayments.reduce((total, payment) => total + money(payment.amount), 0)),
      receivable: Math.round(monthInvoices.reduce((total, invoice) => total + money(invoice.balanceDue), 0)),
      hours: Math.round(monthEntries.reduce((total, entry) => total + money(entry.hours), 0) * 10) / 10,
    };
  });

  const jobStatusMap = new Map<string, { status: string; value: number; amount: number }>(
    JOB_STATUSES.map((status) => [status, { status, value: 0, amount: 0 }]),
  );

  for (const job of jobs) {
    const current = jobStatusMap.get(job.status) ?? { status: job.status, value: 0, amount: 0 };
    current.value += 1;
    current.amount += money(job.finalCost ?? job.estimatedCost);
    jobStatusMap.set(job.status, current);
  }

  const jobStatus = [...jobStatusMap.values()].map((item) => ({
    ...item,
    amount: Math.round(item.amount),
  }));

  function buildReportingPeriod(periodStart: Date) {
    const periodInvoices = recentInvoices.filter((invoice) => !isBefore(invoice.issuedAt, periodStart));
    const periodPayments = recentPayments.filter((payment) => !isBefore(payment.paidOn, periodStart));
    const periodEntries = timeEntries.filter((entry) => !isBefore(entry.workedOn, periodStart));
    const periodDecisions = estimates.filter(
      (estimate) => estimate.decidedAt && !isBefore(estimate.decidedAt, periodStart),
    );
    const wonEstimates = periodDecisions.filter(
      (estimate) => WON_ESTIMATE_STATUSES.has(estimate.status) || Boolean(estimate.convertedJobId),
    );
    const lostEstimates = periodDecisions.filter((estimate) => LOST_ESTIMATE_STATUSES.has(estimate.status));
    const wonEstimateValue = wonEstimates.reduce((total, estimate) => total + money(estimate.estimatedTotal), 0);
    const lostEstimateValue = lostEstimates.reduce((total, estimate) => total + money(estimate.estimatedTotal), 0);
    const decidedEstimateValue = wonEstimateValue + lostEstimateValue;
    const estimateOutcomeValue = waitingEstimateValue + decidedEstimateValue;
    const estimateOutcomes = [
      {
        status: "Waiting on Customer",
        count: waitingEstimates.length,
        value: Math.round(waitingEstimateValue),
        share: percent(waitingEstimateValue, estimateOutcomeValue),
      },
      {
        status: "Won",
        count: wonEstimates.length,
        value: Math.round(wonEstimateValue),
        share: percent(wonEstimateValue, estimateOutcomeValue),
      },
      {
        status: "Lost",
        count: lostEstimates.length,
        value: Math.round(lostEstimateValue),
        share: percent(lostEstimateValue, estimateOutcomeValue),
      },
    ];

    const customerRevenue = new Map<
      string,
      { id: string; customerId: string | null; name: string; revenue: number; invoices: number; balance: number }
    >();

    for (const invoice of periodInvoices) {
      const name = invoice.customerName?.trim() || "Unassigned customer";
      const id = invoice.customerId ?? `name:${name.toLocaleLowerCase()}`;
      const current = customerRevenue.get(id) ?? {
        id,
        customerId: invoice.customerId,
        name,
        revenue: 0,
        invoices: 0,
        balance: 0,
      };
      current.invoices += 1;
      current.revenue += money(invoice.finalCost);
      current.balance += money(invoice.balanceDue);
      customerRevenue.set(id, current);
    }

    const totalCustomerRevenue = [...customerRevenue.values()].reduce((total, customer) => total + customer.revenue, 0);
    const topCustomers = [...customerRevenue.values()]
      .filter((customer) => customer.invoices > 0 || customer.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((customer) => ({
        ...customer,
        revenue: Math.round(customer.revenue),
        balance: Math.round(customer.balance),
        share: percent(customer.revenue, totalCustomerRevenue),
      }));

    const employeeHoursMap = new Map<
      string,
      { id: string; name: string; active: boolean; accentColor: string; hours: number }
    >();

    for (const entry of periodEntries) {
      const employee = entry.employee;
      const current = employeeHoursMap.get(employee.id) ?? {
        id: employee.id,
        name: employee.name,
        active: employee.active,
        accentColor: employee.accentColor,
        hours: 0,
      };
      current.hours += money(entry.hours);
      employeeHoursMap.set(employee.id, current);
    }

    const totalEmployeeHours = [...employeeHoursMap.values()].reduce((total, employee) => total + employee.hours, 0);
    const employeeHours = [...employeeHoursMap.values()]
      .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name))
      .map((employee) => ({
        ...employee,
        hours: Math.round(employee.hours * 10) / 10,
        share: percent(employee.hours, totalEmployeeHours),
      }));

    return {
      billed: Math.round(periodInvoices.reduce((total, invoice) => total + money(invoice.finalCost), 0)),
      collected: Math.round(periodPayments.reduce((total, payment) => total + money(payment.amount), 0)),
      payments: periodPayments.length,
      estimateWinRate: percent(wonEstimateValue, decidedEstimateValue),
      estimateOutcomes,
      topCustomers,
      employeeHours,
    };
  }

  const reportingPeriods = {
    6: buildReportingPeriod(sixMonthStart),
    12: buildReportingPeriod(twelveMonthStart),
  };

  return {
    companyName,
    generatedAt: new Date().toISOString(),
    totals: {
      openJobs: openJobs.length,
      openWorkValue: Math.round(openWorkValue),
      waitingEstimateCount: waitingEstimates.length,
      waitingEstimateValue: Math.round(waitingEstimateValue),
      invoices: invoiceTotals._count._all,
      receivablesTotal: Math.round(receivablesTotal),
      collectionRate,
    },
    monthlyFlow,
    jobStatus,
    reportingPeriods,
  };
}

export default async function Page() {
  const authorization = await getCurrentDashboardAuthorization();

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Sign in to view business performance"
        description="Your company performance reporting is private to your signed-in account."
      />
    );
  }

  const data = await getCommandCenterData(
    authorization.workspaceId,
    authorization.membership.workspaceName,
    authorization.membership,
  );

  return <CommandCenterDashboard data={data} />;
}
