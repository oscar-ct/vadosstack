import Stripe from "stripe";

let stripeClient: Stripe | undefined;

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured.");
  stripeClient ??= new Stripe(secretKey, { appInfo: { name: "VadosStack" } });
  return stripeClient;
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return secret;
}

export function getStripeConnectedAccountCountry() {
  const country = process.env.STRIPE_CONNECTED_ACCOUNT_COUNTRY?.trim().toUpperCase() || "US";
  if (!/^[A-Z]{2}$/.test(country)) throw new Error("STRIPE_CONNECTED_ACCOUNT_COUNTRY must be a two-letter code.");
  return country;
}

export function getPublicSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!value) throw new Error("NEXT_PUBLIC_SITE_URL is not configured.");
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in production.");
  }
  return url.origin;
}
