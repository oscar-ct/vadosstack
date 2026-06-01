import { Fragment } from "react";

import Image from "next/image";
import { notFound } from "next/navigation";

import { addDays, format } from "date-fns";
import { BriefcaseBusiness, CalendarDays, MapPin, ReceiptText, UserRound } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { BackButton } from "@/components/back-button";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { formatDateOnly } from "@/lib/date-only";
import { formatDocumentNumber } from "@/lib/document-number";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

import { parsePricingItems } from "../../jobs/_components/pricing-items";
import { createJobPaymentAction, deleteJobPaymentAction } from "../../jobs/actions";
import { DeleteInvoiceButton } from "../_components/delete-invoice-button";
import { InvoiceActions } from "../_components/invoice-actions";
import type { InvoiceTableItem } from "../_components/invoices-table";
import { ManageInvoiceDialogButton } from "../_components/manage-invoice-dialog-button";
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

function formatMoney(value: { toString: () => string }) {
  return `$${Number(value.toString()).toFixed(2)}`;
}

function formatOptionalMoney(value?: string) {
  return value ? `$${Number(value).toFixed(2)}` : "-";
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

function formatMaterialMeta(material: InvoiceMaterial) {
  const materialDate = formatMaterialDate(material.purchaseDate);

  return [
    materialDate ? `Date ${materialDate}` : null,
    material.vendor.trim() ? `Vendor ${material.vendor}` : null,
    formatLineMeta(material),
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatMaybeDate(value: Date | null) {
  return value ? format(value, "MMM d, yyyy") : "Not scheduled";
}

function formatMaterialDate(value: string) {
  if (!value) return "";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "MMM d, yyyy");
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
  const invoiceNumber = formatDocumentNumber("INV", invoiceSequence);
  const companyEmail = currentUser.companyEmail ?? currentUser.email;
  const dueDate = addDays(invoice.issuedAt, currentUser.invoiceDueDays);
  const googleMailAccount = await prisma.googleMailAccount.findUnique({
    where: {
      userId: currentUser.id,
    },
  });
  const currentHref = `/dashboard/invoices/${invoice.id}?from=${resolvedSearchParams?.from ?? "invoices"}`;
  const managedInvoice: InvoiceTableItem = {
    id: invoice.id,
    jobId: invoice.jobId,
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

  return (
    <div className="mx-auto grid max-w-3xl gap-4 print:max-w-none print:gap-0 print:p-0 print:text-[10px]">
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
            customerEmail={invoice.customerEmail}
            customerName={invoice.customerName}
            dueDate={format(dueDate, "MMM d, yyyy")}
            gmailConnected={Boolean(googleMailAccount)}
            invoiceId={invoice.id}
            invoiceNumber={invoiceNumber}
            notice={gmailNotice}
            returnTo={currentHref}
          />
          <DeleteInvoiceButton action={deleteInvoiceAction} invoiceId={invoice.id} redirectTo={backHref} />
        </div>
      </div>

      <article className="grid gap-5 rounded-md border bg-card p-5 shadow-sm print:min-h-[9.6in] print:gap-3 print:border-0 print:bg-white print:p-5 print:text-neutral-950 print:shadow-none">
        <header className="grid gap-4 border-b pb-2 sm:grid-cols-[1fr_auto] print:gap-2 print:border-neutral-300 print:pb-2">
          <div className="grid gap-1">
            <div className="mb-2 flex items-start gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/20 print:size-10 print:border-neutral-300 print:bg-neutral-50">
                <Image
                  src={companyLogoSrc}
                  alt=""
                  width={48}
                  height={48}
                  unoptimized
                  className="size-full object-contain p-1"
                />
              </div>
              <div className="grid gap-0.5">
                <div className="font-semibold text-lg leading-none print:text-sm">{currentUser.companyName}</div>
                <div className="text-muted-foreground text-xs">{companyEmail}</div>
                {currentUser.companyPhone ? (
                  <div className="text-muted-foreground text-xs">{currentUser.companyPhone}</div>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 font-semibold text-xl print:mt-2 print:text-base">
              <ReceiptText className="size-5 text-muted-foreground print:size-4" />
              Invoice
            </div>
            <div className={"grid gap-0.5 text-muted-foreground text-xs"}>
              <span>Invoice #{invoiceNumber}</span>
              <span>Issued {format(invoice.issuedAt, "MMM d, yyyy")}</span>
            </div>
          </div>
          <div className="grid gap-1 rounded-md border bg-muted/20 p-3 text-left sm:text-right print:border-neutral-300 print:bg-neutral-50 print:p-2">
            <span className="text-muted-foreground text-xs">Balance due</span>
            <span className="font-semibold text-2xl text-rose-700 dark:text-rose-400 print:text-xl">
              {formatMoney(invoice.balanceDue)}
            </span>
            <span className="text-muted-foreground text-xs">by {format(dueDate, "MMM d, yyyy")}</span>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 font-medium text-xs">
              <UserRound className="size-3.5 text-muted-foreground" />
              Bill To
            </div>
            <div className="rounded-md border bg-muted/20 p-2 text-xs print:border-neutral-300 print:bg-neutral-50">
              <div className="font-medium">{invoice.customerName ?? "No customer on file"}</div>
              <div className="text-muted-foreground">{invoice.customerEmail ?? "No email on file"}</div>
              <div className="text-muted-foreground">
                {invoice.customerPhone ? formatPhoneNumber(invoice.customerPhone) : "No phone on file"}
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center gap-2 font-medium text-xs">
              <BriefcaseBusiness className="size-3.5 text-muted-foreground" />
              Job
            </div>
            <div className="rounded-md border bg-muted/20 p-2 text-xs print:border-neutral-300 print:bg-neutral-50">
              <div className="font-medium">{invoice.jobTitle}</div>
              <div className="text-muted-foreground">Status: {invoice.jobStatus}</div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 font-medium text-xs">
              <CalendarDays className="size-3.5 text-muted-foreground" />
              Schedule
            </div>
            <div className="grid gap-0.5 rounded-md border bg-muted/20 p-2 text-xs print:border-neutral-300 print:bg-neutral-50">
              <div>Start: {formatMaybeDate(invoice.dateBegin)}</div>
              <div>End: {formatMaybeDate(invoice.dateEnd)}</div>
            </div>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center gap-2 font-medium text-xs">
              <MapPin className="size-3.5 text-muted-foreground" />
              Service Location
            </div>
            <div className="rounded-md border bg-muted/20 p-2 text-xs print:border-neutral-300 print:bg-neutral-50">
              {invoice.serviceLocation ?? "Not on file"}
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
          <div className="overflow-hidden rounded-md border print:border-neutral-300">
            <div className="hidden grid-cols-[minmax(0,1fr)_3.75rem_4.25rem_4.75rem_5rem] gap-2 border-b bg-muted/20 px-2 py-1.5 font-medium text-xs md:grid print:grid print:border-neutral-300 print:bg-neutral-100">
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
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b px-2 py-1.5 text-xs last:border-b-0 md:grid-cols-[minmax(0,1fr)_3.75rem_4.25rem_4.75rem_5rem] md:gap-2 print:grid-cols-[minmax(0,1fr)_3.75rem_4.25rem_4.75rem_5rem] print:gap-2 print:border-neutral-200"
                >
                  <span className="min-w-0 break-words">
                    {formatDash(item.description)}
                    {formatLineMeta(item) ? (
                      <span className="mt-0.5 block text-muted-foreground md:hidden print:hidden">
                        {formatLineMeta(item)}
                      </span>
                    ) : null}
                  </span>
                  <span className="hidden text-right tabular-nums md:block print:block">
                    {formatDash(item.quantity)}
                  </span>
                  <span className="hidden text-right md:block print:block">{formatDash(item.unit)}</span>
                  <span className="hidden text-right tabular-nums md:block print:block">
                    {formatOptionalMoney(item.unitPrice)}
                  </span>
                  <span className="text-right tabular-nums">{formatOptionalMoney(item.price)}</span>
                </div>
              ))
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-2 py-1.5 text-xs md:grid-cols-[minmax(0,1fr)_3.75rem_4.25rem_4.75rem_5rem] md:gap-2 print:grid-cols-[minmax(0,1fr)_3.75rem_4.25rem_4.75rem_5rem] print:gap-2">
                <span>Labor</span>
                <span className="hidden text-right md:block print:block">-</span>
                <span className="hidden text-right md:block print:block">-</span>
                <span className="hidden text-right md:block print:block">-</span>
                <span className="text-right">{formatMoney(invoice.laborCost)}</span>
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-2">
          <div className="font-medium text-xs">Materials</div>
          <div className="overflow-hidden rounded-md border print:border-neutral-300">
            <div
              className="hidden gap-2 border-b bg-muted/20 px-2 py-1.5 font-medium text-xs md:grid print:grid print:border-neutral-300 print:bg-neutral-100"
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
                    className="hidden gap-2 border-b px-2 py-1.5 text-xs last:border-b-0 md:grid print:grid print:border-neutral-200"
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
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b px-2 py-1.5 text-xs last:border-b-0 md:hidden print:hidden">
                    <span className="min-w-0 break-words">
                      {formatDash(material.description)}
                      {formatMaterialMeta(material) ? (
                        <span className="mt-0.5 block text-muted-foreground">{formatMaterialMeta(material)}</span>
                      ) : null}
                    </span>
                    <span className="text-right tabular-nums">{formatOptionalMoney(material.price)}</span>
                  </div>
                </Fragment>
              ))
            ) : (
              <div className="px-2 py-1.5 text-muted-foreground text-xs">No material line items.</div>
            )}
          </div>
          {returnMaterials.length ? (
            <div className="overflow-hidden rounded-md border print:border-neutral-300">
              <div className="hidden grid-cols-[5.5rem_5.5rem_1fr_3.75rem_4.25rem_4.75rem_5rem] gap-2 border-b bg-muted/20 px-2 py-1.5 font-medium text-xs md:grid print:grid print:border-neutral-300 print:bg-neutral-100">
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
                  <div className="hidden grid-cols-[5.5rem_5.5rem_1fr_3.75rem_4.25rem_4.75rem_5rem] gap-2 border-b px-2 py-1.5 text-xs last:border-b-0 md:grid print:grid print:border-neutral-200">
                    <span className="text-muted-foreground">{formatMaterialDate(material.purchaseDate) || "-"}</span>
                    <span className="text-muted-foreground">{material.vendor || "-"}</span>
                    <span className="min-w-0 break-words">{formatDash(material.description)}</span>
                    <span className="text-right tabular-nums">{formatDash(material.quantity)}</span>
                    <span className="text-right">{formatDash(material.unit)}</span>
                    <span className="text-right tabular-nums">{formatOptionalMoney(material.unitPrice)}</span>
                    <span className="text-right tabular-nums">{formatNegativeOptionalMoney(material.price)}</span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b px-2 py-1.5 text-xs last:border-b-0 md:hidden print:hidden">
                    <span className="min-w-0 break-words">
                      {formatDash(material.description)}
                      {formatMaterialMeta(material) ? (
                        <span className="mt-0.5 block text-muted-foreground">{formatMaterialMeta(material)}</span>
                      ) : null}
                    </span>
                    <span className="text-right tabular-nums">{formatNegativeOptionalMoney(material.price)}</span>
                  </div>
                </Fragment>
              ))}
            </div>
          ) : null}
          <div className="ml-auto grid min-w-56 gap-1 rounded-md border bg-muted/20 p-2 text-xs print:border-neutral-300 print:bg-neutral-50">
            {returnMaterials.length ? (
              <div className="flex items-center justify-between gap-6">
                <span className="text-muted-foreground">Minus returns</span>
                <span className="font-medium">-${returnTotal.toFixed(2)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-6">
              <span className="text-muted-foreground">Net materials</span>
              <span className="font-medium">{formatMoney(invoice.materialsSubtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span>Tax ({invoice.materialTaxRate.toString()}%)</span>
              <span className="font-medium">{formatMoney(invoice.materialTaxAmount)}</span>
            </div>
          </div>
        </section>

        <section className="grid gap-2">
          <div className="font-medium text-xs">Transaction History</div>
          <div className="overflow-hidden rounded-md border print:border-neutral-300">
            <div className="grid grid-cols-[5.5rem_1fr_5rem_5.5rem] gap-2 border-b bg-muted/20 px-2 py-1.5 font-medium text-xs print:border-neutral-300 print:bg-neutral-100">
              <span>Date</span>
              <span>Description</span>
              <span>Method</span>
              <span className="text-right">Amount</span>
            </div>
            {payments.length ? (
              payments.map((payment) => (
                <div
                  key={payment.id}
                  className="grid grid-cols-[5.5rem_1fr_5rem_5.5rem] gap-2 border-b px-2 py-1.5 text-xs last:border-b-0 print:border-neutral-200"
                >
                  <span>{formatDateOnly(payment.paidOn)}</span>
                  <span>{payment.description}</span>
                  <span className="text-muted-foreground">{payment.method}</span>
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
              <span className="text-muted-foreground">Deposits paid</span>
              <span className="font-medium">{formatMoney(invoice.depositPaid)}</span>
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
      </article>
    </div>
  );
}
