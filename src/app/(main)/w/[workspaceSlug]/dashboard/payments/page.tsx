import type { Prisma } from "@prisma/client";
import { CreditCard } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { getApplicationFeeConfig } from "@/lib/payments/application-fee";
import { getWorkspacePaymentHealth } from "@/lib/payments/health";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { syncStripeProviderConnection } from "@/lib/payments/stripe-connect";
import type { StripePaymentMethodReadiness } from "@/lib/payments/stripe-payment-methods";
import { prisma } from "@/lib/prisma";

import { createJobPaymentAction } from "../jobs/actions";
import { PaymentHistory, type PaymentHistoryItem, type PaymentHistorySort } from "./_components/payment-history";
import { StripeSetupExperience } from "./_components/provider-actions";
import { RecordPaymentDialog } from "./_components/record-payment-dialog";
import { getPaymentTargetDetailsAction, searchPaymentTargetsAction } from "./actions";

function money(value: { toString(): string } | null | undefined) {
  return `$${Number(value?.toString() ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const defaultPageSize = 20;
const pageSizeOptions = [20, 30, 40, 50] as const;
const paymentStatuses = ["succeeded", "processing", "pending", "failed", "canceled", "disputed"] as const;
type PaymentStatusFilter = "all" | (typeof paymentStatuses)[number];
type PaymentTypeFilter = "all" | "deposit" | "invoice_payment";
type PaymentProviderFilter = "all" | "manual" | "stripe";

type PageProps = {
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    provider?: string;
    q?: string;
    sort?: string;
    status?: string;
    stripe?: string;
    type?: string;
  }>;
};

function parsePage(value?: string) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSize(value?: string) {
  const parsed = Number.parseInt(value ?? String(defaultPageSize), 10);
  return pageSizeOptions.includes(parsed as (typeof pageSizeOptions)[number]) ? parsed : defaultPageSize;
}

function parseStatus(value?: string): PaymentStatusFilter {
  return paymentStatuses.includes(value as (typeof paymentStatuses)[number]) ? (value as PaymentStatusFilter) : "all";
}

function parseType(value?: string): PaymentTypeFilter {
  return value === "deposit" || value === "invoice_payment" ? value : "all";
}

function parseProvider(value?: string): PaymentProviderFilter {
  return value === "manual" || value === "stripe" ? value : "all";
}

function parseSort(value?: string): PaymentHistorySort {
  const options: PaymentHistorySort[] = [
    "amount-asc",
    "amount-desc",
    "customer-asc",
    "customer-desc",
    "date-asc",
    "date-desc",
    "method-asc",
    "method-desc",
    "provider-asc",
    "provider-desc",
    "reference-asc",
    "reference-desc",
    "status-asc",
    "status-desc",
  ];
  return options.includes(value as PaymentHistorySort) ? (value as PaymentHistorySort) : "date-desc";
}

function paymentOrderBy(sort: PaymentHistorySort): Prisma.JobPaymentOrderByWithRelationInput[] {
  const direction = sort.endsWith("-asc") ? "asc" : "desc";
  if (sort.startsWith("amount-")) return [{ amount: direction }, { paidOn: "desc" }, { id: direction }];
  if (sort.startsWith("customer-")) {
    return [{ job: { customer: { name: direction } } }, { paidOn: "desc" }, { id: direction }];
  }
  if (sort.startsWith("method-")) return [{ method: direction }, { paidOn: "desc" }, { id: direction }];
  if (sort.startsWith("provider-")) return [{ provider: direction }, { paidOn: "desc" }, { id: direction }];
  if (sort.startsWith("reference-")) {
    return [
      { referenceNumber: { sort: direction, nulls: "last" } },
      { externalPaymentId: { sort: direction, nulls: "last" } },
      { paidOn: "desc" },
      { id: direction },
    ];
  }
  if (sort.startsWith("status-")) return [{ status: direction }, { paidOn: "desc" }, { id: direction }];
  return [{ paidOn: direction }, { createdAt: direction }, { id: direction }];
}

export default async function PaymentsPage({ searchParams }: PageProps) {
  const authorization = await getPermittedDashboardAuthorization("payments.view");
  if (!authorization) {
    return (
      <AuthRequiredState title="Payments access required" description="You do not have permission to view payments." />
    );
  }
  const canRecordPayments = can(authorization.membership, "invoices.record_payment");
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams?.q?.trim().slice(0, 120) ?? "";
  const status = parseStatus(resolvedSearchParams?.status);
  const paymentType = parseType(resolvedSearchParams?.type);
  const provider = parseProvider(resolvedSearchParams?.provider);
  const sort = parseSort(resolvedSearchParams?.sort);
  const requestedPage = parsePage(resolvedSearchParams?.page);
  const pageSize = parsePageSize(resolvedSearchParams?.pageSize);
  const paymentWhere: Prisma.JobPaymentWhereInput = {
    ownerId: authorization.workspaceId,
    ...(status === "all" ? {} : { status }),
    ...(paymentType === "all" ? {} : { paymentType }),
    ...(provider === "all" ? {} : { provider }),
    ...(query
      ? {
          OR: [
            { description: { contains: query, mode: "insensitive" } },
            { method: { contains: query, mode: "insensitive" } },
            { methodType: { contains: query, mode: "insensitive" } },
            { referenceNumber: { contains: query, mode: "insensitive" } },
            { externalPaymentId: { contains: query, mode: "insensitive" } },
            { invoice: { is: { customerName: { contains: query, mode: "insensitive" } } } },
            { invoice: { is: { invoiceNumber: { contains: query, mode: "insensitive" } } } },
            { job: { is: { description: { contains: query, mode: "insensitive" } } } },
            { job: { is: { customer: { is: { name: { contains: query, mode: "insensitive" } } } } } },
          ],
        }
      : {}),
  };

  const configured = isStripeConfigured();
  const existingConnection = await prisma.paymentProviderConnection.findUnique({
    where: { ownerId_provider: { ownerId: authorization.workspaceId, provider: "stripe" } },
  });
  let connection = existingConnection;
  let paymentMethods: StripePaymentMethodReadiness | null = null;
  if (configured && existingConnection && existingConnection.status !== "disconnected") {
    try {
      const synced = await syncStripeProviderConnection(authorization.workspaceId);
      connection = synced.connection;
      paymentMethods = synced.paymentMethods;
    } catch (error) {
      console.error("Stripe connection status could not be refreshed.", error);
    }
  }

  const [filteredCount, totalCount, paymentHealth] = await Promise.all([
    prisma.jobPayment.count({ where: paymentWhere }),
    prisma.jobPayment.count({ where: { ownerId: authorization.workspaceId } }),
    getWorkspacePaymentHealth(authorization.workspaceId),
  ]);
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const payments = await prisma.jobPayment.findMany({
    where: paymentWhere,
    include: {
      invoice: { select: { customerName: true, id: true, invoiceNumber: true } },
      job: { select: { customer: { select: { name: true } }, description: true, id: true } },
      refunds: {
        orderBy: [{ createdAt: "asc" }],
        select: { amount: true, id: true, reason: true, refundedAt: true, status: true },
      },
      disputes: {
        orderBy: [{ openedAt: "asc" }],
        select: {
          amount: true,
          externalDisputeId: true,
          id: true,
          openedAt: true,
          reason: true,
          status: true,
        },
      },
    },
    orderBy: paymentOrderBy(sort),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const paymentIds = payments.map((payment) => payment.id);
  const paymentAudits = paymentIds.length
    ? await prisma.authorizationAuditEvent.findMany({
        where: {
          workspaceId: authorization.workspaceId,
          targetType: "JobPayment",
          targetId: { in: paymentIds },
          action: {
            in: ["job.payment.create", "job.payment.update", "payment.attempt.create", "payment.provider_event.apply"],
          },
        },
        select: {
          action: true,
          actor: { select: { email: true, name: true } },
          createdAt: true,
          id: true,
          targetId: true,
        },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const auditsByPaymentId = new Map<string, typeof paymentAudits>();
  for (const audit of paymentAudits) {
    if (!audit.targetId) continue;
    const current = auditsByPaymentId.get(audit.targetId) ?? [];
    current.push(audit);
    auditsByPaymentId.set(audit.targetId, current);
  }
  const paymentItems: PaymentHistoryItem[] = payments.map((payment) => ({
    amount: payment.amount.toString(),
    applicationFeeAmount: payment.applicationFeeAmount.toString(),
    audits: (auditsByPaymentId.get(payment.id) ?? []).map((audit) => ({
      action: audit.action,
      actorEmail: audit.actor?.email ?? undefined,
      actorName: audit.actor?.name ?? undefined,
      createdAt: audit.createdAt.toISOString(),
      id: audit.id,
    })),
    createdAt: payment.createdAt.toISOString(),
    currency: payment.currency,
    customerName: payment.invoice?.customerName ?? payment.job.customer?.name ?? "Customer not recorded",
    description: payment.description,
    disputes: payment.disputes.map((dispute) => ({
      amount: dispute.amount.toString(),
      externalDisputeId: dispute.externalDisputeId,
      id: dispute.id,
      openedAt: dispute.openedAt.toISOString(),
      reason: dispute.reason ?? undefined,
      status: dispute.status,
    })),
    externalPaymentId: payment.externalPaymentId ?? undefined,
    failureCode: payment.failureCode ?? undefined,
    failureMessage: payment.failureMessage ?? undefined,
    feeAmount: payment.feeAmount?.toString(),
    id: payment.id,
    invoiceId: payment.invoice?.id,
    invoiceNumber: payment.invoice?.invoiceNumber ?? undefined,
    jobDescription: payment.job.description,
    jobId: payment.job.id,
    method: payment.method,
    methodType: payment.methodType ?? undefined,
    notes: payment.notes ?? undefined,
    paidOn: payment.paidOn.toISOString(),
    paymentType: payment.paymentType,
    provider: payment.provider,
    referenceNumber: payment.referenceNumber ?? undefined,
    refundedAmount: payment.refundedAmount.toString(),
    refunds: payment.refunds.map((refund) => ({
      amount: refund.amount.toString(),
      id: refund.id,
      reason: refund.reason ?? undefined,
      refundedAt: refund.refundedAt?.toISOString(),
      status: refund.status,
    })),
    status: payment.status,
    updatedAt: payment.updatedAt.toISOString(),
  }));
  const canManageProviders = can(authorization.membership, "payments.settings.manage");
  const ready = connection?.accountType === "standard" && connection.status === "active" && connection.chargesEnabled;
  const requiresStandardReconnect = Boolean(
    connection && connection.status !== "disconnected" && connection.accountType !== "standard",
  );
  const fee = getApplicationFeeConfig();
  const returnedFromStripe = resolvedSearchParams?.stripe === "returned";
  const health = {
    canManage: canManageProviders,
    failedRefunds: paymentHealth.failedRefunds,
    healthy: paymentHealth.healthy,
    issueCount: paymentHealth.issueCount,
    lastProcessedAt: paymentHealth.lastProcessedAt?.toISOString() ?? null,
    openDisputes: paymentHealth.openDisputes,
    webhookIssues: paymentHealth.webhookIssues.map((issue) => ({
      ...issue,
      nextAttemptAt: issue.nextAttemptAt?.toISOString() ?? null,
      receivedAt: issue.receivedAt.toISOString(),
    })),
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4" /> Payments
          </CardTitle>
          <CardDescription>Connect payment providers and review invoice transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          <StripeSetupExperience
            canManage={canManageProviders}
            configured={configured}
            connected={Boolean(connection && connection.status !== "disconnected")}
            feeLabel={`${fee.basisPoints / 100}%${
              fee.fixedMinorUnits ? ` + ${money({ toString: () => (fee.fixedMinorUnits / 100).toFixed(2) })}` : ""
            }`}
            health={health}
            paymentMethods={paymentMethods}
            ready={ready}
            requiresReconnect={requiresStandardReconnect}
            returnedIncomplete={returnedFromStripe}
            showReadyCelebration={ready && returnedFromStripe}
            status={connection?.status ?? "not_connected"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
          <CardDescription>
            Review manual and online payment records. Select a payment to view its details and history.
          </CardDescription>
          {canRecordPayments ? (
            <CardAction>
              <RecordPaymentDialog
                action={createJobPaymentAction}
                detailsAction={getPaymentTargetDetailsAction}
                searchAction={searchPaymentTargetsAction}
              />
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          <PaymentHistory
            filteredCount={filteredCount}
            initialProvider={provider}
            initialQuery={query}
            initialSort={sort}
            initialStatus={status}
            initialType={paymentType}
            page={page}
            pageSize={pageSize}
            payments={paymentItems}
            totalCount={totalCount}
            totalPages={totalPages}
          />
        </CardContent>
      </Card>
    </div>
  );
}
