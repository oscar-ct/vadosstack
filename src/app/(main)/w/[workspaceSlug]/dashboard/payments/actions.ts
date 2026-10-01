"use server";

import { redirect } from "next/navigation";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { getPublicSiteUrl, getStripeClient, getStripeConnectedAccountCountry } from "@/lib/payments/stripe";
import { getStripeConnectionState } from "@/lib/payments/stripe-connect";
import { reconcileRecentStripePayments } from "@/lib/payments/stripe-reconciliation";
import { processStoredStripeWebhookEvent } from "@/lib/payments/stripe-webhook-processor";
import { prisma } from "@/lib/prisma";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

export type StripeConnectionActionState = { success: boolean; message: string };
export type PaymentHealthActionState = { success: boolean; message: string };

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
