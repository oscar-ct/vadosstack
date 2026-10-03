import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyProviderPaymentEvent: vi.fn(),
  attachProviderPaymentReference: vi.fn(),
  consumeRateLimit: vi.fn(),
  createInvoicePaymentAttempt: vi.fn(),
  createSession: vi.fn(),
  findPayment: vi.fn(),
  getCompanyLogoSrc: vi.fn(),
  getRateLimitIp: vi.fn(),
  resolveInvoicePaymentLink: vi.fn(),
  retrieveAccount: vi.fn(),
  retrieveSession: vi.fn(),
}));

vi.mock("@/lib/company-logo", () => ({ getCompanyLogoSrc: mocks.getCompanyLogoSrc }));
vi.mock("@/lib/payments/ledger", () => ({
  applyProviderPaymentEvent: mocks.applyProviderPaymentEvent,
  attachProviderPaymentReference: mocks.attachProviderPaymentReference,
  createInvoicePaymentAttempt: mocks.createInvoicePaymentAttempt,
}));
vi.mock("@/lib/payments/payment-links", () => ({ resolveInvoicePaymentLink: mocks.resolveInvoicePaymentLink }));
vi.mock("@/lib/payments/stripe", () => ({
  getPublicSiteUrl: () => "http://localhost:3000",
  getStripeClient: () => ({
    accounts: { retrieve: mocks.retrieveAccount },
    checkout: { sessions: { create: mocks.createSession, retrieve: mocks.retrieveSession } },
  }),
}));
vi.mock("@/lib/payments/stripe-payment-methods", () => ({
  getStripeCheckoutPaymentMethodTypes: () => ["card"],
  resolveStripeCheckoutPaymentMethod: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { jobPayment: { findFirst: mocks.findPayment } },
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  getRateLimitIp: mocks.getRateLimitIp,
}));

import { startStripeCheckoutAction } from "@/app/pay/[token]/actions";

describe("Stripe Checkout action", () => {
  beforeEach(() => {
    mocks.getRateLimitIp.mockResolvedValue("127.0.0.1");
    mocks.consumeRateLimit.mockResolvedValue(true);
    mocks.resolveInvoicePaymentLink.mockResolvedValue({
      invoiceId: "invoice-1",
      ownerId: "workspace-1",
      invoice: {
        amountPaid: "1953.00",
        balanceDue: "0.91",
        customerEmail: "customer@example.com",
        finalCost: "1953.91",
        id: "invoice-1",
        invoiceNumber: "INV0005",
        issuedAt: new Date("2026-05-26T12:00:00.000Z"),
        job: { laborItems: "[]" },
        jobTitle: "Exterior door replacement",
        laborCost: "1040.00",
        materialTaxAmount: "148.91",
        materialTaxRate: "8.25",
        materials: "[]",
        materialsSubtotal: "765.00",
        owner: {
          invoiceDueDays: 15,
          name: "Test Company",
          paymentProviderConnections: [
            {
              accountType: "standard",
              chargesEnabled: true,
              externalAccountId: "acct_123",
              status: "active",
            },
          ],
        },
      },
    });
    mocks.findPayment.mockResolvedValue({
      externalPaymentId: "cs_missing",
      id: "payment-stale",
    });
    mocks.retrieveSession.mockRejectedValue({ code: "resource_missing" });
    mocks.applyProviderPaymentEvent.mockResolvedValue({});
    mocks.createInvoicePaymentAttempt.mockResolvedValue({
      amount: "0.91",
      applicationFeeAmount: "0.05",
      id: "payment-new",
    });
    mocks.getCompanyLogoSrc.mockResolvedValue("");
    mocks.retrieveAccount.mockResolvedValue({ capabilities: { card_payments: "active" } });
    mocks.createSession.mockResolvedValue({ id: "cs_new", url: "https://checkout.stripe.com/new" });
    mocks.attachProviderPaymentReference.mockResolvedValue({});
  });

  it("replaces a stale payment attempt when its Stripe session no longer exists", async () => {
    const formData = new FormData();
    formData.set("token", "valid-token");

    const result = await startStripeCheckoutAction({ message: "", success: false }, formData);

    expect(mocks.applyProviderPaymentEvent).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      provider: "stripe",
      paymentId: "payment-stale",
      status: "failed",
      failureCode: "checkout_session_missing",
      failureMessage: "The saved Stripe Checkout session no longer exists in the connected Stripe account.",
    });
    expect(mocks.createInvoicePaymentAttempt).toHaveBeenCalled();
    expect(mocks.createSession).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: "Redirecting to secure checkout…",
      checkoutUrl: "https://checkout.stripe.com/new",
    });
  });
});
