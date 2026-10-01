import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";

import { applyProviderPaymentEvent } from "./ledger";
import { getStripeClient } from "./stripe";
import { resolveStripeCheckoutPaymentMethod } from "./stripe-payment-methods";

const OPEN_PAYMENT_STATUSES = ["created", "pending", "processing"] as const;

export type StripeCheckoutExpirationResult = {
  canceledCount: number;
  failedCount: number;
  synchronizedCount: number;
};

export type StripeCheckoutReturnStatus = "expired" | "failed" | "paid" | "pending" | "processing";

export async function synchronizeStripeCheckoutReturn(input: {
  workspaceId: string;
  invoiceId: string;
  sessionId?: string;
}): Promise<StripeCheckoutReturnStatus> {
  try {
    const [connection, payment] = await Promise.all([
      prisma.paymentProviderConnection.findUnique({
        where: { ownerId_provider: { ownerId: input.workspaceId, provider: "stripe" } },
        select: { externalAccountId: true },
      }),
      prisma.jobPayment.findFirst({
        where: {
          ownerId: input.workspaceId,
          invoiceId: input.invoiceId,
          provider: "stripe",
          ...(input.sessionId
            ? { externalPaymentId: input.sessionId }
            : { status: { in: [...OPEN_PAYMENT_STATUSES] } }),
        },
        orderBy: { createdAt: "desc" },
        select: { externalPaymentId: true, id: true, status: true },
      }),
    ]);
    if (!connection || !payment?.externalPaymentId) return "failed";
    if (payment.status === "succeeded" || payment.status === "partially_refunded") return "paid";

    const session = await getStripeClient().checkout.sessions.retrieve(
      payment.externalPaymentId,
      {},
      { stripeAccount: connection.externalAccountId },
    );
    if (
      session.metadata?.vadosWorkspaceId !== input.workspaceId ||
      session.metadata?.vadosInvoiceId !== input.invoiceId ||
      session.metadata?.vadosPaymentId !== payment.id
    ) {
      console.error("Stripe Checkout return metadata did not match its VadosStack payment.");
      return "failed";
    }

    if (session.status === "open") return "pending";
    if (session.status === "expired") {
      await applyProviderPaymentEvent({
        workspaceId: input.workspaceId,
        provider: "stripe",
        paymentId: payment.id,
        status: "canceled",
        failureCode: "checkout_session_expired",
        failureMessage: "The Stripe Checkout session expired before payment was completed.",
      });
      return "expired";
    }

    const paid = session.payment_status === "paid";
    await synchronizeCompletedSession(input.workspaceId, payment.id, session, connection.externalAccountId);
    return paid ? "paid" : "processing";
  } catch (error) {
    console.error("Stripe Checkout return could not be synchronized.", error);
    return "failed";
  }
}

/**
 * Retires checkout sessions whose fixed amount became stale after a manual
 * payment mutation. The reusable customer payment link remains intact and can
 * create a new session for the invoice's current balance.
 */
export async function expireStripeCheckoutSessionsAfterManualPayment(input: {
  workspaceId: string;
  jobId: string;
}): Promise<StripeCheckoutExpirationResult> {
  const result: StripeCheckoutExpirationResult = {
    canceledCount: 0,
    failedCount: 0,
    synchronizedCount: 0,
  };
  const job = await prisma.job.findUnique({
    where: { id_ownerId: { id: input.jobId, ownerId: input.workspaceId } },
    select: { invoice: { select: { id: true } } },
  });
  if (!job?.invoice) return result;

  const [connection, payments] = await Promise.all([
    prisma.paymentProviderConnection.findUnique({
      where: { ownerId_provider: { ownerId: input.workspaceId, provider: "stripe" } },
      select: { externalAccountId: true },
    }),
    prisma.jobPayment.findMany({
      where: {
        ownerId: input.workspaceId,
        invoiceId: job.invoice.id,
        provider: "stripe",
        status: { in: [...OPEN_PAYMENT_STATUSES] },
      },
      select: { externalPaymentId: true, id: true },
    }),
  ]);
  if (!payments.length) return result;
  if (!connection) return { ...result, failedCount: payments.length };

  for (const payment of payments) {
    try {
      if (!payment.externalPaymentId) {
        await cancelStalePaymentAttempt(input.workspaceId, payment.id);
        result.canceledCount += 1;
        continue;
      }

      const session = await getStripeClient().checkout.sessions.retrieve(
        payment.externalPaymentId,
        {},
        { stripeAccount: connection.externalAccountId },
      );

      if (session.status === "open") {
        await getStripeClient().checkout.sessions.expire(
          session.id,
          {},
          { stripeAccount: connection.externalAccountId },
        );
        await cancelStalePaymentAttempt(input.workspaceId, payment.id);
        result.canceledCount += 1;
        continue;
      }

      if (session.status === "expired") {
        await cancelStalePaymentAttempt(input.workspaceId, payment.id);
        result.canceledCount += 1;
        continue;
      }

      await synchronizeCompletedSession(input.workspaceId, payment.id, session, connection.externalAccountId);
      result.synchronizedCount += 1;
    } catch (error) {
      result.failedCount += 1;
      console.error("Stale Stripe Checkout session could not be retired.", error);
    }
  }

  return result;
}

function cancelStalePaymentAttempt(workspaceId: string, paymentId: string) {
  return applyProviderPaymentEvent({
    workspaceId,
    provider: "stripe",
    paymentId,
    status: "canceled",
    failureCode: "invoice_balance_changed",
    failureMessage: "Checkout was canceled because a manual payment changed the invoice balance.",
  });
}

async function synchronizeCompletedSession(
  workspaceId: string,
  paymentId: string,
  session: Stripe.Checkout.Session,
  connectedAccountId: string,
) {
  const paid = session.payment_status === "paid";
  const paymentMethod = await resolveStripeCheckoutPaymentMethod({
    connectedAccountId,
    session,
    stripe: getStripeClient(),
  });
  return applyProviderPaymentEvent({
    workspaceId,
    provider: "stripe",
    paymentId,
    status: paid ? "succeeded" : "processing",
    paidOn: paid ? new Date() : undefined,
    ...paymentMethod,
    referenceNumber:
      typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? session.id),
  });
}
