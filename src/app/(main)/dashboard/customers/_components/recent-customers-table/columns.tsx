"use client";
"use no memo";

import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { differenceInCalendarDays, endOfToday, format, parseISO } from "date-fns";
import { UserRound, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

import type { RecentCustomerRow } from "./schema";

export function getCustomerBillingDisplay(customer: RecentCustomerRow) {
  const unpaidJobs = customer.unpaidJobs ?? [];
  const invoiceHistory = customer.invoiceHistory ?? [];
  const hasBalance = unpaidJobs.length > 0;
  const unpaidJobCount = unpaidJobs.length;

  if (!hasBalance) {
    const hasInvoices = invoiceHistory.length > 0;

    return {
      amountLabel: "$0.00 due",
      detail: hasInvoices ? "All invoices are paid" : "No invoices yet",
      actionClassName: "",
      tone: "settled" as const,
      label: "No balance",
      actionLabel: "",
    };
  }

  return {
    amountLabel: `${customer.outstandingAmount ?? "$0.00"} due`,
    actionClassName:
      "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60",
    tone: "due" as const,
    label: "Outstanding balance",
    detail: `${unpaidJobCount} unpaid invoice${unpaidJobCount === 1 ? "" : "s"}`,
    actionLabel: `Review ${unpaidJobCount} unpaid invoice${unpaidJobCount === 1 ? "" : "s"}`,
  };
}

function formatDate(value?: string) {
  return value ? format(parseISO(value), "MMM d, yyyy") : "No jobs yet";
}

export function CustomerDueJobsPopover({ customer }: { customer: RecentCustomerRow }) {
  const unpaidJobs = customer.unpaidJobs ?? [];
  const billingDisplay = getCustomerBillingDisplay(customer);

  if (!unpaidJobs.length) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="xs"
          className={`w-fit gap-1.5 px-2 text-[11px] ${billingDisplay.actionClassName}`}
        >
          <WalletCards className="size-3" />
          {billingDisplay.actionLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <PopoverHeader>
          <div className="border-b p-3">
            <PopoverTitle>Unpaid invoices</PopoverTitle>
            <PopoverDescription>
              {billingDisplay.amountLabel} across {unpaidJobs.length} invoice{unpaidJobs.length === 1 ? "" : "s"}.
            </PopoverDescription>
          </div>
        </PopoverHeader>
        <div className="grid max-h-72 overflow-auto">
          {unpaidJobs.map((job) => (
            <Link
              key={job.id}
              prefetch={false}
              href={
                job.linkedInvoiceId
                  ? `/dashboard/invoices/${job.linkedInvoiceId}`
                  : `/dashboard/jobs/${job.linkedJobId ?? job.id}`
              }
              className="grid gap-1 border-b p-3 transition-colors last:border-b-0 hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-sm">{job.title}</div>
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                    <span>{formatDate(job.date)}</span>
                    <span>{job.paymentStatus ?? job.status}</span>
                  </div>
                </div>
                <span className="shrink-0 font-medium text-rose-700 text-sm dark:text-rose-400">{job.balance}</span>
              </div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function getRecentCustomersColumns({
  onViewCustomer,
}: {
  onViewCustomer: (customer: RecentCustomerRow) => void;
}): ColumnDef<RecentCustomerRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all customers on this page"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select ${row.original.name}`}
          />
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: "Customer",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 border bg-muted text-muted-foreground hover:text-foreground"
            onClick={() => onViewCustomer(row.original)}
            aria-label={`View ${row.original.name} details`}
          >
            <UserRound className="size-4 text-muted-foreground" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate font-medium text-sm leading-none">{row.original.name}</span>
              <span className="truncate text-muted-foreground text-xs leading-none">
                {row.original.email || "No email on file"}
              </span>
            </div>
          </div>
        </div>
      ),
      enableHiding: false,
    },
    {
      id: "search",
      accessorFn: (row) =>
        [
          row.name,
          row.email,
          row.id,
          row.billing,
          row.outstandingAmount,
          ...(row.unpaidJobs?.map((job) => [job.title, job.paymentStatus, job.balance].join(" ")) ?? []),
        ].join(" "),
      filterFn: "includesString",
      enableHiding: true,
    },
    {
      id: "billingBucket",
      accessorFn: (row) => {
        const unpaidJobs = row.unpaidJobs ?? [];

        if (!unpaidJobs.length) {
          return ["no-balance"];
        }

        return ["outstanding-balance"];
      },
      filterFn: "arrIncludes",
      enableHiding: true,
    },
    {
      accessorKey: "billing",
      header: "Billing",
      cell: ({ row }) => {
        const billingDisplay = getCustomerBillingDisplay(row.original);

        return (
          <div className="grid gap-0.5">
            <span className="text-muted-foreground text-sm">{billingDisplay.detail}</span>
            <CustomerDueJobsPopover customer={row.original} />
          </div>
        );
      },
    },
    {
      id: "lastScheduledWindow",
      accessorFn: (row) => {
        if (!row.lastScheduledJobDate) {
          return [];
        }

        const daysSinceLastJob = differenceInCalendarDays(endOfToday(), parseISO(row.lastScheduledJobDate));

        if (daysSinceLastJob <= 30) return ["30", "90"];
        if (daysSinceLastJob <= 90) return ["90"];
        return [];
      },
      filterFn: "arrIncludes",
      enableHiding: true,
    },
    {
      accessorKey: "lastScheduledJobDate",
      header: "Last scheduled",
      sortUndefined: "last",
      cell: ({ row }) => {
        if (!row.original.lastScheduledJobDate) {
          return <span className="text-muted-foreground text-sm">No jobs yet</span>;
        }

        const scheduledAt = parseISO(row.original.lastScheduledJobDate);

        return (
          <div className="grid gap-0.5">
            <span className="text-sm">{format(scheduledAt, "MMM d, yyyy")}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "jobCount",
      header: "Jobs",
      cell: ({ row }) => (
        <Button type="button" variant="ghost" className="h-8 px-2" onClick={() => onViewCustomer(row.original)}>
          <span className="font-medium text-sm">{row.original.jobCount}</span>
          <span className="text-muted-foreground text-xs">{row.original.jobCount === 1 ? "job" : "jobs"}</span>
        </Button>
      ),
    },
  ];
}
