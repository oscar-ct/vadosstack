import { startOfToday } from "date-fns";

import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { calculateOutstandingBalance, toMoneyNumber } from "@/lib/customer-billing";
import { prisma } from "@/lib/prisma";

import { getManagerActionQueue } from "../_lib/manager-action-queue";
import { OverviewV2Dashboard } from "./_components/overview-v2-dashboard";

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view overview"
        description="Your company overview is private to your signed-in account."
      />
    );
  }

  const today = startOfToday();
  const now = new Date();
  const localHour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Chicago",
    }).format(now),
  );
  const [actionQueue, leads, jobs] = await Promise.all([
    getManagerActionQueue(currentUser.id),
    prisma.lead.findMany({
      where: {
        ownerId: currentUser.id,
        status: {
          notIn: ["Won", "Lost"],
        },
      },
      orderBy: [{ followUpAt: "asc" }, { createdAt: "desc" }],
      take: 500,
    }),
    prisma.job.findMany({
      where: {
        ownerId: currentUser.id,
        status: {
          not: "Cancelled",
        },
      },
      include: {
        customer: true,
        invoice: {
          select: {
            id: true,
          },
        },
      },
      orderBy: [{ dateBegin: "asc" }, { updatedAt: "desc" }],
      take: 500,
    }),
  ]);

  const moneyItems = jobs
    .map((job) => ({
      balanceDue: calculateOutstandingBalance(
        job.status,
        toMoneyNumber(job.finalCost?.toString()),
        toMoneyNumber(job.amountPaid?.toString()),
      ),
      customerName: job.customer?.name ?? "Customer not assigned",
      href: job.invoice ? `/dashboard/invoices/${job.invoice.id}` : `/dashboard/jobs/${job.id}`,
      id: job.id,
      invoiceId: job.invoice?.id,
      title: job.description,
    }))
    .filter((job) => job.balanceDue > 0)
    .sort((a, b) => b.balanceDue - a.balanceDue);

  const scheduleItems = jobs
    .filter((job) => job.dateBegin && job.dateBegin >= today)
    .slice(0, 8)
    .map((job) => ({
      customerName: job.customer?.name ?? "Customer not assigned",
      dateBegin: job.dateBegin?.toISOString() ?? today.toISOString(),
      href: `/dashboard/jobs/${job.id}`,
      id: job.id,
      status: job.status,
      title: job.description,
    }));

  const waitingJobs = jobs
    .filter((job) => job.status === "Unscheduled" || job.status === "On Hold")
    .slice(0, 8)
    .map((job) => ({
      customerName: job.customer?.name ?? "Customer not assigned",
      href: `/dashboard/jobs/${job.id}`,
      id: job.id,
      status: job.status,
      title: job.description,
    }));

  const outstandingTotal = moneyItems.reduce((total, item) => total + item.balanceDue, 0);
  const unscheduledCount = jobs.filter((job) => job.status === "Unscheduled").length;
  const onHoldCount = jobs.filter((job) => job.status === "On Hold").length;

  return (
    <OverviewV2Dashboard
      actionQueue={actionQueue}
      companyName={currentUser.companyName}
      dateLabel={new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "long",
        timeZone: "America/Chicago",
        weekday: "long",
      }).format(now)}
      displayName={getDisplayName(currentUser).split(" ")[0]}
      greeting={localHour < 12 ? "Good morning" : localHour < 18 ? "Good afternoon" : "Good evening"}
      leadFollowUpCount={leads.filter((lead) => lead.followUpAt).length}
      leadNewCount={leads.filter((lead) => lead.status === "New").length}
      moneyItems={moneyItems}
      onHoldCount={onHoldCount}
      openLeadCount={leads.length}
      outstandingTotal={outstandingTotal}
      scheduleItems={scheduleItems}
      timeLabel={new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Chicago",
      }).format(now)}
      unscheduledCount={unscheduledCount}
      waitingJobs={waitingJobs}
    />
  );
}
