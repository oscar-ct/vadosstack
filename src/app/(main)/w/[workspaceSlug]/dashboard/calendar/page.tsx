import { addDays, endOfYear, startOfYear } from "date-fns";

import { AuthRequiredState } from "@/components/auth-required-state";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { formatServiceAddress } from "@/lib/service-address";

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
  const authorization = await getPermittedDashboardAuthorization("calendar.view");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Calendar access required"
        description="You do not have permission to view this workspace calendar."
      />
    );
  }
  const workspaceId = authorization.workspaceId;
  const { membership } = authorization;
  const canManageCalendar = can(membership, "calendar.manage");
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { invoiceDueDays: true },
  });

  const today = new Date();
  const windowStart = startOfYear(today);
  const windowEnd = endOfYear(addDays(today, 365));

  const [jobs, tasks, invoices, customers, leads] = await Promise.all([
    can(membership, "jobs.view")
      ? prisma.job.findMany({
          where: {
            ownerId: workspaceId,
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
        })
      : Promise.resolve([]),
    prisma.task.findMany({
      where: {
        ownerId: workspaceId,
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
    can(membership, "invoices.view")
      ? prisma.invoice.findMany({
          where: {
            ownerId: workspaceId,
            issuedAt: {
              gte: addDays(windowStart, -workspace.invoiceDueDays),
              lte: windowEnd,
            },
          },
          orderBy: {
            issuedAt: "asc",
          },
        })
      : Promise.resolve([]),
    can(membership, "customers.view")
      ? prisma.customer.findMany({
          where: {
            ownerId: workspaceId,
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
        })
      : Promise.resolve([]),
    can(membership, "leads.view")
      ? prisma.lead.findMany({
          where: {
            ownerId: workspaceId,
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
            serviceAddressLine1: true,
            serviceAddressLine2: true,
            serviceCity: true,
            serviceLocation: true,
            servicePostalCode: true,
            serviceState: true,
            serviceType: true,
            status: true,
          },
        })
      : Promise.resolve([]),
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
      location: formatServiceAddress(job) ?? undefined,
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
      date: addDays(invoice.issuedAt, workspace.invoiceDueDays).toISOString(),
      status: invoice.paymentStatus,
      amount: invoice.balanceDue.toString(),
      location: formatServiceAddress(invoice) ?? undefined,
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
        locations: Array.from(
          new Set(
            customer.addresses
              .map((address) =>
                [address.line1, address.line2, address.city, address.state, address.postalCode]
                  .filter(Boolean)
                  .join(", "),
              )
              .filter(Boolean),
          ),
        ),
        meta: [customer.email, addressSummary].filter(Boolean).join(" - ") || "Customer",
      };
    }),
    ...leads.map((lead) => ({
      id: lead.id,
      kind: "lead" as const,
      label: lead.name,
      meta: [lead.serviceType, formatServiceAddress(lead), lead.email ?? lead.phone, lead.status]
        .filter(Boolean)
        .join(" - "),
    })),
  ];

  return (
    <CalendarDashboard
      canManage={canManageCalendar}
      createTaskAction={createCalendarTaskAction}
      deleteTaskAction={deleteCalendarTaskAction}
      updateTaskAction={updateCalendarTaskAction}
      contacts={taskContacts}
      events={events}
    />
  );
}
