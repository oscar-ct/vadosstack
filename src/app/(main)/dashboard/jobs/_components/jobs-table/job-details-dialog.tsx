"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format, parseISO } from "date-fns";
import { CircleDollarSign, FileText, Mail, NotebookText, Pencil, ReceiptText, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { InvoiceMutationState } from "../../../invoices/types";
import type { JobMutationState } from "../../actions";
import { calculateSignedMaterialTotal } from "../materials";
import { statusIcon } from "./columns";
import type { JobRow } from "./schema";

const initialInvoiceState: InvoiceMutationState = {
  success: false,
  message: "",
};

const initialJobMutationState: JobMutationState = {
  success: false,
  message: "",
};

function DetailItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-sm">{value ?? "Not on file"}</span>
    </div>
  );
}

function formatDateStartToEnd(value?: string, value2?: string) {
  const startDate = value ? format(parseISO(value), "MMM d, yyyy") : undefined;
  const endDate = value2 ? format(parseISO(value2), "MMM d, yyyy") : undefined;
  if (!startDate) {
    return "Unscheduled";
  }
  if (!endDate) {
    return `${startDate} - Not scheduled`;
  }
  return `${startDate} - ${endDate}`;
}

function formatShortDate(value?: string) {
  return value ? format(parseISO(value), "MMM d, yyyy") : undefined;
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatMoney(value?: string) {
  if (value === undefined) return undefined;

  const amount = Number(value);

  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : `$${value}`;
}

function toMoneyNumber(value?: string) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getInvoiceEligibility(job: JobRow) {
  if (!job.customerId) {
    return {
      canCreate: false,
      message: "Add a customer before creating an invoice.",
    };
  }

  if (toMoneyNumber(job.finalCost) <= 0) {
    return {
      canCreate: false,
      message: "Add billable totals before creating an invoice.",
    };
  }

  return {
    canCreate: true,
    message: undefined,
  };
}

function getMaterialsSubtotal(job: JobRow) {
  return job.materials
    .reduce((total, material) => total + Number(calculateSignedMaterialTotal(material)), 0)
    .toFixed(2);
}

function getLaborSubtotal(job: JobRow) {
  return job.laborItems.length
    ? job.laborItems.reduce((total, item) => total + Number(item.price || 0), 0).toFixed(2)
    : (job.laborCost ?? "0.00");
}

function getMaterialTaxAmount(job: JobRow) {
  const subtotal = Number(getMaterialsSubtotal(job));
  const laborCost = Number(getLaborSubtotal(job));
  const taxRate = Number(job.materialTaxRate ?? 0);
  return (((laborCost + subtotal) * taxRate) / 100).toFixed(2);
}

function withLineItemKeys<T extends { description: string; price: string }>(items: T[]) {
  const seen = new Map<string, number>();

  return items.map((item) => {
    const baseKey = `${item.description}-${item.price}`;
    const occurrence = (seen.get(baseKey) ?? 0) + 1;
    seen.set(baseKey, occurrence);

    return {
      ...item,
      key: `${baseKey}-${occurrence}`,
    };
  });
}

function DeletePaymentDialog({
  deletePaymentFormAction,
  isDeletingPayment,
  payment,
}: {
  deletePaymentFormAction: React.ComponentProps<"form">["action"];
  isDeletingPayment: boolean;
  payment: JobRow["payments"][number];
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={isDeletingPayment}
          aria-label={`Delete ${payment.description} payment`}
        >
          <Trash2 className="text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete recorded payment?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the {formatMoney(payment.amount)} payment for {payment.description} recorded on{" "}
            {formatShortDate(payment.paidOn)}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form id={`delete-payment-${payment.id}`} action={deletePaymentFormAction}>
          <input type="hidden" name="id" value={payment.id} />
        </form>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeletingPayment}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeletingPayment}
            onClick={(event) => {
              event.preventDefault();
              const form = document.getElementById(`delete-payment-${payment.id}`) as HTMLFormElement | null;
              form?.requestSubmit();
            }}
          >
            {isDeletingPayment ? "Deleting..." : "Delete payment"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function JobDetailsDialog({
  createJobPaymentAction,
  createInvoiceAction,
  deleteJobPaymentAction,
  job,
  onEditJob,
  open,
  onOpenChange,
}: {
  createJobPaymentAction: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  createInvoiceAction: (state: InvoiceMutationState, formData: FormData) => Promise<InvoiceMutationState>;
  deleteJobPaymentAction: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  job: JobRow | null;
  onEditJob: (job: JobRow) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const paymentFormRef = React.useRef<HTMLFormElement>(null);
  const laborItems = React.useMemo(() => withLineItemKeys(job?.laborItems ?? []), [job?.laborItems]);
  const materials = React.useMemo(() => withLineItemKeys(job?.materials ?? []), [job?.materials]);
  const invoiceEligibility = React.useMemo(() => (job ? getInvoiceEligibility(job) : null), [job]);
  const [invoiceState, createInvoiceFormAction, isCreatingInvoice] = React.useActionState(
    createInvoiceAction,
    initialInvoiceState,
  );
  const [paymentState, createPaymentFormAction, isCreatingPayment] = React.useActionState(
    createJobPaymentAction,
    initialJobMutationState,
  );
  const [deletePaymentState, deletePaymentFormAction, isDeletingPayment] = React.useActionState(
    deleteJobPaymentAction,
    initialJobMutationState,
  );

  React.useEffect(() => {
    if (!invoiceState.success) return;

    router.refresh();
  }, [invoiceState.success, router]);

  React.useEffect(() => {
    if (!paymentState.success) return;

    paymentFormRef.current?.reset();
    router.refresh();
  }, [paymentState.success, router]);

  React.useEffect(() => {
    if (!deletePaymentState.success) return;

    router.refresh();
  }, [deletePaymentState.success, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden sm:max-w-5xl">
        {job ? (
          <>
            <DialogHeader className="border-b pt-2 pr-10 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-md border bg-muted">
                  <FileText className="size-5 text-muted-foreground" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-wrap font-semibold tracking-tight">
                      {job.description}
                    </DialogTitle>
                    <DialogDescription className="truncate">
                      {job.customerName}
                      {/*{formatDate(job.dateBegin) ? ` · ${formatDate(job.dateBegin)}` : ""}*/}
                    </DialogDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="h-8 w-fit shrink-0 bg-muted-foreground/10 px-2 text-muted-foreground"
                  >
                    {statusIcon(job.status)}
                    {job.status}
                  </Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onEditJob(job);
                  }}
                >
                  <Pencil />
                  Edit job
                </Button>
                {job.estimateId ? (
                  <Button asChild variant="outline" size="sm">
                    <Link prefetch={false} href={`/dashboard/estimates/${job.estimateId}?from=jobs`}>
                      <NotebookText />
                      View estimate
                    </Link>
                  </Button>
                ) : null}
                {job.invoiceId ? (
                  <Button asChild size="sm">
                    <Link prefetch={false} href={`/dashboard/invoices/${job.invoiceId}?from=jobs`}>
                      <ReceiptText />
                      View invoice
                    </Link>
                  </Button>
                ) : (
                  <form action={createInvoiceFormAction}>
                    <input type="hidden" name="jobId" value={job.id} />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isCreatingInvoice || !invoiceEligibility?.canCreate}
                      title={invoiceEligibility?.message}
                    >
                      <ReceiptText />
                      {isCreatingInvoice ? "Creating..." : "Create invoice"}
                    </Button>
                  </form>
                )}
              </div>
              {invoiceState.message ? (
                <p className={invoiceState.success ? "mt-2 text-emerald-700 text-sm" : "mt-2 text-destructive text-sm"}>
                  {invoiceState.message}
                </p>
              ) : null}
              {!job.invoiceId && invoiceEligibility?.message ? (
                <p className="mt-2 text-muted-foreground text-xs">{invoiceEligibility.message}</p>
              ) : null}
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                <section className="grid gap-4 rounded-lg border p-4">
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="w-fit">
                        {job.category}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">{job.scope || "No description on file."}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailItem label="Customer" value={job.customerName} />
                    <DetailItem label="Job dates" value={formatDateStartToEnd(job.dateBegin, job.dateEnd)} />
                    <DetailItem label="Notes" value={job.notes || "No notes on file"} />
                    <DetailItem label="Service location" value={job.serviceLocation} />
                  </div>
                </section>

                <section className="grid gap-3 rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <CircleDollarSign className="size-4 text-muted-foreground" />
                    Payment summary
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailItem label="Final price" value={formatMoney(job.finalCost)} />
                    <DetailItem label="Balance due" value={formatMoney(job.outstandingBalance)} />
                    <DetailItem label="Amount paid" value={formatMoney(job.amountPaid)} />
                    <DetailItem label="Labor" value={formatMoney(getLaborSubtotal(job))} />
                    <DetailItem label="Materials" value={formatMoney(getMaterialsSubtotal(job))} />
                    <DetailItem
                      label={`Tax${job.materialTaxRate ? ` (${job.materialTaxRate}%)` : ""}`}
                      value={formatMoney(getMaterialTaxAmount(job))}
                    />
                  </div>
                </section>
              </div>

              <section className="grid gap-3">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <CircleDollarSign className="size-4 text-muted-foreground" />
                  Transaction history
                </div>
                <form
                  ref={paymentFormRef}
                  action={createPaymentFormAction}
                  className="grid gap-3 rounded-lg border p-4"
                >
                  <input type="hidden" name="jobId" value={job.id} />
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[140px_120px_150px_130px_minmax(180px,1fr)]">
                    <div className="grid gap-2">
                      <Label htmlFor={`job-payment-date-${job.id}`}>Date</Label>
                      <Input
                        id={`job-payment-date-${job.id}`}
                        name="paidOn"
                        type="date"
                        defaultValue={toDateInputValue(new Date())}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`job-payment-amount-${job.id}`}>Amount</Label>
                      <Input
                        id={`job-payment-amount-${job.id}`}
                        name="amount"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`job-payment-method-${job.id}`}>Method</Label>
                      <Input
                        id={`job-payment-method-${job.id}`}
                        name="method"
                        placeholder="Zelle, check, card"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`job-payment-reference-${job.id}`}>Check / Ref #</Label>
                      <Input id={`job-payment-reference-${job.id}`} name="referenceNumber" placeholder="Optional" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`job-payment-description-${job.id}`}>Description</Label>
                      <Input
                        id={`job-payment-description-${job.id}`}
                        name="description"
                        placeholder="Deposit, materials, labor"
                        required
                      />
                    </div>
                  </div>
                  {paymentState.message && !paymentState.success ? (
                    <p className="text-destructive text-sm">{paymentState.message}</p>
                  ) : null}
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={isCreatingPayment}>
                      {isCreatingPayment ? "Recording..." : "Add payment"}
                    </Button>
                  </div>
                </form>
                {job.payments.length ? (
                  <div className="grid gap-2 sm:block">
                    <div className="grid gap-2 sm:hidden">
                      {job.payments.map((payment) => (
                        <div key={payment.id} className="rounded-lg border bg-muted/10 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-sm leading-5">{payment.description}</div>
                              <div className="mt-0.5 text-muted-foreground text-xs">
                                {formatShortDate(payment.paidOn)}
                              </div>
                            </div>
                            <div className="shrink-0 text-right font-semibold text-sm tabular-nums">
                              {formatMoney(payment.amount)}
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-xs">
                            <div className="grid gap-1">
                              <span className="text-muted-foreground">Method</span>
                              <span className="font-medium">{payment.method}</span>
                            </div>
                            <div className="grid gap-1">
                              <span className="text-muted-foreground">Ref #</span>
                              <span className="font-medium">{payment.referenceNumber ?? "-"}</span>
                            </div>
                          </div>
                          <div className="mt-2 flex justify-end">
                            <DeletePaymentDialog
                              deletePaymentFormAction={deletePaymentFormAction}
                              isDeletingPayment={isDeletingPayment}
                              payment={payment}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden overflow-hidden rounded-lg border sm:block">
                      <div className="grid grid-cols-[120px_minmax(0,1fr)_120px_120px_110px_auto] gap-3 border-b bg-muted/80 px-3 py-2 font-medium text-xs">
                        <span>Date</span>
                        <span>Description</span>
                        <span>Method</span>
                        <span>Ref #</span>
                        <span className="text-right">Amount</span>
                        <span className="sr-only">Actions</span>
                      </div>
                      {job.payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="grid grid-cols-[120px_minmax(0,1fr)_120px_120px_110px_auto] items-center gap-3 border-b px-3 py-3 text-sm last:border-b-0"
                        >
                          <span>{formatShortDate(payment.paidOn)}</span>
                          <span>{payment.description}</span>
                          <span className="text-muted-foreground">{payment.method}</span>
                          <span className="text-muted-foreground">{payment.referenceNumber ?? "-"}</span>
                          <span className="text-right font-medium tabular-nums">{formatMoney(payment.amount)}</span>
                          <DeletePaymentDialog
                            deletePaymentFormAction={deletePaymentFormAction}
                            isDeletingPayment={isDeletingPayment}
                            payment={payment}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg border bg-muted/20 p-4 text-muted-foreground text-sm">
                    No payments recorded yet.
                  </p>
                )}
                {deletePaymentState.message && !deletePaymentState.success ? (
                  <p className="text-destructive text-sm">{deletePaymentState.message}</p>
                ) : null}
              </section>

              {/*<div className="grid gap-4">*/}
              {/*  <section className="grid gap-2 rounded-lg border p-4">*/}
              {/*    <div className="flex items-center gap-2 font-medium text-sm">*/}
              {/*      <FileText className="size-4 text-muted-foreground" />*/}
              {/*      Notes*/}
              {/*    </div>*/}
              {/*    <p className="whitespace-pre-line text-sm">{job.notes || "No notes on file."}</p>*/}
              {/*  </section>*/}
              {/*</div>*/}

              <section className="grid gap-3">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <CircleDollarSign className="size-4 text-muted-foreground" />
                  Labor and materials
                </div>
                <div className="grid gap-3">
                  <div className="rounded-lg border border-sky-200/80 bg-sky-50/50 p-3 dark:border-sky-900/60 dark:bg-sky-950/20">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="font-medium text-sm">Labor</div>
                      <span className="text-muted-foreground text-xs">{laborItems.length} item(s)</span>
                    </div>
                    {laborItems.length ? (
                      <div className="divide-y divide-sky-200/70 dark:divide-sky-900/60">
                        {laborItems.map((item) => (
                          <div
                            key={item.key}
                            className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2 text-sm first:pt-0 last:pb-0"
                          >
                            <span className="min-w-0 whitespace-normal break-words">{item.description}</span>
                            <span className="whitespace-nowrap text-right tabular-nums">{formatMoney(item.price)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No labor line items.</p>
                    )}
                  </div>
                  {laborItems.length ? (
                    <div className="flex justify-end pt-2">
                      <span className="whitespace-nowrap text-right font-medium tabular-nums">
                        Labor total: {formatMoney(getLaborSubtotal(job))}
                      </span>
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="font-medium text-sm">Materials</div>
                      <span className="text-muted-foreground text-xs">{materials.length} item(s)</span>
                    </div>
                    {materials.length ? (
                      <div className="divide-y divide-amber-200/70 dark:divide-amber-900/60">
                        {materials.map((material) => (
                          <div
                            key={material.key}
                            className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2 text-sm first:pt-0 last:pb-0"
                          >
                            <span className="min-w-0 whitespace-normal break-words">
                              {material.description}
                              <span className="mt-0.5 block text-muted-foreground text-xs">
                                {[
                                  material.type === "return" ? "Return" : undefined,
                                  material.purchaseDate
                                    ? format(parseISO(material.purchaseDate), "MMM d, yyyy")
                                    : undefined,
                                  material.vendor,
                                  material.quantity && material.unitPrice
                                    ? `Qty ${material.quantity} × ${formatMoney(material.unitPrice)}`
                                    : undefined,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                            <span className="whitespace-nowrap text-right tabular-nums">
                              {material.type === "return" ? "-" : ""}
                              {formatMoney(material.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No material line items.</p>
                    )}
                  </div>
                  {materials.length ? (
                    <div className="flex justify-end pt-2">
                      <span className="whitespace-nowrap text-right font-medium tabular-nums">
                        Materials total: {formatMoney(getMaterialsSubtotal(job))}
                      </span>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
