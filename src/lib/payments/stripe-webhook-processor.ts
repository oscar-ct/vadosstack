import type Stripe from "stripe";

import { minorUnitsToDecimalMoney } from "@/lib/payments/domain";
import { applyProviderPaymentEvent } from "@/lib/payments/ledger";
import { getStripeClient } from "@/lib/payments/stripe";
import { getStripeConnectionState } from "@/lib/payments/stripe-connect";
import {
  getStripeChargePaymentMethod,
  resolveStripeCheckoutPaymentMethod,
} from "@/lib/payments/stripe-payment-methods";
import {
  claimPaymentWebhookEvent,
  completePaymentWebhookEvent,
  failPaymentWebhookEvent,
  findDuePaymentWebhookEventIds,
} from "@/lib/payments/webhook-events";
import { prisma } from "@/lib/prisma";

function paymentIdFromMetadata(object: { metadata?: Stripe.Metadata | null }) {
  return object.metadata?.vadosPaymentId?.trim() || null;
}

function stripeObjectId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : (value?.id ?? null);
}

async function resolvePaymentIdFromCharge(workspaceId: string, connectedAccountId: string, charge: Stripe.Charge) {
  const directPaymentId = paymentIdFromMetadata(charge);
  if (directPaymentId) return directPaymentId;

  const paymentIntentId = stripeObjectId(charge.payment_intent);
  if (paymentIntentId) {
    const paymentIntent = await getStripeClient().paymentIntents.retrieve(
      paymentIntentId,
      {},
      { stripeAccount: connectedAccountId },
    );
    const metadataPaymentId = paymentIdFromMetadata(paymentIntent);
    if (metadataPaymentId) return metadataPaymentId;

    const payment = await prisma.jobPayment.findFirst({
      where: { ownerId: workspaceId, provider: "stripe", referenceNumber: paymentIntentId },
      select: { id: true },
    });
    if (payment) return payment.id;
  }
  return null;
}

async function applyCheckoutEvent(
  workspaceId: string,
  connectedAccountId: string,
  session: Stripe.Checkout.Session,
  status: "processing" | "succeeded" | "failed" | "canceled",
  occurredAt: Date,
) {
  const paymentId = paymentIdFromMetadata(session);
  if (!paymentId) throw new Error("Stripe Checkout event is missing its VadosStack payment ID.");
  const paymentMethod = await resolveStripeCheckoutPaymentMethod({
    connectedAccountId,
    session,
    stripe: getStripeClient(),
  });
  await applyProviderPaymentEvent({
    workspaceId,
    provider: "stripe",
    paymentId,
    status,
    paidOn: status === "succeeded" ? occurredAt : undefined,
    ...paymentMethod,
    referenceNumber:
      typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? session.id),
    failureCode: status === "failed" ? "stripe_async_payment_failed" : null,
    failureMessage: status === "failed" ? "Stripe reported that the payment failed." : null,
  });
}

function paymentStatusFromCharge(charge: Stripe.Charge, ignoreDispute = false) {
  if (charge.disputed && !ignoreDispute) return "disputed" as const;
  if (charge.amount_refunded >= charge.amount) return "refunded" as const;
  if (charge.amount_refunded > 0) return "partially_refunded" as const;
  return "succeeded" as const;
}

function normalizeRefundStatus(status: string | null) {
  if (status === "succeeded" || status === "failed" || status === "canceled") return status;
  return "pending";
}

async function upsertStripeRefund(workspaceId: string, paymentId: string, refund: Stripe.Refund) {
  const status = normalizeRefundStatus(refund.status);
  return prisma.paymentRefund.upsert({
    where: {
      ownerId_provider_externalRefundId: {
        ownerId: workspaceId,
        provider: "stripe",
        externalRefundId: refund.id,
      },
    },
    create: {
      ownerId: workspaceId,
      paymentId,
      provider: "stripe",
      externalRefundId: refund.id,
      amount: minorUnitsToDecimalMoney(refund.amount),
      currency: refund.currency.toUpperCase(),
      status,
      reason: refund.reason ?? null,
      failureCode: refund.failure_reason ?? null,
      failureMessage: refund.failure_reason ? `Stripe refund failed: ${refund.failure_reason}.` : null,
      refundedAt: status === "succeeded" ? new Date(refund.created * 1000) : null,
    },
    update: {
      amount: minorUnitsToDecimalMoney(refund.amount),
      status,
      reason: refund.reason ?? null,
      failureCode: refund.failure_reason ?? null,
      failureMessage: refund.failure_reason ? `Stripe refund failed: ${refund.failure_reason}.` : null,
      refundedAt: status === "succeeded" ? new Date(refund.created * 1000) : null,
    },
  });
}

export async function synchronizeStripeCharge(input: {
  workspaceId: string;
  connectedAccountId: string;
  charge: Stripe.Charge;
  ignoreDispute?: boolean;
}) {
  const paymentId = await resolvePaymentIdFromCharge(input.workspaceId, input.connectedAccountId, input.charge);
  if (!paymentId) throw new Error(`Stripe charge ${input.charge.id} is not linked to a VadosStack payment.`);

  for (const refund of input.charge.refunds?.data ?? []) {
    await upsertStripeRefund(input.workspaceId, paymentId, refund);
  }

  return applyProviderPaymentEvent({
    workspaceId: input.workspaceId,
    provider: "stripe",
    paymentId,
    status: paymentStatusFromCharge(input.charge, input.ignoreDispute),
    ...getStripeChargePaymentMethod(input.charge),
    refundedAmount: minorUnitsToDecimalMoney(input.charge.amount_refunded),
  });
}

async function retrieveRefundCharge(refund: Stripe.Refund, connectedAccountId: string) {
  const chargeId = stripeObjectId(refund.charge);
  if (!chargeId) throw new Error(`Stripe refund ${refund.id} does not include a charge.`);
  return getStripeClient().charges.retrieve(chargeId, { expand: ["refunds"] }, { stripeAccount: connectedAccountId });
}

async function synchronizeStripeDispute(input: {
  workspaceId: string;
  connectedAccountId: string;
  dispute: Stripe.Dispute;
}) {
  const chargeId = stripeObjectId(input.dispute.charge);
  if (!chargeId) throw new Error(`Stripe dispute ${input.dispute.id} does not include a charge.`);
  const charge = await getStripeClient().charges.retrieve(
    chargeId,
    { expand: ["refunds"] },
    { stripeAccount: input.connectedAccountId },
  );
  const paymentId = await resolvePaymentIdFromCharge(input.workspaceId, input.connectedAccountId, charge);
  if (!paymentId) throw new Error(`Stripe dispute ${input.dispute.id} is not linked to a VadosStack payment.`);

  const closed = ["lost", "won", "warning_closed", "prevented"].includes(input.dispute.status);
  await prisma.paymentDispute.upsert({
    where: {
      ownerId_provider_externalDisputeId: {
        ownerId: input.workspaceId,
        provider: "stripe",
        externalDisputeId: input.dispute.id,
      },
    },
    create: {
      ownerId: input.workspaceId,
      paymentId,
      provider: "stripe",
      externalDisputeId: input.dispute.id,
      amount: minorUnitsToDecimalMoney(input.dispute.amount),
      currency: input.dispute.currency.toUpperCase(),
      status: input.dispute.status,
      reason: input.dispute.reason,
      evidenceDueAt: input.dispute.evidence_details.due_by
        ? new Date(input.dispute.evidence_details.due_by * 1000)
        : null,
      openedAt: new Date(input.dispute.created * 1000),
      closedAt: closed ? new Date() : null,
    },
    update: {
      amount: minorUnitsToDecimalMoney(input.dispute.amount),
      status: input.dispute.status,
      reason: input.dispute.reason,
      evidenceDueAt: input.dispute.evidence_details.due_by
        ? new Date(input.dispute.evidence_details.due_by * 1000)
        : null,
      closedAt: closed ? new Date() : null,
    },
  });

  if (["won", "warning_closed", "prevented"].includes(input.dispute.status)) {
    return synchronizeStripeCharge({ ...input, charge, ignoreDispute: true });
  }
  return applyProviderPaymentEvent({
    workspaceId: input.workspaceId,
    provider: "stripe",
    paymentId,
    status: "disputed",
  });
}

export async function processStripeEvent(event: Stripe.Event, workspaceId: string | null) {
  if (event.type === "account.updated") {
    const account = event.data.object;
    const connection = await prisma.paymentProviderConnection.findUnique({
      where: { provider_externalAccountId: { provider: "stripe", externalAccountId: account.id } },
    });
    if (!connection) return;
    const state = getStripeConnectionState(account);
    await prisma.paymentProviderConnection.update({
      where: { id: connection.id },
      data: {
        ...state,
        connectedAt: state.status === "active" ? (connection.connectedAt ?? new Date()) : connection.connectedAt,
        lastSyncedAt: new Date(),
      },
    });
    return;
  }

  if (!workspaceId) return;
  const connectedAccountId = typeof event.account === "string" ? event.account : null;
  if (!connectedAccountId) throw new Error("Connected-account Stripe event is missing its account ID.");
  const occurredAt = new Date(event.created * 1000);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      await applyCheckoutEvent(
        workspaceId,
        connectedAccountId,
        session,
        session.payment_status === "paid" ? "succeeded" : "processing",
        occurredAt,
      );
      return;
    }
    case "checkout.session.async_payment_succeeded":
      await applyCheckoutEvent(workspaceId, connectedAccountId, event.data.object, "succeeded", occurredAt);
      return;
    case "checkout.session.async_payment_failed":
      await applyCheckoutEvent(workspaceId, connectedAccountId, event.data.object, "failed", occurredAt);
      return;
    case "checkout.session.expired":
      await applyCheckoutEvent(workspaceId, connectedAccountId, event.data.object, "canceled", occurredAt);
      return;
    case "charge.refunded": {
      await synchronizeStripeCharge({ workspaceId, connectedAccountId, charge: event.data.object });
      return;
    }
    case "refund.created":
    case "refund.updated":
    case "refund.failed": {
      const charge = await retrieveRefundCharge(event.data.object, connectedAccountId);
      await synchronizeStripeCharge({ workspaceId, connectedAccountId, charge });
      return;
    }
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed":
    case "charge.dispute.funds_reinstated":
    case "charge.dispute.funds_withdrawn": {
      await synchronizeStripeDispute({ workspaceId, connectedAccountId, dispute: event.data.object });
      return;
    }
    default:
      return;
  }
}

export async function processStoredStripeWebhookEvent(id: string) {
  if (!(await claimPaymentWebhookEvent(id))) return { claimed: false, processed: false };
  try {
    const stored = await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id } });
    if (!stored.rawPayload) throw new Error("Stored Stripe webhook payload is unavailable.");
    const event = JSON.parse(stored.rawPayload) as Stripe.Event;
    await processStripeEvent(event, stored.ownerId);
    await completePaymentWebhookEvent(id);
    return { claimed: true, processed: true };
  } catch (error) {
    await failPaymentWebhookEvent(id, error);
    throw error;
  }
}

export async function processDueStripeWebhookEvents(limit = 25) {
  const ids = await findDuePaymentWebhookEventIds("stripe", limit);
  let processed = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      const result = await processStoredStripeWebhookEvent(id);
      if (result.processed) processed += 1;
    } catch (error) {
      failed += 1;
      console.error(`Stored Stripe webhook ${id} failed.`, error);
    }
  }
  return { attempted: ids.length, failed, processed };
}
