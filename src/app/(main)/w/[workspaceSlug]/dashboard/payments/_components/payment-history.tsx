"use client";

import * as React from "react";

import { useSearchParams } from "next/navigation";

import { format } from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  CreditCard,
  FileText,
  Hash,
  Landmark,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";

import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWorkspaceRouter, WorkspaceLink } from "@/components/workspace-path-provider";
import { formatDateOnly } from "@/lib/date-only";
import { formatPaymentReference, getPaymentDisplayReference } from "@/lib/payments/presentation";
import { cn } from "@/lib/utils";

type PaymentAuditItem = {
  action: string;
  actorEmail?: string;
  actorName?: string;
  createdAt: string;
  id: string;
};

type PaymentRefundItem = {
  amount: string;
  id: string;
  reason?: string;
  refundedAt?: string;
  status: string;
};

type PaymentDisputeItem = {
  amount: string;
  externalDisputeId: string;
  id: string;
  openedAt: string;
  reason?: string;
  status: string;
};

export type PaymentHistorySort =
  | "amount-asc"
  | "amount-desc"
  | "customer-asc"
  | "customer-desc"
  | "date-asc"
  | "date-desc"
  | "method-asc"
  | "method-desc"
  | "provider-asc"
  | "provider-desc"
  | "reference-asc"
  | "reference-desc"
  | "status-asc"
  | "status-desc";

export type PaymentHistoryItem = {
  amount: string;
  applicationFeeAmount: string;
  audits: PaymentAuditItem[];
  createdAt: string;
  currency: string;
  customerName: string;
  description: string;
  disputes: PaymentDisputeItem[];
  externalPaymentId?: string;
  failureCode?: string;
  failureMessage?: string;
  feeAmount?: string;
  id: string;
  invoiceId?: string;
  invoiceNumber?: string;
  jobDescription: string;
  jobId: string;
  method: string;
  methodType?: string;
  notes?: string;
  paidOn: string;
  paymentType: string;
  provider: string;
  referenceNumber?: string;
  refundedAmount: string;
  refunds: PaymentRefundItem[];
  status: string;
  updatedAt: string;
};

function money(value: string | undefined, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function statusVariant(status: string) {
  if (status === "succeeded" || status === "active") return "default" as const;
  if (status === "failed" || status === "disputed") return "destructive" as const;
  return "outline" as const;
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatPaymentType(type: string) {
  return type === "deposit" ? "Deposit" : "Invoice payment";
}

function formatDateTime(value: string) {
  return format(new Date(value), "MMM d, yyyy 'at' h:mm a");
}

function recordedBy(payment: PaymentHistoryItem) {
  const creation = payment.audits.find((audit) => audit.action === "job.payment.create");
  if (creation?.actorName) return creation.actorName;
  if (creation?.actorEmail) return creation.actorEmail;
  if (payment.provider !== "manual") return "Customer via online checkout";
  return "Not available";
}

function recordedByDetail(payment: PaymentHistoryItem) {
  const creation = payment.audits.find((audit) => audit.action === "job.payment.create");
  if (creation?.actorName && creation.actorEmail) return creation.actorEmail;
  if (payment.provider !== "manual") return `${payment.provider} payment provider`;
  return "No creation audit is available for this payment.";
}

function auditLabel(action: string) {
  if (action === "job.payment.create") return "Payment recorded";
  if (action === "job.payment.update") return "Payment details updated";
  if (action === "payment.attempt.create") return "Online payment initiated";
  if (action === "payment.provider_event.apply") return "Provider status updated";
  return formatStatus(action.replaceAll(".", " "));
}

function DetailItem({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border bg-background/60 p-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className={cn("mt-1 min-w-0 break-words font-medium", valueClassName)}>{value}</div>
      </div>
    </div>
  );
}

function PaymentDetails({ payment }: { payment: PaymentHistoryItem }) {
  const grossAmount = Number(payment.amount);
  const refundedAmount = Number(payment.refundedAmount);
  const providerFee = Number(payment.feeAmount ?? 0);
  const applicationFee = Number(payment.applicationFeeAmount);
  const recordedNet = grossAmount - refundedAmount - providerFee - applicationFee;
  const displayReference = getPaymentDisplayReference(payment);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 rounded-xl border bg-muted/25 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(payment.status)} className="capitalize">
              {formatStatus(payment.status)}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {payment.provider}
            </Badge>
            <Badge variant="outline">{formatPaymentType(payment.paymentType)}</Badge>
          </div>
          <div className="mt-3 text-muted-foreground text-sm">{payment.customerName}</div>
          <div className="mt-1 font-medium text-base">{payment.description}</div>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-muted-foreground text-xs">Gross payment</div>
          <div className="mt-1 font-semibold text-2xl tabular-nums">{money(payment.amount, payment.currency)}</div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-medium">Payment information</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem icon={CalendarDays} label="Payment date" value={formatDateOnly(payment.paidOn)} />
          <DetailItem
            icon={CreditCard}
            label="Method"
            value={[payment.method, payment.methodType].filter(Boolean).join(" · ")}
          />
          <DetailItem
            icon={Hash}
            label="Reference number"
            value={formatPaymentReference(displayReference) ?? "Not provided"}
          />
          <DetailItem
            icon={Landmark}
            label="Source"
            value={payment.provider === "manual" ? "Manual entry" : `${payment.provider} checkout`}
            valueClassName="capitalize"
          />
          <DetailItem icon={ReceiptText} label="Payment type" value={formatPaymentType(payment.paymentType)} />
          <DetailItem
            icon={UserRound}
            label="Recorded by"
            value={
              <>
                <div>{recordedBy(payment)}</div>
                <div className="mt-0.5 font-normal text-muted-foreground text-xs">{recordedByDetail(payment)}</div>
              </>
            }
          />
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-medium">Related records</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem
            icon={FileText}
            label="Invoice"
            value={
              payment.invoiceId ? (
                <WorkspaceLink
                  className="underline underline-offset-4"
                  href={`/dashboard/invoices/${payment.invoiceId}`}
                >
                  {payment.invoiceNumber ?? "Open invoice"}
                </WorkspaceLink>
              ) : (
                "No invoice linked"
              )
            }
          />
          <DetailItem
            icon={CircleDollarSign}
            label="Job"
            value={
              <WorkspaceLink className="underline underline-offset-4" href={`/dashboard/jobs/${payment.jobId}`}>
                {payment.jobDescription}
              </WorkspaceLink>
            }
          />
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-medium">Financial breakdown</h3>
        <div className="overflow-hidden rounded-lg border">
          <dl className="divide-y">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">Gross amount</dt>
              <dd className="font-medium tabular-nums">{money(payment.amount, payment.currency)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">Refunded</dt>
              <dd className="font-medium tabular-nums">{money(payment.refundedAmount, payment.currency)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">Provider fee</dt>
              <dd className="font-medium tabular-nums">
                {payment.feeAmount ? money(payment.feeAmount, payment.currency) : "Not recorded"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">Application fee</dt>
              <dd className="font-medium tabular-nums">{money(payment.applicationFeeAmount, payment.currency)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 bg-muted/35 px-4 py-3">
              <dt className="font-medium">Net after recorded refunds and fees</dt>
              <dd className="font-semibold tabular-nums">{money(String(recordedNet), payment.currency)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {payment.notes || payment.failureMessage ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {payment.notes ? <DetailItem icon={ReceiptText} label="Notes" value={payment.notes} /> : null}
          {payment.failureMessage ? (
            <DetailItem
              icon={ShieldAlert}
              label={payment.failureCode ? `Failure · ${payment.failureCode}` : "Failure"}
              value={payment.failureMessage}
              valueClassName="text-destructive"
            />
          ) : null}
        </section>
      ) : null}

      {payment.externalPaymentId ? (
        <section>
          <h3 className="mb-3 font-medium">Provider record</h3>
          <DetailItem
            icon={Hash}
            label="External payment ID"
            value={payment.externalPaymentId}
            valueClassName="break-all font-mono text-xs"
          />
        </section>
      ) : null}

      {payment.refunds.length ? (
        <section>
          <h3 className="mb-3 font-medium">Refund activity</h3>
          <div className="grid gap-2">
            {payment.refunds.map((refund) => (
              <div key={refund.id} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <RefreshCcw className="size-4" />
                    Customer refund
                  </div>
                  <div className="mt-1 text-muted-foreground text-xs">
                    {refund.refundedAt ? formatDateTime(refund.refundedAt) : "Refund date pending"}
                    {refund.reason ? ` · ${refund.reason}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium tabular-nums">{money(refund.amount, payment.currency)}</div>
                  <div className="mt-1 text-muted-foreground text-xs capitalize">{formatStatus(refund.status)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {payment.disputes.length ? (
        <section>
          <h3 className="mb-3 font-medium">Disputes</h3>
          <div className="grid gap-2">
            {payment.disputes.map((dispute) => (
              <div
                key={dispute.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
              >
                <div>
                  <div className="font-medium">{dispute.externalDisputeId}</div>
                  <div className="mt-1 text-muted-foreground text-xs">
                    Opened {formatDateTime(dispute.openedAt)}
                    {dispute.reason ? ` · ${dispute.reason}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium tabular-nums">{money(dispute.amount, payment.currency)}</div>
                  <div className="mt-1 text-destructive text-xs capitalize">{formatStatus(dispute.status)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-3 font-medium">Record history</h3>
        <div className="grid gap-2">
          {payment.audits.length ? (
            payment.audits.map((audit) => (
              <div key={audit.id} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div>
                  <div className="font-medium">{auditLabel(audit.action)}</div>
                  <div className="mt-1 text-muted-foreground text-xs">
                    {audit.actorName ??
                      audit.actorEmail ??
                      (payment.provider === "manual" ? "System record" : payment.provider)}
                  </div>
                </div>
                <time className="shrink-0 text-right text-muted-foreground text-xs" dateTime={audit.createdAt}>
                  {formatDateTime(audit.createdAt)}
                </time>
              </div>
            ))
          ) : (
            <div className="rounded-lg border bg-muted/20 p-3 text-muted-foreground text-sm">
              No audit events are available for this payment.
            </div>
          )}
        </div>
        <div className="mt-3 text-muted-foreground text-xs">
          Created {formatDateTime(payment.createdAt)} · Last updated {formatDateTime(payment.updatedAt)}
        </div>
      </section>
    </div>
  );
}

export function PaymentHistory({
  filteredCount,
  initialProvider,
  initialQuery,
  initialSort,
  initialStatus,
  initialType,
  page,
  pageSize,
  payments,
  totalCount,
  totalPages,
}: {
  filteredCount: number;
  initialProvider: string;
  initialQuery: string;
  initialSort: PaymentHistorySort;
  initialStatus: string;
  initialType: string;
  page: number;
  pageSize: number;
  payments: PaymentHistoryItem[];
  totalCount: number;
  totalPages: number;
}) {
  const router = useWorkspaceRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(initialQuery);
  const [selectedPayment, setSelectedPayment] = React.useState<PaymentHistoryItem | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => setQuery(initialQuery), [initialQuery]);

  const updateParams = React.useCallback(
    (updates: {
      page?: number;
      pageSize?: number;
      provider?: string;
      query?: string;
      sort?: PaymentHistorySort;
      status?: string;
      type?: string;
    }) => {
      const params = new URLSearchParams(searchParams.toString());
      const nextQuery = updates.query ?? initialQuery;
      const nextProvider = updates.provider ?? initialProvider;
      const nextStatus = updates.status ?? initialStatus;
      const nextType = updates.type ?? initialType;
      const nextSort = updates.sort ?? initialSort;
      const nextPageSize = updates.pageSize ?? pageSize;
      const nextPage = updates.page ?? 1;

      if (nextQuery) params.set("q", nextQuery);
      else params.delete("q");
      if (nextProvider === "all") params.delete("provider");
      else params.set("provider", nextProvider);
      if (nextStatus === "all") params.delete("status");
      else params.set("status", nextStatus);
      if (nextType === "all") params.delete("type");
      else params.set("type", nextType);
      if (nextSort === "date-desc") params.delete("sort");
      else params.set("sort", nextSort);
      if (nextPageSize === 20) params.delete("pageSize");
      else params.set("pageSize", String(nextPageSize));
      if (nextPage > 1) params.set("page", String(nextPage));
      else params.delete("page");

      const suffix = params.toString();
      startTransition(() => router.replace(`/dashboard/payments${suffix ? `?${suffix}` : ""}`, { scroll: false }));
    },
    [initialProvider, initialQuery, initialSort, initialStatus, initialType, pageSize, router, searchParams],
  );

  function sortDirection(ascending: PaymentHistorySort, descending: PaymentHistorySort): TableSortDirection {
    if (initialSort === ascending) return "asc";
    if (initialSort === descending) return "desc";
    return false;
  }

  const firstResult = filteredCount ? (page - 1) * pageSize + 1 : 0;
  const lastResult = Math.min(page * pageSize, filteredCount);
  const hasFilters = Boolean(
    initialQuery || initialProvider !== "all" || initialStatus !== "all" || initialType !== "all",
  );

  return (
    <>
      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_repeat(3,minmax(9rem,0.42fr))]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            updateParams({ query: query.trim() });
          }}
        >
          <Label htmlFor="payment-history-search" className="sr-only">
            Search payments
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="payment-history-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customer, invoice, job, or reference"
              className="pr-8 pl-8"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear payment search"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  setQuery("");
                  updateParams({ query: "" });
                }}
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <button type="submit" className="sr-only" disabled={isPending || query.trim() === initialQuery}>
            Search payments
          </button>
        </form>

        <div>
          <Label htmlFor="payment-history-type" className="sr-only">
            Payment type
          </Label>
          <Select value={initialType} disabled={isPending} onValueChange={(value) => updateParams({ type: value })}>
            <SelectTrigger id="payment-history-type" className="w-full">
              <SelectValue placeholder="Payment type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payment types</SelectItem>
              <SelectItem value="invoice_payment">Invoice payments</SelectItem>
              <SelectItem value="deposit">Deposits</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="payment-history-status" className="sr-only">
            Payment status
          </Label>
          <Select value={initialStatus} disabled={isPending} onValueChange={(value) => updateParams({ status: value })}>
            <SelectTrigger id="payment-history-status" className="w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="succeeded">Succeeded</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="payment-history-provider" className="sr-only">
            Payment source
          </Label>
          <Select
            value={initialProvider}
            disabled={isPending}
            onValueChange={(value) => updateParams({ provider: value })}
          >
            <SelectTrigger id="payment-history-provider" className="w-full">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={cn("transition-opacity", isPending && "opacity-60")}>
        <div className="grid gap-3 md:hidden">
          {payments.length ? (
            payments.map((payment) => (
              <button
                key={payment.id}
                type="button"
                className="grid min-w-0 gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:grid-cols-[minmax(0,1.25fr)_minmax(13rem,0.75fr)] landscape:grid-cols-[minmax(0,1.25fr)_minmax(13rem,0.75fr)] landscape:gap-x-5"
                onClick={() => setSelectedPayment(payment)}
                aria-label={`View ${money(payment.amount, payment.currency)} payment from ${payment.customerName}`}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{payment.customerName}</div>
                    <div className="mt-0.5 truncate text-muted-foreground text-xs">
                      {payment.invoiceNumber ?? payment.jobDescription}
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-semibold tabular-nums">
                    {money(payment.amount, payment.currency)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:row-span-2 landscape:row-span-2">
                  <div>
                    <div className="text-muted-foreground text-xs">Date</div>
                    <div className="mt-1">{formatDateOnly(payment.paidOn)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Source</div>
                    <div className="mt-1 capitalize">{payment.provider}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Method</div>
                    <div className="mt-1 truncate">
                      {[payment.method, payment.methodType].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Reference</div>
                    <div className="mt-1 truncate">
                      {formatPaymentReference(getPaymentDisplayReference(payment)) ?? "—"}
                    </div>
                  </div>
                </div>
                <div className="flex min-w-0 items-center justify-between gap-3 border-t pt-3 sm:col-start-1 landscape:col-start-1">
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <Badge variant={statusVariant(payment.status)} className="capitalize">
                      {formatStatus(payment.status)}
                    </Badge>
                    {Number(payment.refundedAmount) > 0 ? (
                      <Badge variant="outline">Refunded {money(payment.refundedAmount, payment.currency)}</Badge>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-muted-foreground text-xs">View details</span>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-lg border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
              {hasFilters ? "No payments match the selected filters." : "No payments recorded yet."}
            </div>
          )}
        </div>

        <div className="hidden overflow-hidden rounded-lg border md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>
                  <SortableTableHeader
                    direction={sortDirection("date-asc", "date-desc")}
                    label="Date"
                    onSort={() => updateParams({ sort: initialSort === "date-asc" ? "date-desc" : "date-asc" })}
                  />
                </TableHead>
                <TableHead>
                  <SortableTableHeader
                    direction={sortDirection("customer-asc", "customer-desc")}
                    label="Customer / invoice"
                    onSort={() =>
                      updateParams({ sort: initialSort === "customer-asc" ? "customer-desc" : "customer-asc" })
                    }
                  />
                </TableHead>
                <TableHead>
                  <SortableTableHeader
                    direction={sortDirection("provider-asc", "provider-desc")}
                    label="Provider"
                    onSort={() =>
                      updateParams({ sort: initialSort === "provider-asc" ? "provider-desc" : "provider-asc" })
                    }
                  />
                </TableHead>
                <TableHead>
                  <SortableTableHeader
                    direction={sortDirection("method-asc", "method-desc")}
                    label="Method"
                    onSort={() => updateParams({ sort: initialSort === "method-asc" ? "method-desc" : "method-asc" })}
                  />
                </TableHead>
                <TableHead>
                  <SortableTableHeader
                    direction={sortDirection("reference-asc", "reference-desc")}
                    label="Reference"
                    onSort={() =>
                      updateParams({ sort: initialSort === "reference-asc" ? "reference-desc" : "reference-asc" })
                    }
                  />
                </TableHead>
                <TableHead>
                  <SortableTableHeader
                    direction={sortDirection("status-asc", "status-desc")}
                    label="Status"
                    onSort={() => updateParams({ sort: initialSort === "status-asc" ? "status-desc" : "status-asc" })}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortableTableHeader
                    align="right"
                    direction={sortDirection("amount-asc", "amount-desc")}
                    label="Amount"
                    onSort={() => updateParams({ sort: initialSort === "amount-asc" ? "amount-desc" : "amount-asc" })}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length ? (
                payments.map((payment) => (
                  <TableRow
                    key={payment.id}
                    className="cursor-pointer hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      if (event.target instanceof HTMLElement && event.target.closest("a, button")) return;
                      setSelectedPayment(payment);
                    }}
                    onKeyDown={(event) => {
                      if (event.target instanceof HTMLElement && event.target.closest("a, button")) return;
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setSelectedPayment(payment);
                    }}
                  >
                    <TableCell>{formatDateOnly(payment.paidOn)}</TableCell>
                    <TableCell>
                      <div>{payment.customerName}</div>
                      <div className="text-muted-foreground text-xs">
                        {payment.invoiceId ? (
                          <WorkspaceLink
                            href={`/dashboard/invoices/${payment.invoiceId}`}
                            className="underline decoration-muted-foreground/50 underline-offset-4 hover:text-foreground"
                          >
                            {payment.invoiceNumber ?? "View invoice"}
                          </WorkspaceLink>
                        ) : (
                          "No invoice"
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{payment.provider}</TableCell>
                    <TableCell className="capitalize">
                      {[payment.method, payment.methodType].filter(Boolean).join(" · ")}
                    </TableCell>
                    <TableCell className="max-w-40 truncate" title={getPaymentDisplayReference(payment) ?? undefined}>
                      {formatPaymentReference(getPaymentDisplayReference(payment)) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(payment.status)} className="capitalize">
                        {formatStatus(payment.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money(payment.amount, payment.currency)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {hasFilters ? "No payments match the selected filters." : "No payments recorded yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {filteredCount ? (
          <div className="mt-4 flex flex-col gap-3 border-t px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="hidden flex-1 text-muted-foreground text-sm lg:block">
              Showing{" "}
              <span className="font-medium text-foreground tabular-nums">
                {firstResult}–{lastResult}
              </span>{" "}
              of <span className="font-medium text-foreground tabular-nums">{filteredCount}</span> payments
              {hasFilters ? <span> · {totalCount} total</span> : null}
            </p>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-8 lg:w-fit">
              <div className="hidden items-center gap-2 lg:flex">
                <Label htmlFor="payment-history-rows-per-page" className="font-medium text-sm">
                  Rows per page
                </Label>
                <Select
                  value={String(pageSize)}
                  disabled={isPending}
                  onValueChange={(value) => updateParams({ pageSize: Number(value) })}
                >
                  <SelectTrigger id="payment-history-rows-per-page" size="sm" className="w-20">
                    <SelectValue placeholder={pageSize} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    <SelectGroup>
                      {[20, 30, 40, 50].map((option) => (
                        <SelectItem key={option} value={String(option)}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-center font-medium text-sm sm:w-fit">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center justify-center gap-2 sm:ml-auto lg:ml-0">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="hidden size-8 lg:flex"
                  disabled={page <= 1 || isPending}
                  onClick={() => updateParams({ page: 1 })}
                >
                  <span className="sr-only">Go to first page</span>
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={page <= 1 || isPending}
                  onClick={() => updateParams({ page: page - 1 })}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={page >= totalPages || isPending}
                  onClick={() => updateParams({ page: page + 1 })}
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="hidden size-8 lg:flex"
                  disabled={page >= totalPages || isPending}
                  onClick={() => updateParams({ page: totalPages })}
                >
                  <span className="sr-only">Go to last page</span>
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(selectedPayment)} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent className="top-0 left-0 grid h-svh max-h-svh w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-6">
            <DialogTitle>Payment details</DialogTitle>
            <DialogDescription>
              Review the payment source, related records, financial activity, and audit history.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            {selectedPayment ? <PaymentDetails payment={selectedPayment} /> : null}
          </div>
          <div className="flex justify-end border-t bg-muted/30 px-4 py-3 sm:px-6">
            <Button variant="outline" onClick={() => setSelectedPayment(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
