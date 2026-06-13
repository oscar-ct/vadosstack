import { addMonths, endOfMonth, format, isAfter, isBefore, startOfMonth, startOfToday, subMonths } from "date-fns";

import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { buildManagerActionQueue } from "../_lib/manager-action-queue";
import { CommandCenterDashboard, type CommandCenterData } from "./_components/command-center-dashboard";

export const dynamic = "force-dynamic";

const ACTIVE_JOB_STATUSES = new Set(["Scheduled"]);
const WON_ESTIMATE_STATUSES = new Set(["Converted", "Approved", "Accepted", "Won"]);
const LOST_ESTIMATE_STATUSES = new Set(["Declined", "Cancelled", "Lost"]);
const FOLLOW_UP_ESTIMATE_STATUSES = new Set(["Estimate Provided", "Waiting on Customer"]);

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

async function getCommandCenterData(ownerId: string, companyName: string): Promise<CommandCenterData> {
  const today = startOfToday();
  const sixMonthStart = startOfMonth(subMonths(today, 5));

  const [customers, leads, jobs, estimates, invoices, timeRequests, timeEntries, activeEmployees] = await Promise.all([
    prisma.customer.findMany({
      where: { ownerId },
      select: {
        id: true,
        name: true,
        joinedAt: true,
      },
      orderBy: { joinedAt: "desc" },
      take: 500,
    }),
    prisma.lead.findMany({
      where: { ownerId },
      orderBy: [{ followUpAt: "asc" }, { createdAt: "desc" }],
      take: 500,
    }),
    prisma.job.findMany({
      where: { ownerId },
      include: {
        customer: true,
        invoice: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    prisma.estimateRecord.findMany({
      where: { ownerId },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.invoice.findMany({
      where: { ownerId },
      orderBy: { issuedAt: "desc" },
      take: 500,
    }),
    prisma.timeEntryRequest.findMany({
      where: { ownerId },
      include: { employee: true },
      orderBy: { requestedAt: "desc" },
      take: 100,
    }),
    prisma.timeEntry.findMany({
      where: {
        ownerId,
        workedOn: {
          gte: sixMonthStart,
        },
      },
      include: { employee: true },
      orderBy: { workedOn: "desc" },
      take: 500,
    }),
    prisma.employee.count({
      where: {
        ownerId,
        active: true,
      },
    }),
  ]);

  const issuedTotal = invoices.reduce((total, invoice) => total + money(invoice.finalCost), 0);
  const receivablesTotal = invoices.reduce((total, invoice) => total + money(invoice.balanceDue), 0);
  const collectedTotal = invoices.reduce((total, invoice) => total + money(invoice.amountPaid), 0);
  const activeJobs = jobs.filter((job) => ACTIVE_JOB_STATUSES.has(job.status));
  const completedJobs = jobs.filter((job) => job.status === "Completed");
  const pendingTimeRequests = timeRequests.filter((request) => request.status === "Pending");
  const waitingEstimates = estimates.filter((estimate) => FOLLOW_UP_ESTIMATE_STATUSES.has(estimate.status));
  const wonEstimates = estimates.filter(
    (estimate) => WON_ESTIMATE_STATUSES.has(estimate.status) || Boolean(estimate.convertedJobId),
  );
  const lostEstimates = estimates.filter((estimate) => LOST_ESTIMATE_STATUSES.has(estimate.status));
  const estimateOutcomeValue = [...waitingEstimates, ...wonEstimates, ...lostEstimates].reduce(
    (total, estimate) => total + money(estimate.estimatedTotal),
    0,
  );
  const waitingEstimateValue = waitingEstimates.reduce((total, estimate) => total + money(estimate.estimatedTotal), 0);
  const wonEstimateValue = wonEstimates.reduce((total, estimate) => total + money(estimate.estimatedTotal), 0);
  const lostEstimateValue = lostEstimates.reduce((total, estimate) => total + money(estimate.estimatedTotal), 0);
  const estimateOutcomeCount = waitingEstimates.length + wonEstimates.length + lostEstimates.length;
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
  ].filter((item) => item.count > 0 || item.value > 0);
  const totalEstimateDecisionValue = estimates
    .filter(
      (estimate) =>
        FOLLOW_UP_ESTIMATE_STATUSES.has(estimate.status) ||
        WON_ESTIMATE_STATUSES.has(estimate.status) ||
        LOST_ESTIMATE_STATUSES.has(estimate.status) ||
        Boolean(estimate.convertedJobId),
    )
    .reduce((total, estimate) => total + money(estimate.estimatedTotal), 0);
  const completionRate = percent(completedJobs.length, jobs.filter((job) => job.status !== "Cancelled").length);
  const estimateWinRate = percent(wonEstimateValue, totalEstimateDecisionValue);
  const collectionRate = percent(collectedTotal, issuedTotal);
  const scheduledNext30 = jobs.filter((job) => {
    if (!job.dateBegin || job.status === "Cancelled") {
      return false;
    }

    return !isBefore(job.dateBegin, today) && isBefore(job.dateBegin, addMonths(today, 1));
  });

  const monthlyFlow = Array.from({ length: 6 }, (_, index) => {
    const monthStart = startOfMonth(subMonths(today, 5 - index));
    const monthEnd = endOfMonth(monthStart);
    const monthInvoices = invoices.filter(
      (invoice) => !isBefore(invoice.issuedAt, monthStart) && !isAfter(invoice.issuedAt, monthEnd),
    );
    const monthEntries = timeEntries.filter(
      (entry) => !isBefore(entry.workedOn, monthStart) && !isAfter(entry.workedOn, monthEnd),
    );

    return {
      month: format(monthStart, "MMM"),
      billed: Math.round(monthInvoices.reduce((total, invoice) => total + money(invoice.finalCost), 0)),
      collected: Math.round(monthInvoices.reduce((total, invoice) => total + money(invoice.amountPaid), 0)),
      receivable: Math.round(monthInvoices.reduce((total, invoice) => total + money(invoice.balanceDue), 0)),
      hours: Math.round(monthEntries.reduce((total, entry) => total + money(entry.hours), 0) * 10) / 10,
    };
  });

  const customerRevenue = new Map<
    string,
    { id: string; name: string; revenue: number; jobs: number; balance: number }
  >();

  for (const customer of customers) {
    customerRevenue.set(customer.id, {
      id: customer.id,
      name: customer.name,
      revenue: 0,
      jobs: 0,
      balance: 0,
    });
  }

  for (const job of jobs) {
    if (!job.customerId) {
      continue;
    }

    const current = customerRevenue.get(job.customerId) ?? {
      id: job.customerId,
      name: job.customer?.name ?? "Unassigned customer",
      revenue: 0,
      jobs: 0,
      balance: 0,
    };

    current.jobs += 1;
    current.revenue += money(job.finalCost);
    current.balance += Math.max(0, money(job.finalCost) - money(job.amountPaid));
    customerRevenue.set(job.customerId, current);
  }

  const totalCustomerJobRevenue = [...customerRevenue.values()].reduce(
    (total, customer) => total + customer.revenue,
    0,
  );
  const topCustomers = [...customerRevenue.values()]
    .filter((customer) => customer.jobs > 0 || customer.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((customer) => ({
      ...customer,
      revenue: Math.round(customer.revenue),
      balance: Math.round(customer.balance),
      share: percent(customer.revenue, totalCustomerJobRevenue),
    }));

  const jobStatusMap = new Map<string, { status: string; value: number; amount: number }>();

  for (const job of jobs) {
    const current = jobStatusMap.get(job.status) ?? { status: job.status, value: 0, amount: 0 };
    current.value += 1;
    current.amount += money(job.finalCost ?? job.estimatedCost);
    jobStatusMap.set(job.status, current);
  }

  const jobStatus = [...jobStatusMap.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((item) => ({
      ...item,
      amount: Math.round(item.amount),
    }));

  const categoryMap = new Map<string, { category: string; jobs: number; value: number }>();

  for (const job of jobs.filter((job) => job.status !== "Cancelled")) {
    const category = job.category || "Other";
    const current = categoryMap.get(category) ?? { category, jobs: 0, value: 0 };
    current.jobs += 1;
    current.value += money(job.finalCost ?? job.estimatedCost);
    categoryMap.set(category, current);
  }

  const serviceMix = [...categoryMap.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      value: Math.round(item.value),
      share: percent(
        item.value,
        [...categoryMap.values()].reduce((total, category) => total + category.value, 0),
      ),
    }));

  const actionQueue = buildManagerActionQueue({
    estimates,
    jobs,
    leads,
    timeRequests: pendingTimeRequests,
  });

  return {
    companyName,
    generatedAt: new Date().toISOString(),
    totals: {
      customers: customers.length,
      leads: leads.length,
      activeEmployees,
      jobs: jobs.length,
      activeJobs: activeJobs.length,
      scheduledNext30: scheduledNext30.length,
      estimates: estimates.length,
      estimateOutcomeCount,
      waitingEstimateValue: Math.round(waitingEstimateValue),
      invoices: invoices.length,
      issuedTotal: Math.round(issuedTotal),
      collectedTotal: Math.round(collectedTotal),
      receivablesTotal: Math.round(receivablesTotal),
      pendingTimeReviews: pendingTimeRequests.length,
      hoursLogged: Math.round(timeEntries.reduce((total, entry) => total + money(entry.hours), 0) * 10) / 10,
      completionRate,
      estimateWinRate,
      collectionRate,
    },
    monthlyFlow,
    estimateOutcomes,
    topCustomers,
    jobStatus,
    serviceMix,
    actionQueue,
  };
}

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view command center"
        description="Your company command center is private to your signed-in account."
      />
    );
  }

  const data = await getCommandCenterData(currentUser.id, currentUser.companyName);

  return <CommandCenterDashboard data={data} />;
}
