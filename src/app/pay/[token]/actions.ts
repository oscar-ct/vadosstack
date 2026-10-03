"use server";

import { Prisma } from "@prisma/client";
import { addDays, format } from "date-fns";
import type Stripe from "stripe";

import { getCompanyLogoSrc } from "@/lib/company-logo";
import { decimalMoneyToMinorUnits } from "@/lib/payments/domain";
import {
  applyProviderPaymentEvent,
  attachProviderPaymentReference,
  createInvoicePaymentAttempt,
} from "@/lib/payments/ledger";
import { resolveInvoicePaymentLink } from "@/lib/payments/payment-links";
import { getPublicSiteUrl, getStripeClient } from "@/lib/payments/stripe";
import {
  getStripeCheckoutPaymentMethodTypes,
  resolveStripeCheckoutPaymentMethod,
} from "@/lib/payments/stripe-payment-methods";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, getRateLimitIp } from "@/lib/rate-limit";

import { randomUUID } from "node:crypto";

export type StripeCheckoutState = { success: boolean; message: string; checkoutUrl?: string };

const OPEN_PAYMENT_STATUSES = ["created", "pending", "processing"] as const;
const CHECKOUT_PRESENTATION_VERSION = "5";
type ResolvedPaymentInvoice = NonNullable<Awaited<ReturnType<typeof resolveInvoicePaymentLink>>>["invoice"];

function countJsonItems(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => item?.description || item?.price).length : 0;
  } catch {
    return 0;
  }
}

function checkoutProductData(input: { description: string; images?: string[]; name: string }) {
  return {
    description: input.description.slice(0, 500),
    images: input.images,
    name: input.name.slice(0, 127),
  };
}

function isMissingStripeResource(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "resource_missing");
}

function buildCheckoutLineItems(input: {
  amountMinor: number;
  companyLogoUrl?: string;
  invoice: ResolvedPaymentInvoice;
}) {
  const invoiceNumber = input.invoice.invoiceNumber ?? input.invoice.id.slice(-6).toUpperCase();
  const images = input.companyLogoUrl ? [input.companyLogoUrl] : undefined;
  const laborMinor = decimalMoneyToMinorUnits(input.invoice.laborCost.toString());
  const materialsMinor = decimalMoneyToMinorUnits(input.invoice.materialsSubtotal.toString());
  const taxMinor = decimalMoneyToMinorUnits(input.invoice.materialTaxAmount.toString());
  const otherFeesMinor = input.invoice.otherFeesEnabled
    ? decimalMoneyToMinorUnits(input.invoice.otherFeesAmount.toString())
    : 0;
  const materialItemCount = countJsonItems(input.invoice.materials);
  const breakdown = [
    laborMinor > 0
      ? {
          amount: laborMinor,
          description: input.invoice.job.laborItems
            ? `${input.invoice.jobTitle} · Labor and professional services`
            : input.invoice.jobTitle,
          name: `Invoice ${invoiceNumber} · Labor`,
        }
      : null,
    materialsMinor > 0
      ? {
          amount: materialsMinor,
          description: `${input.invoice.jobTitle} · ${materialItemCount || "Invoice"} material item${materialItemCount === 1 ? "" : "s"}`,
          name: `Invoice ${invoiceNumber} · Materials`,
        }
      : null,
    taxMinor > 0
      ? {
          amount: taxMinor,
          description: `Tax calculated for ${input.invoice.jobTitle}`,
          name: `Invoice ${invoiceNumber} · Sales tax (${Number(input.invoice.materialTaxRate)}%)`,
        }
      : null,
    otherFeesMinor > 0
      ? {
          amount: otherFeesMinor,
          description: `Additional charges for ${input.invoice.jobTitle}`,
          name: `Invoice ${invoiceNumber} · Other fees and charges (${Number(input.invoice.otherFeesRate)}%)`,
        }
      : null,
  ].filter((item): item is { amount: number; description: string; name: string } => Boolean(item));

  if (breakdown.length && breakdown.reduce((total, item) => total + item.amount, 0) === input.amountMinor) {
    return breakdown.map((item, index) => ({
      price_data: {
        currency: "usd",
        product_data: checkoutProductData({
          description: item.description,
          images: index === 0 ? images : undefined,
          name: item.name,
        }),
        unit_amount: item.amount,
      },
      quantity: 1,
    })) satisfies Stripe.Checkout.SessionCreateParams.LineItem[];
  }

  const dueDate = addDays(input.invoice.issuedAt, input.invoice.owner.invoiceDueDays);
  const paidMinor = decimalMoneyToMinorUnits(input.invoice.amountPaid.toString());
  const details = [
    input.invoice.jobTitle,
    `Original invoice: $${Number(input.invoice.finalCost).toFixed(2)}`,
    paidMinor > 0 ? `Payments received: $${(paidMinor / 100).toFixed(2)}` : null,
    `Due ${format(dueDate, "MMM d, yyyy")}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    {
      price_data: {
        currency: "usd",
        product_data: checkoutProductData({
          description: details,
          images,
          name: `Remaining balance · Invoice ${invoiceNumber}`,
        }),
        unit_amount: input.amountMinor,
      },
      quantity: 1,
    },
  ] satisfies Stripe.Checkout.SessionCreateParams.LineItem[];
}

async function resumeExistingStripeCheckout(input: {
  workspaceId: string;
  invoiceId: string;
  connectedAccountId: string;
  cancelUrl: string;
  successUrl: string;
}): Promise<StripeCheckoutState | null> {
  const payment = await prisma.jobPayment.findFirst({
    where: {
      ownerId: input.workspaceId,
      invoiceId: input.invoiceId,
      provider: "stripe",
      status: { in: [...OPEN_PAYMENT_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) return null;

  if (!payment.externalPaymentId) {
    return {
      success: false,
      message: "A secure checkout is being prepared. Please wait a moment and try again.",
    };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await getStripeClient().checkout.sessions.retrieve(
      payment.externalPaymentId,
      {},
      { stripeAccount: input.connectedAccountId },
    );
  } catch (error) {
    if (isMissingStripeResource(error)) {
      await applyProviderPaymentEvent({
        workspaceId: input.workspaceId,
        provider: "stripe",
        paymentId: payment.id,
        status: "failed",
        failureCode: "checkout_session_missing",
        failureMessage: "The saved Stripe Checkout session no longer exists in the connected Stripe account.",
      });
      return null;
    }

    console.error("Existing Stripe Checkout session could not be retrieved.", error);
    return {
      success: false,
      message: "The existing secure checkout could not be reopened. Please try again shortly.",
    };
  }

  if (session.status === "open") {
    const belongsToCurrentLink =
      session.cancel_url === input.cancelUrl &&
      session.success_url === input.successUrl &&
      session.metadata?.vadosCheckoutVersion === CHECKOUT_PRESENTATION_VERSION;
    if (belongsToCurrentLink && session.url) {
      return { success: true, message: "Reopening secure checkout…", checkoutUrl: session.url };
    }

    try {
      await getStripeClient().checkout.sessions.expire(session.id, {}, { stripeAccount: input.connectedAccountId });
    } catch (error) {
      console.error("Stale Stripe Checkout session could not be expired.", error);
      return {
        success: false,
        message: "The previous secure checkout is still closing. Please wait a moment and try again.",
      };
    }
    await applyProviderPaymentEvent({
      workspaceId: input.workspaceId,
      provider: "stripe",
      paymentId: payment.id,
      status: "canceled",
      failureCode: "payment_link_replaced",
      failureMessage: "The payment link was replaced while its Stripe Checkout session was open.",
    });
    return null;
  }

  if (session.status === "expired") {
    await applyProviderPaymentEvent({
      workspaceId: input.workspaceId,
      provider: "stripe",
      paymentId: payment.id,
      status: "canceled",
      failureCode: "checkout_session_expired",
      failureMessage: "The Stripe Checkout session expired before payment was completed.",
    });
    return null;
  }

  if (session.status === "complete") {
    const paid = session.payment_status === "paid";
    const paymentMethod = await resolveStripeCheckoutPaymentMethod({
      connectedAccountId: input.connectedAccountId,
      session,
      stripe: getStripeClient(),
    });
    await applyProviderPaymentEvent({
      workspaceId: input.workspaceId,
      provider: "stripe",
      paymentId: payment.id,
      status: paid ? "succeeded" : "processing",
      paidOn: paid ? new Date() : undefined,
      ...paymentMethod,
    });
    return {
      success: false,
      message: paid
        ? "Stripe has received this payment. Refresh the page to see the updated balance."
        : "Stripe is still processing this payment. Please try again after it finishes.",
    };
  }

  return {
    success: false,
    message: "A payment is already in progress for this invoice. Please try again shortly.",
  };
}

export async function startStripeCheckoutAction(
  _previousState: StripeCheckoutState,
  formData: FormData,
): Promise<StripeCheckoutState> {
  const token = String(formData.get("token") ?? "");
  const ip = await getRateLimitIp();
  if (!(await consumeRateLimit("payment-checkout", [ip, token.slice(0, 16)]))) {
    return { success: false, message: "Too many payment attempts. Please wait a few minutes and try again." };
  }

  const link = await resolveInvoicePaymentLink(token);
  if (!link) return { success: false, message: "This payment link is invalid or has expired." };
  if (Number(link.invoice.balanceDue) <= 0) return { success: false, message: "This invoice is already paid." };

  const connection = link.invoice.owner.paymentProviderConnections[0];
  if (
    !connection ||
    connection.accountType !== "standard" ||
    connection.status !== "active" ||
    !connection.chargesEnabled
  ) {
    return { success: false, message: "Online card payments are not available for this company yet." };
  }

  const paymentUrl = new URL(`/pay/${encodeURIComponent(token)}`, getPublicSiteUrl());
  const successUrl = `${paymentUrl.toString()}?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${paymentUrl.toString()}?checkout=canceled`;

  const resumedCheckout = await resumeExistingStripeCheckout({
    workspaceId: link.ownerId,
    invoiceId: link.invoiceId,
    connectedAccountId: connection.externalAccountId,
    cancelUrl,
    successUrl,
  });
  if (resumedCheckout) return resumedCheckout;

  let paymentId: string | undefined;
  try {
    const payment = await createInvoicePaymentAttempt({
      workspaceId: link.ownerId,
      invoiceId: link.invoiceId,
      provider: "stripe",
      idempotencyKey: randomUUID(),
      method: "Stripe",
      methodType: "card_or_wallet",
      currency: "USD",
    });
    paymentId = payment.id;
    const amountMinor = decimalMoneyToMinorUnits(payment.amount.toString());
    const applicationFeeMinor = decimalMoneyToMinorUnits(payment.applicationFeeAmount.toString());
    const metadata = {
      vadosCheckoutVersion: CHECKOUT_PRESENTATION_VERSION,
      vadosPaymentId: payment.id,
      vadosInvoiceId: link.invoice.id,
      vadosWorkspaceId: link.ownerId,
    };
    const rawCompanyLogoSrc = await getCompanyLogoSrc(link.ownerId);
    const companyLogoUrl = /^https:\/\//.test(rawCompanyLogoSrc) ? rawCompanyLogoSrc : undefined;
    const invoiceNumber = link.invoice.invoiceNumber ?? link.invoice.id.slice(-6).toUpperCase();
    const connectedAccount = await getStripeClient().accounts.retrieve(connection.externalAccountId);
    const session = await getStripeClient().checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: getStripeCheckoutPaymentMethodTypes(connectedAccount.capabilities),
        wallet_options: { link: { display: "never" } },
        client_reference_id: payment.id,
        customer_email: link.invoice.customerEmail ?? undefined,
        custom_text: {
          submit: {
            message: `Secure payment for Invoice ${invoiceNumber}. You will return to ${link.invoice.owner.name} after checkout.`,
          },
        },
        line_items: buildCheckoutLineItems({ amountMinor, companyLogoUrl, invoice: link.invoice }),
        metadata,
        payment_intent_data: {
          description: `Invoice ${invoiceNumber} · ${link.invoice.jobTitle}`.slice(0, 1000),
          metadata,
          ...(applicationFeeMinor > 0 ? { application_fee_amount: applicationFeeMinor } : {}),
        },
        expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
      { stripeAccount: connection.externalAccountId, idempotencyKey: payment.id },
    );
    if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
    await attachProviderPaymentReference({
      workspaceId: link.ownerId,
      paymentId: payment.id,
      provider: "stripe",
      externalPaymentId: session.id,
    });
    return { success: true, message: "Redirecting to secure checkout…", checkoutUrl: session.url };
  } catch (error) {
    if (paymentId) {
      await applyProviderPaymentEvent({
        workspaceId: link.ownerId,
        provider: "stripe",
        paymentId,
        status: "failed",
        failureCode: "checkout_creation_failed",
        failureMessage: error instanceof Error ? error.message.slice(0, 500) : "Checkout could not be created.",
      }).catch((syncError) => console.error("Failed Stripe attempt could not be synchronized.", syncError));
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return (
        (await resumeExistingStripeCheckout({
          workspaceId: link.ownerId,
          invoiceId: link.invoiceId,
          connectedAccountId: connection.externalAccountId,
          cancelUrl,
          successUrl,
        })) ?? { success: false, message: "A payment is already in progress for this invoice." }
      );
    }
    console.error("Stripe Checkout creation failed.", error);
    return { success: false, message: "Secure checkout could not be started. Please try again." };
  }
}
