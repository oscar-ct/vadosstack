import type * as React from "react";

import Link from "next/link";
import { notFound } from "next/navigation";

import { format, parseISO } from "date-fns";
import {
  BadgeDollarSign,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  type LucideIcon,
  MapPin,
  Package,
  Pencil,
  ReceiptText,
  Ruler,
  UserRound,
  Wrench,
} from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { createInvoiceAction } from "../../invoices/actions";
import { JobBackButton } from "../_components/job-back-button";
import { CreateDepositButton, DeleteDepositButton, JobInvoiceButton } from "../_components/job-record-action-buttons";
import { calculateSignedMaterialTotal } from "../_components/materials";
import { getJob } from "../_lib/job-data";
import { createJobPaymentAction, deleteJobPaymentAction } from "../actions";

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

function jobStatusClassName(status: string) {
  if (status === "Completed") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900";
  if (status === "Cancelled") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900";
  if (status === "On Hold") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900";
  if (status === "Scheduled") return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900";
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

function InfoTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: string }) {
  return (
    <div className="grid gap-1 rounded-lg border bg-background p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="font-medium text-sm">{value ?? "Not on file"}</div>
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
  items: Array<{
    description?: string;
    price?: string;
    quantity?: string;
    unit?: string;
    unitPrice?: string;
    type?: "purchase" | "return";
    vendor?: string;
    purchaseDate?: string;
  }>;
  label: string;
  tone: "L" | "M";
}) {
  const seenKeys = new Map<string, number>();
  const keyedItems = items.map((item) => ({
    ...item,
    rowKey: createUniqueRowKey(
      `${label}-${item.description}-${item.quantity}-${item.unit}-${item.unitPrice}-${item.price}-${item.type}`,
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
          const hasVendor = Boolean(item.vendor?.trim());
          const hasPurchaseDate = Boolean(item.purchaseDate?.trim());
          const signedPrice = item.type
            ? calculateSignedMaterialTotal({
                ...item,
                quantity: item.quantity ?? "",
                unitPrice: item.unitPrice ?? "",
                price: item.price ?? "",
              })
            : item.price;
          const hasDetails =
            hasQuantity || hasUnit || hasRate || hasVendor || hasPurchaseDate || item.type === "return";

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
                <span className="font-medium text-sm tabular-nums md:hidden">{formatMoney(signedPrice)}</span>
              </div>
              <div className="order-1 grid min-w-0 gap-1 md:order-none">
                <div className="font-medium text-sm">{item.description || "Untitled line item"}</div>
                {hasDetails ? (
                  <div className="flex flex-wrap gap-1 text-xs leading-none">
                    {item.type === "return" ? (
                      <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">Return ·</span>
                    ) : null}
                    {hasQuantity ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        Qty: <span className="tabular-nums">{item.quantity} ·</span>
                      </span>
                    ) : null}
                    {hasUnit ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">Unit: {item.unit} ·</span>
                    ) : null}
                    {hasRate ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        Rate: <span className="tabular-nums">{formatMoney(item.unitPrice)} ·</span>
                      </span>
                    ) : null}
                    {hasVendor ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">{item.vendor} ·</span>
                    ) : null}
                    {hasPurchaseDate ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        {format(parseISO(item.purchaseDate ?? ""), "MMM d, yyyy")}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="hidden font-semibold text-sm tabular-nums md:block md:text-right">
                {formatMoney(signedPrice)}
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
}: {
  params: Promise<{
    jobId: string;
  }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view jobs"
        description="Job records are private to each signed-in account."
      />
    );
  }

  const { jobId } = await params;
  const job = await getJob(currentUser.id, jobId);

  if (!job) {
    notFound();
  }

  const laborSubtotal = sum(job.laborItems);
  const materialsSubtotal = job.materials.reduce(
    (total, material) => total + Number(calculateSignedMaterialTotal(material)),
    0,
  );
  const taxRate = Number(job.materialTaxRate ?? 0);
  const taxableSubtotal = materialsSubtotal + (job.jobType === "Commercial" ? laborSubtotal : 0);
  const tax = taxableSubtotal * (taxRate / 100);
  const measurementTotal = job.measurementRooms.reduce((total, room) => total + roomArea(room), 0);
  const measuredAreas = job.measurementRooms.filter((room) => roomArea(room) > 0);
  const startDate = job.dateBegin ? format(parseISO(job.dateBegin), "MMM d, yyyy") : "Unscheduled";
  const endDate = job.dateEnd ? format(parseISO(job.dateEnd), "MMM d, yyyy") : undefined;
  const taxBasis = job.jobType === "Commercial" ? "Labor + materials" : "Materials only";
  const deposits = (job?.payments ?? []).filter((payment) => payment.paymentType === "deposit");

  return (
    <div className="@container/main mx-auto grid w-full max-w-7xl gap-5 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <JobBackButton />
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link prefetch={false} href={`/dashboard/jobs/${job.id}/edit`}>
              <Pencil />
              Edit
            </Link>
          </Button>
          <CreateDepositButton action={createJobPaymentAction} className="w-auto" size="sm" job={job} />
          <JobInvoiceButton action={createInvoiceAction} className="w-auto" job={job} size="sm" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="grid gap-5 bg-card p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="grid gap-3">
            <Badge variant="outline" className={cn("w-fit", jobStatusClassName(job.status))}>
              {job.status}
            </Badge>
            <div>
              <h1 className="font-medium text-xl tracking-normal md:text-2xl">{job.description}</h1>
              <p className="mt-2 max-w-3xl text-muted-foreground text-sm">
                {job.scope || "No scope description on file."}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-4 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-100">
            <div className="flex items-center gap-2 text-sky-800 text-xs uppercase tracking-normal dark:text-sky-200">
              <BadgeDollarSign className="size-4" />
              Job total
            </div>
            <div className="mt-2 font-semibold text-2xl tabular-nums">{formatMoney(job.finalCost)}</div>
            <div className="mt-1 text-sky-800/80 text-xs dark:text-sky-200/80">{taxBasis} tax basis</div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="grid gap-5">
          <SectionPanel icon={ClipboardList} title="Job Details">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InfoTile icon={UserRound} label="Customer" value={job.customerName} />
              <InfoTile icon={MapPin} label="Service location" value={job.serviceLocation} />
              <InfoTile
                icon={CalendarDays}
                label="Schedule"
                value={endDate ? `${startDate} - ${endDate}` : startDate}
              />
              <InfoTile icon={Building2} label="Job type" value={job.jobType} />
            </div>
            {job.notes ? (
              <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                <div className="text-muted-foreground text-xs">Internal notes</div>
                <div className="mt-1 text-sm">{job.notes}</div>
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
                  <div className="mt-1 font-semibold text-2xl tabular-nums">{formatArea(measurementTotal)} sq ft</div>
                </div>
              </div>
            </SectionPanel>
          ) : null}

          <SectionPanel icon={Wrench} title="Labor" description="Work items and service pricing.">
            <LineItems items={job.laborItems} label="Labor" tone="L" />
          </SectionPanel>

          <SectionPanel icon={Package} title="Materials" description="Parts, supplies, quantities, rates, and returns.">
            <LineItems items={job.materials} label="Materials" tone="M" />
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
                <span className="text-muted-foreground">Tax basis</span>
                <span className="font-medium tabular-nums">{formatMoney(taxableSubtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Tax ({taxRate.toFixed(2)}%)</span>
                <span className="font-medium tabular-nums">{formatMoney(tax)}</span>
              </div>
              <div className="mt-2 flex justify-between gap-3 border-sky-200 border-t pt-3 dark:border-sky-900/60">
                <span className="font-medium">Customer total</span>
                <span className="font-semibold tabular-nums">{formatMoney(job.finalCost)}</span>
              </div>
            </div>
          </section>

          <section className="w-full rounded-lg border bg-background p-4">
            <div className={"flex justify-between gap-2"}>
              <div className="flex items-center gap-2 font-semibold text-sm uppercase tracking-normal">
                <CircleDollarSign className="size-4" />
                Deposits
              </div>
              {deposits.length ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                  {deposits.length}
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2 text-sm">
              {/*<div className="flex justify-between gap-3"><span*/}
              {/*    className="text-muted-foreground">Payment status</span><span*/}
              {/*    className="font-medium">{job.paymentStatus}</span></div>*/}
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Deposit paid</span>
                <span className="font-medium tabular-nums">{formatMoney(job.depositPaid)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Other payments</span>
                <span className="font-medium tabular-nums">{formatMoney(job.amountPaid)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Balance</span>
                <span className="font-semibold text-red-700 tabular-nums">{formatMoney(job.outstandingBalance)}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {deposits.length ? (
                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                  {deposits.map((payment) => (
                    <div
                      key={payment.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b p-2.5 text-sm transition-colors last:border-b-0 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium leading-tight">{payment.description || "Deposit"}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-muted-foreground text-xs leading-snug">
                          <span>{format(parseISO(payment.paidOn), "MMM d, yyyy")}</span>

                          {payment.method ? (
                            <>
                              <span>·</span>
                              <span className="truncate">{payment.method}</span>
                            </>
                          ) : null}

                          {payment.referenceNumber ? (
                            <>
                              <span>·</span>
                              <span className="truncate">Ref #{payment.referenceNumber}</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-start gap-1.5">
                        <span className="rounded-md bg-muted px-2 py-1 text-right font-semibold tabular-nums leading-none">
                          {formatMoney(payment.amount)}
                        </span>
                        <DeleteDepositButton action={deleteJobPaymentAction} paymentId={payment.id} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed bg-muted/20 p-3 text-muted-foreground text-sm">
                  No deposits recorded yet.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

{
  /*{deposits.length ? (*/
}
{
  /*    <div className="mt-4 grid gap-2 border-t pt-3">*/
}
{
  /*      {deposits.map((payment) => (*/
}
{
  /*          <div key={payment.id}*/
}
{
  /*               className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-sm">*/
}
{
  /*            <div className="min-w-0">*/
}
{
  /*              <div className="font-medium">{payment.description}</div>*/
}
{
  /*              <div*/
}
{
  /*                  className="text-muted-foreground text-xs">{format(parseISO(payment.paidOn), "MMM d, yyyy")}</div>*/
}
{
  /*            </div>*/
}
{
  /*            <span className="font-medium tabular-nums">{formatMoney(payment.amount)}</span>*/
}
{
  /*            <DeleteDepositButton action={deleteJobPaymentAction} paymentId={payment.id}/>*/
}
{
  /*          </div>*/
}
{
  /*      ))}*/
}
{
  /*    </div>*/
}
{
  /*) : null}*/
}
{
  /*<JobPaymentForm action={createJobPaymentAction} job={job} />*/
}
