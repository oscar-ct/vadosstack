import { addDays } from "date-fns";

import { AuthRequiredState } from "@/components/auth-required-state";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { calculateOutstandingBalance } from "@/lib/customer-billing";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { parseWorkspaceMode, type WorkspaceMode } from "@/lib/workspace-mode";

import type { RecentCustomerRow } from "./_components/recent-customers-table/schema";
import { SubscriberOverview } from "./_components/subscriber-overview";
import { createCustomerAction } from "./actions";

function formatMoney(value: { toString: () => string } | null) {
  return value ? `$${value.toString()}` : undefined;
}

function formatCurrencyValue(value: number) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(value);
}

function getJobActivityDate(job: { dateBegin: Date | null; createdAt: Date }) {
  return job.dateBegin ?? job.createdAt;
}

async function getCustomers(
  ownerId: string,
  invoiceDueDays: number,
  access: { invoices: boolean; jobs: boolean; orders: boolean },
): Promise<RecentCustomerRow[]> {
  const customers = await prisma.customer.findMany({
    where: {
      ownerId,
    },
    include: {
      addresses: true,
      phoneNumbers: true,
      jobs: {
        where: access.jobs ? undefined : { id: { in: [] } },
        include: {
          invoice: access.invoices,
        },
      },
      orders: {
        where: access.orders ? undefined : { id: { in: [] } },
        include: {
          items: true,
          returns: {
            orderBy: {
              returnDate: "desc",
            },
          },
        },
        orderBy: {
          orderDate: "desc",
        },
      },
    },
    orderBy: {
      joinedAt: "desc",
    },
  });

  return customers.map((customer) => {
    const jobHistory = customer.jobs
      .map((job) => {
        const outstandingBalance = calculateOutstandingBalance(
          job.status,
          job.finalCost?.toString(),
          job.amountPaid?.toString(),
        );

        return {
          id: job.id,
          title: job.description,
          status: job.status,
          date: getJobActivityDate(job).toISOString(),
          total: formatMoney(job.finalCost) ?? formatMoney(job.estimatedCost),
          amountPaid: formatMoney(job.amountPaid),
          paymentStatus: job.paymentStatus,
          outstandingAmount: outstandingBalance > 0 ? `$${outstandingBalance.toFixed(2)}` : undefined,
          linkedJobId: job.id,
        };
      })
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
    const invoiceHistory = customer.jobs
      .map((job) => job.invoice)
      .filter((invoice) => invoice !== null)
      .sort((left, right) => right.issuedAt.getTime() - left.issuedAt.getTime())
      .map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber ?? undefined,
        status: invoice.paymentStatus,
        issuedAt: invoice.issuedAt.toISOString(),
        dueAt: addDays(invoice.issuedAt, invoiceDueDays).toISOString(),
        total: formatMoney(invoice.finalCost) ?? "$0",
        balance: formatMoney(invoice.balanceDue) ?? "$0",
        balanceValue: Number(invoice.balanceDue),
      }));
    const unpaidInvoices = invoiceHistory
      .filter((invoice) => invoice.balanceValue > 0)
      .map((invoice) => ({
        id: invoice.id,
        title: invoice.invoiceNumber ?? "Invoice",
        status: invoice.status,
        dueAt: invoice.dueAt,
        balance: invoice.balance,
        paymentStatus: invoice.status,
        linkedInvoiceId: invoice.id,
      }));
    const latestJobDate = jobHistory[0]?.date;
    const outstandingAmount = unpaidInvoices.reduce(
      (total, invoice) => total + Number(invoice.balance.replace("$", "")),
      0,
    );
    const orderHistory = customer.orders.map((order) => {
      const orderReturn = order.returns[0];
      const refundAmount = orderReturn ? Number(orderReturn.refundAmount) : 0;

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        orderedAt: order.orderDate.toISOString(),
        total: formatCurrencyValue(Number(order.total)),
        totalValue: Number(order.total),
        itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
        returnNumber: orderReturn?.returnNumber ?? undefined,
        refundAmount: orderReturn ? formatCurrencyValue(refundAmount) : undefined,
        refundAmountValue: orderReturn ? refundAmount : undefined,
        refundStatus: orderReturn?.refundStatus ?? undefined,
      };
    });
    const totalOrderSpent = orderHistory.reduce((total, order) => total + order.totalValue, 0);
    const totalOrderRefunded = orderHistory.reduce((total, order) => total + (order.refundAmountValue ?? 0), 0);

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email ?? "",
      billing: unpaidInvoices.length ? "Outstanding Balance" : "No Balance",
      joined: customer.joinedAt.toISOString(),
      lastScheduledJobDate: latestJobDate,
      jobCount: customer.jobs.length,
      lastOrderDate: orderHistory[0]?.orderedAt,
      orderCount: orderHistory.length,
      returnedOrderCount: orderHistory.filter((order) => order.returnNumber).length,
      totalOrderRefunded: formatCurrencyValue(totalOrderRefunded),
      totalOrderRefundedValue: totalOrderRefunded,
      totalOrderSpent: formatCurrencyValue(totalOrderSpent),
      totalOrderSpentValue: totalOrderSpent,
      outstandingAmount: outstandingAmount > 0 ? `$${outstandingAmount.toFixed(2)}` : undefined,
      addresses: customer.addresses.map((address) => ({
        label: address.label ?? undefined,
        line1: address.line1,
        line2: address.line2 ?? undefined,
        city: address.city ?? undefined,
        state: address.state ?? undefined,
        postalCode: address.postalCode ?? undefined,
        country: address.country ?? undefined,
      })),
      phoneNumbers: customer.phoneNumbers.map((phoneNumber) => ({
        label: phoneNumber.label ?? "Phone",
        value: formatPhoneNumber(phoneNumber.value),
      })),
      jobHistory,
      unpaidInvoices,
      invoiceHistory,
      orderHistory,
      notes: customer.notes ?? undefined,
    };
  });
}

function getCustomerView(mode: WorkspaceMode, requestedView?: string) {
  if (mode === "commerce") return "orders";
  if (mode === "service") return "work";
  return requestedView === "orders" ? "orders" : "work";
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{
    view?: string;
  }>;
}) {
  const authorization = await getPermittedDashboardAuthorization("customers.view");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Customer access required"
        description="You do not have permission to view customer records in this workspace."
      />
    );
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: authorization.workspaceId },
    select: { invoiceDueDays: true, workspaceMode: true },
  });
  const customers = await getCustomers(authorization.workspaceId, workspace.invoiceDueDays, {
    invoices: can(authorization.membership, "invoices.view"),
    jobs: can(authorization.membership, "jobs.view"),
    orders: can(authorization.membership, "orders.view"),
  });
  const workspaceMode = parseWorkspaceMode(workspace.workspaceMode);
  const resolvedSearchParams = await searchParams;
  const customerView = getCustomerView(workspaceMode, resolvedSearchParams?.view);
  const canCreateCustomers = can(authorization.membership, "customers.create");

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <SubscriberOverview
        createCustomerAction={createCustomerAction}
        canCreateCustomers={canCreateCustomers}
        data={customers}
        view={customerView}
        workspaceMode={workspaceMode}
      />
    </div>
  );
}
