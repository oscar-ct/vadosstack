"use client";
"use no memo";

import type { ColumnDef } from "@tanstack/react-table";
import { differenceInCalendarDays, endOfDay, format, parseISO, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import type { InvoiceTableItem } from "./schema";

function formatMoney(value: string) {
  return `$${Number(value).toFixed(2)}`;
}

function formatCustomerName(name?: string) {
  if (!name) return "No customer";
  return name;
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

function getDueState(invoice: InvoiceTableItem) {
  if (Number(invoice.balanceDue) <= 0) {
    return {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      daysUntilDue: null,
      label: "Paid",
    };
  }

  const daysUntilDue = differenceInCalendarDays(parseISO(invoice.dueAt), new Date());

  if (daysUntilDue < 0) {
    const daysPastDue = Math.abs(daysUntilDue);

    return {
      className: "border-rose-200 bg-rose-50 text-rose-700",
      daysUntilDue,
      label: `${daysPastDue} day${daysPastDue === 1 ? "" : "s"} overdue`,
    };
  }

  if (daysUntilDue === 0) {
    return {
      className: "border-amber-200 bg-amber-50 text-amber-700",
      daysUntilDue,
      label: "Due today",
    };
  }

  return {
    className: "border-muted bg-muted/30 text-muted-foreground",
    daysUntilDue,
    label: `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`,
  };
}

function getDueFilterBucket(invoice: InvoiceTableItem) {
  if (Number(invoice.balanceDue) <= 0) return "paid";

  const daysUntilDue = differenceInCalendarDays(parseISO(invoice.dueAt), new Date());

  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "due-today";
  return "upcoming";
}

export function getInvoicesColumns(): ColumnDef<InvoiceTableItem>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all invoices on this page"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center" data-invoice-row-ignore>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select ${row.original.invoiceNumber}`}
          />
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "issuedAt",
      header: "Issued Date",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{format(parseISO(row.original.issuedAt), "MMM d, yyyy")}</span>
      ),
      filterFn: (row, _columnId, filterValue: DateRange | undefined) => {
        if (!filterValue?.from && !filterValue?.to) return true;

        const issuedDate = parseISO(row.original.issuedAt);
        const from = filterValue.from ? startOfDay(filterValue.from) : undefined;
        const to = filterValue.to ? endOfDay(filterValue.to) : undefined;

        if (from && issuedDate < from) return false;
        if (to && issuedDate > to) return false;
        return true;
      },
    },
    {
      accessorKey: "dueAt",
      header: "Due",
      cell: ({ row }) => {
        const dueState = getDueState(row.original);

        return (
          <div className="grid gap-1">
            <span className="whitespace-nowrap text-sm">{format(parseISO(row.original.dueAt), "MMM d, yyyy")}</span>
            <Badge variant="outline" className={`w-fit ${dueState.className}`}>
              {dueState.label}
            </Badge>
          </div>
        );
      },
      sortingFn: (rowA, rowB) => parseISO(rowA.original.dueAt).getTime() - parseISO(rowB.original.dueAt).getTime(),
    },
    {
      accessorKey: "invoiceNumber",
      header: "Invoice ID",
      cell: ({ row }) => <span className="font-medium">{row.original.invoiceNumber}</span>,
      enableHiding: false,
    },
    {
      accessorKey: "customerName",
      header: "Customer",
      cell: ({ row }) => <span className="whitespace-nowrap">{formatCustomerName(row.original.customerName)}</span>,
    },
    {
      accessorKey: "jobTitle",
      header: "Job Description",
      cell: ({ row }) => (
        <div className="grid min-w-48 gap-1.5">
          <span className="truncate font-medium text-sm">{row.original.jobTitle}</span>
          <span className="truncate text-muted-foreground text-xs leading-none">
            {row.original.jobServiceLocation ?? "No address on file"}
          </span>
        </div>
        // <span className="block max-w-64 truncate">{row.original.jobTitle}</span>
      ),
    },
    {
      accessorKey: "total",
      header: () => <div className="text-right">Total</div>,
      cell: ({ row }) => <div className="text-right tabular-nums">{formatMoney(row.original.total)}</div>,
      sortingFn: (rowA, rowB) => Number(rowA.original.total ?? 0) - Number(rowB.original.total ?? 0),
    },
    {
      accessorKey: "amountPaid",
      header: () => <div className="text-right">Paid</div>,
      cell: ({ row }) => <div className="text-right tabular-nums">{formatMoney(row.original.amountPaid)}</div>,
      sortingFn: (rowA, rowB) => Number(rowA.original.amountPaid ?? 0) - Number(rowB.original.amountPaid ?? 0),
    },
    {
      accessorKey: "balanceDue",
      header: () => <div className="text-right">Balance</div>,
      cell: ({ row }) => (
        <div
          className={
            Number(row.original.balanceDue) > 0
              ? "text-right text-rose-700 tabular-nums dark:text-rose-400"
              : "text-right text-emerald-700 tabular-nums dark:text-emerald-400"
          }
        >
          {formatMoney(row.original.balanceDue)}
        </div>
      ),
      sortingFn: (rowA, rowB) => Number(rowA.original.balanceDue ?? 0) - Number(rowB.original.balanceDue ?? 0),
    },
    {
      id: "status",
      accessorFn: (row) => getInvoiceStatus(row),
      filterFn: "equalsString",
      enableHiding: true,
    },
    {
      id: "dueBucket",
      accessorFn: (row) => getDueFilterBucket(row),
      filterFn: "equalsString",
      enableHiding: true,
    },
    {
      id: "search",
      accessorFn: (row) =>
        [
          row.invoiceNumber,
          row.customerName,
          formatCustomerName(row.customerName),
          row.jobTitle,
          row.total,
          row.amountPaid,
          row.balanceDue,
          row.paymentStatus,
          getInvoiceStatus(row),
          format(parseISO(row.issuedAt), "MMM d, yyyy"),
          format(parseISO(row.dueAt), "MMM d, yyyy"),
          getDueState(row).label,
        ].join(" "),
      filterFn: "includesString",
      enableHiding: true,
    },
  ];
}
