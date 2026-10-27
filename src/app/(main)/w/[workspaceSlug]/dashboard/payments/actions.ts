"use server";

import { redirect } from "next/navigation";

import { addDays } from "date-fns";
import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { getPublicSiteUrl, getStripeClient, getStripeConnectedAccountCountry } from "@/lib/payments/stripe";
import { getStripeConnectionState } from "@/lib/payments/stripe-connect";
import { reconcileRecentStripePayments } from "@/lib/payments/stripe-reconciliation";
import { processStoredStripeWebhookEvent } from "@/lib/payments/stripe-webhook-processor";
import { prisma } from "@/lib/prisma";
import { formatServiceAddress } from "@/lib/service-address";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

import type {
  PaymentInvoiceOption,
  PaymentJobOption,
  PaymentTargetDetailsResult,
  PaymentTargetSearchResult,
  PreviousPaymentOption,
} from "./payment-target-types";

export type StripeConnectionActionState = { success: boolean; message: string };
export type PaymentHealthActionState = { success: boolean; message: string };

const paymentTargetPageSize = 20;
const paymentTargetSearchSchema = z.object({
  kind: z.enum(["deposit", "invoice_payment"]),
  page: z.number().int().positive().default(1),
  query: z.string().trim().max(120).default(""),
});
const paymentTargetDetailsSchema = z.object({
  id: z.string().trim().min(1),
  kind: z.enum(["deposit", "invoice_payment"]),
});

function mapPreviousPayment(payment: {
  amount: { toString(): string };
  id: string;
  method: string;
  paidOn: Date;
  paymentType: string;
  referenceNumber: string | null;
  status: string;
}): PreviousPaymentOption {
  return {
    amount: payment.amount.toString(),
    id: payment.id,
    method: payment.method,
    paidOn: payment.paidOn.toISOString(),
    paymentType: payment.paymentType,
    referenceNumber: payment.referenceNumber ?? undefined,
    status: payment.status,
  };
}

async function invoiceDueDays(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { invoiceDueDays: true },
  });
  return workspace?.invoiceDueDays ?? 15;
}

export async function searchPaymentTargetsAction(input: unknown): Promise<PaymentTargetSearchResult> {
  const authorization = await getPermittedDashboardAuthorization("invoices.record_payment");
  if (!authorization) {
    return {
      invoices: [],
      jobs: [],
      message: "You do not have permission to record payments.",
      page: 1,
      success: false,
      total: 0,
      totalPages: 1,
    };
  }
  const parsed = paymentTargetSearchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      invoices: [],
      jobs: [],
      message: "Check the search and try again.",
      page: 1,
      success: false,
      total: 0,
      totalPages: 1,
    };
  }

  const { kind, query } = parsed.data;
  if (kind === "invoice_payment") {
    const where = {
      ownerId: authorization.workspaceId,
      balanceDue: { gt: 0 },
      ...(query
        ? {
            OR: [
              { customerName: { contains: query, mode: "insensitive" as const } },
              { invoiceNumber: { contains: query, mode: "insensitive" as const } },
              { jobTitle: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const total = await prisma.invoice.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / paymentTargetPageSize));
    const page = Math.min(parsed.data.page, totalPages);
    const [dueDays, invoices] = await Promise.all([
      invoiceDueDays(authorization.workspaceId),
      prisma.invoice.findMany({
        where,
        orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * paymentTargetPageSize,
        take: paymentTargetPageSize,
        select: {
          amountPaid: true,
          balanceDue: true,
          customerName: true,
          finalCost: true,
          id: true,
          invoiceNumber: true,
          issuedAt: true,
          jobId: true,
          jobTitle: true,
        },
      }),
    ]);
    return {
      invoices: invoices.map(
        (invoice): PaymentInvoiceOption => ({
          amountPaid: invoice.amountPaid.toString(),
          balanceDue: invoice.balanceDue.toString(),
          customerName: invoice.customerName ?? "Customer not recorded",
          dueAt: addDays(invoice.issuedAt, dueDays).toISOString(),
          finalCost: invoice.finalCost.toString(),
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber ?? `INV-${invoice.id.slice(-6).toUpperCase()}`,
          issuedAt: invoice.issuedAt.toISOString(),
          jobId: invoice.jobId,
          jobTitle: invoice.jobTitle,
          paymentCount: 0,
          payments: [],
        }),
      ),
      jobs: [],
      message: "",
      page,
      success: true,
      total,
      totalPages,
    };
  }

  const where = {
    ownerId: authorization.workspaceId,
    status: { not: "Cancelled" },
    paymentStatus: { not: "Paid in Full" },
    AND: [
      { OR: [{ invoice: { is: null } }, { invoice: { is: { balanceDue: { gt: 0 } } } }] },
      ...(query
        ? [
            {
              OR: [
                { customer: { is: { name: { contains: query, mode: "insensitive" as const } } } },
                { description: { contains: query, mode: "insensitive" as const } },
                { serviceCity: { contains: query, mode: "insensitive" as const } },
                { serviceLocation: { contains: query, mode: "insensitive" as const } },
                { servicePostalCode: { contains: query, mode: "insensitive" as const } },
                { serviceState: { contains: query, mode: "insensitive" as const } },
                { status: { contains: query, mode: "insensitive" as const } },
                { invoice: { is: { invoiceNumber: { contains: query, mode: "insensitive" as const } } } },
              ],
            },
          ]
        : []),
    ],
  };
  const total = await prisma.job.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / paymentTargetPageSize));
  const page = Math.min(parsed.data.page, totalPages);
  const jobs = await prisma.job.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * paymentTargetPageSize,
    take: paymentTargetPageSize,
    select: {
      amountPaid: true,
      customer: { select: { name: true } },
      depositPaid: true,
      description: true,
      estimatedCost: true,
      finalCost: true,
      id: true,
      invoice: { select: { balanceDue: true, id: true, invoiceNumber: true } },
      serviceAddressLine1: true,
      serviceAddressLine2: true,
      serviceCity: true,
      serviceLocation: true,
      servicePostalCode: true,
      serviceState: true,
      status: true,
    },
  });
  return {
    invoices: [],
    jobs: jobs.map(
      (job): PaymentJobOption => ({
        amountPaid: job.amountPaid?.toString() ?? "0",
        customerName: job.customer?.name ?? "Customer not recorded",
        depositPaid: job.depositPaid?.toString() ?? "0",
        description: job.description,
        estimatedCost: job.estimatedCost?.toString(),
        finalCost: job.finalCost?.toString(),
        id: job.id,
        invoiceBalanceDue: job.invoice?.balanceDue.toString(),
        invoiceId: job.invoice?.id,
        invoiceNumber: job.invoice?.invoiceNumber ?? undefined,
        paymentCount: 0,
        payments: [],
        serviceLocation: formatServiceAddress(job) ?? undefined,
        status: job.status,
      }),
    ),
    message: "",
    page,
    success: true,
    total,
    totalPages,
  };
}

export async function getPaymentTargetDetailsAction(input: unknown): Promise<PaymentTargetDetailsResult> {
  const authorization = await getPermittedDashboardAuthorization("invoices.record_payment");
  if (!authorization) {
    return { invoice: null, job: null, message: "You do not have permission to record payments.", success: false };
  }
  const parsed = paymentTargetDetailsSchema.safeParse(input);
  if (!parsed.success) return { invoice: null, job: null, message: "Select a valid record.", success: false };

  const paymentSelect = {
    amount: true,
    id: true,
    method: true,
    paidOn: true,
    paymentType: true,
    referenceNumber: true,
    status: true,
  } as const;

  if (parsed.data.kind === "invoice_payment") {
    const [dueDays, invoice] = await Promise.all([
      invoiceDueDays(authorization.workspaceId),
      prisma.invoice.findFirst({
        where: { id: parsed.data.id, ownerId: authorization.workspaceId, balanceDue: { gt: 0 } },
        select: {
          amountPaid: true,
          balanceDue: true,
          customerName: true,
          finalCost: true,
          id: true,
          invoiceNumber: true,
          issuedAt: true,
          jobId: true,
          jobTitle: true,
          job: {
            select: {
              _count: { select: { payments: true } },
              payments: { orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }], select: paymentSelect, take: 20 },
            },
          },
        },
      }),
    ]);
    if (!invoice) return { invoice: null, job: null, message: "That invoice is no longer available.", success: false };
    return {
      invoice: {
        amountPaid: invoice.amountPaid.toString(),
        balanceDue: invoice.balanceDue.toString(),
        customerName: invoice.customerName ?? "Customer not recorded",
        dueAt: addDays(invoice.issuedAt, dueDays).toISOString(),
        finalCost: invoice.finalCost.toString(),
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber ?? `INV-${invoice.id.slice(-6).toUpperCase()}`,
        issuedAt: invoice.issuedAt.toISOString(),
        jobId: invoice.jobId,
        jobTitle: invoice.jobTitle,
        paymentCount: invoice.job._count.payments,
        payments: invoice.job.payments.map(mapPreviousPayment),
      },
      job: null,
      message: "",
      success: true,
    };
  }

  const job = await prisma.job.findFirst({
    where: {
      id: parsed.data.id,
      ownerId: authorization.workspaceId,
      paymentStatus: { not: "Paid in Full" },
      status: { not: "Cancelled" },
      OR: [{ invoice: { is: null } }, { invoice: { is: { balanceDue: { gt: 0 } } } }],
    },
    select: {
      _count: { select: { payments: true } },
      amountPaid: true,
      customer: { select: { name: true } },
      depositPaid: true,
      description: true,
      estimatedCost: true,
      finalCost: true,
      id: true,
      invoice: { select: { balanceDue: true, id: true, invoiceNumber: true } },
      payments: { orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }], select: paymentSelect, take: 20 },
      serviceAddressLine1: true,
      serviceAddressLine2: true,
      serviceCity: true,
      serviceLocation: true,
      servicePostalCode: true,
      serviceState: true,
      status: true,
    },
  });
  if (!job) return { invoice: null, job: null, message: "That job is no longer available.", success: false };
  return {
    invoice: null,
    job: {
      amountPaid: job.amountPaid?.toString() ?? "0",
      customerName: job.customer?.name ?? "Customer not recorded",
      depositPaid: job.depositPaid?.toString() ?? "0",
      description: job.description,
      estimatedCost: job.estimatedCost?.toString(),
      finalCost: job.finalCost?.toString(),
      id: job.id,
      invoiceBalanceDue: job.invoice?.balanceDue.toString(),
      invoiceId: job.invoice?.id,
      invoiceNumber: job.invoice?.invoiceNumber ?? undefined,
      paymentCount: job._count.payments,
      payments: job.payments.map(mapPreviousPayment),
      serviceLocation: formatServiceAddress(job) ?? undefined,
      status: job.status,
    },
    message: "",
    success: true,
  };
}

export async function connectStripeAction() {
  const authorization = await getPermittedDashboardAuthorization("payments.settings.manage");
  if (!authorization) throw new Error("You do not have permission to manage payment providers.");

  const stripe = getStripeClient();
  const existing = await prisma.paymentProviderConnection.findUnique({
    where: { ownerId_provider: { ownerId: authorization.workspaceId, provider: "stripe" } },
  });
  let accountId = existing?.externalAccountId;

  if (!accountId || existing?.status === "disconnected") {
    const account = await stripe.accounts.create(
      {
        type: "standard",
        country: getStripeConnectedAccountCountry(),
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { vadosWorkspaceId: authorization.workspaceId },
      },
      { idempotencyKey: `vados-connect-standard-v1-${authorization.workspaceId}` },
    );
    accountId = account.id;
    const state = getStripeConnectionState(account);
    await prisma.paymentProviderConnection.upsert({
      where: { ownerId_provider: { ownerId: authorization.workspaceId, provider: "stripe" } },
      create: {
        ownerId: authorization.workspaceId,
        provider: "stripe",
        externalAccountId: account.id,
        accountType: account.type ?? "standard",
        ...state,
        lastSyncedAt: new Date(),
      },
      update: {
        externalAccountId: account.id,
        accountType: account.type ?? "standard",
        disconnectedAt: null,
        ...state,
        lastSyncedAt: new Date(),
      },
    });
    await recordAuthorizationAuditEvent({
      workspaceId: authorization.workspaceId,
      actorUserId: authorization.principal.user.id,
      membershipId: authorization.membership.id,
      action: "payment_provider.stripe.connect_start",
      targetType: "PaymentProviderConnection",
      targetId: account.id,
    });
  }

  const paymentsPath = getWorkspaceDashboardPath(authorization.membership.workspaceSlug, "/dashboard/payments");
  const returnUrl = new URL(`${paymentsPath}?stripe=returned`, getPublicSiteUrl()).toString();
  const refreshUrl = new URL(`${paymentsPath}?stripe=refresh`, getPublicSiteUrl()).toString();
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });
  redirect(accountLink.url);
}

export async function openStripeDashboardAction() {
  const authorization = await getPermittedDashboardAuthorization("payments.settings.manage");
  if (!authorization) throw new Error("You do not have permission to manage payment providers.");

  const connection = await prisma.paymentProviderConnection.findUnique({
    where: { ownerId_provider: { ownerId: authorization.workspaceId, provider: "stripe" } },
  });
  if (!connection) throw new Error("Stripe is not connected.");

  const stripe = getStripeClient();
  const account = await stripe.accounts.retrieve(connection.externalAccountId);
  if (account.type === "standard") redirect("https://dashboard.stripe.com/");

  const loginLink = await stripe.accounts.createLoginLink(connection.externalAccountId);
  redirect(loginLink.url);
}

export async function openStripePaymentMethodsAction() {
  const authorization = await getPermittedDashboardAuthorization("payments.settings.manage");
  if (!authorization) throw new Error("You do not have permission to manage payment providers.");

  const connection = await prisma.paymentProviderConnection.findUnique({
    where: { ownerId_provider: { ownerId: authorization.workspaceId, provider: "stripe" } },
  });
  if (!connection || connection.status === "disconnected") throw new Error("Stripe is not connected.");
  redirect("https://dashboard.stripe.com/settings/payment_methods");
}

export async function disconnectStripeAction(
  _previousState: StripeConnectionActionState,
): Promise<StripeConnectionActionState> {
  const authorization = await getPermittedDashboardAuthorization("payments.settings.manage");
  if (!authorization) return { success: false, message: "You do not have permission to manage payment providers." };

  const connection = await prisma.paymentProviderConnection.findUnique({
    where: { ownerId_provider: { ownerId: authorization.workspaceId, provider: "stripe" } },
  });
  if (!connection) return { success: false, message: "Stripe is not connected." };

  await prisma.$transaction(async (transaction) => {
    await transaction.paymentProviderConnection.update({
      where: { id: connection.id },
      data: {
        status: "disconnected",
        chargesEnabled: false,
        payoutsEnabled: false,
        disconnectedAt: new Date(),
      },
    });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: authorization.workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "payment_provider.stripe.disconnect",
        targetType: "PaymentProviderConnection",
        targetId: connection.id,
      },
      transaction,
    );
  });
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/payments");
  return { success: true, message: "Stripe disconnected from new VadosStack payments." };
}

export async function retryStripeWebhookAction(
  _previousState: PaymentHealthActionState,
  formData: FormData,
): Promise<PaymentHealthActionState> {
  const authorization = await getPermittedDashboardAuthorization("payments.settings.manage");
  if (!authorization) return { success: false, message: "You do not have permission to repair payments." };
  const eventId = String(formData.get("eventId") ?? "").trim();
  if (!eventId) return { success: false, message: "Select a Stripe event to retry." };

  const event = await prisma.paymentWebhookEvent.findFirst({
    where: { id: eventId, ownerId: authorization.workspaceId, provider: "stripe" },
    select: { id: true, rawPayload: true, status: true },
  });
  if (!event) return { success: false, message: "That Stripe event could not be found." };
  if (event.status === "processed") return { success: true, message: "This Stripe event was already processed." };
  if (!event.rawPayload) return { success: false, message: "This older event has no stored payload to retry." };

  await prisma.paymentWebhookEvent.update({
    where: { id: event.id },
    data: { status: "received", processingStartedAt: null, nextAttemptAt: null },
  });
  try {
    await processStoredStripeWebhookEvent(event.id);
    await recordAuthorizationAuditEvent({
      workspaceId: authorization.workspaceId,
      actorUserId: authorization.principal.user.id,
      membershipId: authorization.membership.id,
      action: "payment.webhook.retry",
      targetType: "PaymentWebhookEvent",
      targetId: event.id,
    });
    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/payments");
    return { success: true, message: "Stripe event processed successfully." };
  } catch (error) {
    console.error("Manual Stripe webhook retry failed.", error);
    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/payments");
    return { success: false, message: "Stripe still could not process this event. Its retry was rescheduled." };
  }
}

export async function reconcileStripePaymentsAction(
  _previousState: PaymentHealthActionState,
): Promise<PaymentHealthActionState> {
  const authorization = await getPermittedDashboardAuthorization("payments.settings.manage");
  if (!authorization) return { success: false, message: "You do not have permission to reconcile payments." };

  const result = await reconcileRecentStripePayments({
    days: 30,
    limit: 100,
    workspaceId: authorization.workspaceId,
  });
  await recordAuthorizationAuditEvent({
    workspaceId: authorization.workspaceId,
    actorUserId: authorization.principal.user.id,
    membershipId: authorization.membership.id,
    action: "payment.stripe.reconcile",
    targetType: "Workspace",
    targetId: authorization.workspaceId,
    metadata: result,
  });
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/payments");

  if (result.failed) {
    return {
      success: false,
      message: `${result.checked} payments checked; ${result.failed} still need attention.`,
    };
  }
  return {
    success: true,
    message: `${result.checked} recent Stripe ${result.checked === 1 ? "payment" : "payments"} checked successfully.`,
  };
}
