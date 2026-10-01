import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyProviderPaymentEvent: vi.fn(),
  expire: vi.fn(),
  findConnection: vi.fn(),
  findJob: vi.fn(),
  findPayment: vi.fn(),
  findPayments: vi.fn(),
  retrieve: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    job: { findUnique: mocks.findJob },
    jobPayment: { findFirst: mocks.findPayment, findMany: mocks.findPayments },
    paymentProviderConnection: { findUnique: mocks.findConnection },
  },
}));

vi.mock("@/lib/payments/ledger", () => ({
  applyProviderPaymentEvent: mocks.applyProviderPaymentEvent,
}));

vi.mock("@/lib/payments/stripe", () => ({
  getStripeClient: () => ({
    checkout: { sessions: { expire: mocks.expire, retrieve: mocks.retrieve } },
  }),
}));

import {
  expireStripeCheckoutSessionsAfterManualPayment,
  synchronizeStripeCheckoutReturn,
} from "@/lib/payments/stripe-checkout-sessions";

describe("Stripe Checkout cleanup after manual payments", () => {
  beforeEach(() => {
    mocks.findJob.mockResolvedValue({ invoice: { id: "invoice-1" } });
    mocks.findConnection.mockResolvedValue({ externalAccountId: "acct_123" });
    mocks.findPayments.mockResolvedValue([{ externalPaymentId: "cs_123", id: "payment-1" }]);
    mocks.applyProviderPaymentEvent.mockResolvedValue({});
    mocks.expire.mockResolvedValue({});
  });

  it("expires an open session and cancels its stale payment attempt", async () => {
    mocks.retrieve.mockResolvedValue({ id: "cs_123", payment_status: "unpaid", status: "open" });

    const result = await expireStripeCheckoutSessionsAfterManualPayment({
      workspaceId: "workspace-1",
      jobId: "job-1",
    });

    expect(mocks.expire).toHaveBeenCalledWith("cs_123", {}, { stripeAccount: "acct_123" });
    expect(mocks.applyProviderPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        failureCode: "invoice_balance_changed",
        paymentId: "payment-1",
        status: "canceled",
      }),
    );
    expect(result).toEqual({ canceledCount: 1, failedCount: 0, synchronizedCount: 0 });
  });

  it("synchronizes a checkout that completed before it could be expired", async () => {
    mocks.retrieve.mockResolvedValue({ id: "cs_123", payment_status: "paid", status: "complete" });

    const result = await expireStripeCheckoutSessionsAfterManualPayment({
      workspaceId: "workspace-1",
      jobId: "job-1",
    });

    expect(mocks.expire).not.toHaveBeenCalled();
    expect(mocks.applyProviderPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "payment-1", status: "succeeded" }),
    );
    expect(result).toEqual({ canceledCount: 0, failedCount: 0, synchronizedCount: 1 });
  });

  it("reports a cleanup failure without rolling back the manual payment", async () => {
    mocks.retrieve.mockRejectedValue(new Error("Stripe unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await expireStripeCheckoutSessionsAfterManualPayment({
      workspaceId: "workspace-1",
      jobId: "job-1",
    });

    expect(result).toEqual({ canceledCount: 0, failedCount: 1, synchronizedCount: 0 });
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("Stripe Checkout return synchronization", () => {
  beforeEach(() => {
    mocks.findConnection.mockResolvedValue({ externalAccountId: "acct_123" });
    mocks.findPayment.mockResolvedValue({ externalPaymentId: "cs_123", id: "payment-1", status: "pending" });
    mocks.applyProviderPaymentEvent.mockResolvedValue({});
  });

  it("confirms a paid return immediately instead of waiting for the webhook", async () => {
    mocks.retrieve.mockResolvedValue({
      id: "cs_123",
      metadata: {
        vadosInvoiceId: "invoice-1",
        vadosPaymentId: "payment-1",
        vadosWorkspaceId: "workspace-1",
      },
      payment_status: "paid",
      status: "complete",
    });

    const result = await synchronizeStripeCheckoutReturn({
      workspaceId: "workspace-1",
      invoiceId: "invoice-1",
      sessionId: "cs_123",
    });

    expect(result).toBe("paid");
    expect(mocks.applyProviderPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "payment-1", status: "succeeded" }),
    );
  });

  it("rejects a returned session whose metadata belongs to another invoice", async () => {
    mocks.retrieve.mockResolvedValue({
      id: "cs_123",
      metadata: {
        vadosInvoiceId: "invoice-other",
        vadosPaymentId: "payment-1",
        vadosWorkspaceId: "workspace-1",
      },
      payment_status: "paid",
      status: "complete",
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await synchronizeStripeCheckoutReturn({
      workspaceId: "workspace-1",
      invoiceId: "invoice-1",
      sessionId: "cs_123",
    });

    expect(result).toBe("failed");
    expect(mocks.applyProviderPaymentEvent).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });
});
