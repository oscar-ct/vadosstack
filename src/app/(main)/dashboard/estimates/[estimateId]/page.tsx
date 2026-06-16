import Image from "next/image";
import { notFound } from "next/navigation";

import { addDays, format } from "date-fns";
import { BriefcaseBusiness, CalendarDays, MapPin, NotebookText, UserRound } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { BackButton } from "@/components/back-button";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { formatDocumentNumber } from "@/lib/document-number";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

import { parseMaterials as parseJobMaterials } from "../../jobs/_components/materials";
import { parsePricingItems } from "../../jobs/_components/pricing-items";
import { DeleteEstimateButton, EstimateActions } from "../_components/estimate-actions";
import { deleteEstimateAction, emailEstimateAction } from "../actions";

type EstimateMaterial = {
  description: string;
  type?: "labor" | "material";
  quantity?: string;
  unit?: string;
  unitPrice?: string;
  price: string;
};

function parseMaterials(value: string): EstimateMaterial[] {
  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((material) => ({
      description: String(material?.description ?? ""),
      type: material?.type === "labor" ? "labor" : "material",
      quantity: material?.quantity === undefined ? undefined : String(material.quantity),
      unit: material?.unit === undefined ? undefined : String(material.unit),
      unitPrice: material?.unitPrice === undefined ? undefined : String(material.unitPrice),
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

function formatMaybeDate(value: Date | null) {
  return value ? format(value, "MMM d, yyyy") : "Not scheduled";
}

function formatEstimateSchedule(dateBegin: Date | null, dateEnd: Date | null) {
  if (!dateBegin && !dateEnd) {
    return "Unscheduled";
  }

  return `Begin: ${formatMaybeDate(dateBegin)}${dateEnd ? `\nEnd: ${formatMaybeDate(dateEnd)}` : ""}`;
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
    estimateId: string;
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
        title="Sign in to view estimates"
        description="Estimate records are private to each signed-in account."
      />
    );
  }

  const [{ estimateId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const backHref =
    resolvedSearchParams?.from === "jobs"
      ? "/dashboard/jobs"
      : resolvedSearchParams?.from === "estimates"
        ? "/dashboard/estimates"
        : "/dashboard/estimates";
  const estimate = await prisma.estimate.findUnique({
    where: {
      id_ownerId: {
        id: estimateId,
        ownerId: currentUser.id,
      },
    },
    include: {
      estimateRecord: true,
    },
  });

  if (!estimate) {
    notFound();
  }

  const estimateSequence = await prisma.estimate.count({
    where: {
      ownerId: currentUser.id,
      issuedAt: {
        lte: estimate.issuedAt,
      },
    },
  });
  const materials = parseMaterials(estimate.materials);
  const laborItems = estimate.estimateRecord
    ? parsePricingItems(estimate.estimateRecord.laborItems).map((item) => ({ ...item, type: "labor" as const }))
    : materials.filter((item) => item.type === "labor");
  const materialItems = estimate.estimateRecord
    ? parseJobMaterials(estimate.estimateRecord.materials).map((item) => ({ ...item, type: "material" as const }))
    : materials.filter((item) => item.type !== "labor");
  const laborKeyCounts = new Map<string, number>();
  const keyedLaborItems = laborItems.map((item) => ({
    ...item,
    rowKey: createUniqueRowKey(`labor-${item.description}-${item.price}`, laborKeyCounts),
  }));
  const materialKeyCounts = new Map<string, number>();
  const keyedMaterialItems = materialItems.map((material) => ({
    ...material,
    rowKey: createUniqueRowKey(
      `material-${material.description}-${material.quantity ?? ""}-${material.unit ?? ""}-${material.unitPrice ?? ""}-${material.price}`,
      materialKeyCounts,
    ),
  }));
  const paymentAmount = Number(estimate.estimatedTotal.toString()) / 2;
  const estimateNumber = formatDocumentNumber("EST", estimateSequence);
  const companyEmail = currentUser.companyEmail ?? currentUser.email;
  const companyLogoSrc = await getCompanyLogoSrc(currentUser.id);
  const validThrough = addDays(estimate.issuedAt, currentUser.estimateValidDays);
  const googleMailAccount = await prisma.googleMailAccount.findUnique({
    where: {
      userId: currentUser.id,
    },
  });
  const currentHref = resolvedSearchParams?.from
    ? `/dashboard/estimates/${estimate.id}?from=${resolvedSearchParams.from}`
    : `/dashboard/estimates/${estimate.id}`;
  const gmailError = resolvedSearchParams?.gmail_error;
  const gmailNotice = resolvedSearchParams?.gmail_connected
    ? { message: "Gmail is connected. You can email estimates from this account.", type: "success" as const }
    : gmailError
      ? { message: gmailErrorMessages[gmailError] ?? "Gmail could not be connected.", type: "error" as const }
      : null;

  return (
    <div className="mx-auto grid h-[calc(100svh-6rem)] max-w-5xl grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden print:h-auto print:max-w-none print:gap-0 print:overflow-visible print:p-0 print:text-[10px]">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackButton fallbackHref={backHref} />
        <div className="flex flex-wrap items-center gap-2">
          <EstimateActions
            action={emailEstimateAction}
            companyName={currentUser.companyName}
            customerEmail={estimate.customerEmail}
            customerName={estimate.customerName}
            estimateId={estimate.id}
            estimateNumber={estimateNumber}
            estimatedTotal={formatMoney(estimate.estimatedTotal)}
            gmailConnected={Boolean(googleMailAccount)}
            gmailSenderEmail={googleMailAccount?.email ?? null}
            notice={gmailNotice}
            returnTo={currentHref}
            validThrough={format(validThrough, "MMM d, yyyy")}
          />
          <DeleteEstimateButton action={deleteEstimateAction} estimateId={estimate.id} redirectTo={backHref} />
        </div>
      </div>

      <div className="-mx-4 min-h-0 overflow-auto px-4 pb-4 print:contents">
        <article className="mx-auto grid min-h-[1056px] w-[816px] max-w-none gap-5 rounded-md border bg-card p-5 shadow-sm print:min-h-[9.6in] print:w-auto print:gap-3 print:border-0 print:bg-white print:p-5 print:text-neutral-950 print:shadow-none">
          <header className="grid grid-cols-[1fr_auto] gap-4 border-b pb-2 print:border-neutral-300 print:pb-2">
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
                    priority
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
                <NotebookText className="size-5 text-muted-foreground print:size-4" />
                Estimate
              </div>
              <div className="grid gap-0.5 text-muted-foreground text-xs">
                <span>Estimate #{estimateNumber}</span>
                <span>Issued {format(estimate.issuedAt, "MMM d, yyyy")}</span>
                <span>Valid through {format(validThrough, "MMM d, yyyy")}</span>
              </div>
            </div>
            <div className="grid gap-1 rounded-md border bg-muted/20 p-3 text-right print:border-neutral-300 print:bg-neutral-50 print:p-2">
              <span className="text-muted-foreground text-xs">Estimated total</span>
              <span className="font-semibold text-2xl text-sky-700 dark:text-sky-400 print:text-xl">
                {formatMoney(estimate.estimatedTotal)}
              </span>
              <span className="text-muted-foreground text-xs">valid through {format(validThrough, "MMM d, yyyy")}</span>
            </div>
          </header>
          <section className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <div className="flex items-center gap-2 font-medium text-xs">
                <UserRound className="size-3.5 text-muted-foreground" />
                Prepared For
              </div>
              <div className="h-16 rounded-md border bg-muted/20 p-2 text-xs print:border-neutral-300 print:bg-neutral-50">
                <div className="font-medium">{estimate.customerName ?? "No customer on file"}</div>
                <div className="text-muted-foreground">{estimate.customerEmail ?? "No email on file"}</div>
                <div className="text-muted-foreground">
                  {estimate.customerPhone ? formatPhoneNumber(estimate.customerPhone) : "No phone on file"}
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-2 font-medium text-xs">
                <BriefcaseBusiness className="size-3.5 text-muted-foreground" />
                Job
              </div>
              <div className="h-16 rounded-md border bg-muted/20 p-2 text-xs print:border-neutral-300 print:bg-neutral-50">
                <div className="font-medium">{estimate.jobTitle}</div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <div className="flex items-center gap-2 font-medium text-xs">
                <CalendarDays className="size-3.5 text-muted-foreground" />
                Schedule
              </div>
              <div className="grid h-16 gap-0.5 whitespace-pre-line rounded-md border bg-muted/20 p-2 text-xs print:border-neutral-300 print:bg-neutral-50">
                {formatEstimateSchedule(estimate.dateBegin, estimate.dateEnd)}
              </div>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-2 font-medium text-xs">
                <MapPin className="size-3.5 text-muted-foreground" />
                Service Location
              </div>
              <div className="h-16 rounded-md border bg-muted/20 p-2 text-xs print:border-neutral-300 print:bg-neutral-50">
                {estimate.serviceLocation ?? "Not on file"}
              </div>
            </div>
          </section>

          {estimate.jobDescription ? (
            <section className="grid gap-1">
              <div className="font-medium text-xs">Job Description</div>
              <p className="whitespace-pre-line rounded-md border bg-muted/20 p-2 text-xs print:line-clamp-3 print:border-neutral-300 print:bg-neutral-50">
                {estimate.jobDescription}
              </p>
            </section>
          ) : null}

          <section className="grid gap-2">
            <div className="font-medium text-xs">Labor</div>
            <div className="overflow-hidden rounded-md border print:border-neutral-300">
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
                  <span className="text-right">{formatMoney(estimate.laborCost)}</span>
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-2">
            <div className="font-medium text-xs">Materials</div>
            <div className="overflow-hidden rounded-md border print:border-neutral-300">
              <div className="grid grid-cols-[minmax(0,1fr)_3.75rem_4.25rem_4.75rem_5rem] gap-2 border-b bg-muted/20 px-2 py-1.5 font-medium text-xs print:border-neutral-300 print:bg-neutral-100">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Amount</span>
              </div>
              {keyedMaterialItems.length ? (
                keyedMaterialItems.map((material) => (
                  <div
                    key={material.rowKey}
                    className="grid grid-cols-[minmax(0,1fr)_3.75rem_4.25rem_4.75rem_5rem] gap-2 border-b px-2 py-1.5 text-xs last:border-b-0 print:border-neutral-200"
                  >
                    <span className="min-w-0 break-words">
                      {formatDash(material.description)}
                      {formatLineMeta(material) ? <span className="hidden">{formatLineMeta(material)}</span> : null}
                    </span>
                    <span className="block text-right tabular-nums">{formatDash(material.quantity)}</span>
                    <span className="block text-right">{formatDash(material.unit)}</span>
                    <span className="block text-right tabular-nums">{formatOptionalMoney(material.unitPrice)}</span>
                    <span className="text-right tabular-nums">{formatOptionalMoney(material.price)}</span>
                  </div>
                ))
              ) : (
                <div className="px-2 py-1.5 text-muted-foreground text-xs">No material line items.</div>
              )}
            </div>
          </section>

          <section className="grid justify-end gap-2">
            <div className="grid min-w-64 gap-1.5 rounded-md border bg-muted/20 p-3 text-xs print:min-w-56 print:border-neutral-300 print:bg-neutral-50 print:p-2">
              <div className="flex items-center justify-between gap-6">
                <span className="text-muted-foreground">Materials subtotal</span>
                <span className="font-medium">{formatMoney(estimate.materialsSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-muted-foreground">Tax ({estimate.materialTaxRate.toString()}%)</span>
                <span className="font-medium">{formatMoney(estimate.materialTaxAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-lg text-muted-foreground">Estimated total</span>
                <span className="font-semibold text-lg text-sky-700 dark:text-sky-400 print:text-base">
                  {formatMoney(estimate.estimatedTotal)}
                </span>
              </div>
              <Separator />
              <p className="text-muted-foreground">
                This estimate is a snapshot of the job details at the time it was created.
              </p>
            </div>
          </section>

          <section className="grid gap-2 rounded-md border bg-muted/20 p-3 text-xs print:border-neutral-300 print:bg-neutral-50">
            <div className="font-semibold">Payment Schedule</div>
            <div className="grid gap-1">
              <div className="flex items-center justify-between gap-6">
                <span>1st payment due before work begins (half of estimate amount)</span>
                <span className="font-medium">{`$${paymentAmount.toFixed(2)}`}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span>2nd payment due when the job is completed</span>
                <span className="font-medium">{`$${paymentAmount.toFixed(2)}`}</span>
              </div>
            </div>
            <Separator />
            <p>
              Any additional work or materials not included in this estimate will be reviewed with the customer and
              billed as an extra charge.
            </p>
            <p className="font-medium">Please make all checks payable to: {currentUser.companyName}</p>
            <p className="font-semibold">Thank you for your business!</p>
          </section>
        </article>
      </div>
    </div>
  );
}
