"use client";
"use no memo";

import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";

import { Checkbox } from "@/components/ui/checkbox";

import type { InvoiceTableItem } from "./schema";

function formatMoney(value: string) {
  return `$${Number(value).toFixed(2)}`;
}

function formatCustomerName(name?: string) {
  if (!name) return "No customer";
  return name;
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
        <div className="flex items-center justify-center">
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
    },
    {
      accessorKey: "invoiceNumber",
      header: "Invoice ID",
      cell: ({ row }) => (
        <Link
          prefetch={false}
          href={row.original.href}
          className="font-medium text-blue-600 underline-offset-4 hover:underline"
        >
          {row.original.invoiceNumber}
        </Link>
      ),
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
      cell: ({ row }) => <span className="block max-w-64 truncate">{row.original.jobTitle}</span>,
    },
    {
      accessorKey: "total",
      header: () => <div className="text-right">Total</div>,
      cell: ({ row }) => <div className="text-right tabular-nums">{formatMoney(row.original.total)}</div>,
      sortingFn: (rowA, rowB) => Number(rowA.original.total ?? 0) - Number(rowB.original.total ?? 0),
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
          format(parseISO(row.issuedAt), "MMM d, yyyy"),
        ].join(" "),
      filterFn: "includesString",
      enableHiding: true,
    },
  ];
}
