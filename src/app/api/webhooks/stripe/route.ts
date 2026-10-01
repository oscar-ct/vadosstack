import { after, NextResponse } from "next/server";

import type Stripe from "stripe";

import { getStripeClient, getStripeWebhookSecret } from "@/lib/payments/stripe";
import { processStoredStripeWebhookEvent } from "@/lib/payments/stripe-webhook-processor";
import { registerPaymentWebhookEvent } from "@/lib/payments/webhook-events";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawPayload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawPayload, signature, getStripeWebhookSecret());
  } catch (error) {
    console.error("Stripe webhook signature verification failed.", error);
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  const accountId = typeof event.account === "string" ? event.account : null;
  const connection = accountId
    ? await prisma.paymentProviderConnection.findUnique({
        where: { provider_externalAccountId: { provider: "stripe", externalAccountId: accountId } },
      })
    : null;
  const registration = await registerPaymentWebhookEvent({
    workspaceId: connection?.ownerId ?? null,
    provider: "stripe",
    externalEventId: event.id,
    eventType: event.type,
    providerObjectId: "id" in event.data.object ? event.data.object.id : null,
    rawPayload,
  });
  if (registration.duplicate && registration.event.status === "processed") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  after(async () => {
    try {
      await processStoredStripeWebhookEvent(registration.event.id);
    } catch (error) {
      console.error("Stripe webhook processing failed after durable receipt.", error);
    }
  });
  return NextResponse.json({ received: true, queued: true });
}
