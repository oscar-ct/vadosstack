import Image from "next/image";

import { format } from "date-fns";
import { BriefcaseBusiness, CalendarDays, Mail, MapPin, NotebookText, Phone, UserRound } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { formatPhoneNumber } from "@/lib/phone";

export type EstimateCustomerPreviewItem = {
  description?: string;
  price?: string;
  quantity?: string;
  unit?: string;
  unitPrice?: string;
};

export type EstimateCustomerPreviewData = {
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  dateBegin?: Date | null;
  dateEnd?: Date | null;
  estimateNumber?: string | null;
  estimatedTotal: string;
  issuedAt?: Date | null;
  jobDescription?: string | null;
  jobTitle: string;
  jobType: "Commercial" | "Residential";
  laborCost: string;
  laborItems: EstimateCustomerPreviewItem[];
  materialItems: EstimateCustomerPreviewItem[];
  materialTaxAmount: string;
  materialTaxRate: string;
  materialsSubtotal: string;
  serviceLocation?: string | null;
  validThrough?: Date | null;
};

function formatMoney(value?: string | number | null) {
  return `$${Number(value ?? 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function formatDash(value?: string) {
  return value?.trim() ? value : "-";
}

function formatOptionalMoney(value?: string) {
  return value?.trim() ? formatMoney(value) : "-";
}

function formatMaybeDate(value?: Date | null) {
  return value ? format(value, "MMM d, yyyy") : "Not scheduled";
}

function formatSchedule(dateBegin?: Date | null, dateEnd?: Date | null) {
  if (!dateBegin && !dateEnd) return "Unscheduled";
  return `Begin: ${formatMaybeDate(dateBegin)}${dateEnd ? `\nEnd: ${formatMaybeDate(dateEnd)}` : ""}`;
}

function formatLineMeta(item: EstimateCustomerPreviewItem) {
  return [
    item.quantity?.trim() ? `Qty ${item.quantity}` : null,
    item.unit?.trim() ? `Unit ${item.unit}` : null,
    item.unitPrice?.trim() ? `Rate ${formatOptionalMoney(item.unitPrice)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function PreviewItems({ items, label }: { items: EstimateCustomerPreviewItem[]; label: string }) {
  const seenKeys = new Map<string, number>();
  const keyedItems = items.map((item) => {
    const baseKey = `${label}-${item.description}-${item.quantity}-${item.unit}-${item.unitPrice}-${item.price}`;
    const count = seenKeys.get(baseKey) ?? 0;
    seenKeys.set(baseKey, count + 1);

    return { ...item, rowKey: count ? `${baseKey}-${count}` : baseKey };
  });

  return (
    <section className="grid gap-2">
      <div className="font-medium text-xs">{label}</div>
      <div className="grid gap-2 md:hidden print:hidden">
        {keyedItems.length ? (
          keyedItems.map((item) => (
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
          <div className="rounded-md border bg-muted/20 p-3 text-muted-foreground text-xs">
            No {label.toLowerCase()} line items.
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
        {keyedItems.length ? (
          keyedItems.map((item) => (
            <div
              key={item.rowKey}
              className="grid grid-cols-[minmax(0,1fr)_3.75rem_4.25rem_4.75rem_5rem] gap-2 border-b px-2 py-1.5 text-xs last:border-b-0 print:border-neutral-200"
            >
              <span className="min-w-0 break-words">{formatDash(item.description)}</span>
              <span className="text-right tabular-nums">{formatDash(item.quantity)}</span>
              <span className="text-right">{formatDash(item.unit)}</span>
              <span className="text-right tabular-nums">{formatOptionalMoney(item.unitPrice)}</span>
              <span className="text-right tabular-nums">{formatOptionalMoney(item.price)}</span>
            </div>
          ))
        ) : (
          <div className="px-2 py-1.5 text-muted-foreground text-xs">No {label.toLowerCase()} line items.</div>
        )}
      </div>
    </section>
  );
}

export function EstimateCustomerPreview({
  companyEmail,
  companyLogoSrc,
  companyName,
  companyPhone,
  data,
  messageAlignClassName,
  messageLines,
}: {
  companyEmail: string;
  companyLogoSrc: string;
  companyName: string;
  companyPhone?: string | null;
  data: EstimateCustomerPreviewData;
  messageAlignClassName?: string;
  messageLines?: Array<{ id: string; line: string }>;
}) {
  const isDraft = !data.estimateNumber;
  const subtotal = Number(data.laborCost) + Number(data.materialsSubtotal);
  const taxableItemsLabel = data.jobType === "Commercial" ? "labor + materials" : "materials";

  return (
    <div className="rounded-lg border bg-muted/20 p-2 sm:p-4 print:contents">
      {isDraft ? (
        <div className="mx-auto mb-3 flex w-full max-w-[816px] items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-xs dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200 print:hidden">
          <span>
            <strong>Draft preview.</strong> Publish the estimate before emailing or downloading the customer copy.
          </span>
          <span className="shrink-0 font-medium">Not issued</span>
        </div>
      ) : null}

      <article className="mx-auto grid w-full max-w-[816px] gap-4 rounded-md border bg-card p-4 shadow-sm sm:p-5 print:min-h-[9.6in] print:w-auto print:max-w-none print:gap-3 print:border-0 print:bg-white print:p-5 print:text-[10px] print:text-neutral-950 print:shadow-none">
        <header className="grid gap-4 pb-2 md:grid-cols-[1fr_auto] print:pb-2">
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
              <div className="grid min-w-0 gap-0.5">
                <div className="truncate font-semibold text-lg leading-none print:text-sm">{companyName}</div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Mail className="size-3 shrink-0" />
                    <span className="truncate">{companyEmail}</span>
                  </span>
                  {companyPhone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3" />
                      <span>{formatPhoneNumber(companyPhone)}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 font-semibold text-xl print:mt-2 print:text-base">
              <NotebookText className="size-5 text-muted-foreground print:size-4" />
              Estimate
            </div>
            <div className="grid gap-0.5 text-muted-foreground text-xs">
              <span>
                {data.estimateNumber ? `Estimate #${data.estimateNumber}` : "Estimate number assigned when published"}
              </span>
              <span>{data.issuedAt ? `Issued ${format(data.issuedAt, "MMM d, yyyy")}` : "Not issued"}</span>
              <span>
                {data.validThrough
                  ? `Valid through ${format(data.validThrough, "MMM d, yyyy")}`
                  : "Validity begins when published"}
              </span>
            </div>
          </div>
          <div className="grid gap-1 rounded-md border bg-muted/20 p-3 text-left md:text-right print:border-neutral-300 print:bg-neutral-50 print:p-2">
            <span className="text-muted-foreground text-xs">Estimated total</span>
            <span className="font-semibold text-2xl text-sky-700 dark:text-sky-400 print:text-xl">
              {formatMoney(data.estimatedTotal)}
            </span>
            <span className="text-muted-foreground text-xs">
              {data.validThrough ? `valid through ${format(data.validThrough, "MMM d, yyyy")}` : "draft customer copy"}
            </span>
          </div>
        </header>

        <section className="overflow-hidden rounded-md border bg-muted/20 text-xs print:border-neutral-300 print:bg-neutral-50">
          <div className="grid md:grid-cols-2">
            <div className="grid gap-1 border-b p-2 md:border-r">
              <div className="flex items-center gap-2 font-medium text-muted-foreground">
                <UserRound className="size-3.5" /> Prepared For
              </div>
              <div>
                <div className="font-medium">{data.customerName ?? "No customer on file"}</div>
                <div className="text-muted-foreground">{data.customerEmail ?? "No email on file"}</div>
                <div className="text-muted-foreground">
                  {data.customerPhone ? formatPhoneNumber(data.customerPhone) : "No phone on file"}
                </div>
              </div>
            </div>
            <div className="grid gap-1 border-b p-2">
              <div className="flex items-center gap-2 font-medium text-muted-foreground">
                <BriefcaseBusiness className="size-3.5" /> Job
              </div>
              <div className="font-medium">{data.jobTitle}</div>
            </div>
            <div className="grid gap-1 border-b p-2 md:border-r md:border-b-0">
              <div className="flex items-center gap-2 font-medium text-muted-foreground">
                <CalendarDays className="size-3.5" /> Schedule
              </div>
              <div className="whitespace-pre-line">{formatSchedule(data.dateBegin, data.dateEnd)}</div>
            </div>
            <div className="grid gap-1 p-2">
              <div className="flex items-center gap-2 font-medium text-muted-foreground">
                <MapPin className="size-3.5" /> Service Location
              </div>
              <div>{data.serviceLocation ?? "Not on file"}</div>
            </div>
          </div>
        </section>

        {data.jobDescription ? (
          <section className="grid gap-1">
            <div className="font-medium text-xs">Job Description</div>
            <p className="whitespace-pre-line rounded-md border bg-muted/20 p-2 text-xs print:border-neutral-300 print:bg-neutral-50">
              {data.jobDescription}
            </p>
          </section>
        ) : null}

        <PreviewItems items={data.laborItems} label="Labor" />
        <PreviewItems items={data.materialItems} label="Materials" />

        <section className="grid justify-end gap-2">
          <div className="grid w-full gap-1.5 rounded-md border bg-muted/20 p-3 text-xs md:min-w-72 md:max-w-80 print:min-w-56 print:border-neutral-300 print:bg-neutral-50 print:p-2">
            <div className="flex items-center justify-between gap-6">
              <span className="text-muted-foreground">Labor</span>
              <span className="font-medium">{formatMoney(data.laborCost)}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-muted-foreground">Materials</span>
              <span className="font-medium">{formatMoney(data.materialsSubtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-muted-foreground">
                Tax on {taxableItemsLabel} ({data.materialTaxRate}%)
              </span>
              <span className="font-medium">{formatMoney(data.materialTaxAmount)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-6">
              <span className="font-medium">Estimated total</span>
              <span className="font-semibold text-base text-sky-700 tabular-nums dark:text-sky-400">
                {formatMoney(data.estimatedTotal)}
              </span>
            </div>
          </div>
        </section>

        {messageLines?.length ? (
          <section
            className={`grid gap-2 rounded-md border bg-muted/20 p-3 text-xs print:border-neutral-300 print:bg-neutral-50 ${messageAlignClassName ?? ""}`}
          >
            {messageLines.map((item, index) => (
              <p
                key={item.id}
                className={index === 0 || index === messageLines.length - 1 ? "font-semibold" : undefined}
              >
                {item.line}
              </p>
            ))}
          </section>
        ) : null}
      </article>
    </div>
  );
}
