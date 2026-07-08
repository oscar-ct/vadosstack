import { Fragment } from "react";

import Image from "next/image";
import { notFound } from "next/navigation";

import { addDays, format } from "date-fns";
import { BriefcaseBusiness, CalendarDays, Mail, MapPin, Phone, ReceiptText, UserRound } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { BackButton } from "@/components/back-button";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import {
  getDocumentMessageAlignClass,
  getDocumentMessageLineItems,
  normalizeDocumentMessageAlign,
  renderDocumentMessage,
} from "@/lib/document-messages";
import { formatDocumentNumber } from "@/lib/document-number";
import { getRenderedDocumentEmailTemplates } from "@/lib/email-templates";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

import { parsePricingItems } from "../../jobs/_components/pricing-items";
import { createJobPaymentAction, deleteJobPaymentAction } from "../../jobs/actions";
import { DeleteInvoiceButton, InvoiceActions, ManageInvoiceDialogButton } from "../_components/invoice-actions";
import type { InvoiceTableItem } from "../_components/invoices-table";
import { deleteInvoiceAction, emailInvoiceAction } from "../actions";

type InvoiceMaterial = {
  description: string;
  type: "purchase" | "return";
  vendor: string;
  purchaseDate: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  price: string;
};

function parseMaterials(value: string): InvoiceMaterial[] {
  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((material) => ({
      description: String(material?.description ?? ""),
      type: material?.type === "return" ? "return" : "purchase",
      vendor: String(material?.vendor ?? ""),
      purchaseDate: String(material?.purchaseDate ?? ""),
      quantity: String(material?.quantity ?? ""),
      unit: String(material?.unit ?? ""),
      unitPrice: String(material?.unitPrice ?? ""),
      price: String(material?.price ?? "0"),
    }));
  } catch {
    return [];
  }
}

function formatMoney(value: { toString: () => string } | string | number) {
  return `$${Number(value.toString()).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function formatOptionalMoney(value?: string) {
  return value ? formatMoney(value) : "-";
}

function formatNegativeOptionalMoney(value?: string) {
  return value ? `-${formatOptionalMoney(value)}` : "-";
}

function formatDash(value?: string) {
  return value?.trim() ? value : "-";
}

function formatLineMeta(item: { quantity?: string; unit?: string; unitPrice?: string }) {
  return [
    item.quantity?.trim() ? `Qty ${item.quantity}` : null,
    item.unit?.trim() ? `Unit ${item.unit}` : null,
    item.unitPrice?.trim() ? `Rate ${formatOptionalMoney(item.unitPrice)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatShortDate(value: Date) {
  return format(value, "MM/dd/yy");
}

function formatMaybeDate(value: Date | null) {
  return value ? formatShortDate(value) : "Not scheduled";
}

function formatMaterialDate(value: string) {
  if (!value) return "";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatShortDate(date);
}

function createUniqueRowKey(baseKey: string, seenKeys: Map<string, number>) {
  const count = seenKeys.get(baseKey) ?? 0;
  seenKeys.set(baseKey, count + 1);

  return count ? `${baseKey}-${count}` : baseKey;
}

const gmailErrorMessages: Record<string, string> = {
  callback: "Gmail could not be connected. Please try again.",
  config: "Google OAuth is not configured for Gmail sending yet.",
  denied: "Gmail connection was cancelled.",
  mismatch: "Connect the same Google account you use to sign in.",
  refresh: "Google did not return offline Gmail access. Please try connecting again.",
  scope: "Gmail send permission was not granted.",
  state: "Gmail connection expired. Please try again.",
  unverified: "Google has not verified that email address.",
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{
    invoiceId: string;
  }>;
  searchParams?: Promise<{
    from?: string;
    gmail_connected?: string;
    gmail_error?: string;
  }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view invoices"
        description="Invoice records are private to each signed-in account."
      />
    );
  }

  const [{ invoiceId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const backHref =
    resolvedSearchParams?.from === "jobs"
      ? "/dashboard/jobs"
      : resolvedSearchParams?.from === "invoices"
        ? "/dashboard/invoices"
        : "/dashboard/invoices";
  const invoice = await prisma.invoice.findUnique({
    where: {
      id_ownerId: {
        id: invoiceId,
        ownerId: currentUser.id,
      },
    },
    include: {
      job: {
        include: {
          payments: {
            orderBy: [{ paidOn: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  const companyLogoSrc = await getCompanyLogoSrc(currentUser.id);

  const invoiceSequence = await prisma.invoice.count({
    where: {
      ownerId: currentUser.id,
      issuedAt: {
        lte: invoice.issuedAt,
      },
    },
  });
  const laborItems = parsePricingItems(invoice.job.laborItems);
  const laborKeyCounts = new Map<string, number>();
  const keyedLaborItems = laborItems.map((item) => ({
    ...item,
    rowKey: createUniqueRowKey(
      `labor-${item.description}-${item.quantity ?? ""}-${item.unit ?? ""}-${item.unitPrice ?? ""}-${item.price}`,
      laborKeyCounts,
    ),
  }));
  const materials = parseMaterials(invoice.materials);
  const purchaseMaterials = materials.filter((material) => material.type !== "return");
  const returnMaterials = materials.filter((material) => material.type === "return");
  const purchaseKeyCounts = new Map<string, number>();
  const keyedPurchaseMaterials = purchaseMaterials.map((material) => ({
    ...material,
    rowKey: createUniqueRowKey(
      `purchase-${material.description}-${material.purchaseDate}-${material.vendor}-${material.quantity}-${material.unit}-${material.unitPrice}-${material.price}`,
      purchaseKeyCounts,
    ),
  }));
  const returnKeyCounts = new Map<string, number>();
  const keyedReturnMaterials = returnMaterials.map((material) => ({
    ...material,
    rowKey: createUniqueRowKey(
      `return-${material.description}-${material.purchaseDate}-${material.vendor}-${material.price}`,
      returnKeyCounts,
    ),
  }));
  const purchaseGridColumns = purchaseMaterials.some((material) => material.vendor || material.purchaseDate)
    ? "1fr 5.5rem 5.5rem 3.75rem 4.25rem 4.75rem 5rem"
    : "1fr 3.75rem 4.25rem 4.75rem 5rem";
  const showPurchaseMeta = purchaseGridColumns.includes("5.5rem 5.5rem");
  const showPurchaseQtyRate = purchaseMaterials.some(
    (material) => material.quantity || material.unit || material.unitPrice,
  );
  const visiblePurchaseGridColumns = showPurchaseQtyRate
    ? purchaseGridColumns
    : showPurchaseMeta
      ? "1fr 5.5rem 5.5rem 5rem"
      : "1fr 5rem";
  const returnTotal = returnMaterials.reduce((total, material) => total + Number(material.price || 0), 0);
  const payments = invoice.job.payments;
  const laborSubtotal = Number(invoice.laborCost);
  const materialsSubtotal = Number(invoice.materialsSubtotal);
  const subtotal = laborSubtotal + materialsSubtotal;
  const taxableItemsLabel = invoice.job.jobType === "Commercial" ? "labor + materials" : "materials";
  const invoiceNumber = invoice.invoiceNumber ?? formatDocumentNumber("INV", invoiceSequence);
  const companyAddress = currentUser.companyAddress?.trim();
  const companyEmail = currentUser.companyEmail ?? currentUser.email;
  const dueDate = addDays(invoice.issuedAt, currentUser.invoiceDueDays);
  const invoiceMessageContext = {
    amountPaid: formatMoney(invoice.amountPaid),
    balanceDue: formatMoney(invoice.balanceDue),
    companyName: currentUser.companyName,
    customerName: invoice.customerName,
    dueDate: format(dueDate, "MMM d, yyyy"),
    finalCost: formatMoney(invoice.finalCost),
    invoiceNumber,
    jobTitle: invoice.jobTitle,
    serviceLocation: invoice.serviceLocation,
  };
  const invoiceMessage = currentUser.invoiceMessageEnabled
    ? renderDocumentMessage(currentUser.invoiceMessageText, invoiceMessageContext)
    : "";
  const invoiceMessageLines = getDocumentMessageLineItems(invoiceMessage);
  const invoiceMessageAlign = normalizeDocumentMessageAlign(currentUser.invoiceMessageAlign);
  const googleMailAccount = await prisma.googleMailAccount.findUnique({
    where: {
      userId: currentUser.id,
    },
  });
  const currentHref = `/dashboard/invoices/${invoice.id}?from=${resolvedSearchParams?.from ?? "invoices"}`;
  const managedInvoice: InvoiceTableItem = {
    id: invoice.id,
    jobId: invoice.jobId,
    customerId: invoice.customerId ?? undefined,
    customerName: invoice.customerName ?? undefined,
    invoiceNumber,
    href: currentHref,
    issuedAt: invoice.issuedAt.toISOString(),
    dueAt: dueDate.toISOString(),
    jobTitle: invoice.jobTitle,
    jobDescription: invoice.jobDescription ?? undefined,
    jobNumber: invoice.jobId.slice(-6).toUpperCase(),
    jobHref: `/dashboard/jobs/${invoice.jobId}`,
    jobServiceLocation: invoice.serviceLocation ?? undefined,
    paymentStatus: invoice.paymentStatus,
    laborCost: invoice.laborCost.toString(),
    materialsSubtotal: invoice.materialsSubtotal.toString(),
    materialTaxAmount: invoice.materialTaxAmount.toString(),
    depositPaid: invoice.depositPaid.toString(),
    amountPaid: invoice.amountPaid.toString(),
    balanceDue: invoice.balanceDue.toString(),
    total: invoice.finalCost.toString(),
    payments: invoice.job.payments.map((payment) => ({
      id: payment.id,
      paidOn: payment.paidOn.toISOString(),
      amount: payment.amount.toString(),
      paymentType: payment.paymentType,
      method: payment.method,
      referenceNumber: payment.referenceNumber ?? undefined,
      description: payment.description,
      notes: payment.notes ?? undefined,
      createdAt: payment.createdAt.toISOString(),
    })),
  };
  const gmailError = resolvedSearchParams?.gmail_error;
  const gmailNotice = resolvedSearchParams?.gmail_connected
    ? { message: "Gmail is connected. You can email invoices from this account.", type: "success" as const }
    : gmailError
      ? { message: gmailErrorMessages[gmailError] ?? "Gmail could not be connected.", type: "error" as const }
      : null;
  const emailTemplates = await getRenderedDocumentEmailTemplates({
    ownerId: currentUser.id,
    scope: "invoice",
    context: {
      balanceDue: formatMoney(invoice.balanceDue),
      companyEmail,
      companyName: currentUser.companyName,
      companyPhone: currentUser.companyPhone ? formatPhoneNumber(currentUser.companyPhone) : undefined,
      customerEmail: invoice.customerEmail,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone ? formatPhoneNumber(invoice.customerPhone) : undefined,
      dueDate: format(dueDate, "MMM d, yyyy"),
      invoiceNumber,
      jobTitle: invoice.jobTitle,
      serviceLocation: invoice.serviceLocation,
    },
  });

  return (
    <div className="mx-auto grid gap-4 md:h-[calc(100svh-6rem)] md:max-w-5xl md:grid-rows-[auto_minmax(0,1fr)] md:overflow-hidden print:h-auto print:max-w-none print:gap-0 print:overflow-visible print:p-0 print:text-[10px]">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackButton fallbackHref={backHref} />
        <div className="flex flex-wrap items-center gap-2">
          <ManageInvoiceDialogButton
            createJobPaymentAction={createJobPaymentAction}
            deleteJobPaymentAction={deleteJobPaymentAction}
            invoice={managedInvoice}
          />
          <InvoiceActions
            action={emailInvoiceAction}
            balanceDue={formatMoney(invoice.balanceDue)}
            companyName={currentUser.companyName}
            customerEmail={invoice.customerEmail}
            customerName={invoice.customerName}
            dueDate={format(dueDate, "MMM d, yyyy")}
            gmailConnected={Boolean(googleMailAccount)}
            gmailSenderEmail={googleMailAccount?.email ?? null}
            invoiceId={invoice.id}
            invoiceMessageAlign={invoiceMessageAlign}
            invoiceMessageEnabled={currentUser.invoiceMessageEnabled}
            invoiceMessageText={currentUser.invoiceMessageText}
            invoiceNumber={invoiceNumber}
            notice={gmailNotice}
            returnTo={currentHref}
            templates={emailTemplates}
          />
          <DeleteInvoiceButton
            action={deleteInvoiceAction}
            invoiceId={invoice.id}
            redirectTo={backHref}
            snapshot={{
              balanceDue: formatMoney(invoice.balanceDue),
              customerName: invoice.customerName,
              dueDate: format(dueDate, "MMM d, yyyy"),
              invoiceNumber,
              jobTitle: invoice.jobTitle,
              serviceLocation: invoice.serviceLocation,
            }}
          />
        </div>
      </div>

      <div className="-mx-4 min-h-0 overflow-auto px-4 pb-4 print:contents">
        <article className="mx-auto grid w-full max-w-full gap-4 rounded-md border bg-card p-4 shadow-sm md:min-h-[1056px] md:w-[816px] md:max-w-none md:gap-3 md:p-5 print:min-h-[9.6in] print:w-auto print:gap-3 print:border-0 print:bg-white print:p-5 print:text-neutral-950 print:shadow-none">
          <header className="grid gap-4 pb-2 md:grid-cols-[1fr_auto] print:pb-2">
            <div className="grid gap-1">
              <div className="mb-2 flex items-start gap-3">
                {/*<div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/20 print:size-10 print:border-neutral-300 print:bg-neutral-50">*/}
                <Image
                  src={companyLogoSrc}
                  alt="companyLogo"
                  width={56}
                  height={56}
                  unoptimized
                  className="object-contain p-1"
                />
                {/*</div>*/}
                <div className="grid gap-0.5">
                  <div className="font-semibold text-lg leading-none print:text-sm">{currentUser.companyName}</div>
                  {companyAddress ? (
                    <div className="whitespace-pre-line text-muted-foreground text-xs leading-relaxed">
                      {companyAddress}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="size-3" />
                      <span>{companyEmail}</span>
                    </span>
                    {currentUser.companyPhone ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="size-3" />
                        <span>{formatPhoneNumber(currentUser.companyPhone)}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 font-semibold text-xl print:mt-2 print:text-base">
                <ReceiptText className="size-5 text-muted-foreground print:size-4" />
                Invoice
              </div>
              <div className={"grid gap-0.5 text-muted-foreground text-xs"}>
                <span>Invoice #{invoiceNumber}</span>
                <span>Issued {formatShortDate(invoice.issuedAt)}</span>
              </div>
            </div>
            <div className="grid gap-1 rounded-md border bg-muted/20 p-3 text-left md:text-right print:border-neutral-300 print:bg-neutral-50 print:p-2">
              <span className="text-muted-foreground text-xs">Balance due</span>
              <span className="font-semibold text-2xl text-rose-700 dark:text-rose-400 print:text-xl">
                {formatMoney(invoice.balanceDue)}
              </span>
              <span className="text-muted-foreground text-xs">by {formatShortDate(dueDate)}</span>
            </div>
          </header>

          <section className="overflow-hidden rounded-md border bg-muted/20 text-xs print:border-neutral-300 print:bg-neutral-50">
            <div className="grid md:grid-cols-2">
              <div className="grid gap-1 border-b p-2 md:border-r">
                <div className="flex items-center gap-2 font-medium text-muted-foreground">
                  <UserRound className="size-3.5" />
                  Bill To
                </div>
                <div>
                  <div className="font-medium">{invoice.customerName ?? "No customer on file"}</div>
                  <div className="text-muted-foreground">{invoice.customerEmail ?? "No email on file"}</div>
                  <div className="text-muted-foreground">
                    {invoice.customerPhone ? formatPhoneNumber(invoice.customerPhone) : "No phone on file"}
                  </div>
                </div>
              </div>
              <div className="grid gap-1 border-b p-2">
                <div className="flex items-center gap-2 font-medium text-muted-foreground">
                  <BriefcaseBusiness className="size-3.5" />
                  Job
                </div>
                <div className="font-medium">{invoice.jobTitle}</div>
              </div>
              <div className="grid gap-1 border-b p-2 md:border-r md:border-b-0">
                <div className="flex items-center gap-2 font-medium text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  Schedule
                </div>
                <div className="grid gap-0.5">
                  <div>Start: {formatMaybeDate(invoice.dateBegin)}</div>
                  <div>End: {formatMaybeDate(invoice.dateEnd)}</div>
                </div>
              </div>
              <div className="grid gap-1 p-2">
                <div className="flex items-center gap-2 font-medium text-muted-foreground">
                  <MapPin className="size-3.5" />
                  Service Location
                </div>
                <div>{invoice.serviceLocation ?? "Not on file"}</div>
              </div>
            </div>
          </section>

          {invoice.jobDescription ? (
            <section className="grid gap-1">
              <div className="font-medium text-xs">Job Description</div>
              <p className="whitespace-pre-line rounded-md border bg-muted/20 p-2 text-xs print:line-clamp-3 print:border-neutral-300 print:bg-neutral-50">
                {invoice.jobDescription}
              </p>
            </section>
          ) : null}

          <section className="grid gap-2">
            <div className="font-medium text-xs">Labor</div>
            <div className="grid gap-2 md:hidden print:hidden">
              {keyedLaborItems.length ? (
                keyedLaborItems.map((item) => (
                  <div key={item.rowKey} className="rounded-md border bg-muted/20 p-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium leading-snug">{formatDash(item.description)}</div>
                        {formatLineMeta(item) ? (
                          <div className="mt-1 text-muted-foreground">{formatLineMeta(item)}</div>
                        ) : null}
                      </div>
                      <div className="shrink-0 font-semibold tabular-nums">{formatOptionalMoney(item.price)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border bg-muted/20 p-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Labor</span>
                    <span className="font-semibold tabular-nums">{formatMoney(invoice.laborCost)}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="hidden overflow-hidden rounded-md border md:block print:block print:border-neutral-300">
              <div className="grid grid-cols-[minmax(0,1fr)_3.75rem_4.25rem_4.75rem_5rem] gap-2 border-b bg-muted/20 px-2 py-1.5 font-medium text-xs print:border-neutral-300 print:bg-neutral-100">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Amount</span>
              </div>
              {keyedLaborItems.length ? (
                keyedLaborItems.map((item) => (
                  <div
                    key={item.rowKey}
                    className="grid grid-cols-[minmax(0,1fr)_3.75rem_4.25rem_4.75rem_5rem] gap-2 border-b px-2 py-1.5 text-xs last:border-b-0 print:border-neutral-200"
                  >
                    <span className="min-w-0 break-words">
                      {formatDash(item.description)}
                      {formatLineMeta(item) ? <span className="hidden">{formatLineMeta(item)}</span> : null}
                    </span>
                    <span className="block text-right tabular-nums">{formatDash(item.quantity)}</span>
                    <span className="block text-right">{formatDash(item.unit)}</span>
                    <span className="block text-right tabular-nums">{formatOptionalMoney(item.unitPrice)}</span>
                    <span className="text-right tabular-nums">{formatOptionalMoney(item.price)}</span>
                  </div>
                ))
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)_3.75rem_4.25rem_4.75rem_5rem] gap-2 px-2 py-1.5 text-xs">
                  <span>Labor</span>
                  <span className="block text-right">-</span>
                  <span className="block text-right">-</span>
                  <span className="block text-right">-</span>
                  <span className="text-right">{formatMoney(invoice.laborCost)}</span>
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-2">
            <div className="font-medium text-xs">Materials</div>
            <div className="grid gap-2 md:hidden print:hidden">
              {keyedPurchaseMaterials.length ? (
                keyedPurchaseMaterials.map((material) => (
                  <div key={material.rowKey} className="rounded-md border bg-muted/20 p-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium leading-snug">{formatDash(material.description)}</div>
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground">
                          {showPurchaseMeta && formatMaterialDate(material.purchaseDate) ? (
                            <span>{formatMaterialDate(material.purchaseDate)}</span>
                          ) : null}
                          {showPurchaseMeta && material.vendor ? <span>{material.vendor}</span> : null}
                          {formatLineMeta(material) ? <span>{formatLineMeta(material)}</span> : null}
                        </div>
                      </div>
                      <div className="shrink-0 font-semibold tabular-nums">{formatOptionalMoney(material.price)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border bg-muted/20 p-3 text-muted-foreground text-xs">
                  No material line items.
                </div>
              )}
            </div>
            <div className="hidden overflow-hidden rounded-md border md:block print:block print:border-neutral-300">
              <div
                className="grid gap-2 border-b bg-muted/20 px-2 py-1.5 font-medium text-xs print:border-neutral-300 print:bg-neutral-100"
                style={{ gridTemplateColumns: visiblePurchaseGridColumns }}
              >
                <span>Description</span>
                {showPurchaseMeta ? (
                  <>
                    <span>Date</span>
                    <span>Vendor</span>
                  </>
                ) : null}
                {showPurchaseQtyRate ? (
                  <>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Unit</span>
                    <span className="text-right">Rate</span>
                  </>
                ) : null}
                <span className="text-right">Amount</span>
              </div>
              {keyedPurchaseMaterials.length ? (
                keyedPurchaseMaterials.map((material) => (
                  <Fragment key={material.rowKey}>
                    <div
                      className="grid gap-2 border-b px-2 py-1.5 text-xs last:border-b-0 print:border-neutral-200"
                      style={{ gridTemplateColumns: visiblePurchaseGridColumns }}
                    >
                      <span className="min-w-0 break-words">{formatDash(material.description)}</span>
                      {showPurchaseMeta ? (
                        <>
                          <span className="text-muted-foreground">
                            {formatMaterialDate(material.purchaseDate) || "-"}
                          </span>
                          <span className="text-muted-foreground">{material.vendor || "-"}</span>
                        </>
                      ) : null}
                      {showPurchaseQtyRate ? (
                        <>
                          <span className="text-right tabular-nums">{formatDash(material.quantity)}</span>
                          <span className="text-right">{formatDash(material.unit)}</span>
                          <span className="text-right tabular-nums">{formatOptionalMoney(material.unitPrice)}</span>
                        </>
                      ) : null}
                      <span className="text-right tabular-nums">{formatOptionalMoney(material.price)}</span>
                    </div>
                  </Fragment>
                ))
              ) : (
                <div className="px-2 py-1.5 text-muted-foreground text-xs">No material line items.</div>
              )}
            </div>
            {returnMaterials.length ? (
              <div className="grid gap-2 md:hidden print:hidden">
                {keyedReturnMaterials.map((material) => (
                  <div key={material.rowKey} className="rounded-md border bg-muted/20 p-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium leading-snug">{formatDash(material.description)}</div>
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground">
                          {formatMaterialDate(material.purchaseDate) ? (
                            <span>{formatMaterialDate(material.purchaseDate)}</span>
                          ) : null}
                          {material.vendor ? <span>{material.vendor}</span> : null}
                          {formatLineMeta(material) ? <span>{formatLineMeta(material)}</span> : null}
                        </div>
                      </div>
                      <div className="shrink-0 font-semibold tabular-nums">
                        {formatNegativeOptionalMoney(material.price)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {returnMaterials.length ? (
              <div className="hidden overflow-hidden rounded-md border md:block print:block print:border-neutral-300">
                <div className="grid grid-cols-[5.5rem_5.5rem_1fr_3.75rem_4.25rem_4.75rem_5rem] gap-2 border-b bg-muted/20 px-2 py-1.5 font-medium text-xs print:border-neutral-300 print:bg-neutral-100">
                  <span>Date</span>
                  <span>Vendor</span>
                  <span>Returns</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Unit</span>
                  <span className="text-right">Rate</span>
                  <span className="text-right">Amount</span>
                </div>
                {keyedReturnMaterials.map((material) => (
                  <Fragment key={material.rowKey}>
                    <div className="grid grid-cols-[5.5rem_5.5rem_1fr_3.75rem_4.25rem_4.75rem_5rem] gap-2 border-b px-2 py-1.5 text-xs last:border-b-0 print:border-neutral-200">
                      <span className="text-muted-foreground">{formatMaterialDate(material.purchaseDate) || "-"}</span>
                      <span className="text-muted-foreground">{material.vendor || "-"}</span>
                      <span className="min-w-0 break-words">{formatDash(material.description)}</span>
                      <span className="text-right tabular-nums">{formatDash(material.quantity)}</span>
                      <span className="text-right">{formatDash(material.unit)}</span>
                      <span className="text-right tabular-nums">{formatOptionalMoney(material.unitPrice)}</span>
                      <span className="text-right tabular-nums">{formatNegativeOptionalMoney(material.price)}</span>
                    </div>
                  </Fragment>
                ))}
              </div>
            ) : null}
            <div className="ml-auto grid w-full gap-1.5 rounded-md border bg-muted/20 p-3 text-xs md:min-w-72 md:max-w-80 print:min-w-56 print:border-neutral-300 print:bg-neutral-50 print:p-2">
              <div className="flex items-center justify-between gap-6">
                <span className="text-muted-foreground">Labor</span>
                <span className="font-medium">{formatMoney(invoice.laborCost)}</span>
              </div>
              {returnMaterials.length ? (
                <div className="flex items-center justify-between gap-6">
                  <span className="text-muted-foreground">Minus returns</span>
                  <span className="font-medium">-{formatMoney(returnTotal)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-6">
                <span className="text-muted-foreground">Net materials</span>
                <span className="font-medium">{formatMoney(invoice.materialsSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span>
                  Tax on {taxableItemsLabel} ({invoice.materialTaxRate.toString()}%)
                </span>
                <span className="font-medium">{formatMoney(invoice.materialTaxAmount)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-6">
                <span className="font-medium">Final cost</span>
                <span className="font-semibold text-base tabular-nums">{formatMoney(invoice.finalCost)}</span>
              </div>
            </div>
          </section>

          <section className="grid gap-2">
            <div className="font-medium text-xs">Transaction History</div>
            <div className="grid gap-2 md:hidden print:hidden">
              {payments.length ? (
                payments.map((payment) => (
                  <div key={payment.id} className="rounded-md border bg-muted/20 p-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium leading-snug">{payment.description}</div>
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground">
                          <span>{formatShortDate(payment.paidOn)}</span>
                          <span>{payment.method}</span>
                          <span>Ref #{payment.referenceNumber ?? "-"}</span>
                        </div>
                      </div>
                      <div className="shrink-0 font-semibold tabular-nums">{formatMoney(payment.amount)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border bg-muted/20 p-3 text-muted-foreground text-xs">
                  No payments recorded yet.
                </div>
              )}
            </div>
            <div className="hidden overflow-hidden rounded-md border md:block print:block print:border-neutral-300">
              <div className="grid grid-cols-[5.5rem_1fr_5rem_5rem_5.5rem] gap-2 border-b bg-muted/20 px-2 py-1.5 font-medium text-xs print:border-neutral-300 print:bg-neutral-100">
                <span>Date</span>
                <span>Description</span>
                <span>Method</span>
                <span>Ref #</span>
                <span className="text-right">Amount</span>
              </div>
              {payments.length ? (
                payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="grid grid-cols-[5.5rem_1fr_5rem_5rem_5.5rem] gap-2 border-b px-2 py-1.5 text-xs last:border-b-0 print:border-neutral-200"
                  >
                    <span>{formatShortDate(payment.paidOn)}</span>
                    <span>{payment.description}</span>
                    <span className="text-muted-foreground">{payment.method}</span>
                    <span className="text-muted-foreground">{payment.referenceNumber ?? "-"}</span>
                    <span className="text-right font-medium tabular-nums">{formatMoney(payment.amount)}</span>
                  </div>
                ))
              ) : (
                <div className="px-2 py-1.5 text-muted-foreground text-xs">No payments recorded yet.</div>
              )}
            </div>
          </section>

          <section className="grid justify-end gap-2">
            <div className="grid min-w-64 gap-1.5 rounded-md border bg-muted/20 p-3 text-xs print:min-w-56 print:border-neutral-300 print:bg-neutral-50 print:p-2">
              <div className="flex items-center justify-between gap-6">
                <span className="text-muted-foreground">Final cost</span>
                <span className="font-medium">{formatMoney(invoice.finalCost)}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-muted-foreground">Amount paid</span>
                <span className="font-medium">{formatMoney(invoice.amountPaid)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-6">
                <span className="font-medium">Balance due</span>
                <span className="font-semibold text-lg text-rose-700 dark:text-rose-400 print:text-base">
                  {formatMoney(invoice.balanceDue)}
                </span>
              </div>
            </div>
          </section>

          {invoiceMessageLines.length ? (
            <section
              className={`grid gap-2 rounded-md border bg-muted/20 p-3 text-xs print:border-neutral-300 print:bg-neutral-50 ${getDocumentMessageAlignClass(invoiceMessageAlign)}`}
            >
              {invoiceMessageLines.map((item, index) => (
                <p
                  key={item.id}
                  className={index === 0 || index === invoiceMessageLines.length - 1 ? "font-semibold" : undefined}
                >
                  {item.line}
                </p>
              ))}
            </section>
          ) : null}
        </article>
      </div>
    </div>
  );
}
