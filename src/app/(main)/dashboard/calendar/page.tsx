import { addDays, endOfYear, startOfYear } from "date-fns";

import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import {
  CalendarDashboard,
  type CalendarDashboardCustomer,
  type CalendarDashboardEvent,
} from "./_components/calendar-dashboard";
import { createCalendarTaskAction, deleteCalendarTaskAction } from "./actions";

function formatMoney(value: { toString: () => string } | null | undefined) {
  return value ? value.toString() : undefined;
}

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view calendar"
        description="Your schedule is private to each signed-in account."
      />
    );
  }

  const today = new Date();
  const windowStart = startOfYear(today);
  const windowEnd = endOfYear(addDays(today, 365));

  const [jobs, tasks, invoices, customers, unscheduledJobCount] = await Promise.all([
    prisma.job.findMany({
      where: {
        ownerId: currentUser.id,
        OR: [
          {
            dateBegin: {
              gte: windowStart,
              lte: windowEnd,
            },
          },
          {
            dateEnd: {
              gte: windowStart,
              lte: windowEnd,
            },
          },
          {
            dateBegin: {
              lte: windowStart,
            },
            dateEnd: {
              gte: windowEnd,
            },
          },
        ],
        status: {
          not: "Cancelled",
        },
      },
      include: {
        customer: true,
      },
      orderBy: [{ dateBegin: "asc" }, { createdAt: "desc" }],
    }),
    prisma.task.findMany({
      where: {
        ownerId: currentUser.id,
        scheduledFor: {
          gte: windowStart,
          lte: windowEnd,
        },
        status: {
          not: "Completed",
        },
      },
      include: {
        customer: true,
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
    }),
    prisma.invoice.findMany({
      where: {
        ownerId: currentUser.id,
        issuedAt: {
          gte: addDays(windowStart, -currentUser.invoiceDueDays),
          lte: windowEnd,
        },
      },
      orderBy: {
        issuedAt: "asc",
      },
    }),
    prisma.customer.findMany({
      where: {
        ownerId: currentUser.id,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.job.count({
      where: {
        ownerId: currentUser.id,
        status: "Unscheduled",
      },
    }),
  ]);

  const events: CalendarDashboardEvent[] = [
    ...jobs.map((job) => ({
      id: `job-${job.id}`,
      recordId: job.id,
      type: "job" as const,
      title: job.description,
      customerName: job.customer?.name ?? "Customer not assigned",
      date: job.dateBegin?.toISOString() ?? job.createdAt.toISOString(),
      endDate: job.dateEnd?.toISOString(),
      status: job.status,
      amount: formatMoney(job.finalCost) ?? formatMoney(job.estimatedCost),
      location: job.serviceLocation ?? undefined,
      href: `/dashboard/jobs?job=${job.id}`,
    })),
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      recordId: task.id,
      type: "task" as const,
      title: task.title,
      customerName: task.customer?.name ?? "Task",
      date: task.scheduledFor.toISOString(),
      status: task.priority,
      location: task.location ?? undefined,
    })),
    ...invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      recordId: invoice.id,
      type: "invoice" as const,
      title: invoice.jobTitle,
      customerName: invoice.customerName ?? "Customer not assigned",
      date: addDays(invoice.issuedAt, currentUser.invoiceDueDays).toISOString(),
      status: invoice.paymentStatus,
      amount: invoice.balanceDue.toString(),
      location: invoice.serviceLocation ?? undefined,
      href: `/dashboard/invoices?invoice=${invoice.id}`,
    })),
  ];
  const taskCustomers: CalendarDashboardCustomer[] = customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
  }));

  return (
    <CalendarDashboard
      createTaskAction={createCalendarTaskAction}
      deleteTaskAction={deleteCalendarTaskAction}
      customers={taskCustomers}
      events={events}
      unscheduledJobCount={unscheduledJobCount}
    />
  );
}
