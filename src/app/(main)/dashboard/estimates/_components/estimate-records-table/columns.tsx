"use client";
"use no memo";

import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { NotebookText, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import type { EstimateRecordRow } from "../schema";

function formatMoney(value?: string) {
  return value ? `$${Number(value).toFixed(2)}` : "$0.00";
}

function estimateStatusClassName(status: string) {
  if (status === "Won") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900";
  if (status === "Lost") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900";
  if (status === "Ready to Send") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900";
  if (status === "Waiting on Customer") return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900";
  return "bg-muted-foreground/10 text-muted-foreground";
}

function nextActionLabel(status: string) {
  if (status === "Draft") return "Continue estimate";
  if (status === "Ready to Send") return "Send estimate";
  if (status === "Waiting on Customer") return "Follow up";
  if (status === "Won") return "Convert to job";
  if (status === "Lost") return "Reopen if needed";
  return "Review";
}

export function getEstimateRecordsColumns({
  onEditEstimate,
}: {
  onEditEstimate: (estimate: EstimateRecordRow) => void;
}): ColumnDef<EstimateRecordRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all estimates on this page"
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
      accessorKey: "createdAt",
      header: "Date",
      sortUndefined: "last",
      cell: ({ row }) => format(parseISO(row.original.createdAt), "MMM d, yyyy"),
    },
    {
      accessorKey: "customerName",
      header: "Customer",
      cell: ({ row }) => row.original.customerName ?? "No customer",
    },
    {
      accessorKey: "description",
      header: "Service",
      cell: ({ row }) => (
        <div className="grid min-w-0 gap-1.5">
          <span className="truncate font-medium text-sm leading-none">{row.original.description}</span>
          <span className="w-72 truncate text-muted-foreground text-xs leading-none">{row.original.scope ?? ""}</span>
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "estimatedTotal",
      header: () => <div className="text-left">Value</div>,
      cell: ({ row }) => <div className="text-left tabular-nums">{formatMoney(row.original.estimatedTotal)}</div>,
      sortingFn: (rowA, rowB) => Number(rowA.original.estimatedTotal ?? 0) - Number(rowB.original.estimatedTotal ?? 0),
    },
    {
      accessorKey: "status",
      header: "Status",
      filterFn: "equalsString",
      cell: ({ row }) => (
        <div className="grid gap-1">
          <Badge variant="outline" className={estimateStatusClassName(row.original.status)}>
            {row.original.status}
          </Badge>
          <span className="px-1 text-muted-foreground text-xs">{nextActionLabel(row.original.status)}</span>
        </div>
      ),
    },
    {
      id: "documents",
      header: "",
      cell: ({ row }) => (
        <div className={"w-min"}>
          {row.original.printableEstimateId ? (
            <Button
              asChild
              variant="outline"
              size="xs"
              className="flex h-7 justify-center border-sky-200 bg-sky-50 px-2 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950"
            >
              <Link prefetch={false} href={`/dashboard/estimates/${row.original.printableEstimateId}?from=estimates`}>
                <NotebookText className="size-3.5" />
                View PDF
              </Link>
            </Button>
          ) : (
            <Badge variant="outline" className="flex h-7 justify-center px-2 text-muted-foreground text-xs">
              <NotebookText className="size-3.5" />
              No PDF
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <div className="sr-only">Actions</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(event) => {
              event.stopPropagation();
              onEditEstimate(row.original);
            }}
            aria-label={`Edit ${row.original.description}`}
          >
            <Pencil />
          </Button>
        </div>
      ),
      enableHiding: false,
    },
    {
      id: "search",
      accessorFn: (row) =>
        [row.description, row.customerName, row.status, row.category, row.estimatedTotal].filter(Boolean).join(" "),
      filterFn: "includesString",
      enableHiding: true,
    },
  ];
}
