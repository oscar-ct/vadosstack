import Link from "next/link";
import { notFound } from "next/navigation";

import { addDays, format, parseISO } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  Building2,
  CalendarDays,
  ClipboardList,
  MailWarning,
  MapPin,
  Package,
  Pencil,
  ReceiptText,
  Ruler,
  UserRound,
  Wrench,
} from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { CustomerLink } from "@/components/customer-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import {
  getDocumentMessageAlignClass,
  getDocumentMessageLineItems,
  normalizeDocumentMessageAlign,
  renderDocumentMessage,
} from "@/lib/document-messages";
import { getRenderedDocumentEmailTemplates } from "@/lib/email-templates";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

import { EstimateActions } from "../../_components/estimate-actions";
import { EstimateBackButton } from "../../_components/estimate-back-button";
import { EstimateCustomerPreview, type EstimateCustomerPreviewItem } from "../../_components/estimate-customer-preview";
import {
  ConvertEstimateButton,
  PrintableEstimateButton,
  UpdateEstimateStatusButton,
} from "../../_components/estimate-record-action-buttons";
import { EstimateRecordViews } from "../../_components/estimate-record-views";
import { getEstimateRecordWorkspace } from "../../_lib/estimate-record-data";
import { emailEstimateAction } from "../../actions";
import {
  convertEstimateToJobAction,
  createPrintableEstimateAction,
  deleteEstimateRecordAction,
  updateEstimateStatusAction,
} from "../../records-actions";

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

function parsePublishedItems(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.map<EstimateCustomerPreviewItem & { type: "labor" | "material" }>((item) => ({
      description: String(item?.description ?? ""),
      price: String(item?.price ?? "0"),
      quantity: item?.quantity === undefined ? undefined : String(item.quantity),
      type: item?.type === "labor" ? "labor" : "material",
      unit: item?.unit === undefined ? undefined : String(item.unit),
      unitPrice: item?.unitPrice === undefined ? undefined : String(item.unitPrice),
    }));
  } catch {
    return [];
  }
}

function formatMoney(value?: string | number) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : "$0.00";
}

function formatArea(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function estimateStatusClassName(status: string) {
  if (status === "Won") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900";
  if (status === "Lost") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900";
  if (status === "Ready to Send") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900";
  if (status === "Waiting on Customer") return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900";
  return "bg-muted-foreground/10 text-muted-foreground";
}

function sum(items: Array<{ price?: string }>) {
  return items.reduce((total, item) => total + Number(item.price ?? 0), 0);
}

function roomArea(room: { area?: string; length: string; width: string }) {
  const savedArea = Number(room.area ?? 0);
  if (Number.isFinite(savedArea) && savedArea > 0) return savedArea;

  const calculated = Number(room.length) * Number(room.width);
  return Number.isFinite(calculated) && calculated > 0 ? calculated : 0;
}

function createUniqueRowKey(baseKey: string, seenKeys: Map<string, number>) {
  const count = seenKeys.get(baseKey) ?? 0;
  seenKeys.set(baseKey, count + 1);

  return count ? `${baseKey}-${count}` : baseKey;
}

function hasPositiveNumber(value?: string) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount > 0;
}

function InfoTile({
  customerId,
  icon: Icon,
  label,
  value,
}: {
  customerId?: string;
  icon: LucideIcon;
  label: string;
  value?: string;
}) {
  return (
    <div className="grid gap-1 rounded-lg border bg-background p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className="size-3.5" />
        {label}
      </div>
      {customerId ? (
        <CustomerLink customerId={customerId} name={value} fallback="Not on file" className="font-medium text-sm" />
      ) : (
        <div className="font-medium text-sm">{value ?? "Not on file"}</div>
      )}
    </div>
  );
}

function SectionPanel({
  children,
  description,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-start gap-3 border-b bg-muted/20 px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-100/80 text-sky-700">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-muted-foreground text-sm">{description}</p> : null}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function LineItems({
  items,
  label,
  tone,
}: {
  items: Array<{ description?: string; price?: string; quantity?: string; unit?: string; unitPrice?: string }>;
  label: string;
  tone: "L" | "M";
}) {
  const seenKeys = new Map<string, number>();
  const keyedItems = items.map((item) => ({
    ...item,
    rowKey: createUniqueRowKey(
      `${label}-${item.description}-${item.quantity}-${item.unit}-${item.unitPrice}-${item.price}`,
      seenKeys,
    ),
  }));

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      {keyedItems.length ? (
        keyedItems.map((item, index) => {
          const hasQuantity = hasPositiveNumber(item.quantity);
          const hasUnit = Boolean(item.unit?.trim());
          const hasRate = hasPositiveNumber(item.unitPrice);
          const hasDetails = hasQuantity || hasUnit || hasRate;

          return (
            <div
              key={item.rowKey}
              className={cn(
                tone === "L"
                  ? "odd:bg-emerald-50/50 dark:odd:bg-emerald-900"
                  : "odd:bg-amber-50/50 dark:odd:bg-amber-900",
                "grid grid-cols-[minmax(0,4fr)_minmax(0,1fr)] gap-3 border-t p-2 first:border-t-0 md:grid-cols-[44px_minmax(0,1fr)_120px] md:items-center md:p-3",
              )}
            >
              <div className="order-2 flex items-center justify-end gap-3 md:order-none md:block md:justify-between">
                <span
                  className={cn(
                    tone === "L" ? "border-emerald-600 text-emerald-600" : "border-amber-600 text-amber-600",
                    "hidden size-8 items-center justify-center rounded-md border bg-background font-medium text-xs md:inline-flex",
                  )}
                >
                  {tone}
                  {index + 1}
                </span>
                <span className="font-medium text-sm tabular-nums md:hidden">{formatMoney(item.price)}</span>
              </div>
              <div className="order-1 grid min-w-0 gap-1 md:order-none">
                <div className="font-medium text-sm">{item.description || "Untitled line item"}</div>
                {hasDetails ? (
                  <div className="flex flex-wrap gap-1 text-xs leading-none">
                    {hasQuantity ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        Qty:
                        <span className="tabular-nums">{item.quantity} ·</span>
                      </span>
                    ) : null}
                    {hasUnit ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">Unit: {item.unit} ·</span>
                    ) : null}
                    {hasRate ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        Rate:
                        <span className="tabular-nums">{formatMoney(item.unitPrice)}</span>
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="hidden font-semibold text-sm tabular-nums md:block md:text-right">
                {formatMoney(item.price)}
              </div>
            </div>
          );
        })
      ) : (
        <div className="p-4 text-muted-foreground text-sm">No {label.toLowerCase()} line items yet.</div>
      )}
    </div>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{
    estimateRecordId: string;
  }>;
  searchParams?: Promise<{
    gmail_connected?: string;
    gmail_error?: string;
    view?: string;
  }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view estimates"
        description="Estimate records are private to each signed-in account."
      />
    );
  }

  const [{ estimateRecordId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const workspace = await getEstimateRecordWorkspace(currentUser.id, estimateRecordId);

  if (!workspace) {
    notFound();
  }

  const { estimate, source } = workspace;
  const publishedEstimate = source.printableEstimate;

  const laborSubtotal = sum(estimate.laborItems);
  const materialsSubtotal = sum(estimate.materials);
  const taxRate = Number(estimate.materialTaxRate ?? 0);
  const subtotal = laborSubtotal + materialsSubtotal;
  const taxableSubtotal = materialsSubtotal + (estimate.jobType === "Commercial" ? laborSubtotal : 0);
  const tax = taxableSubtotal * (taxRate / 100);
  const measurementTotal = estimate.measurementRooms.reduce((total, room) => total + roomArea(room), 0);
  const measuredAreas = estimate.measurementRooms.filter((room) => roomArea(room) > 0);
  const scheduledDate = estimate.dateBegin ? format(parseISO(estimate.dateBegin), "MMM d, yyyy") : "Unscheduled";
  const taxableItemsLabel = estimate.jobType === "Commercial" ? "labor + materials" : "materials";
  const customerName = publishedEstimate?.customerName ?? source.customer?.name ?? source.lead?.name;
  const customerEmail = publishedEstimate?.customerEmail ?? source.customer?.email ?? source.lead?.email;
  const contactHref = estimate.customerId
    ? `/dashboard/customers/${estimate.customerId}`
    : estimate.leadId
      ? `/dashboard/leads/${estimate.leadId}`
      : null;
  const customerPhone =
    publishedEstimate?.customerPhone ?? source.customer?.phoneNumbers[0]?.value ?? source.lead?.phone;
  const publishedItems = publishedEstimate ? parsePublishedItems(publishedEstimate.materials) : [];
  const previewLaborItems = publishedEstimate
    ? publishedItems.filter((item) => item.type === "labor")
    : estimate.laborItems;
  const previewMaterialItems = publishedEstimate
    ? publishedItems.filter((item) => item.type === "material")
    : estimate.materials;
  const validThroughDate = publishedEstimate
    ? addDays(publishedEstimate.issuedAt, currentUser.estimateValidDays)
    : null;
  const estimateNumber = publishedEstimate?.estimateNumber ?? "Draft estimate";
  const previewTotal = publishedEstimate?.estimatedTotal.toString() ?? estimate.estimatedTotal ?? "0";
  const previewMaterialsSubtotal = publishedEstimate?.materialsSubtotal.toString() ?? materialsSubtotal.toFixed(2);
  const previewTaxAmount = publishedEstimate?.materialTaxAmount.toString() ?? tax.toFixed(2);
  const serviceLocation = publishedEstimate?.serviceLocation ?? estimate.serviceLocation;
  const estimateMessageContext = {
    companyName: currentUser.companyName,
    customerName,
    estimateHalfTotal: formatMoney(Number(previewTotal) / 2),
    estimateNumber,
    estimateTotal: formatMoney(previewTotal),
    jobTitle: publishedEstimate?.jobTitle ?? estimate.description,
    serviceLocation,
    validThrough: validThroughDate ? format(validThroughDate, "MMM d, yyyy") : "Not issued",
  };
  const estimateMessage = currentUser.estimateMessageEnabled
    ? renderDocumentMessage(currentUser.estimateMessageText, estimateMessageContext)
    : "";
  const estimateMessageLines = getDocumentMessageLineItems(estimateMessage);
  const estimateMessageAlign = normalizeDocumentMessageAlign(currentUser.estimateMessageAlign);
  const companyEmail = currentUser.companyEmail ?? currentUser.email;
  const [companyLogoSrc, googleMailAccount, emailTemplates] = await Promise.all([
    getCompanyLogoSrc(currentUser.id),
    prisma.googleMailAccount.findUnique({
      where: {
        userId: currentUser.id,
      },
    }),
    getRenderedDocumentEmailTemplates({
      ownerId: currentUser.id,
      scope: "estimate",
      context: {
        companyEmail,
        companyName: currentUser.companyName,
        companyPhone: currentUser.companyPhone ? formatPhoneNumber(currentUser.companyPhone) : undefined,
        customerEmail,
        customerName,
        customerPhone: customerPhone ? formatPhoneNumber(customerPhone) : undefined,
        estimatedTotal: formatMoney(previewTotal),
        estimateNumber,
        jobTitle: publishedEstimate?.jobTitle ?? estimate.description,
        serviceLocation,
        validThrough: validThroughDate ? format(validThroughDate, "MMM d, yyyy") : "Not issued",
      },
    }),
  ]);
  const returnTo = `/dashboard/estimates/records/${estimate.id}?view=customer`;
  const gmailError = resolvedSearchParams?.gmail_error;
  const gmailNotice = resolvedSearchParams?.gmail_connected
    ? { message: "Gmail is connected. You can email estimates from this account.", type: "success" as const }
    : gmailError
      ? { message: gmailErrorMessages[gmailError] ?? "Gmail could not be connected.", type: "error" as const }
      : null;

  return (
    <div className="@container/main mx-auto grid w-full max-w-7xl gap-5 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <EstimateBackButton />
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link prefetch={false} href={`/dashboard/estimates/records/${estimate.id}/edit`}>
              <Pencil />
              Edit
            </Link>
          </Button>
          <PrintableEstimateButton
            action={createPrintableEstimateAction}
            className="w-auto"
            estimate={estimate}
            size="sm"
          />
          {estimate.status === "Ready to Send" && publishedEstimate && !customerEmail ? (
            <UpdateEstimateStatusButton
              action={updateEstimateStatusAction}
              className="w-auto"
              estimate={estimate}
              status="Waiting on Customer"
            >
              Mark waiting
            </UpdateEstimateStatusButton>
          ) : null}
          {estimate.status === "Waiting on Customer" ? (
            <UpdateEstimateStatusButton
              action={updateEstimateStatusAction}
              className="w-auto"
              estimate={estimate}
              status="Won"
            >
              Mark won
            </UpdateEstimateStatusButton>
          ) : null}
          {estimate.status === "Won" ? (
            <ConvertEstimateButton
              action={convertEstimateToJobAction}
              className="w-auto"
              estimate={estimate}
              size="sm"
            />
          ) : null}
          {estimate.status === "Lost" ? (
            <UpdateEstimateStatusButton
              action={updateEstimateStatusAction}
              className="w-auto"
              estimate={estimate}
              status="Draft"
            >
              Reopen estimate
            </UpdateEstimateStatusButton>
          ) : null}
          <EstimateActions
            action={emailEstimateAction}
            compact
            companyName={currentUser.companyName}
            customerEmail={customerEmail}
            customerName={customerName}
            deleteAction={deleteEstimateRecordAction}
            deleteDescription="This removes the working estimate and its issued customer copy. Converted jobs are not deleted."
            deleteId={estimate.id}
            deleteRedirectTo="/dashboard/estimates"
            deleteSnapshot={{
              customerName,
              estimatedTotal: formatMoney(estimate.estimatedTotal),
              estimateNumber: publishedEstimate?.estimateNumber ?? "Not issued",
              jobTitle: estimate.description,
              serviceLocation: estimate.serviceLocation,
              validThrough: validThroughDate ? format(validThroughDate, "MMM d, yyyy") : "Not issued",
            }}
            editHref={`/dashboard/estimates/records/${estimate.id}/edit`}
            estimateId={publishedEstimate?.id}
            estimateMessageAlign={estimateMessageAlign}
            estimateMessageEnabled={currentUser.estimateMessageEnabled}
            estimateMessageText={currentUser.estimateMessageText}
            estimateNumber={estimateNumber}
            estimatedTotal={formatMoney(previewTotal)}
            gmailConnected={Boolean(googleMailAccount)}
            gmailSenderEmail={googleMailAccount?.email ?? null}
            notice={gmailNotice}
            primaryEmail={estimate.status === "Ready to Send" && Boolean(publishedEstimate)}
            returnTo={returnTo}
            templates={emailTemplates}
            validThrough={validThroughDate ? format(validThroughDate, "MMM d, yyyy") : "Not issued"}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="grid gap-5 bg-card p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="grid gap-3">
            <Badge variant="outline" className={cn("w-fit", estimateStatusClassName(estimate.status))}>
              {estimate.status}
            </Badge>
            <div>
              <h1 className="font-medium text-xl tracking-normal md:text-2xl">{estimate.description}</h1>
              <p className="mt-2 max-w-3xl text-muted-foreground text-sm">
                {estimate.scope || "No scope description on file."}
              </p>
              <p className="mt-3 text-muted-foreground text-xs">
                {publishedEstimate
                  ? `Customer copy ${publishedEstimate.estimateNumber ?? "issued"} · Issued ${format(publishedEstimate.issuedAt, "MMM d, yyyy")}`
                  : "Customer copy not issued"}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-4 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-100">
            <div className="flex items-center gap-2 text-sky-800 text-xs uppercase tracking-normal dark:text-sky-200">
              <BadgeDollarSign className="size-4" />
              Estimate total
            </div>
            <div className="mt-2 font-semibold text-2xl tabular-nums">{formatMoney(estimate.estimatedTotal)}</div>
            <div className="mt-1 text-sky-800/80 text-xs dark:text-sky-200/80">Tax applies to {taxableItemsLabel}</div>
          </div>
        </div>
      </div>

      {!customerEmail ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <MailWarning className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div>
              <div className="font-semibold text-sm">Email missing</div>
              <p className="mt-1 text-amber-900/80 text-sm dark:text-amber-100/80">
                You can publish and download this estimate, but emailing is unavailable until this contact has an email
                address.
              </p>
            </div>
          </div>
          {contactHref ? (
            <Button asChild size="sm" variant="outline" className="shrink-0 bg-background">
              <Link href={contactHref}>Add email</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <EstimateRecordViews
        defaultView={resolvedSearchParams?.view === "customer" ? "customer" : "overview"}
        overview={
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
            <div className="grid gap-5">
              <SectionPanel icon={ClipboardList} title="Estimate Details">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <InfoTile
                    customerId={estimate.customerId}
                    icon={UserRound}
                    label={estimate.customerId ? "Customer" : "Lead"}
                    value={estimate.customerName ?? estimate.leadName}
                  />
                  <InfoTile icon={MapPin} label="Service location" value={estimate.serviceLocation} />
                  <InfoTile icon={CalendarDays} label="Scheduled" value={scheduledDate} />
                  <InfoTile icon={Building2} label="Job type" value={estimate.jobType} />
                </div>
                {estimate.notes ? (
                  <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                    <div className="text-muted-foreground text-xs">Internal notes</div>
                    <div className="mt-1 text-sm">{estimate.notes}</div>
                  </div>
                ) : null}
              </SectionPanel>

              {measuredAreas.length ? (
                <SectionPanel
                  icon={Ruler}
                  title="Measurements"
                  description={`${measuredAreas.length} ${measuredAreas.length === 1 ? "area" : "areas"} measured for sqft pricing.`}
                >
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px] xl:items-start">
                    <div className="overflow-hidden rounded-lg border bg-background">
                      {measuredAreas.map((room, index) => (
                        <div
                          key={room.id ?? `${room.name}-${index}`}
                          className="grid gap-2 border-t p-3 first:border-t-0 md:grid-cols-[minmax(0,1fr)_90px_90px_70px] md:items-center"
                        >
                          <div className="font-medium text-sm">{room.name || `Area ${index + 1}`}</div>
                          <div className="text-muted-foreground text-xs md:text-sm">{room.length || "0"} ft L</div>
                          <div className="text-muted-foreground text-xs md:text-sm">{room.width || "0"} ft W</div>
                          <div className="font-semibold text-sm tabular-nums md:text-right">
                            {formatArea(roomArea(room))} sq ft
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-4 xl:text-right">
                      <div className="text-muted-foreground text-xs">Building total</div>
                      <div className="mt-1 font-semibold text-2xl tabular-nums">
                        {formatArea(measurementTotal)} sq ft
                      </div>
                    </div>
                  </div>
                </SectionPanel>
              ) : null}

              <SectionPanel icon={Wrench} title="Labor" description="Work items and service pricing.">
                <LineItems items={estimate.laborItems} label="Labor" tone="L" />
              </SectionPanel>

              <SectionPanel icon={Package} title="Materials" description="Parts, supplies, quantities, and rates.">
                <LineItems items={estimate.materials} label="Materials" tone="M" />
              </SectionPanel>
            </div>

            <aside className="grid gap-4 md:w-full md:max-w-sm md:justify-self-end xl:sticky xl:top-20">
              <section className="w-full rounded-lg border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900/60 dark:bg-sky-950/20">
                <div className="flex items-center gap-2 font-semibold text-sky-900 text-sm uppercase tracking-normal dark:text-sky-200">
                  <ReceiptText className="size-4" />
                  Pricing
                </div>
                <div className="mt-4 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Labor</span>
                    <span className="font-medium tabular-nums">{formatMoney(laborSubtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Materials</span>
                    <span className="font-medium tabular-nums">{formatMoney(materialsSubtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium tabular-nums">{formatMoney(subtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      Tax on {taxableItemsLabel} ({taxRate.toFixed(2)}%)
                    </span>
                    <span className="font-medium tabular-nums">{formatMoney(tax)}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3 border-sky-200 border-t pt-3 dark:border-sky-900/60">
                    <span className="font-medium">Customer total</span>
                    <span className="font-semibold tabular-nums">{formatMoney(estimate.estimatedTotal)}</span>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        }
        customerPreview={
          <EstimateCustomerPreview
            companyEmail={companyEmail}
            companyLogoSrc={companyLogoSrc}
            companyName={currentUser.companyName}
            companyPhone={currentUser.companyPhone}
            data={{
              customerEmail,
              customerName,
              customerPhone,
              dateBegin: publishedEstimate?.dateBegin ?? source.dateBegin,
              dateEnd: publishedEstimate?.dateEnd ?? source.dateEnd,
              estimateNumber: publishedEstimate?.estimateNumber,
              estimatedTotal: previewTotal,
              issuedAt: publishedEstimate?.issuedAt,
              jobDescription: publishedEstimate?.jobDescription ?? estimate.scope,
              jobTitle: publishedEstimate?.jobTitle ?? estimate.description,
              jobType: estimate.jobType,
              laborCost: publishedEstimate?.laborCost.toString() ?? estimate.laborCost ?? "0",
              laborItems: previewLaborItems,
              materialItems: previewMaterialItems,
              materialTaxAmount: previewTaxAmount,
              materialTaxRate: publishedEstimate?.materialTaxRate.toString() ?? estimate.materialTaxRate ?? "0",
              materialsSubtotal: previewMaterialsSubtotal,
              serviceLocation,
              validThrough: validThroughDate,
            }}
            messageAlignClassName={getDocumentMessageAlignClass(estimateMessageAlign)}
            messageLines={estimateMessageLines}
          />
        }
      />
    </div>
  );
}
