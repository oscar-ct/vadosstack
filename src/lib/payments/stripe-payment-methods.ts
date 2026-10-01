import type Stripe from "stripe";

export type StripePaymentMethodPresentation = {
  method: string;
  methodType: string;
};

export type StripePaymentMethodStatus = "active" | "pending" | "unavailable";

export type StripePaymentMethodReadiness = {
  cards: StripePaymentMethodStatus;
  cashApp: StripePaymentMethodStatus;
};

const DEFAULT_STRIPE_METHOD: StripePaymentMethodPresentation = {
  method: "Stripe",
  methodType: "card_or_wallet",
};

/**
 * Keep the initial Checkout surface intentionally small. Card also enables
 * eligible card-backed wallets such as Apple Pay and Google Pay.
 */
export function getStripeCheckoutPaymentMethodTypes(
  capabilities?: Stripe.Account.Capabilities | null,
): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] {
  const methods: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = ["card"];
  if (capabilities?.cashapp_payments === "active") methods.push("cashapp");
  return methods;
}

export function getStripePaymentMethodReadiness(account: Stripe.Account): StripePaymentMethodReadiness {
  const cardCapability = account.capabilities?.card_payments;
  const cashAppCapability = account.capabilities?.cashapp_payments;
  return {
    cards:
      account.charges_enabled || cardCapability === "active"
        ? "active"
        : cardCapability === "pending"
          ? "pending"
          : "unavailable",
    cashApp: cashAppCapability === "active" ? "active" : cashAppCapability === "pending" ? "pending" : "unavailable",
  };
}

export function getStripePaymentMethodPresentation(paymentMethodType?: string | null): StripePaymentMethodPresentation {
  if (paymentMethodType === "cashapp") {
    return { method: "Cash App Pay", methodType: "wallet" };
  }
  return DEFAULT_STRIPE_METHOD;
}

export function getStripeChargePaymentMethod(charge?: Stripe.Charge | null) {
  return getStripePaymentMethodPresentation(charge?.payment_method_details?.type);
}

export async function resolveStripeCheckoutPaymentMethod(input: {
  connectedAccountId: string;
  session: Stripe.Checkout.Session;
  stripe: Stripe;
}) {
  const expandedIntent = typeof input.session.payment_intent === "string" ? null : input.session.payment_intent;
  const expandedCharge =
    expandedIntent && typeof expandedIntent.latest_charge !== "string" ? expandedIntent.latest_charge : null;
  if (expandedCharge) return getStripeChargePaymentMethod(expandedCharge as Stripe.Charge);

  const paymentIntentId =
    typeof input.session.payment_intent === "string"
      ? input.session.payment_intent
      : (input.session.payment_intent?.id ?? null);
  if (!paymentIntentId) return DEFAULT_STRIPE_METHOD;

  const paymentIntent = await input.stripe.paymentIntents.retrieve(
    paymentIntentId,
    { expand: ["latest_charge"] },
    { stripeAccount: input.connectedAccountId },
  );
  const charge = typeof paymentIntent.latest_charge === "string" ? null : paymentIntent.latest_charge;
  return getStripeChargePaymentMethod(charge as Stripe.Charge | null);
}
