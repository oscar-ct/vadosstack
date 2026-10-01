import { describe, expect, it } from "vitest";

import {
  getStripeCheckoutPaymentMethodTypes,
  getStripePaymentMethodPresentation,
  getStripePaymentMethodReadiness,
} from "@/lib/payments/stripe-payment-methods";

describe("Stripe payment methods", () => {
  it("offers only cards when optional connected-account capabilities are unavailable", () => {
    expect(getStripeCheckoutPaymentMethodTypes()).toEqual(["card"]);
  });

  it("adds Cash App Pay only when the connected account can accept it and never enables Link", () => {
    expect(
      getStripeCheckoutPaymentMethodTypes({
        cashapp_payments: "active",
        link_payments: "active",
      }),
    ).toEqual(["card", "cashapp"]);
    expect(
      getStripeCheckoutPaymentMethodTypes({
        cashapp_payments: "pending",
        link_payments: "inactive",
      }),
    ).toEqual(["card"]);
  });

  it("records Cash App Pay distinctly while preserving the existing Stripe card label", () => {
    expect(getStripePaymentMethodPresentation("cashapp")).toEqual({
      method: "Cash App Pay",
      methodType: "wallet",
    });
    expect(getStripePaymentMethodPresentation("card")).toEqual({
      method: "Stripe",
      methodType: "card_or_wallet",
    });
  });

  it("summarizes connected-account payment method readiness", () => {
    expect(
      getStripePaymentMethodReadiness({
        capabilities: { card_payments: "active", cashapp_payments: "pending" },
        charges_enabled: true,
      } as never),
    ).toEqual({ cards: "active", cashApp: "pending" });
  });
});
