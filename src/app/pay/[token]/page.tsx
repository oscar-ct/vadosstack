import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { addDays, format } from "date-fns";
import { CheckCircle2, Download, LockKeyhole, ReceiptText, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { normalizeDocumentMessageAlign, renderDocumentMessage } from "@/lib/document-messages";
import { getInvoicePaymentLinkUnavailableReason, resolveInvoicePaymentLink } from "@/lib/payments/payment-links";
import { getPaymentDisplayMethod, getPaymentDisplayReference } from "@/lib/payments/presentation";
import { synchronizeStripeCheckoutReturn } from "@/lib/payments/stripe-checkout-sessions";
import { formatPhoneNumber } from "@/lib/phone";
import { formatServiceAddress } from "@/lib/service-address";

import { parsePricingItems } from "../../(main)/w/[workspaceSlug]/dashboard/jobs/_components/pricing-items";
import { PrintInvoiceButton } from "./invoice-controls";
import { InvoicePreview } from "./invoice-preview";
import { PayWithStripeButton } from "./pay-button";
import { CheckoutCanceledNotice, PaymentConfirmationStatus } from "./payment-confirmation-status";
import { UnavailablePaymentLink } from "./unavailable-payment-link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pay invoice", robots: { index: false, follow: false } };

function money(value: { toString(): string } | string | number) {
  return `$${Number(value.toString()).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parsePublicMaterials(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((material) => {
        const amount = money(String(material?.price ?? 0));
        return {
          amount: material?.type === "return" ? `− ${amount}` : amount,
          description: String(material?.description ?? "").trim(),
          quantity: String(material?.quantity ?? "").trim(),
          rate: material?.unitPrice ? money(String(material.unitPrice)) : "",
          unit: String(material?.unit ?? "").trim(),
        };
      })
      .filter((material) => material.description || Number(material.amount.replace(/[^0-9.-]/g, "")));
  } catch {
    return [];
  }
}

function displayDate(value: Date | null) {
  return value ? format(value, "MMM d, yyyy") : "Not scheduled";
}

export default async function PayInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const { token } = await params;
  const link = await resolveInvoicePaymentLink(token);
  if (!link) {
    const unavailableReason = await getInvoicePaymentLinkUnavailableReason(token);
    if (unavailableReason) return <UnavailablePaymentLink reason={unavailableReason} />;
    notFound();
  }

  const query = await searchParams;
  const invoice = link.invoice;
  const company = invoice.owner;
  const connection = company.paymentProviderConnections[0];
  const cleanPaymentUrl = `/pay/${encodeURIComponent(token)}`;
  const confirmationPending = query?.checkout === "success" || query?.checkout === "processing";
  if (confirmationPending && Number(invoice.balanceDue) <= 0) redirect(cleanPaymentUrl);
  if (confirmationPending) {
    const checkoutStatus = await synchronizeStripeCheckoutReturn({
      workspaceId: link.ownerId,
      invoiceId: invoice.id,
      sessionId: query?.session_id,
    });
    if (checkoutStatus === "paid") redirect(cleanPaymentUrl);
    if (checkoutStatus === "expired") redirect(`${cleanPaymentUrl}?checkout=canceled`);
  }
  const canPay =
    connection?.accountType === "standard" &&
    connection.status === "active" &&
    connection.chargesEnabled &&
    Number(invoice.balanceDue) > 0;
  const paid = Number(invoice.balanceDue) <= 0;
  const invoiceNumber = invoice.invoiceNumber ?? invoice.id.slice(-6).toUpperCase();
  const dueDate = addDays(invoice.issuedAt, company.invoiceDueDays);
  const serviceLocation = formatServiceAddress(invoice);
  const companyEmail = company.companyEmail ?? company.legacyOwner?.email ?? null;
  const rawCompanyLogoSrc = await getCompanyLogoSrc(invoice.ownerId);
  const companyLogoSrc = rawCompanyLogoSrc.startsWith("/dashboard/") ? null : rawCompanyLogoSrc;
  const laborItems = parsePricingItems(invoice.job.laborItems).map((item) => ({
    amount: money(item.price || 0),
    description: item.description,
    quantity: item.quantity,
    rate: item.unitPrice ? money(item.unitPrice) : undefined,
    unit: item.unit,
  }));
  const materials = parsePublicMaterials(invoice.materials);
  const subtotal = Number(invoice.laborCost) + Number(invoice.materialsSubtotal);
  const message = company.invoiceMessageEnabled
    ? renderDocumentMessage(company.invoiceMessageText, {
        amountPaid: money(invoice.amountPaid),
        balanceDue: money(invoice.balanceDue),
        companyName: company.name,
        customerName: invoice.customerName,
        dueDate: format(dueDate, "MMM d, yyyy"),
        finalCost: money(invoice.finalCost),
        invoiceNumber,
        jobTitle: invoice.jobTitle,
        serviceLocation,
      })
    : null;
  const messageAlignment = normalizeDocumentMessageAlign(company.invoiceMessageAlign);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(99,91,255,0.08),transparent_32%),linear-gradient(to_bottom,var(--color-background),var(--color-muted))] px-4 py-6 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            {companyLogoSrc ? (
              <Image
                alt={`${company.name} logo`}
                className="size-10 rounded-lg object-contain"
                height={40}
                src={companyLogoSrc}
                unoptimized
                width={40}
              />
            ) : (
              <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <ReceiptText className="size-5" />
              </span>
            )}
            <div>
              <h1 className="font-semibold tracking-tight">{company.name}</h1>
              <p className="text-muted-foreground text-sm">Secure invoice portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PrintInvoiceButton />
            <Button asChild size="sm" variant="outline">
              <Link href={`/pay/${token}/invoice`}>
                <Download className="size-4" /> Download PDF
              </Link>
            </Button>
          </div>
        </header>

        {confirmationPending ? <PaymentConfirmationStatus /> : null}
        {query?.checkout === "canceled" ? <CheckoutCanceledNotice cleanUrl={cleanPaymentUrl} /> : null}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] print:block">
          <div className="order-2 min-w-0 lg:order-1">
            <InvoicePreview
              amountPaid={money(invoice.amountPaid)}
              balanceDue={money(invoice.balanceDue)}
              companyAddress={company.companyAddress}
              companyEmail={companyEmail}
              companyLogoSrc={companyLogoSrc}
              companyName={company.name}
              companyPhone={company.companyPhone ? formatPhoneNumber(company.companyPhone) : null}
              customerEmail={invoice.customerEmail}
              customerName={invoice.customerName}
              customerPhone={invoice.customerPhone ? formatPhoneNumber(invoice.customerPhone) : null}
              dateBegin={displayDate(invoice.dateBegin)}
              dateEnd={displayDate(invoice.dateEnd)}
              dueDate={format(dueDate, "MMM d, yyyy")}
              finalCost={money(invoice.finalCost)}
              invoiceNumber={invoiceNumber}
              issuedAt={format(invoice.issuedAt, "MMM d, yyyy")}
              jobDescription={invoice.jobDescription}
              jobTitle={invoice.jobTitle}
              laborItems={laborItems}
              laborTotal={money(invoice.laborCost)}
              materialTaxAmount={money(invoice.materialTaxAmount)}
              materialTaxRate={`${Number(invoice.materialTaxRate)}%`}
              otherFeesEnabled={invoice.otherFeesEnabled}
              otherFeesRate={`${Number(invoice.otherFeesRate)}%`}
              otherFeesAmount={money(invoice.otherFeesAmount)}
              materials={materials}
              materialsTotal={money(invoice.materialsSubtotal)}
              message={message}
              messageAlign={messageAlignment}
              payments={invoice.job.payments.map((payment) => ({
                amount: money(payment.amount),
                date: format(payment.paidOn, "MM/dd/yy"),
                description: payment.description,
                id: payment.id,
                method: getPaymentDisplayMethod(payment),
                referenceNumber: getPaymentDisplayReference(payment),
              }))}
              serviceLocation={serviceLocation}
              subtotal={money(subtotal)}
            />
          </div>

          <aside className="order-1 grid gap-4 lg:sticky lg:top-6 lg:order-2 print:hidden">
            <Card className="border-primary/15 shadow-black/5 shadow-xl">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">
                    Invoice {invoiceNumber}
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 text-xs dark:text-emerald-300">
                    <ShieldCheck className="size-3.5" /> Secure
                  </span>
                </div>
                <CardDescription className="pt-3">Balance due</CardDescription>
                <CardTitle className="text-4xl tabular-nums">{money(invoice.balanceDue)}</CardTitle>
                <p className="text-muted-foreground text-sm">Due {format(dueDate, "MMMM d, yyyy")}</p>
              </CardHeader>
              <CardContent className="grid gap-4">
                {paid ? (
                  <div className="rounded-xl bg-emerald-50 p-5 text-center text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle2 className="mx-auto mb-2 size-7" />
                    <div className="font-semibold">Paid in full</div>
                    <div className="mt-1 text-sm">No balance remains on this invoice.</div>
                  </div>
                ) : confirmationPending ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
                    <div className="font-semibold">Confirming payment</div>
                    <div className="mt-1 text-sm">Please don&apos;t submit another payment.</div>
                  </div>
                ) : canPay ? (
                  <PayWithStripeButton token={token} />
                ) : (
                  <div className="rounded-xl border p-4 text-center">
                    <Badge variant="outline">Online payments unavailable</Badge>
                    <p className="mt-2 text-muted-foreground text-sm">
                      Please contact {company.name} for another payment method.
                    </p>
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-muted-foreground text-xs leading-5">
                  <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
                  Card and bank details are collected securely by Stripe and are never stored by VadosStack.
                </div>
                <div className="border-t pt-4 text-center text-muted-foreground text-xs">
                  Questions?{" "}
                  {companyEmail ? (
                    <a className="font-medium text-foreground hover:underline" href={`mailto:${companyEmail}`}>
                      {companyEmail}
                    </a>
                  ) : (
                    `Contact ${company.name}.`
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>

        <footer className="text-center text-muted-foreground text-xs print:hidden">
          Invoice provided by {company.name}. Payments are processed securely by Stripe.
        </footer>
      </div>
    </main>
  );
}
