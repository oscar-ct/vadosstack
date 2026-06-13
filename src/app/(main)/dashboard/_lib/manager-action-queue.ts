import { addMonths, differenceInCalendarDays, format, isAfter, startOfToday, subDays } from "date-fns";

import { prisma } from "@/lib/prisma";

const FOLLOW_UP_ESTIMATE_STATUSES = new Set(["Estimate Provided", "Waiting on Customer"]);
const READY_ESTIMATE_STATUSES = new Set(["Ready to Send"]);

type QueueSeverity = "amber" | "cyan" | "emerald" | "rose";

export type ManagerActionQueueItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  href: string;
  priority: string;
  severity: QueueSeverity;
  value: string | number;
};

type MoneyValue = { toString(): string } | number | string | null | undefined;

type QueueLead = {
  id: string;
  name: string | null;
  source: string | null;
  serviceType: string | null;
  estimatedValue: MoneyValue;
  status: string;
  followUpAt: Date | null;
  createdAt: Date;
};

type QueueJob = {
  id: string;
  description: string | null;
  status: string;
  customerId: string | null;
  finalCost: MoneyValue;
  amountPaid: MoneyValue;
  updatedAt: Date;
  customer: {
    name: string;
  } | null;
  invoice: {
    id: string;
  } | null;
};

type QueueEstimate = {
  id: string;
  description: string | null;
  status: string;
  estimatedTotal: MoneyValue;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    name: string;
  } | null;
};

type QueueTimeRequest = {
  id: string;
  action: string;
  hours: MoneyValue;
  requestedAt: Date;
  workedOn: Date | null;
  employee: {
    name: string;
  };
};

function money(value: MoneyValue) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactTitle(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.length > 76 ? `${trimmed.slice(0, 73)}...` : trimmed;
}

function formatTimeRequestAction(action: string) {
  const normalizedAction = action.toLowerCase();

  if (normalizedAction === "create") {
    return "new time entry";
  }

  if (normalizedAction === "edit" || normalizedAction === "update") {
    return "time edit";
  }

  if (normalizedAction === "delete") {
    return "time deletion";
  }

  return normalizedAction;
}

export function buildManagerActionQueue({
  estimates,
  jobs,
  leads,
  limit = 8,
  timeRequests,
}: {
  estimates: QueueEstimate[];
  jobs: QueueJob[];
  leads: QueueLead[];
  limit?: number;
  timeRequests: QueueTimeRequest[];
}): ManagerActionQueueItem[] {
  const today = startOfToday();
  const staleCutoff = subDays(today, 14);

  const pendingTimeRequests = timeRequests.filter((request) => request.action && request);
  const staleEstimates = estimates
    .filter((estimate) => FOLLOW_UP_ESTIMATE_STATUSES.has(estimate.status) && estimate.createdAt < staleCutoff)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const readyEstimates = estimates
    .filter((estimate) => READY_ESTIMATE_STATUSES.has(estimate.status))
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  const unscheduledJobs = jobs
    .filter((job) => job.status === "Unscheduled")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const onHoldJobs = jobs
    .filter((job) => job.status === "On Hold")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const jobsMissingFinalPrice = jobs
    .filter((job) => job.status !== "Cancelled")
    .filter((job) => !job.invoice && job.customerId && money(job.finalCost) <= 0)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const billableJobsWithBalance = jobs
    .filter((job) => job.status !== "Cancelled")
    .filter((job) => Math.max(0, money(job.finalCost) - money(job.amountPaid)) > 0);
  const readyToInvoiceJobs = billableJobsWithBalance
    .filter((job) => !job.invoice && job.customerId && money(job.finalCost) > 0)
    .sort(
      (a, b) =>
        Math.max(0, money(b.finalCost) - money(b.amountPaid)) - Math.max(0, money(a.finalCost) - money(a.amountPaid)),
    );
  const unpaidInvoicedJobs = billableJobsWithBalance
    .filter((job) => job.invoice)
    .sort(
      (a, b) =>
        Math.max(0, money(b.finalCost) - money(b.amountPaid)) - Math.max(0, money(a.finalCost) - money(a.amountPaid)),
    );
  const openLeadFollowUps = leads
    .filter((lead) => lead.status !== "Won" && lead.status !== "Lost")
    .filter((lead) => lead.followUpAt && !isAfter(lead.followUpAt, addMonths(today, 1)))
    .sort((a, b) => (a.followUpAt?.getTime() ?? 0) - (b.followUpAt?.getTime() ?? 0));
  const openLeadFollowUpIds = new Set(openLeadFollowUps.map((lead) => lead.id));
  const newLeads = leads
    .filter((lead) => lead.status === "New")
    .filter((lead) => !openLeadFollowUpIds.has(lead.id))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return [
    ...openLeadFollowUps.slice(0, 4).map((lead) => ({
      id: lead.id,
      type: "Lead",
      title: compactTitle(lead.name, "Lead needs follow-up"),
      detail: lead.followUpAt
        ? `${lead.serviceType ?? "Inquiry"} · follow up ${format(lead.followUpAt, "MMM d")}`
        : `${lead.serviceType ?? "Inquiry"} · follow-up date not set`,
      href: `/dashboard/leads/${lead.id}`,
      priority: "Follow up",
      severity: "cyan" as const,
      value: lead.estimatedValue ? Math.round(money(lead.estimatedValue)) : "Lead",
    })),
    ...newLeads.slice(0, 3).map((lead) => ({
      id: lead.id,
      type: "Lead",
      title: compactTitle(lead.name, "New lead"),
      detail: `${lead.source ?? "Unknown source"} · ${lead.serviceType ?? "service not set"}`,
      href: `/dashboard/leads/${lead.id}`,
      priority: "Contact",
      severity: "amber" as const,
      value: lead.estimatedValue ? Math.round(money(lead.estimatedValue)) : "New",
    })),
    ...pendingTimeRequests.slice(0, 4).map((request) => ({
      id: request.id,
      type: "Time review",
      title: `${request.employee.name} requested ${formatTimeRequestAction(request.action)}`,
      detail: request.workedOn
        ? `Worked ${format(request.workedOn, "MMM d")} · submitted ${format(request.requestedAt, "MMM d")}`
        : `Submitted ${format(request.requestedAt, "MMM d")}`,
      href: `/dashboard/time-tracking?request=${request.id}`,
      priority: "Review",
      severity: "amber" as const,
      value: request.hours ? `${money(request.hours)}h` : "Pending",
    })),
    ...unscheduledJobs.slice(0, 4).map((job) => ({
      id: job.id,
      type: "Job",
      title: compactTitle(job.description, "Job needs scheduling"),
      detail: `${job.customer?.name ?? "Customer not assigned"} · no scheduled date`,
      href: `/dashboard/jobs/${job.id}`,
      priority: "Schedule",
      severity: "rose" as const,
      value: "Unscheduled",
    })),
    ...onHoldJobs.slice(0, 4).map((job) => ({
      id: job.id,
      type: "Job",
      title: compactTitle(job.description, "Job is on hold"),
      detail: `${job.customer?.name ?? "Customer not assigned"} · review blocker or next step`,
      href: `/dashboard/jobs/${job.id}`,
      priority: "Review hold",
      severity: "amber" as const,
      value: "On hold",
    })),
    ...jobsMissingFinalPrice.slice(0, 4).map((job) => ({
      id: job.id,
      type: "Invoice prep",
      title: compactTitle(job.description, "Job needs final price"),
      detail: `${job.customer?.name ?? "Customer not assigned"} · add billable totals before invoicing`,
      href: `/dashboard/jobs/${job.id}/edit`,
      priority: "Price",
      severity: "amber" as const,
      value: "No total",
    })),
    ...readyEstimates.slice(0, 4).map((estimate) => ({
      id: estimate.id,
      type: "Estimate",
      title: compactTitle(estimate.description, "Estimate ready to send"),
      detail: `${estimate.customer?.name ?? "Customer not assigned"} · ready to email`,
      href: `/dashboard/estimates/records/${estimate.id}`,
      priority: "Send",
      severity: "cyan" as const,
      value: Math.round(money(estimate.estimatedTotal)),
    })),
    ...staleEstimates.slice(0, 4).map((estimate) => ({
      id: estimate.id,
      type: "Estimate",
      title: compactTitle(estimate.description, "Estimate needs follow-up"),
      detail: `${estimate.customer?.name ?? "Customer not assigned"} · ${differenceInCalendarDays(today, estimate.createdAt)} days old`,
      href: `/dashboard/estimates/records/${estimate.id}`,
      priority: "Follow up",
      severity: "cyan" as const,
      value: Math.round(money(estimate.estimatedTotal)),
    })),
    ...readyToInvoiceJobs.slice(0, 4).map((job) => ({
      id: job.id,
      type: "Invoice prep",
      title: compactTitle(job.description, "Job ready to invoice"),
      detail: `${job.customer?.name ?? "Customer not assigned"} · balance due with no invoice`,
      href: `/dashboard/jobs/${job.id}`,
      priority: "Invoice",
      severity: "amber" as const,
      value: Math.round(Math.max(0, money(job.finalCost) - money(job.amountPaid))),
    })),
    ...unpaidInvoicedJobs.slice(0, 4).map((job) => ({
      id: job.id,
      type: "Receivable",
      title: compactTitle(job.description, "Job has balance"),
      detail: `${job.customer?.name ?? "Customer not assigned"} · invoice open with balance`,
      href: job.invoice ? `/dashboard/invoices/${job.invoice.id}` : "/dashboard/invoices",
      priority: "Collect",
      severity: "emerald" as const,
      value: Math.round(Math.max(0, money(job.finalCost) - money(job.amountPaid))),
    })),
  ].slice(0, limit);
}

export async function getManagerActionQueue(ownerId: string, limit = 8) {
  const [leads, jobs, estimates, timeRequests] = await Promise.all([
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
    prisma.timeEntryRequest.findMany({
      where: {
        ownerId,
        status: "Pending",
      },
      include: { employee: true },
      orderBy: { requestedAt: "desc" },
      take: 100,
    }),
  ]);

  return buildManagerActionQueue({
    estimates,
    jobs,
    leads,
    limit,
    timeRequests,
  });
}
