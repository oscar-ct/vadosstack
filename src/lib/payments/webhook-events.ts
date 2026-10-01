import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { createHash } from "node:crypto";

export const PAYMENT_WEBHOOK_PROCESSING_LEASE_MS = 5 * 60 * 1000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000] as const;

export function hashWebhookPayload(payload: string | Buffer) {
  return createHash("sha256").update(payload).digest("hex");
}

export async function registerPaymentWebhookEvent(input: {
  workspaceId?: string | null;
  provider: string;
  externalEventId: string;
  eventType: string;
  providerObjectId?: string | null;
  rawPayload: string | Buffer;
}) {
  const payloadHash = hashWebhookPayload(input.rawPayload);

  try {
    const event = await prisma.paymentWebhookEvent.create({
      data: {
        ownerId: input.workspaceId ?? null,
        provider: input.provider,
        externalEventId: input.externalEventId,
        eventType: input.eventType,
        providerObjectId: input.providerObjectId ?? null,
        payloadHash,
        rawPayload: input.rawPayload.toString(),
      },
    });
    return { duplicate: false, event } as const;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;

    const event = await prisma.paymentWebhookEvent.findUniqueOrThrow({
      where: { provider_externalEventId: { provider: input.provider, externalEventId: input.externalEventId } },
    });
    if (event.payloadHash !== payloadHash) throw new Error("Webhook event ID was reused with a different payload.");
    if (!event.rawPayload && event.status !== "processed") {
      const updated = await prisma.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { rawPayload: input.rawPayload.toString() },
      });
      return { duplicate: true, event: updated } as const;
    }
    return { duplicate: true, event } as const;
  }
}

export async function claimPaymentWebhookEvent(id: string, now = new Date()) {
  const staleBefore = new Date(now.getTime() - PAYMENT_WEBHOOK_PROCESSING_LEASE_MS);
  const claimed = await prisma.paymentWebhookEvent.updateMany({
    where: {
      id,
      OR: [
        { status: "received" },
        { status: "failed", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { status: "processing", processingStartedAt: { lt: staleBefore } },
      ],
    },
    data: {
      status: "processing",
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      processingStartedAt: now,
      nextAttemptAt: null,
      lastError: null,
    },
  });
  return claimed.count === 1;
}

export async function completePaymentWebhookEvent(id: string) {
  return prisma.paymentWebhookEvent.update({
    where: { id },
    data: {
      status: "processed",
      processedAt: new Date(),
      processingStartedAt: null,
      nextAttemptAt: null,
      lastError: null,
      rawPayload: null,
    },
  });
}

export async function failPaymentWebhookEvent(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown webhook processing error.";
  const event = await prisma.paymentWebhookEvent.findUnique({ where: { id }, select: { attemptCount: true } });
  const attemptCount = event?.attemptCount ?? 1;
  const delay = RETRY_DELAYS_MS[Math.min(Math.max(attemptCount - 1, 0), RETRY_DELAYS_MS.length - 1)];
  return prisma.paymentWebhookEvent.update({
    where: { id },
    data: {
      status: "failed",
      processingStartedAt: null,
      nextAttemptAt: new Date(Date.now() + delay),
      lastError: message.slice(0, 1000),
    },
  });
}

export async function findDuePaymentWebhookEventIds(provider: string, limit = 25, now = new Date()) {
  const staleBefore = new Date(now.getTime() - PAYMENT_WEBHOOK_PROCESSING_LEASE_MS);
  const events = await prisma.paymentWebhookEvent.findMany({
    where: {
      provider,
      OR: [
        { status: "received" },
        { status: "failed", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { status: "processing", processingStartedAt: { lt: staleBefore } },
      ],
    },
    orderBy: [{ nextAttemptAt: "asc" }, { receivedAt: "asc" }],
    select: { id: true },
    take: Math.max(1, Math.min(limit, 100)),
  });
  return events.map((event) => event.id);
}
