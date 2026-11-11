import { Temporal } from "temporal-polyfill";

import { AuthRequiredState } from "@/components/auth-required-state";
import { can, getPermittedDashboardAuthorization, type WorkspaceMembershipSummary } from "@/lib/authorization";
import {
  businessDateKey,
  businessDayStart,
  calendarDateKey,
  DEFAULT_BUSINESS_TIME_ZONE,
  formatCalendarDate,
} from "@/lib/business-time";
import { getNetPaymentMinorUnits } from "@/lib/payments/domain";
import { allocatePaymentSalesTax } from "@/lib/payments/sales-tax";
import {
  buildPerformancePeriods,
  inPerformancePeriod,
  isPerformanceInvoiceOverdue,
  type PerformancePeriod,
  performancePeriodRange,
} from "@/lib/performance-periods";
import { prisma } from "@/lib/prisma";

import { CommandCenterDashboard, type CommandCenterData } from "./command-center-dashboard";

const WON_ESTIMATE_STATUSES = new Set(["Converted", "Approved", "Accepted", "Won"]);
const LOST_ESTIMATE_STATUSES = new Set(["Declined", "Cancelled", "Lost"]);
const FOLLOW_UP_ESTIMATE_STATUSES = new Set(["Estimate Provided", "Waiting on Customer"]);
const JOB_STATUSES = ["Completed", "Scheduled", "Unscheduled", "On Hold", "Cancelled"] as const;

function money(value: { toString(): string } | number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function netPaymentMoney(payment: {
  amount: { toString(): string };
  refundedAmount: { toString(): string };
  status: string;
}) {
  return (
    getNetPaymentMinorUnits({
      amount: payment.amount.toString(),
      refundedAmount: payment.refundedAmount.toString(),
      status: payment.status,
    }) / 100
  );
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
): Promise<CommandCenterData> {
  const today = new Date();
  const mayRead = (permission: Parameters<typeof can>[1]) => !membership || can(membership, permission);
  const canViewEstimates = mayRead("estimates.view");
  const canViewInvoices = mayRead("invoices.view");
  const canViewJobs = mayRead("jobs.view");
  const canViewTime = mayRead("time.view");

  const [jobs, estimates, recentInvoices, recentPayments, timeEntries] = await Promise.all([
    canViewJobs
      ? prisma.job.findMany({
          where: { ownerId },
          select: {
            dateBegin: true,
            jobType: true,
            estimatedCost: true,
            finalCost: true,
            status: true,
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
      ? prisma.invoice.findMany({
          where: { ownerId },
          select: {
            id: true,
            jobId: true,
            laborCost: true,
            materialsSubtotal: true,
            materialTaxAmount: true,
            otherFeesEnabled: true,
            otherFeesAmount: true,

            balanceDue: true,
            customerId: true,
            customerName: true,
            finalCost: true,
            issuedAt: true,
            dueAt: true,
          },
        })
      : Promise.resolve([]),
    canViewInvoices
      ? prisma.jobPayment.findMany({
          where: {
            ownerId,
            status: { in: ["succeeded", "partially_refunded"] },
          },
          select: {
            id: true,
            jobId: true,
            createdAt: true,
            amount: true,
            paidOn: true,
            refundedAmount: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    canViewTime
      ? prisma.timeEntry.findMany({
          where: {
            ownerId,
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

  const waitingEstimates = estimates.filter((estimate) => FOLLOW_UP_ESTIMATE_STATUSES.has(estimate.status));
  const waitingEstimateValue = waitingEstimates.reduce((total, estimate) => total + money(estimate.estimatedTotal), 0);

  const taxAllocations = allocatePaymentSalesTax(recentPayments, recentInvoices);
  const invoicedJobs = new Set(recentInvoices.map((invoice) => invoice.jobId));
  const periods = buildPerformancePeriods(
    today,
    [
      ...recentInvoices.map((invoice) => invoice.issuedAt),
      ...recentPayments.map((payment) => businessDayStart(calendarDateKey(payment.paidOn), timeZone)),
      ...timeEntries.map((entry) => businessDayStart(calendarDateKey(entry.workedOn), timeZone)),
      ...jobs.flatMap((job) => (job.dateBegin ? [businessDayStart(calendarDateKey(job.dateBegin), timeZone)] : [])),
      ...estimates.flatMap((estimate) => (estimate.decidedAt ? [estimate.decidedAt] : [])),
    ],
    timeZone,
  );

  function buildReportingPeriod(period: PerformancePeriod) {
    const periodInvoices = recentInvoices.filter((invoice) => inPerformancePeriod(invoice.issuedAt, period));
    const overdueInvoices = periodInvoices.filter(
      (invoice) => money(invoice.balanceDue) > 0 && isPerformanceInvoiceOverdue(invoice.dueAt, today, timeZone),
    );
    const periodPayments = recentPayments.filter((payment) => inPerformancePeriod(payment.paidOn, period, true));
    const invoicePayments = periodPayments.filter((payment) => invoicedJobs.has(payment.jobId));
    const periodEntries = timeEntries.filter((entry) => inPerformancePeriod(entry.workedOn, period, true));
    const periodJobs = jobs.filter(
      (job) => inPerformancePeriod(job.dateBegin, period, true) || (period.key === "all" && !job.dateBegin),
    );
    const periodDecisions = estimates.filter((estimate) => inPerformancePeriod(estimate.decidedAt, period));
    const months: Date[] = [];
    for (
      let month = Temporal.PlainDate.from(businessDateKey(period.start, timeZone)).with({ day: 1 });
      businessDayStart(month.toString(), timeZone) < period.end;
      month = month.add({ months: 1 })
    )
      months.push(businessDayStart(month.toString(), timeZone));
    const monthlyFlow = months.map((month) => {
      const key = businessDateKey(month, timeZone).slice(0, 7);
      return {
        month: formatCalendarDate(`${key}-01`, "MMM yy"),
        billed: roundMoney(
          periodInvoices
            .filter((invoice) => businessDateKey(invoice.issuedAt, timeZone).slice(0, 7) === key)
            .reduce((sum, invoice) => sum + money(invoice.finalCost), 0),
        ),
        collected: roundMoney(
          invoicePayments
            .filter((payment) => calendarDateKey(payment.paidOn).slice(0, 7) === key)
            .reduce((sum, payment) => sum + netPaymentMoney(payment), 0),
        ),
        receivable: roundMoney(
          periodInvoices
            .filter((invoice) => businessDateKey(invoice.issuedAt, timeZone).slice(0, 7) === key)
            .reduce((sum, invoice) => sum + Math.max(0, money(invoice.balanceDue)), 0),
        ),
        hours: roundMoney(
          periodEntries
            .filter((entry) => calendarDateKey(entry.workedOn).slice(0, 7) === key)
            .reduce((sum, entry) => sum + money(entry.hours), 0),
        ),
      };
    });
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
        revenue: roundMoney(customer.revenue),
        balance: roundMoney(customer.balance),
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
        hours: roundMoney(employee.hours),
        share: percent(employee.hours, totalEmployeeHours),
      }));

    return {
      jobStatus: JOB_STATUSES.map((status) => {
        const matching = periodJobs.filter((job) => job.status === status);
        return {
          status,
          value: matching.length,
          amount: roundMoney(matching.reduce((sum, job) => sum + money(job.finalCost ?? job.estimatedCost), 0)),
        };
      }),
      label: period.label,
      range: performancePeriodRange(period),
      monthlyFlow,
      billed: roundMoney(periodInvoices.reduce((total, invoice) => total + money(invoice.finalCost), 0)),
      collected: roundMoney(invoicePayments.reduce((total, payment) => total + netPaymentMoney(payment), 0)),
      payments: invoicePayments.length,
      outstanding: roundMoney(periodInvoices.reduce((sum, invoice) => sum + Math.max(0, money(invoice.balanceDue)), 0)),
      overdue: roundMoney(overdueInvoices.reduce((sum, invoice) => sum + money(invoice.balanceDue), 0)),
      overdueInvoices: overdueInvoices.length,
      taxBilled: roundMoney(periodInvoices.reduce((sum, invoice) => sum + money(invoice.materialTaxAmount), 0)),
      feesBilled: roundMoney(
        periodInvoices.reduce(
          (sum, invoice) => sum + (invoice.otherFeesEnabled ? money(invoice.otherFeesAmount) : 0),
          0,
        ),
      ),
      labor: roundMoney(periodInvoices.reduce((sum, invoice) => sum + money(invoice.laborCost), 0)),
      materials: roundMoney(periodInvoices.reduce((sum, invoice) => sum + money(invoice.materialsSubtotal), 0)),
      taxCollected: invoicePayments.reduce((sum, payment) => sum + (taxAllocations.get(payment.id) ?? 0), 0) / 100,
      uninvoicedPayments: roundMoney(
        periodPayments
          .filter((payment) => !invoicedJobs.has(payment.jobId))
          .reduce((sum, payment) => sum + netPaymentMoney(payment), 0),
      ),
      invoices: periodInvoices.length,
      jobs: periodJobs.length,
      completedJobs: periodJobs.filter((job) => job.status === "Completed").length,
      residentialJobs: periodJobs.filter((job) => job.jobType === "Residential").length,
      commercialJobs: periodJobs.filter((job) => job.jobType === "Commercial").length,
      unscheduledJobs:
        period.key === "all"
          ? periodJobs.filter((job) => !job.dateBegin).length
          : jobs.filter((job) => !job.dateBegin).length,
      hours: roundMoney(totalEmployeeHours),
      estimateWinRate: percent(wonEstimateValue, decidedEstimateValue),
      estimateOutcomes,
      topCustomers,
      employeeHours,
    };
  }

  const reportingPeriods = Object.fromEntries(periods.map((period) => [period.key, buildReportingPeriod(period)]));

  return {
    companyName,
    generatedAt: new Date().toISOString(),
    reportingPeriods,
    permissions: { invoices: canViewInvoices, jobs: canViewJobs, time: canViewTime, estimates: canViewEstimates },
  };
}

export default async function Page({ searchParams }: { searchParams?: Promise<{ period?: string }> }) {
  const authorization = await getPermittedDashboardAuthorization("dashboard.performance.view");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Sign in to view business performance"
        description="Your company performance reporting is private to your signed-in account."
      />
    );
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: authorization.workspaceId },
    select: { timeZone: true },
  });
  const data = await getCommandCenterData(
    authorization.workspaceId,
    authorization.membership.workspaceName,
    authorization.membership,
    workspace.timeZone,
  );

  const params = await searchParams;
  return <CommandCenterDashboard data={data} initialPeriod={params?.period} />;
}
