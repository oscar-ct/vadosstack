"use client";
"use no memo";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { type CsvColumn, CsvExportMenu, CsvExportSlot } from "@/components/csv-export-menu";
import { CustomerLink } from "@/components/customer-link";
import { DateRangePicker } from "@/components/date-range-picker";
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
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateOnly, toDateInputValue } from "@/lib/date-only";

import type { JobMutationState } from "../../jobs/actions";
import { getInvoicesColumns } from "./invoices-table/columns";
import type { InvoiceTableItem } from "./invoices-table/schema";

export type { InvoiceTableItem } from "./invoices-table/schema";

const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "total-asc", label: "Total low-high" },
  { value: "total-desc", label: "Total high-low" },
] as const;

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "Unpaid", label: "Unpaid" },
  { value: "Partial", label: "Partial" },
  { value: "Paid", label: "Paid" },
  { value: "Overpaid", label: "Overpaid" },
] as const;

const dueOptions = [
  { value: "all", label: "All due dates" },
  { value: "overdue", label: "Overdue" },
  { value: "due-today", label: "Due today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "paid", label: "Paid" },
] as const;

function formatMoney(value: string) {
  return `$${Number(value).toFixed(2)}`;
}

function formatDate(value: string) {
  return formatDateOnly(value) ?? "Not scheduled";
}

const invoiceExportColumns: CsvColumn<InvoiceTableItem>[] = [
  { header: "Invoice number", value: (invoice) => invoice.invoiceNumber },
  { header: "Customer", value: (invoice) => invoice.customerName },
  { header: "Job title", value: (invoice) => invoice.jobTitle },
  { header: "Job number", value: (invoice) => invoice.jobNumber },
  { header: "Issued date", value: (invoice) => formatDate(invoice.issuedAt) },
  { header: "Due date", value: (invoice) => formatDate(invoice.dueAt) },
  { header: "Status", value: (invoice) => getInvoiceStatus(invoice) },
  { header: "Payment status", value: (invoice) => invoice.paymentStatus },
  { header: "Labor cost", value: (invoice) => invoice.laborCost },
  { header: "Materials subtotal", value: (invoice) => invoice.materialsSubtotal },
  { header: "Material tax", value: (invoice) => invoice.materialTaxAmount },
  { header: "Total", value: (invoice) => invoice.total },
  { header: "Deposit paid", value: (invoice) => invoice.depositPaid },
  { header: "Amount paid", value: (invoice) => invoice.amountPaid },
  { header: "Balance due", value: (invoice) => invoice.balanceDue },
  { header: "Service location", value: (invoice) => invoice.jobServiceLocation },
];

function formatPaymentType(value: string) {
  return value === "deposit" ? "Deposit" : "Invoice payment";
}

function getInvoiceStatus(invoice: InvoiceTableItem) {
  const total = Number(invoice.total);
  const paid = Number(invoice.amountPaid);
  const balance = Number(invoice.balanceDue);

  if (total > 0 && paid > total && balance <= 0) return "Overpaid";
  if (total > 0 && balance <= 0) return "Paid";
  if (paid > 0) return "Partial";
  return "Unpaid";
}

function getStatusClassName(status: string) {
  if (status === "Paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Partial") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Overpaid") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function getDueState(invoice: InvoiceTableItem) {
  if (Number(invoice.balanceDue) <= 0) {
    return {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      daysUntilDue: null,
      isOverdue: false,
      label: "Paid",
    };
  }

  const daysUntilDue = differenceInCalendarDays(parseISO(invoice.dueAt), new Date());

  if (daysUntilDue < 0) {
    const daysPastDue = Math.abs(daysUntilDue);

    return {
      className: "border-rose-200 bg-rose-50 text-rose-700",
      daysUntilDue,
      isOverdue: true,
      label: `${daysPastDue} day${daysPastDue === 1 ? "" : "s"} overdue`,
    };
  }

  if (daysUntilDue === 0) {
    return {
      className: "border-amber-200 bg-amber-50 text-amber-700",
      daysUntilDue,
      isOverdue: false,
      label: "Due today",
    };
  }

  return {
    className: "border-muted bg-muted/30 text-muted-foreground",
    daysUntilDue,
    isOverdue: false,
    label: `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`,
  };
}

const initialJobMutationState: JobMutationState = {
  success: false,
  message: "",
};

function DeleteInvoicePaymentDialog({
  deletePaymentFormAction,
  isDeletingPayment,
  payment,
}: {
  deletePaymentFormAction: React.ComponentProps<"form">["action"];
  isDeletingPayment: boolean;
  payment: InvoiceTableItem["payments"][number];
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="destructive"
          size="icon-sm"
          disabled={isDeletingPayment}
          aria-label={`Delete ${payment.description} payment`}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete recorded payment?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the {formatMoney(payment.amount)} payment for {payment.description} recorded on{" "}
            {formatDate(payment.paidOn)}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form id={`delete-invoice-payment-${payment.id}`} action={deletePaymentFormAction}>
          <input type="hidden" name="id" value={payment.id} />
        </form>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeletingPayment}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeletingPayment}
            onClick={(event) => {
              event.preventDefault();
              const form = document.getElementById(`delete-invoice-payment-${payment.id}`) as HTMLFormElement | null;
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

export function InvoiceDetailsDialog({
  createJobPaymentAction,
  deleteJobPaymentAction,
  invoice,
  onOpenChange,
  open,
}: {
  createJobPaymentAction: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  deleteJobPaymentAction: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  invoice: InvoiceTableItem | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const router = useRouter();
  const paymentFormRef = React.useRef<HTMLFormElement>(null);
  const [paymentState, createPaymentFormAction, isCreatingPayment] = React.useActionState(
    createJobPaymentAction,
    initialJobMutationState,
  );
  const [deletePaymentState, deletePaymentFormAction, isDeletingPayment] = React.useActionState(
    deleteJobPaymentAction,
    initialJobMutationState,
  );

  React.useEffect(() => {
    if (!paymentState.success) return;

    paymentFormRef.current?.reset();
    router.refresh();
    toast.success(paymentState.message || "Payment recorded.");
  }, [paymentState, router]);

  React.useEffect(() => {
    if (!deletePaymentState.success) return;

    router.refresh();
    toast.success(deletePaymentState.message || "Payment deleted.");
  }, [deletePaymentState, router]);

  if (!invoice) return null;

  const status = getInvoiceStatus(invoice);
  const dueState = getDueState(invoice);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="border-b pb-4">
          <div className="grid gap-2">
            <div>
              <DialogTitle>{invoice.invoiceNumber}</DialogTitle>
              <DialogDescription>
                <CustomerLink customerId={invoice.customerId} name={invoice.customerName} />
                {" - issued "}
                {formatDate(invoice.issuedAt)}
              </DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`w-fit ${getStatusClassName(status)}`}>
                {status}
              </Badge>
              {dueState.label !== "Paid" && (
                <Badge variant="outline" className={`w-fit ${dueState.className}`}>
                  {dueState.label}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4">
          <section className="grid gap-3 rounded-lg border p-3 sm:p-4">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0">
                <div className="font-medium text-sm leading-5">{invoice.jobTitle}</div>
                <div className="text-muted-foreground text-xs">Job #{invoice.jobNumber}</div>
              </div>
              <Button asChild variant="outline" size="sm" className="w-fit">
                <Link prefetch={false} href={invoice.jobHref}>
                  Open job
                </Link>
              </Button>
            </div>
            {invoice.jobDescription ? (
              <p className="line-clamp-3 text-muted-foreground text-sm">{invoice.jobDescription}</p>
            ) : null}
            <div className="grid grid-cols-2 overflow-hidden rounded-md border bg-muted/10 sm:grid-cols-5">
              <div className="grid gap-0.5 p-2">
                <span className="text-muted-foreground text-xs">Labor</span>
                <span className="font-medium tabular-nums">{formatMoney(invoice.laborCost)}</span>
              </div>
              <div className="grid gap-0.5 p-2">
                <span className="text-muted-foreground text-xs">Materials</span>
                <span className="font-medium tabular-nums">{formatMoney(invoice.materialsSubtotal)}</span>
              </div>
              <div className="grid gap-0.5 p-2">
                <span className="text-muted-foreground text-xs">Tax</span>
                <span className="font-medium tabular-nums">{formatMoney(invoice.materialTaxAmount)}</span>
              </div>
              <div className="grid gap-0.5 p-2">
                <span className="text-muted-foreground text-xs">Job deposits</span>
                <span className="font-medium tabular-nums">{formatMoney(invoice.depositPaid)}</span>
              </div>
              <div className="col-span-2 grid gap-0.5 p-2 sm:col-span-1">
                <span className="text-muted-foreground text-xs">Invoice total</span>
                <span className="font-medium tabular-nums">{formatMoney(invoice.total)}</span>
              </div>
            </div>
          </section>

          <section className="grid gap-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center gap-2 font-medium text-sm">
              <CircleDollarSign className="size-4 text-muted-foreground" />
              Payment summary
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1">
                <span className="text-muted-foreground text-xs">Invoice total</span>
                <span className="font-medium tabular-nums">{formatMoney(invoice.total)}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-muted-foreground text-xs">Paid</span>
                <span className="font-medium text-emerald-700 tabular-nums dark:text-emerald-400">
                  {formatMoney(invoice.amountPaid)}
                </span>
              </div>
              <div className="grid gap-1">
                <span className="text-muted-foreground text-xs">Balance</span>
                <span
                  className={
                    Number(invoice.balanceDue) > 0
                      ? "font-medium text-rose-700 tabular-nums dark:text-rose-400"
                      : "font-medium text-emerald-700 tabular-nums dark:text-emerald-400"
                  }
                >
                  {formatMoney(invoice.balanceDue)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
              <span className="text-muted-foreground">Due date</span>
              <span className={dueState.isOverdue ? "font-medium text-rose-700 dark:text-rose-400" : "font-medium"}>
                {formatDate(invoice.dueAt)} · {dueState.label}
              </span>
            </div>
          </section>

          <form
            ref={paymentFormRef}
            action={createPaymentFormAction}
            className="grid gap-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm dark:border-emerald-900/70 dark:bg-emerald-950/20"
          >
            <input type="hidden" name="jobId" value={invoice.jobId} />
            <input type="hidden" name="paymentType" value="invoice_payment" />
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                <CircleDollarSign className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm leading-5">Record payment</div>
                <p className="text-muted-foreground text-xs">
                  Add a payment received for this invoice and update the balance.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`invoice-payment-date-${invoice.id}`}>Date</Label>
                <Input
                  id={`invoice-payment-date-${invoice.id}`}
                  name="paidOn"
                  type="date"
                  defaultValue={toDateInputValue()}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`invoice-payment-amount-${invoice.id}`}>Amount</Label>
                <Input
                  id={`invoice-payment-amount-${invoice.id}`}
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`invoice-payment-method-${invoice.id}`}>Method</Label>
                <Input
                  id={`invoice-payment-method-${invoice.id}`}
                  name="method"
                  placeholder="Zelle, check, card"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`invoice-payment-reference-${invoice.id}`}>Check / Ref #</Label>
                <Input id={`invoice-payment-reference-${invoice.id}`} name="referenceNumber" placeholder="Optional" />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor={`invoice-payment-description-${invoice.id}`}>Description</Label>
                <Input
                  id={`invoice-payment-description-${invoice.id}`}
                  name="description"
                  placeholder="Final payment, deposit"
                  required
                />
              </div>
            </div>
            {paymentState.message && !paymentState.success ? (
              <p className="text-destructive text-sm">{paymentState.message}</p>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isCreatingPayment} className="shadow-sm">
                <CircleDollarSign className="size-4" />
                {isCreatingPayment ? "Recording..." : "Record payment"}
              </Button>
            </div>
          </form>

          <section className="grid gap-3">
            <div className="font-medium text-sm">Transaction history</div>
            {invoice.payments.length ? (
              <div className="max-h-72 overflow-y-auto rounded-lg border bg-background">
                <div className="grid gap-2 p-2 sm:hidden">
                  {invoice.payments.map((payment) => (
                    <div key={payment.id} className="rounded-lg border bg-muted/10 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm leading-5">{payment.description}</div>
                          <div className="mt-0.5 text-muted-foreground text-xs">
                            {formatDate(payment.paidOn)} · {formatPaymentType(payment.paymentType)}
                          </div>
                        </div>
                        <div className="shrink-0 text-right font-medium text-sm tabular-nums">
                          {formatMoney(payment.amount)}
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 border-t pt-2 text-xs">
                        <div className="grid gap-1">
                          <span className="text-muted-foreground">Method</span>
                          <span className="font-medium">{payment.method}</span>
                        </div>
                        <div className="grid gap-1">
                          <span className="text-muted-foreground">Ref #</span>
                          <span className="font-medium">{payment.referenceNumber ?? "-"}</span>
                        </div>
                        <div className="flex justify-end">
                          <DeleteInvoicePaymentDialog
                            deletePaymentFormAction={deletePaymentFormAction}
                            isDeletingPayment={isDeletingPayment}
                            payment={payment}
                          />
                        </div>
                      </div>
                      {/*<div className="mt-2 flex justify-end">*/}
                      {/*  <DeleteInvoicePaymentDialog*/}
                      {/*      deletePaymentFormAction={deletePaymentFormAction}*/}
                      {/*      isDeletingPayment={isDeletingPayment}*/}
                      {/*      payment={payment}*/}
                      {/*  />*/}
                      {/*</div>*/}
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block">
                  <div className="sticky top-0 z-10 grid grid-cols-[120px_minmax(0,1fr)_120px_80px_auto] gap-3 border-b bg-muted/95 px-3 py-2 font-medium text-xs backdrop-blur">
                    <span>Date</span>
                    <span>Description</span>
                    <span>Ref #</span>
                    <span className="text-right">Amount</span>
                    <span className="sr-only">Actions</span>
                  </div>
                  {invoice.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="grid grid-cols-[120px_minmax(0,1fr)_120px_80px_auto] items-start gap-3 border-b px-3 py-3 text-sm last:border-b-0"
                    >
                      <span className="text-muted-foreground text-xs">{formatDate(payment.paidOn)}</span>
                      <div className="min-w-0">
                        <p className="whitespace-normal break-words leading-snug">{payment.description}</p>
                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
                          <span>{formatPaymentType(payment.paymentType)}</span>
                          <span>•</span>
                          <span className="min-w-0 truncate">{payment.method}</span>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="whitespace-normal break-words leading-snug">
                          {payment.referenceNumber ? payment.referenceNumber : "-"}
                        </p>
                      </div>
                      <span className="text-right font-medium tabular-nums">{formatMoney(payment.amount)}</span>
                      <div className="flex justify-end">
                        <DeleteInvoicePaymentDialog
                          deletePaymentFormAction={deletePaymentFormAction}
                          isDeletingPayment={isDeletingPayment}
                          payment={payment}
                        />
                      </div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InvoicesTable({ exportSlotId, invoices }: { exportSlotId?: string; invoices: InvoiceTableItem[] }) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "issuedAt", desc: true }]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [columnVisibility] = React.useState<VisibilityState>({
    dueBucket: false,
    search: false,
    status: false,
  });
  const columns = React.useMemo(() => getInvoicesColumns(), []);

  const table = useReactTable({
    data: invoices,
    columns,
    state: {
      rowSelection,
      columnFilters,
      sorting,
      pagination,
      columnVisibility,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const searchQuery = (table.getColumn("search")?.getFilterValue() as string) ?? "";
  const selectedExportRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original);
  const currentExportRows = table.getPrePaginationRowModel().rows.map((row) => row.original);
  const exportMenu = (
    <CsvExportMenu
      allRows={invoices}
      columns={invoiceExportColumns}
      currentRows={currentExportRows}
      filenamePrefix="invoices"
      selectedRows={selectedExportRows}
      triggerClassName={exportSlotId ? "hidden w-7 px-0 sm:w-auto sm:px-2.5 md:flex" : undefined}
    />
  );
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string) ?? "all";
  const dueFilter = (table.getColumn("dueBucket")?.getFilterValue() as string) ?? "all";
  const issuedDateFilter = table.getColumn("issuedAt")?.getFilterValue() as DateRange | undefined;
  const hasIssuedDateFilter = Boolean(issuedDateFilter?.from || issuedDateFilter?.to);
  const filteredRows = table.getFilteredRowModel().rows;
  const currentRows = table.getRowModel().rows;
  const dueSummary = React.useMemo(() => {
    const pastDueInvoices = invoices.filter((invoice) => getDueState(invoice).isOverdue);
    const pastDueBalance = pastDueInvoices.reduce((total, invoice) => total + Number(invoice.balanceDue), 0);

    return {
      pastDueBalance: pastDueBalance.toFixed(2),
      pastDueCount: pastDueInvoices.length,
    };
  }, [invoices]);
  const sortValue = React.useMemo(() => {
    const currentSort = sorting[0];

    if (!currentSort) return "newest";
    if (currentSort.id === "issuedAt" && currentSort.desc) return "newest";
    if (currentSort.id === "issuedAt" && !currentSort.desc) return "oldest";
    if (currentSort.id === "total" && !currentSort.desc) return "total-asc";
    if (currentSort.id === "total" && currentSort.desc) return "total-desc";

    return "newest";
  }, [sorting]);

  function updateSort(value: string) {
    const nextSorting: SortingState =
      value === "oldest"
        ? [{ id: "issuedAt", desc: false }]
        : value === "total-asc"
          ? [{ id: "total", desc: false }]
          : value === "total-desc"
            ? [{ id: "total", desc: true }]
            : [{ id: "issuedAt", desc: true }];

    table.setSorting(nextSorting);
    table.setPageIndex(0);
  }

  function updateStatusFilter(value: string) {
    table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value);
    table.setPageIndex(0);
  }

  function updateDueFilter(value: string) {
    table.getColumn("dueBucket")?.setFilterValue(value === "all" ? undefined : value);
    table.setPageIndex(0);
  }

  function updateIssuedDateFilter(value: DateRange | undefined) {
    table.getColumn("issuedAt")?.setFilterValue(value?.from || value?.to ? value : undefined);
    table.setPageIndex(0);
  }

  if (!invoices.length) {
    return (
      <div className="rounded-md border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
        No invoices yet. Create invoices from billable jobs.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div
        className={
          dueSummary.pastDueCount > 0
            ? "grid gap-1 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-400"
            : "grid gap-1 rounded-lg border bg-muted/20 p-3 text-muted-foreground"
        }
      >
        <div className="font-medium text-sm">
          {dueSummary.pastDueCount > 0
            ? `${dueSummary.pastDueCount} past due invoice${dueSummary.pastDueCount === 1 ? "" : "s"}`
            : "No past due invoices"}
        </div>
        <div className="text-sm">
          {dueSummary.pastDueCount > 0
            ? `${formatMoney(dueSummary.pastDueBalance)} currently past due`
            : "Outstanding invoices are still within their due window."}
        </div>
      </div>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(event) => {
                table.getColumn("search")?.setFilterValue(event.target.value || undefined);
                table.setPageIndex(0);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {exportSlotId ? null : exportMenu}
            <div className="md:hidden">
              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal />
                    Filters
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Invoice filters</DrawerTitle>
                    <DrawerDescription>Filter and sort the invoices list on mobile.</DrawerDescription>
                  </DrawerHeader>
                  <div className="grid gap-4 px-4">
                    <div className="grid gap-2">
                      <Label htmlFor="invoices-mobile-status">Status</Label>
                      <Select value={statusFilter} onValueChange={updateStatusFilter}>
                        <SelectTrigger id="invoices-mobile-status" className="w-full">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {statusOptions.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="invoices-mobile-due">Due</Label>
                      <Select value={dueFilter} onValueChange={updateDueFilter}>
                        <SelectTrigger id="invoices-mobile-due" className="w-full">
                          <SelectValue placeholder="Due" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {dueOptions.map((due) => (
                              <SelectItem key={due.value} value={due.value}>
                                {due.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="invoices-mobile-issued-date">Issued date</Label>
                      <div className="grid gap-2">
                        <DateRangePicker
                          id="invoices-mobile-issued-date"
                          value={issuedDateFilter}
                          onChange={updateIssuedDateFilter}
                          placeholder="Filter by issued date"
                          align="start"
                          numberOfMonths={1}
                          className="w-full justify-start text-left"
                        />
                        {hasIssuedDateFilter ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => updateIssuedDateFilter(undefined)}
                          >
                            <X />
                            Clear issued date
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="invoices-mobile-sort">Sort</Label>
                      <Select value={sortValue} onValueChange={updateSort}>
                        <SelectTrigger id="invoices-mobile-sort" className="w-full">
                          <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {sortOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DrawerFooter>
                    <DrawerClose asChild>
                      <Button>Done</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            </div>
            <div className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CircleDollarSign />
                    Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={statusFilter} onValueChange={updateStatusFilter}>
                    {statusOptions.map((status) => (
                      <DropdownMenuRadioItem key={status.value} value={status.value}>
                        {status.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarDays />
                    Due
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={dueFilter} onValueChange={updateDueFilter}>
                    {dueOptions.map((due) => (
                      <DropdownMenuRadioItem key={due.value} value={due.value}>
                        {due.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DateRangePicker
                id="invoices-issued-date-filter"
                value={issuedDateFilter}
                onChange={updateIssuedDateFilter}
                placeholder="Issued date"
                align="start"
                size="sm"
              />
              {hasIssuedDateFilter ? (
                <Button type="button" variant="outline" size="sm" onClick={() => updateIssuedDateFilter(undefined)}>
                  <X />
                  Clear issued date
                </Button>
              ) : null}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden md:flex">
                  <ArrowUpDown />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup value={sortValue} onValueChange={updateSort}>
                  {sortOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      {exportSlotId ? <CsvExportSlot id={exportSlotId}>{exportMenu}</CsvExportSlot> : null}
      <div className="grid gap-3 sm:hidden">
        {currentRows.length ? (
          currentRows.map((row) => {
            const invoice = row.original;

            return (
              <div
                key={row.id}
                className="relative grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40"
              >
                <Link
                  prefetch={false}
                  href={invoice.href}
                  className="absolute inset-0 z-10 rounded-lg"
                  aria-label={`Open invoice ${invoice.invoiceNumber}`}
                />
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{invoice.invoiceNumber}</div>
                    <CustomerLink
                      customerId={invoice.customerId}
                      name={invoice.customerName}
                      className="relative z-20 block truncate text-muted-foreground text-sm"
                    />
                  </div>
                  <div className="shrink-0 font-semibold text-sm tabular-nums">{formatMoney(invoice.total)}</div>
                </div>
                <div className="grid min-w-0 grid-cols-2 gap-3 text-sm">
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="grid gap-1">
                      <span className="text-muted-foreground text-xs">Issued</span>
                      <span>{formatDate(invoice.issuedAt)}</span>
                    </div>
                    <div className="grid gap-1">
                      <span className="text-muted-foreground text-xs">Paid</span>
                      <span>{formatMoney(invoice.amountPaid)}</span>
                    </div>
                    <div className="grid gap-1">
                      <span className="text-muted-foreground text-xs">Due</span>
                      <span>{formatDate(invoice.dueAt)}</span>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="grid gap-1">
                      <span className="text-muted-foreground text-xs">Job</span>
                      <span className="line-clamp-2 min-w-0 break-words">{invoice.jobTitle}</span>
                      <span className="min-w-0 truncate text-muted-foreground text-xs">
                        {invoice.jobServiceLocation}
                      </span>
                    </div>
                    <div className="grid gap-1">
                      <span className="text-muted-foreground text-xs">Balance</span>
                      <span>{formatMoney(invoice.balanceDue)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={getStatusClassName(getInvoiceStatus(invoice))}>
                      {getInvoiceStatus(invoice)}
                    </Badge>
                    {getDueState(invoice).label !== "Paid" ? (
                      <Badge variant="outline" className={getDueState(invoice).className}>
                        {getDueState(invoice).label}
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground text-sm">Open invoice</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border bg-muted/20 p-6 text-center text-muted-foreground text-sm">
            No invoices match your search.
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-lg border bg-card sm:block">
        <Table>
          <TableHeader className="bg-muted/15">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan} className="h-11 p-3 font-medium">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {currentRows.length ? (
              currentRows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  tabIndex={0}
                  role="link"
                  className="cursor-pointer"
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("[data-invoice-row-ignore]")) {
                      return;
                    }

                    router.push(row.original.href);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(row.original.href);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="p-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                  No invoices match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden flex-1 text-muted-foreground text-sm lg:flex">
          {table.getFilteredSelectedRowModel().rows.length} of {filteredRows.length} row(s) selected.
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="invoices-rows-per-page" className="font-medium text-sm">
              Rows per page
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger size="sm" className="w-20" id="invoices-rows-per-page">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-center font-medium text-sm sm:w-fit">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="flex items-center justify-center gap-2 sm:ml-auto lg:ml-0">
            <Button
              variant="outline"
              className="hidden size-8 lg:flex"
              size="icon"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 lg:flex"
              size="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
