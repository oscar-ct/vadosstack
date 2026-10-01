import type Stripe from "stripe";

import { applyProviderPaymentEvent } from "@/lib/payments/ledger";
import { getStripeClient } from "@/lib/payments/stripe";
import { resolveStripeCheckoutPaymentMethod } from "@/lib/payments/stripe-payment-methods";
import { synchronizeStripeCharge } from "@/lib/payments/stripe-webhook-processor";
import { prisma } from "@/lib/prisma";

const RECONCILABLE_STATUSES = ["created", "pending", "processing", "succeeded", "partially_refunded", "disputed"];

function stripeObjectId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : (value?.id ?? null);
}

async function reconcilePayment(payment: {
  externalPaymentId: string | null;
  id: string;
  invoiceId: string | null;
  ownerId: string;
  status: string;
}) {
  if (!payment.externalPaymentId) return "skipped" as const;
  const connection = await prisma.paymentProviderConnection.findUnique({
    where: { ownerId_provider: { ownerId: payment.ownerId, provider: "stripe" } },
    select: { externalAccountId: true },
  });
  if (!connection) throw new Error(`Workspace ${payment.ownerId} no longer has a Stripe connection.`);

  const session = await getStripeClient().checkout.sessions.retrieve(
    payment.externalPaymentId,
    { expand: ["payment_intent.latest_charge"] },
    { stripeAccount: connection.externalAccountId },
  );
  if (
    session.metadata?.vadosPaymentId !== payment.id ||
    session.metadata?.vadosWorkspaceId !== payment.ownerId ||
    (payment.invoiceId && session.metadata?.vadosInvoiceId !== payment.invoiceId)
  ) {
    throw new Error(`Stripe Checkout session ${session.id} metadata does not match its VadosStack payment.`);
  }

  if (session.status === "expired") {
    if (["created", "pending", "processing"].includes(payment.status)) {
      await applyProviderPaymentEvent({
        workspaceId: payment.ownerId,
        provider: "stripe",
        paymentId: payment.id,
        status: "canceled",
        failureCode: "checkout_session_expired",
        failureMessage: "The Stripe Checkout session expired before payment was completed.",
      });
    }
    return "updated" as const;
  }

  if (session.payment_status !== "paid") {
    if (session.status === "complete" && ["created", "pending"].includes(payment.status)) {
      await applyProviderPaymentEvent({
        workspaceId: payment.ownerId,
        provider: "stripe",
        paymentId: payment.id,
        status: "processing",
      });
      return "updated" as const;
    }
    return "unchanged" as const;
  }

  const paymentIntent = typeof session.payment_intent === "string" ? null : session.payment_intent;
  const latestCharge =
    paymentIntent && typeof paymentIntent.latest_charge !== "string" ? paymentIntent.latest_charge : null;
  if (latestCharge) {
    await synchronizeStripeCharge({
      workspaceId: payment.ownerId,
      connectedAccountId: connection.externalAccountId,
      charge: latestCharge as Stripe.Charge,
    });
    return "updated" as const;
  }

  const paymentIntentId = stripeObjectId(session.payment_intent);
  if (paymentIntentId) {
    const retrieved = await getStripeClient().paymentIntents.retrieve(
      paymentIntentId,
      { expand: ["latest_charge.refunds"] },
      { stripeAccount: connection.externalAccountId },
    );
    const charge = typeof retrieved.latest_charge === "string" ? null : retrieved.latest_charge;
    if (charge) {
      await synchronizeStripeCharge({
        workspaceId: payment.ownerId,
        connectedAccountId: connection.externalAccountId,
        charge,
      });
      return "updated" as const;
    }
  }

  await applyProviderPaymentEvent({
    workspaceId: payment.ownerId,
    provider: "stripe",
    paymentId: payment.id,
    status: "succeeded",
    paidOn: new Date(),
    ...(await resolveStripeCheckoutPaymentMethod({
      connectedAccountId: connection.externalAccountId,
      session,
      stripe: getStripeClient(),
    })),
    referenceNumber: paymentIntentId ?? session.id,
  });
  return "updated" as const;
}

export async function reconcileRecentStripePayments(input?: { days?: number; limit?: number; workspaceId?: string }) {
  const days = Math.max(1, Math.min(input?.days ?? 30, 90));
  const limit = Math.max(1, Math.min(input?.limit ?? 100, 500));
  const payments = await prisma.jobPayment.findMany({
    where: {
      ...(input?.workspaceId ? { ownerId: input.workspaceId } : {}),
      provider: "stripe",
      status: { in: RECONCILABLE_STATUSES },
      updatedAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
    },
    orderBy: { updatedAt: "asc" },
    select: { externalPaymentId: true, id: true, invoiceId: true, ownerId: true, status: true },
    take: limit,
  });

  const result = { checked: payments.length, failed: 0, skipped: 0, unchanged: 0, updated: 0 };
  for (const payment of payments) {
    try {
      const outcome = await reconcilePayment(payment);
      result[outcome] += 1;
    } catch (error) {
      result.failed += 1;
      console.error(`Stripe payment ${payment.id} could not be reconciled.`, error);
    }
  }
  return result;
}
