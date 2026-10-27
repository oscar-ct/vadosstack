import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    customer: { update: vi.fn() },
    invoice: { update: vi.fn() },
    job: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    jobPayment: { create: vi.fn(), findMany: vi.fn() },
  };
  return {
    audit: vi.fn(),
    authorize: vi.fn(),
    expireCheckouts: vi.fn(),
    prisma: {
      $transaction: vi.fn(),
      jobPayment: { findUnique: vi.fn() },
    },
    revalidate: vi.fn(),
    transaction,
  };
});

vi.mock("@/lib/authorization", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authorization")>()),
  getPermittedDashboardAuthorization: mocks.authorize,
}));
vi.mock("@/lib/authorization/audit", () => ({ recordAuthorizationAuditEvent: mocks.audit }));
vi.mock("@/lib/payments/stripe-checkout-sessions", () => ({
  expireStripeCheckoutSessionsAfterManualPayment: mocks.expireCheckouts,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/workspace-revalidation", () => ({ revalidateWorkspacePath: mocks.revalidate }));

import { createJobPaymentAction } from "@/app/(main)/w/[workspaceSlug]/dashboard/jobs/actions";

function paymentForm(idempotencyKey = "manual-payment-attempt-1") {
  const form = new FormData();
  form.set("amount", "125.00");
  form.set("description", "Invoice payment");
  form.set("idempotencyKey", idempotencyKey);
  form.set("jobId", "job-1");
  form.set("method", "Check");
  form.set("paidOn", "2026-10-26");
  form.set("paymentType", "invoice_payment");
  form.set("referenceNumber", "1042");
  return form;
}

describe("manual payment idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({
      membership: { id: "membership-1", workspaceSlug: "business-1" },
      principal: { user: { id: "user-1" } },
      workspaceId: "workspace-1",
    });
    mocks.expireCheckouts.mockResolvedValue({ failedCount: 0 });
  });

  it("returns the original payment when the same submission is retried", async () => {
    mocks.prisma.jobPayment.findUnique.mockResolvedValue({ id: "payment-existing" });

    const result = await createJobPaymentAction({ message: "", success: false }, paymentForm());

    expect(result).toMatchObject({ success: true, paymentId: "payment-existing" });
    expect(result.message).toMatch(/already recorded/i);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.expireCheckouts).not.toHaveBeenCalled();
  });

  it("creates the payment and refreshes balances in one database transaction", async () => {
    mocks.prisma.jobPayment.findUnique.mockResolvedValue(null);
    mocks.prisma.$transaction.mockImplementation(async (operation) => operation(mocks.transaction));
    mocks.transaction.job.findUnique
      .mockResolvedValueOnce({ id: "job-1", invoice: { balanceDue: "250.00", id: "invoice-1" } })
      .mockResolvedValueOnce({
        customerId: null,
        finalCost: "250.00",
        id: "job-1",
        invoice: { id: "invoice-1" },
        status: "Scheduled",
      });
    mocks.transaction.jobPayment.create.mockResolvedValue({ id: "payment-new" });
    mocks.transaction.jobPayment.findMany
      .mockResolvedValueOnce([{ amount: "125.00", refundedAmount: "0", status: "succeeded" }])
      .mockResolvedValueOnce([]);

    const result = await createJobPaymentAction({ message: "", success: false }, paymentForm());

    expect(result).toMatchObject({ success: true, paymentId: "payment-new" });
    expect(mocks.prisma.$transaction).toHaveBeenCalledOnce();
    expect(mocks.transaction.jobPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ idempotencyKey: "manual-payment-attempt-1" }),
      }),
    );
    expect(mocks.transaction.job.update).toHaveBeenCalledOnce();
    expect(mocks.transaction.invoice.update).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledWith(expect.any(Object), mocks.transaction);
    expect(mocks.expireCheckouts).toHaveBeenCalledWith({ jobId: "job-1", workspaceId: "workspace-1" });
  });
});
