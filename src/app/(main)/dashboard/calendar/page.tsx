import { addDays, endOfYear, startOfYear } from "date-fns";

import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import {
  CalendarDashboard,
  type CalendarDashboardContact,
  type CalendarDashboardEvent,
} from "./_components/calendar-dashboard";
import { createCalendarTaskAction, deleteCalendarTaskAction, updateCalendarTaskAction } from "./actions";

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

  const [jobs, tasks, invoices, customers, leads, unscheduledJobCount] = await Promise.all([
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
        lead: true,
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
        email: true,
        addresses: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            city: true,
            line1: true,
            line2: true,
            postalCode: true,
            state: true,
          },
        },
      },
    }),
    prisma.lead.findMany({
      where: {
        ownerId: currentUser.id,
        status: {
          notIn: ["Won", "Lost"],
        },
      },
      orderBy: [{ followUpAt: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        serviceLocation: true,
        serviceType: true,
        status: true,
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
      href: `/dashboard/jobs/${job.id}`,
    })),
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      recordId: task.id,
      type: "task" as const,
      title: task.title,
      customerName: task.customer?.name ?? task.lead?.name ?? "Task",
      customerId: task.customerId ?? undefined,
      date: task.scheduledFor.toISOString(),
      leadId: task.leadId ?? undefined,
      notes: task.notes ?? undefined,
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
  const taskContacts: CalendarDashboardContact[] = [
    ...customers.map((customer) => {
      const primaryAddress = customer.addresses[0];
      const addressSummary = primaryAddress
        ? [
            primaryAddress.line1,
            primaryAddress.line2,
            primaryAddress.city,
            primaryAddress.state,
            primaryAddress.postalCode,
          ]
            .filter(Boolean)
            .join(", ")
        : undefined;

      return {
        id: customer.id,
        kind: "customer" as const,
        label: customer.name,
        meta: [customer.email, addressSummary].filter(Boolean).join(" - ") || "Customer",
      };
    }),
    ...leads.map((lead) => ({
      id: lead.id,
      kind: "lead" as const,
      label: lead.name,
      meta: [lead.serviceType, lead.serviceLocation, lead.email ?? lead.phone, lead.status].filter(Boolean).join(" - "),
    })),
  ];

  return (
    <CalendarDashboard
      createTaskAction={createCalendarTaskAction}
      deleteTaskAction={deleteCalendarTaskAction}
      updateTaskAction={updateCalendarTaskAction}
      contacts={taskContacts}
      events={events}
      unscheduledJobCount={unscheduledJobCount}
    />
  );
}
