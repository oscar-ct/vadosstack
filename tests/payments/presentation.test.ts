import { describe, expect, it } from "vitest";

import {
  formatPaymentReference,
  getPaymentDisplayMethod,
  getPaymentDisplayReference,
} from "@/lib/payments/presentation";

describe("payment presentation", () => {
  it("normalizes Stripe methods and falls back to its searchable provider reference", () => {
    const payment = {
      externalPaymentId: "cs_test_123",
      method: "Stripe Checkout",
      provider: "stripe",
      referenceNumber: null,
    };

    expect(getPaymentDisplayMethod(payment)).toBe("Stripe");
    expect(getPaymentDisplayReference(payment)).toBe("cs_test_123");
  });

  it("preserves manual payment methods and references", () => {
    const payment = {
      externalPaymentId: null,
      method: "Check",
      provider: "manual",
      referenceNumber: "1125",
    };

    expect(getPaymentDisplayMethod(payment)).toBe("Check");
    expect(getPaymentDisplayReference(payment)).toBe("1125");
  });

  it("shows Cash App Pay distinctly from a Stripe card payment", () => {
    expect(getPaymentDisplayMethod({ method: "Cash App Pay", provider: "stripe" })).toBe("Cash App Pay");
  });

  it("shortens long provider references to their final six characters", () => {
    expect(formatPaymentReference("cs_test_b15a8mZGakSw5BvXK7kW0o")).toBe("K7kW0o");
    expect(formatPaymentReference("1125")).toBe("1125");
  });
});
