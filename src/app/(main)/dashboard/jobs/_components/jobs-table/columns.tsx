"use client";
"use no memo";

import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { endOfDay, format, isBefore, parseISO, startOfDay } from "date-fns";
import { CalendarOff, CircleCheckIcon, Clock3Icon, PauseCircle, Pencil, ReceiptText, XCircle } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import type { JobRow } from "./schema";

export function statusIcon(status: string) {
  switch (status) {
    case "Completed":
      return <CircleCheckIcon className="fill-green-500 stroke-primary-foreground dark:fill-green-600" />;
    case "On Hold":
      return <PauseCircle className="text-amber-600 dark:text-amber-500" />;
    case "Cancelled":
      return <XCircle className="text-destructive" />;
    case "Scheduled":
      return <Clock3Icon className="text-muted-foreground" />;
    case "Unscheduled":
      return <CalendarOff className="text-muted-foreground" />;
    default:
      return null;
  }
}

function formatDate(value?: string) {
  return value ? format(parseISO(value), "MMM d, yyyy") : "Not scheduled";
}

export function getJobOverdueDate(job: Pick<JobRow, "dateEnd" | "status">) {
  if (!job.dateEnd || job.status === "Completed" || job.status === "Cancelled") {
    return undefined;
  }

  const endDate = endOfDay(parseISO(job.dateEnd));
  return isBefore(endDate, new Date()) ? format(parseISO(job.dateEnd), "MMM d, yyyy") : undefined;
}

// function formatMoney(value?: string) {
//   return value ? `$${parseFloat(value).toFixed(2)}` : "Not set";
// }

function toMoneyNumber(value?: string) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getAmountDueDisplay(job: JobRow) {
  const balance = toMoneyNumber(job.outstandingBalance);
  const finalCost = toMoneyNumber(job.finalCost);

  if (!job.invoiceId) {
    return {
      amountClassName: "text-muted-foreground",
      label: "No balance",
    };
  }

  if (finalCost <= 0) {
    return {
      amountClassName: "text-muted-foreground",
      label: "Not Priced",
    };
  }

  if (finalCost > 0 && balance <= 0) {
    return {
      amountClassName: "text-emerald-700 dark:text-emerald-400",
      label: "Paid in full",
    };
  }
  return {
    amountClassName: "text-rose-700 dark:text-rose-400",
    label: "Balance due",
  };

  // return {
  //   amountClassName: "text-rose-700 dark:text-rose-400",
  //   amountLabel: `${formatMoney(job.outstandingBalance)} due`,
  //   label: `Outstanding: ${formatMoney(job.outstandingBalance)}`,
  // };
}

export function getJobsColumns({ onEditJob }: { onEditJob: (job: JobRow) => void }): ColumnDef<JobRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all jobs on this page"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select ${row.original.description}`}
          />
        </div>
      ),
      enableHiding: false,
    },
    {
      id: "rowNumber",
      header: "#",
      cell: ({ row, table }) => {
        const currentRows = table.getRowModel().rows;
        const visibleIndex = currentRows.findIndex((currentRow) => currentRow.id === row.id);
        const { pageIndex, pageSize } = table.getState().pagination;
        const rowNumber = pageIndex * pageSize + visibleIndex + 1;

        return <span className="text-muted-foreground text-sm tabular-nums">{rowNumber}</span>;
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: () => null,
    },
    {
      accessorKey: "dateBegin",
      header: "Job Dates",
      sortUndefined: "last",
      filterFn: (row, _columnId, filterValue: DateRange | undefined) => {
        if (!filterValue?.from && !filterValue?.to) return true;
        if (!row.original.dateBegin) return false;

        const startDate = parseISO(row.original.dateBegin);
        const from = filterValue.from ? startOfDay(filterValue.from) : undefined;
        const to = filterValue.to ? endOfDay(filterValue.to) : undefined;

        if (from && startDate < from) return false;
        if (to && startDate > to) return false;

        return true;
      },
      cell: ({ row }) => (
        <div className="grid gap-0.5">
          <span className="text-sm">{formatDate(row.original.dateBegin)}</span>
          {row.original.dateEnd && (
            <span className="w-fit px-1 text-[11px] text-muted-foreground">- {formatDate(row.original.dateEnd)}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "finalCost",
      header: "Job Description",
      cell: ({ row }) => (
        <div className="grid min-w-0 gap-1.5">
          <span className="truncate font-medium text-sm">{row.original.description}</span>
          <div className={"flex gap-1.5 text-xs leading-none"}>
            <span className={"text-muted-foreground"}>Cost:</span>
            <span className={"text-green-700 font-medium"}>
              {row.original.finalCost ? `$${parseFloat(row.original.finalCost).toFixed(2)}` : "0.00"}
            </span>
          </div>
        </div>
      ),
      sortingFn: (rowA, rowB) => toMoneyNumber(rowA.original.finalCost) - toMoneyNumber(rowB.original.finalCost),
      enableHiding: false,
    },
    {
      accessorKey: "customerName",
      header: "Customer",
      cell: ({ row }) => (
        <div className="grid min-w-0 gap-1.5">
          <span className="truncate text-sm leading-none">{row.original.customerName ?? "No customer"}</span>
          <span className="truncate  text-muted-foreground text-xs leading-none">
            {row.original.serviceLocation ?? "No address on file"}
          </span>
        </div>
      ),
      enableHiding: false,
    },
    {
      id: "search",
      accessorFn: (row) =>
        [row.description, row.customerName, row.customerId, row.status, row.serviceLocation].join(" "),
      filterFn: "includesString",
      enableHiding: true,
    },
    {
      accessorKey: "status",
      header: "Status",
      filterFn: "equalsString",
      cell: ({ row }) => (
        <div className="grid min-w-[6.5em] gap-0.5">
          <Badge variant="outline" className="w-fit px-1.5 text-muted-foreground">
            {statusIcon(row.original.status)}
            {row.original.status}
          </Badge>
          {getJobOverdueDate(row.original) ? (
            <span className="px-1.5 text-[11px] text-amber-700 dark:text-amber-400">
              Overdue since {getJobOverdueDate(row.original)}
            </span>
          ) : null}
        </div>
      ),
    },
    // {
    //   accessorKey: "category",
    //   header: "Category",
    //   filterFn: "equalsString",
    //   cell: ({ row }) => <span className="text-sm">{row.original.category}</span>,
    // },
    // {
    //   accessorKey: "finalCost",
    //   header: "Cost",
    //   cell: ({ row }) => {
    //     return (
    //       <span className={`text-sm`}>
    //         {row.original.finalCost ? `$${parseFloat(row.original.finalCost).toFixed(2)}` : "0.00"}
    //       </span>
    //     );
    //   },
    //   sortingFn: (rowA, rowB) => toMoneyNumber(rowA.original.finalCost) - toMoneyNumber(rowB.original.finalCost),
    // },
    {
      accessorKey: "outstandingBalance",
      header: "Billing",
      cell: ({ row }) => {
        const amountDue = getAmountDueDisplay(row.original);
        return (
          <div className="grid gap-0.5">
            <span className={`text-[12px] font-medium ${amountDue.amountClassName}`}>{amountDue.label}</span>
            {/*<span className="w-fit px-1.5 text-[11px] text-muted-foreground">*/}
            {/*  {row.original.invoiceId ? "Invoiced" : "Not invoiced"}*/}
            {/*</span>*/}
          </div>
        );
      },
    },
    {
      id: "documents",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-start">
          {row.original.invoiceId ? (
            <Badge
              asChild
              variant="outline"
              className="h-7 border-sky-200 bg-sky-50 px-2 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950"
            >
              <Link prefetch={false} href={`/dashboard/invoices/${row.original.invoiceId}?from=jobs`}>
                <ReceiptText className="size-3.5" />
                View invoice
              </Link>
            </Badge>
          ) : (
            <Badge variant="outline" className="h-7 bg-muted/30 px-2 text-muted-foreground">
              <ReceiptText className="size-3.5" />
              Not invoiced
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onEditJob(row.original)}
            aria-label={`Edit ${row.original.description}`}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      ),
      enableHiding: false,
    },
  ];
}
