"use client";

import * as React from "react";

import {
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  LoaderCircle,
  MapPin,
  Plus,
  ReceiptText,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceRouter } from "@/components/workspace-path-provider";
import { formatDateOnly, toDateInputValue } from "@/lib/date-only";
import { cn } from "@/lib/utils";

import type {
  GetPaymentTargetDetailsAction,
  PaymentInvoiceOption,
  PaymentJobOption,
  PaymentTargetKind,
  PaymentTargetSearchResult,
  PreviousPaymentOption,
  SearchPaymentTargetsAction,
} from "../payment-target-types";

type PaymentMutationState = {
  message: string;
  paymentId?: string;
  success: boolean;
};

type RecordPaymentAction = (previousState: PaymentMutationState, formData: FormData) => Promise<PaymentMutationState>;

type PaymentKind = PaymentTargetKind;
type DialogStep = "choose" | "details" | "select" | "success";

type SuccessSummary = {
  amount: string;
  method: string;
  referenceNumber: string;
};

const initialPaymentState: PaymentMutationState = { message: "", success: false };

function money(value: string | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function targetTitle(kind: PaymentKind, invoice: PaymentInvoiceOption | null, job: PaymentJobOption | null) {
  if (kind === "invoice_payment") return invoice?.invoiceNumber ?? "Invoice payment";
  return job?.description ?? "Job deposit";
}

function paymentTypeLabel(paymentType: string) {
  return paymentType === "deposit" ? "Deposit" : "Invoice payment";
}

function PreviousPayments({
  paymentCount,
  payments,
  total,
}: {
  paymentCount: number;
  payments: PreviousPaymentOption[];
  total: string;
}) {
  const [open, setOpen] = React.useState(false);

  if (!paymentCount) {
    return <p className="mt-2 text-muted-foreground text-xs">No previous payments recorded.</p>;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>
            {paymentCount} previous {paymentCount === 1 ? "payment" : "payments"} · {money(total)} total
          </span>
          <span className="flex shrink-0 items-center gap-1 font-medium">
            {open ? "Hide" : "View"}
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 max-h-32 overflow-y-auto rounded-md border bg-background/70 px-2.5 py-1">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b py-1.5 text-[11px] leading-4 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-1.5">
                  <span className="font-medium">{paymentTypeLabel(payment.paymentType)}</span>
                  <span className="text-muted-foreground">{formatDateOnly(payment.paidOn)}</span>
                </div>
                <div className="truncate text-muted-foreground">
                  {payment.method}
                  {payment.referenceNumber ? ` · Ref ${payment.referenceNumber}` : ""}
                  {payment.status !== "succeeded" ? ` · ${payment.status}` : ""}
                </div>
              </div>
              <span className="font-semibold tabular-nums">{money(payment.amount)}</span>
            </div>
          ))}
          {paymentCount > payments.length ? (
            <p className="py-1.5 text-center text-[11px] text-muted-foreground">
              Showing the latest {payments.length} of {paymentCount} payments.
            </p>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function StepIndicator({ step }: { step: DialogStep }) {
  const active = step === "choose" ? 1 : step === "select" ? 2 : step === "details" ? 3 : 4;
  return (
    <div
      className="flex items-center gap-2"
      role="progressbar"
      aria-label="Payment recording progress"
      aria-valuemin={1}
      aria-valuemax={4}
      aria-valuenow={active}
    >
      {[1, 2, 3, 4].map((number) => (
        <span
          key={number}
          className={cn("h-1.5 flex-1 rounded-full bg-muted", number <= active && "bg-primary")}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function ChoiceStep({ onSelect }: { onSelect: (kind: PaymentKind) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <button
        type="button"
        className="group grid min-h-44 gap-4 rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => onSelect("invoice_payment")}
      >
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ReceiptText className="size-6" />
        </span>
        <span>
          <span className="block font-semibold text-lg">Invoice payment</span>
          <span className="mt-2 block text-muted-foreground text-sm leading-relaxed">
            Record money received toward an issued invoice with an outstanding balance.
          </span>
        </span>
        <span className="mt-auto flex items-center gap-2 font-medium text-primary text-sm">
          Select an invoice <span aria-hidden="true">→</span>
        </span>
      </button>

      <button
        type="button"
        className="group grid min-h-44 gap-4 rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => onSelect("deposit")}
      >
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BriefcaseBusiness className="size-6" />
        </span>
        <span>
          <span className="block font-semibold text-lg">Job deposit</span>
          <span className="mt-2 block text-muted-foreground text-sm leading-relaxed">
            Record money received before or during a job, including work that has not been invoiced yet.
          </span>
        </span>
        <span className="mt-auto flex items-center gap-2 font-medium text-primary text-sm">
          Select a job <span aria-hidden="true">→</span>
        </span>
      </button>
    </div>
  );
}

function JobSelectionCard({
  disabled = false,
  job,
  loading = false,
  onSelect,
  useInvoicePayment = false,
}: {
  disabled?: boolean;
  job: PaymentJobOption;
  loading?: boolean;
  onSelect: () => void;
  useInvoicePayment?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "relative grid gap-3 overflow-hidden rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
        disabled && !loading && "opacity-60",
      )}
      disabled={disabled}
      onClick={onSelect}
      aria-busy={loading}
    >
      <span className="min-w-0 pr-3">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{job.description}</span>
          <Badge variant="outline">{job.status}</Badge>
          {job.invoiceNumber ? <Badge variant="secondary">Invoice {job.invoiceNumber}</Badge> : null}
        </span>
        <span className="mt-1 block truncate text-muted-foreground text-sm">{job.customerName}</span>
        {job.serviceLocation ? (
          <span className="mt-1 flex min-w-0 items-center gap-1 text-muted-foreground text-xs">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{job.serviceLocation}</span>
          </span>
        ) : null}
      </span>
      <span className="text-left sm:text-right">
        {useInvoicePayment ? (
          <>
            <span className="block text-muted-foreground text-xs">Balance due</span>
            <span className="mt-1 block font-semibold tabular-nums">{money(job.invoiceBalanceDue)}</span>
            <span className="mt-1 block font-medium text-primary text-xs">Record invoice payment →</span>
          </>
        ) : (
          <>
            <span className="block text-muted-foreground text-xs">Deposits recorded</span>
            <span className="mt-1 block font-semibold tabular-nums">{money(job.depositPaid)}</span>
          </>
        )}
      </span>
      {loading ? (
        <span className="fade-in-0 absolute inset-0 flex animate-in items-center justify-center gap-2 bg-card/85 font-medium text-sm backdrop-blur-[1px] duration-200">
          <LoaderCircle className="size-4 animate-spin" />
          Opening…
        </span>
      ) : null}
    </button>
  );
}

function RecordSelectionStep({
  detailsAction,
  kind,
  onBack,
  onSelectInvoice,
  onSelectJob,
  searchAction,
}: {
  detailsAction: GetPaymentTargetDetailsAction;
  kind: PaymentKind;
  onBack: () => void;
  onSelectInvoice: (invoice: PaymentInvoiceOption) => void;
  onSelectJob: (job: PaymentJobOption) => void;
  searchAction: SearchPaymentTargetsAction;
}) {
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [result, setResult] = React.useState<PaymentTargetSearchResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const requestId = React.useRef(0);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setQuery(search.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  React.useEffect(() => {
    const activeRequest = ++requestId.current;
    setLoading(true);
    setError("");
    searchAction({ kind, page, query })
      .then((nextResult) => {
        if (activeRequest !== requestId.current) return;
        setResult(nextResult);
        if (!nextResult.success) setError(nextResult.message);
      })
      .catch(() => {
        if (activeRequest === requestId.current) setError("Records could not be loaded. Please try again.");
      })
      .finally(() => {
        if (activeRequest === requestId.current) setLoading(false);
      });
  }, [kind, page, query, searchAction]);

  const invoices = result?.invoices ?? [];
  const jobs = result?.jobs ?? [];
  const activeDepositJobs = jobs.filter((job) => !job.invoiceNumber && job.status !== "Completed");
  const completedDepositJobs = jobs.filter((job) => !job.invoiceNumber && job.status === "Completed");
  const invoicedJobs = jobs.filter((job) => job.invoiceNumber);
  const records = kind === "invoice_payment" ? invoices : jobs;

  async function selectInvoice(invoiceId: string) {
    setLoadingId(invoiceId);
    setError("");
    try {
      const details = await detailsAction({ id: invoiceId, kind: "invoice_payment" });
      if (!details.success || !details.invoice) {
        setError(details.message || "That invoice could not be loaded.");
        return;
      }
      onSelectInvoice(details.invoice);
    } catch {
      setError("That invoice could not be loaded. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  async function selectJob(job: PaymentJobOption) {
    const targetId = job.invoiceId ?? job.id;
    const targetKind = job.invoiceId ? "invoice_payment" : "deposit";
    setLoadingId(job.id);
    setError("");
    try {
      const details = await detailsAction({ id: targetId, kind: targetKind });
      if (targetKind === "invoice_payment" && details.success && details.invoice) {
        onSelectInvoice(details.invoice);
        return;
      }
      if (targetKind === "deposit" && details.success && details.job) {
        onSelectJob(details.job);
        return;
      }
      setError(details.message || "That job could not be loaded.");
    } catch {
      setError("That job could not be loaded. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4 sm:h-auto">
      <div className="grid min-w-0 gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" size="icon-sm" variant="ghost" onClick={onBack} aria-label="Back to payment type">
            <ArrowLeft />
          </Button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-0 pl-8"
              placeholder={
                kind === "invoice_payment"
                  ? "Search invoices, customers, or jobs..."
                  : "Search jobs, customers, or locations..."
              }
              aria-label={kind === "invoice_payment" ? "Search invoices" : "Search jobs"}
            />
          </div>
        </div>

        {error ? (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm"
            role="alert"
          >
            {error}
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "relative grid min-h-0 min-w-0 flex-1 auto-rows-max content-start gap-2 overflow-y-auto overflow-x-hidden overscroll-y-contain overscroll-x-none pr-1 [touch-action:pan-y] sm:max-h-[min(31rem,calc(100svh-17rem))] sm:min-h-36",
          loading && "opacity-60",
        )}
      >
        {loading && !result ? (
          <div className="grid place-items-center py-12 text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" />
            <span className="mt-2 text-sm">Loading {kind === "invoice_payment" ? "invoices" : "jobs"}…</span>
          </div>
        ) : records.length ? (
          kind === "invoice_payment" ? (
            invoices.map((invoice) => (
              <button
                key={invoice.id}
                type="button"
                className={cn(
                  "relative grid gap-3 overflow-hidden rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
                  loadingId && loadingId !== invoice.id && "opacity-60",
                )}
                disabled={Boolean(loadingId)}
                onClick={() => selectInvoice(invoice.id)}
                aria-busy={loadingId === invoice.id}
              >
                <span className="min-w-0 pr-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{invoice.invoiceNumber}</span>
                    <Badge variant="outline">Due {formatDateOnly(invoice.dueAt)}</Badge>
                  </span>
                  <span className="mt-1 block truncate text-muted-foreground text-sm">{invoice.customerName}</span>
                  <span className="mt-1 block truncate text-muted-foreground text-xs">{invoice.jobTitle}</span>
                </span>
                <span className="text-left sm:text-right">
                  <span className="block text-muted-foreground text-xs">Balance due</span>
                  <span className="mt-1 block font-semibold tabular-nums">{money(invoice.balanceDue)}</span>
                </span>
                {loadingId === invoice.id ? (
                  <span className="fade-in-0 absolute inset-0 flex animate-in items-center justify-center gap-2 bg-card/85 font-medium text-sm backdrop-blur-[1px] duration-200">
                    <LoaderCircle className="size-4 animate-spin" />
                    Opening…
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <>
              {activeDepositJobs.length ? (
                <section className="grid gap-2">
                  <div className="px-1">
                    <h3 className="font-medium text-sm">Active jobs</h3>
                    <p className="text-muted-foreground text-xs">
                      Jobs without an invoice, ready to receive a deposit.
                    </p>
                  </div>
                  {activeDepositJobs.map((job) => (
                    <JobSelectionCard
                      disabled={Boolean(loadingId)}
                      key={job.id}
                      job={job}
                      loading={loadingId === job.id}
                      onSelect={() => selectJob(job)}
                    />
                  ))}
                </section>
              ) : null}
              {completedDepositJobs.length ? (
                <section className="mt-2 grid gap-2 border-t pt-3">
                  <div className="px-1">
                    <h3 className="font-medium text-sm">Completed, not invoiced</h3>
                    <p className="text-muted-foreground text-xs">Completed jobs that still have an unpaid balance.</p>
                  </div>
                  {completedDepositJobs.map((job) => (
                    <JobSelectionCard
                      disabled={Boolean(loadingId)}
                      key={job.id}
                      job={job}
                      loading={loadingId === job.id}
                      onSelect={() => selectJob(job)}
                    />
                  ))}
                </section>
              ) : null}
              {invoicedJobs.length ? (
                <section className="mt-2 grid gap-2 border-t pt-3">
                  <div className="px-1">
                    <h3 className="font-medium text-sm">Already invoiced</h3>
                    <p className="text-muted-foreground text-xs">
                      These payments should normally be applied to the invoice instead of recorded as deposits.
                    </p>
                  </div>
                  {invoicedJobs.map((job) => (
                    <JobSelectionCard
                      key={job.id}
                      job={job}
                      disabled={Boolean(loadingId)}
                      loading={loadingId === job.id}
                      onSelect={() => selectJob(job)}
                      useInvoicePayment
                    />
                  ))}
                </section>
              ) : null}
            </>
          )
        ) : (
          <div className="rounded-lg border bg-muted/20 px-4 py-10 text-center text-muted-foreground text-sm">
            {query
              ? `No ${kind === "invoice_payment" ? "invoices" : "jobs"} match your search.`
              : kind === "invoice_payment"
                ? "No invoices currently have an outstanding balance."
                : "No active jobs are available for a deposit."}
          </div>
        )}
      </div>

      {result && result.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <p className="text-muted-foreground text-xs">
            Page {result.page} of {result.totalPages} · {result.total}{" "}
            {kind === "invoice_payment" ? "invoices" : "jobs"}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              disabled={loading || result.page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Previous results page"
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              disabled={loading || result.page >= result.totalPages}
              onClick={() => setPage((current) => current + 1)}
              aria-label="Next results page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PaymentDetailsStep({
  action,
  invoice,
  job,
  kind,
  onBack,
  onSuccess,
}: {
  action: RecordPaymentAction;
  invoice: PaymentInvoiceOption | null;
  job: PaymentJobOption | null;
  kind: PaymentKind;
  onBack: () => void;
  onSuccess: (summary: SuccessSummary) => void;
}) {
  const [state, formAction, isPending] = React.useActionState(action, initialPaymentState);
  const [amount, setAmount] = React.useState(kind === "invoice_payment" ? (invoice?.balanceDue ?? "") : "");
  const [method, setMethod] = React.useState("");
  const [referenceNumber, setReferenceNumber] = React.useState("");
  const [idempotencyKey, setIdempotencyKey] = React.useState("");
  const handledPaymentId = React.useRef<string | undefined>(undefined);
  const balanceDue = Number(invoice?.balanceDue ?? 0);
  const enteredAmount = Number(amount || 0);
  const amountTooHigh = kind === "invoice_payment" && enteredAmount > balanceDue;
  const selectedJobId = kind === "invoice_payment" ? invoice?.jobId : job?.id;

  React.useEffect(() => {
    setIdempotencyKey(globalThis.crypto.randomUUID());
  }, []);

  React.useEffect(() => {
    if (!state.success || !state.paymentId || handledPaymentId.current === state.paymentId) return;
    handledPaymentId.current = state.paymentId;
    onSuccess({ amount, method, referenceNumber });
  }, [amount, method, onSuccess, referenceNumber, state.paymentId, state.success]);

  return (
    <form action={formAction} className="grid min-w-0 max-w-full gap-5 overflow-x-hidden">
      <input type="hidden" name="jobId" value={selectedJobId ?? ""} />
      <input type="hidden" name="paymentType" value={kind} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="flex min-w-0 max-w-full items-start gap-3 rounded-xl border bg-muted/25 p-4">
        <Button type="button" size="icon-sm" variant="ghost" onClick={onBack} aria-label="Choose another record">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{targetTitle(kind, invoice, job)}</span>
            <Badge variant="outline">{kind === "invoice_payment" ? "Invoice payment" : "Job deposit"}</Badge>
          </div>
          <div className="mt-1 truncate text-muted-foreground text-sm">
            {kind === "invoice_payment" ? invoice?.customerName : job?.customerName}
          </div>
          {kind === "invoice_payment" ? (
            <>
              <div className="mt-2 text-sm">
                Balance due: <span className="font-medium tabular-nums">{money(invoice?.balanceDue)}</span>
              </div>
              <PreviousPayments
                paymentCount={invoice?.paymentCount ?? 0}
                payments={invoice?.payments ?? []}
                total={invoice?.amountPaid ?? "0"}
              />
            </>
          ) : job?.invoiceNumber ? (
            <>
              <div className="mt-2 rounded-md bg-amber-500/10 px-2.5 py-2 text-amber-700 text-xs dark:text-amber-300">
                This job already has invoice {job.invoiceNumber}. Use an invoice payment unless this money should remain
                classified as a deposit.
              </div>
              <PreviousPayments paymentCount={job.paymentCount} payments={job.payments} total={job.amountPaid} />
            </>
          ) : job ? (
            <PreviousPayments paymentCount={job.paymentCount} payments={job.payments} total={job.amountPaid} />
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="payment-dialog-date">Payment date</Label>
          <Input id="payment-dialog-date" name="paidOn" type="date" defaultValue={toDateInputValue()} required />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="payment-dialog-amount">Amount</Label>
          <Input
            id="payment-dialog-amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            aria-invalid={amountTooHigh}
            required
          />
          {amountTooHigh ? (
            <p className="text-destructive text-xs">
              Amount exceeds the invoice balance by {money(String(enteredAmount - balanceDue))}.
            </p>
          ) : null}
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="payment-dialog-method">Method</Label>
          <Input
            id="payment-dialog-method"
            name="method"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            placeholder="Check, cash, Zelle, ACH"
            required
          />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="payment-dialog-reference">Check / reference number</Label>
          <Input
            id="payment-dialog-reference"
            name="referenceNumber"
            value={referenceNumber}
            onChange={(event) => setReferenceNumber(event.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="grid min-w-0 gap-2 sm:col-span-2">
          <Label htmlFor="payment-dialog-description">Description</Label>
          <Input
            id="payment-dialog-description"
            name="description"
            defaultValue={kind === "invoice_payment" ? "Invoice payment" : "Deposit"}
            placeholder={kind === "invoice_payment" ? "Final payment" : "Deposit"}
            required
          />
        </div>
        <div className="grid min-w-0 gap-2 sm:col-span-2">
          <Label htmlFor="payment-dialog-notes">Notes</Label>
          <Textarea id="payment-dialog-notes" name="notes" placeholder="Optional internal notes" />
        </div>
      </div>

      {state.message && !state.success ? (
        <p className="text-destructive text-sm" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          Change {kind === "invoice_payment" ? "invoice" : "job"}
        </Button>
        <Button type="submit" disabled={isPending || !idempotencyKey || amountTooHigh || !amount || !method.trim()}>
          <CircleDollarSign />
          {isPending ? "Recording..." : kind === "invoice_payment" ? "Record payment" : "Record deposit"}
        </Button>
      </div>
    </form>
  );
}

function SuccessStep({
  invoice,
  job,
  kind,
  onClose,
  onRecordAnother,
  summary,
}: {
  invoice: PaymentInvoiceOption | null;
  job: PaymentJobOption | null;
  kind: PaymentKind;
  onClose: () => void;
  onRecordAnother: () => void;
  summary: SuccessSummary;
}) {
  return (
    <div className="grid justify-items-center gap-5 py-4 text-center sm:py-8">
      <span className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-9" />
      </span>
      <div>
        <h3 className="font-semibold text-xl">
          {kind === "invoice_payment" ? "Payment recorded" : "Deposit recorded"}
        </h3>
        <p className="mt-2 text-muted-foreground text-sm">The payment ledger and related balance have been updated.</p>
      </div>
      <div className="w-full max-w-md overflow-hidden rounded-xl border text-left">
        <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-semibold tabular-nums">{money(summary.amount)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
          <span className="text-muted-foreground">Applied to</span>
          <span className="truncate font-medium">{targetTitle(kind, invoice, job)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
          <span className="text-muted-foreground">Method</span>
          <span className="font-medium">{summary.method}</span>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="text-muted-foreground">Reference</span>
          <span className="font-medium">{summary.referenceNumber || "Not provided"}</span>
        </div>
      </div>
      <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
        <Button type="button" variant="outline" onClick={onRecordAnother}>
          <Plus />
          Record another
        </Button>
        <Button type="button" onClick={onClose}>
          <Check />
          Done
        </Button>
      </div>
    </div>
  );
}

export function RecordPaymentDialog({
  action,
  detailsAction,
  searchAction,
}: {
  action: RecordPaymentAction;
  detailsAction: GetPaymentTargetDetailsAction;
  searchAction: SearchPaymentTargetsAction;
}) {
  const router = useWorkspaceRouter();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<DialogStep>("choose");
  const [kind, setKind] = React.useState<PaymentKind>("invoice_payment");
  const [detailsBackKind, setDetailsBackKind] = React.useState<PaymentKind>("invoice_payment");
  const [selectedInvoice, setSelectedInvoice] = React.useState<PaymentInvoiceOption | null>(null);
  const [selectedJob, setSelectedJob] = React.useState<PaymentJobOption | null>(null);
  const [successSummary, setSuccessSummary] = React.useState<SuccessSummary | null>(null);

  const reset = React.useCallback(() => {
    setStep("choose");
    setKind("invoice_payment");
    setDetailsBackKind("invoice_payment");
    setSelectedInvoice(null);
    setSelectedJob(null);
    setSuccessSummary(null);
  }, []);

  const close = React.useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  const handleSuccess = React.useCallback(
    (summary: SuccessSummary) => {
      setSuccessSummary(summary);
      setStep("success");
      router.refresh();
    },
    [router],
  );

  const title =
    step === "choose"
      ? "Record a payment"
      : step === "select"
        ? kind === "invoice_payment"
          ? "Select an invoice"
          : "Select a job"
        : step === "details"
          ? kind === "invoice_payment"
            ? "Invoice payment details"
            : "Job deposit details"
          : "Payment confirmed";

  const description =
    step === "choose"
      ? "Choose how the payment should be applied."
      : step === "select"
        ? kind === "invoice_payment"
          ? "Choose an invoice with an outstanding balance."
          : "Choose the job that received the deposit."
        : step === "details"
          ? "Enter the details exactly as the payment was received."
          : "The transaction was saved successfully.";

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus />
        Record payment
      </Button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) reset();
        }}
      >
        <DialogContent className="top-0 left-0 grid h-svh max-h-svh w-full max-w-full translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-6">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
            <StepIndicator step={step} />
          </DialogHeader>
          <div className="min-h-0 min-w-0 max-w-full overflow-y-auto overflow-x-hidden overscroll-y-contain overscroll-x-none px-4 py-5 [touch-action:pan-y] sm:px-6">
            {step === "choose" ? (
              <ChoiceStep
                onSelect={(selectedKind) => {
                  setKind(selectedKind);
                  setDetailsBackKind(selectedKind);
                  setSelectedInvoice(null);
                  setSelectedJob(null);
                  setStep("select");
                }}
              />
            ) : null}
            {step === "select" ? (
              <RecordSelectionStep
                detailsAction={detailsAction}
                kind={kind}
                onBack={() => setStep("choose")}
                onSelectInvoice={(invoice) => {
                  setDetailsBackKind(kind);
                  setKind("invoice_payment");
                  setSelectedInvoice(invoice);
                  setSelectedJob(null);
                  setStep("details");
                }}
                onSelectJob={(job) => {
                  setDetailsBackKind("deposit");
                  setKind("deposit");
                  setSelectedInvoice(null);
                  setSelectedJob(job);
                  setStep("details");
                }}
                searchAction={searchAction}
              />
            ) : null}
            {step === "details" ? (
              <PaymentDetailsStep
                key={`${kind}-${selectedInvoice?.id ?? selectedJob?.id ?? "none"}`}
                action={action}
                invoice={selectedInvoice}
                job={selectedJob}
                kind={kind}
                onBack={() => {
                  setKind(detailsBackKind);
                  setSelectedInvoice(null);
                  setSelectedJob(null);
                  setStep("select");
                }}
                onSuccess={handleSuccess}
              />
            ) : null}
            {step === "success" && successSummary ? (
              <SuccessStep
                invoice={selectedInvoice}
                job={selectedJob}
                kind={kind}
                onClose={close}
                onRecordAnother={() => {
                  setSelectedInvoice(null);
                  setSelectedJob(null);
                  setSuccessSummary(null);
                  setStep("select");
                }}
                summary={successSummary}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
