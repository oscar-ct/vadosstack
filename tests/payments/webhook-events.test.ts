import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    paymentWebhookEvent: {
      create: mocks.create,
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      update: mocks.update,
      updateMany: mocks.updateMany,
    },
  },
}));

import {
  claimPaymentWebhookEvent,
  failPaymentWebhookEvent,
  findDuePaymentWebhookEventIds,
  PAYMENT_WEBHOOK_PROCESSING_LEASE_MS,
  registerPaymentWebhookEvent,
} from "@/lib/payments/webhook-events";

describe("durable payment webhook events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the verified raw payload for later processing", async () => {
    mocks.create.mockImplementation(async ({ data }) => ({ id: "event-1", ...data }));

    const result = await registerPaymentWebhookEvent({
      externalEventId: "evt_123",
      eventType: "checkout.session.completed",
      provider: "stripe",
      rawPayload: '{"id":"evt_123"}',
      workspaceId: "workspace-1",
    });

    expect(result.duplicate).toBe(false);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ rawPayload: '{"id":"evt_123"}' }),
    });
  });

  it("claims new, retryable, or stale processing events with a fresh lease", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const now = new Date("2026-10-01T12:00:00.000Z");

    await expect(claimPaymentWebhookEvent("event-1", now)).resolves.toBe(true);

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "event-1",
        OR: expect.arrayContaining([
          { status: "received" },
          {
            processingStartedAt: { lt: new Date(now.getTime() - PAYMENT_WEBHOOK_PROCESSING_LEASE_MS) },
            status: "processing",
          },
        ]),
      }),
      data: expect.objectContaining({ processingStartedAt: now, status: "processing" }),
    });
  });

  it("backs off failed events instead of retrying in a tight loop", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    mocks.findUnique.mockResolvedValue({ attemptCount: 2 });
    mocks.update.mockResolvedValue({});

    await failPaymentWebhookEvent("event-1", new Error("temporary outage"));

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: expect.objectContaining({
        lastError: "temporary outage",
        nextAttemptAt: new Date("2026-10-01T12:05:00.000Z"),
        processingStartedAt: null,
        status: "failed",
      }),
    });
    vi.useRealTimers();
  });

  it("returns only due event IDs for the retry worker", async () => {
    mocks.findMany.mockResolvedValue([{ id: "event-1" }, { id: "event-2" }]);

    await expect(findDuePaymentWebhookEventIds("stripe", 25)).resolves.toEqual(["event-1", "event-2"]);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));
  });
});
