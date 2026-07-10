import { addDays } from "date-fns";

import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";
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

async function getCustomers(ownerId: string, invoiceDueDays: number): Promise<RecentCustomerRow[]> {
  const customers = await prisma.customer.findMany({
    where: {
      ownerId,
    },
    include: {
      addresses: true,
      phoneNumbers: true,
      jobs: {
        include: {
          invoice: true,
        },
      },
      orders: {
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
        title: `Invoice ${invoice.id.slice(-6).toUpperCase()}`,
        status: invoice.status,
        date: invoice.issuedAt,
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
      unpaidJobs: unpaidInvoices,
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
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view customers"
        description="Customer records are private to each signed-in account."
      />
    );
  }

  const customers = await getCustomers(currentUser.id, currentUser.invoiceDueDays);
  const workspaceMode = parseWorkspaceMode(currentUser.workspaceMode);
  const resolvedSearchParams = await searchParams;
  const customerView = getCustomerView(workspaceMode, resolvedSearchParams?.view);

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <SubscriberOverview
        createCustomerAction={createCustomerAction}
        data={customers}
        view={customerView}
        workspaceMode={workspaceMode}
      />
    </div>
  );
}
