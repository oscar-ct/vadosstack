"use client";
"use no memo";

import * as React from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

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
import {
  ArrowUpDown,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Pencil,
  ReceiptText,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { DateRange } from "react-day-picker";

import { DateRangePicker } from "@/components/date-range-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

import type { InvoiceMutationState } from "../../../invoices/types";
import type { ServiceTemplateRow } from "../../../services/types";
import type { JobMutationState } from "../../actions";
import { getAmountDueDisplay, getJobOverdueDate, getJobsColumns, statusIcon } from "./columns";
import { DeleteJobDialog } from "./delete-job-dialog";
import { EditJobDialog } from "./edit-job-dialog";
import { JobDetailsDialog } from "./job-details-dialog";
import type { JobCustomer, JobRow } from "./schema";

const statusOptions = [
  { value: "all", label: "All" },
  { value: "Unscheduled", label: "Unscheduled" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "Completed", label: "Completed" },
  { value: "On Hold", label: "On Hold" },
  { value: "Cancelled", label: "Cancelled" },
] as const;
// const categoryOptions = [
//   { value: "all", label: "All" },
//   { value: "Repair", label: "Repair" },
//   { value: "Installation", label: "Installation" },
//   { value: "Other", label: "Other" },
// ] as const;
const sortOptions = [
  { value: "created-desc", label: "Newest created" },
  { value: "created-asc", label: "Oldest created" },
  { value: "start-asc", label: "Start date soonest" },
  { value: "start-desc", label: "Start date latest" },
  { value: "cost-asc", label: "Cost low-high" },
  { value: "cost-desc", label: "Cost high-low" },
] as const;

function shouldIgnoreRowClick(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? !!target.closest("a, button, input, label, select, textarea, [data-row-click-ignore]")
    : false;
}

export function JobsTable({
  customers,
  createJobPaymentAction,
  createInvoiceAction,
  data,
  deleteJobAction,
  deleteJobPaymentAction,
  initialSelectedJobId,
  services,
  updateJobAction,
}: {
  customers: JobCustomer[];
  createJobPaymentAction: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  createInvoiceAction: (state: InvoiceMutationState, formData: FormData) => Promise<InvoiceMutationState>;
  data: JobRow[];
  deleteJobAction: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  deleteJobPaymentAction: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  initialSelectedJobId?: string;
  services: ServiceTemplateRow[];
  updateJobAction: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobToDelete, setJobToDelete] = React.useState<JobRow | null>(null);
  const [jobToEdit, setJobToEdit] = React.useState<JobRow | null>(null);
  const [selectedJob, setSelectedJob] = React.useState<JobRow | null>(null);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [columnVisibility] = React.useState<VisibilityState>({
    createdAt: false,
    search: false,
  });
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const columns = React.useMemo(
    () =>
      getJobsColumns({
        onEditJob: setJobToEdit,
      }),
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      columnFilters,
      sorting,
      columnVisibility,
      pagination,
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
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string) ?? "all";
  const startDateFilter = table.getColumn("dateBegin")?.getFilterValue() as DateRange | undefined;
  const hasStartDateFilter = Boolean(startDateFilter?.from || startDateFilter?.to);
  // const categoryFilter = (table.getColumn("category")?.getFilterValue() as string) ?? "all";
  const sortValue = React.useMemo(() => {
    const currentSort = sorting[0];

    if (!currentSort) return "created-desc";
    if (currentSort.id === "createdAt" && currentSort.desc) return "created-desc";
    if (currentSort.id === "createdAt" && !currentSort.desc) return "created-asc";
    if (currentSort.id === "dateBegin" && !currentSort.desc) return "start-asc";
    if (currentSort.id === "dateBegin" && currentSort.desc) return "start-desc";
    if (currentSort.id === "finalCost" && !currentSort.desc) return "cost-asc";
    if (currentSort.id === "finalCost" && currentSort.desc) return "cost-desc";

    return "created-desc";
  }, [sorting]);

  function updateSort(value: string) {
    const nextSorting: SortingState =
      value === "created-asc"
        ? [{ id: "createdAt", desc: false }]
        : value === "start-asc"
          ? [{ id: "dateBegin", desc: false }]
          : value === "start-desc"
            ? [{ id: "dateBegin", desc: true }]
            : value === "cost-asc"
              ? [{ id: "finalCost", desc: false }]
              : value === "cost-desc"
                ? [{ id: "finalCost", desc: true }]
                : [{ id: "createdAt", desc: true }];

    table.setSorting(nextSorting);
    table.setPageIndex(0);
  }

  function updateStartDateFilter(value: DateRange | undefined) {
    table.getColumn("dateBegin")?.setFilterValue(value?.from || value?.to ? value : undefined);
    table.setPageIndex(0);
  }

  React.useEffect(() => {
    if (!initialSelectedJobId) return;

    const job = data.find((item) => item.id === initialSelectedJobId);
    if (job) {
      setSelectedJob(job);
    }
  }, [data, initialSelectedJobId]);

  React.useEffect(() => {
    if (!selectedJob) return;

    const refreshedJob = data.find((item) => item.id === selectedJob.id);
    if (refreshedJob && refreshedJob !== selectedJob) {
      setSelectedJob(refreshedJob);
    }
  }, [data, selectedJob]);

  return (
    <>
      <DeleteJobDialog
        key={jobToDelete?.id ?? "delete-job"}
        action={deleteJobAction}
        job={jobToDelete}
        open={!!jobToDelete}
        onOpenChange={(open) => {
          if (!open) setJobToDelete(null);
        }}
      />
      <EditJobDialog
        key={jobToEdit?.id ?? "edit-job"}
        action={updateJobAction}
        customers={customers}
        job={jobToEdit}
        onDeleteJob={setJobToDelete}
        open={!!jobToEdit}
        onOpenChange={(open) => {
          if (!open) setJobToEdit(null);
        }}
        services={services}
      />
      <JobDetailsDialog
        createJobPaymentAction={createJobPaymentAction}
        createInvoiceAction={createInvoiceAction}
        deleteJobPaymentAction={deleteJobPaymentAction}
        job={selectedJob}
        onEditJob={(job) => {
          setSelectedJob(null);
          setJobToEdit(job);
        }}
        open={!!selectedJob}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJob(null);

            if (searchParams.get("job")) {
              const nextParams = new URLSearchParams(searchParams.toString());
              nextParams.delete("job");
              const nextQuery = nextParams.toString();
              router.replace(nextQuery ? `/dashboard/jobs?${nextQuery}` : "/dashboard/jobs");
            }
          }
        }}
      />
      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(event) => {
                  table.getColumn("search")?.setFilterValue(event.target.value || undefined);
                  table.setPageIndex(0);
                }}
              />
            </div>
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
                    <DrawerTitle>Job filters</DrawerTitle>
                    <DrawerDescription>Filter and sort the jobs list on mobile.</DrawerDescription>
                  </DrawerHeader>
                  <div className="grid gap-4 px-4">
                    <div className="grid gap-2">
                      <Label htmlFor="jobs-mobile-status">Status</Label>
                      <Select
                        value={statusFilter}
                        onValueChange={(value) => {
                          table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value);
                          table.setPageIndex(0);
                        }}
                      >
                        <SelectTrigger id="jobs-mobile-status" className="w-full">
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
                    {/*<div className="grid gap-2">*/}
                    {/*<Label htmlFor="jobs-mobile-category">Category</Label>*/}
                    {/*<Select*/}
                    {/*  value={categoryFilter}*/}
                    {/*  onValueChange={(value) => {*/}
                    {/*    table.getColumn("category")?.setFilterValue(value === "all" ? undefined : value);*/}
                    {/*    table.setPageIndex(0);*/}
                    {/*  }}*/}
                    {/*>*/}
                    {/*  <SelectTrigger id="jobs-mobile-category" className="w-full">*/}
                    {/*    <SelectValue placeholder="Category" />*/}
                    {/*  </SelectTrigger>*/}
                    {/*  <SelectContent>*/}
                    {/*    <SelectGroup>*/}
                    {/*      {categoryOptions.map((category) => (*/}
                    {/*        <SelectItem key={category.value} value={category.value}>*/}
                    {/*          {category.label}*/}
                    {/*        </SelectItem>*/}
                    {/*      ))}*/}
                    {/*    </SelectGroup>*/}
                    {/*  </SelectContent>*/}
                    {/*</Select>*/}
                    {/*</div>*/}
                    <div className="grid gap-2">
                      <Label htmlFor="jobs-mobile-start-date">Start date</Label>
                      <div className="grid gap-2">
                        <DateRangePicker
                          id="jobs-mobile-start-date"
                          value={startDateFilter}
                          onChange={updateStartDateFilter}
                          placeholder="Filter by start date"
                          align="start"
                          numberOfMonths={1}
                          className="w-full justify-start text-left"
                        />
                        {hasStartDateFilter ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => updateStartDateFilter(undefined)}
                          >
                            <X />
                            Clear start date
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="jobs-mobile-sort">Sort</Label>
                      <Select value={sortValue} onValueChange={updateSort}>
                        <SelectTrigger id="jobs-mobile-sort" className="w-full">
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
                    <BriefcaseBusiness />
                    Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup
                    value={statusFilter}
                    onValueChange={(value) => {
                      table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value);
                      table.setPageIndex(0);
                    }}
                  >
                    {statusOptions.map((status) => (
                      <DropdownMenuRadioItem key={status.value} value={status.value}>
                        {status.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DateRangePicker
                id="jobs-start-date-filter"
                value={startDateFilter}
                onChange={updateStartDateFilter}
                placeholder="Start date"
                align="start"
                size="sm"
              />
              {hasStartDateFilter ? (
                <Button type="button" variant="outline" size="sm" onClick={() => updateStartDateFilter(undefined)}>
                  <X />
                  Clear start date
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
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

        <div className="grid gap-6 md:hidden">
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => {
              const amountDue = getAmountDueDisplay(row.original);
              // const rowNumber =
              //   table.getState().pagination.pageIndex * table.getState().pagination.pageSize + index + 1;

              return (
                <Card key={row.id} size="sm" className="gap-0 py-0">
                  <CardContent className="grid gap-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className={"min-w-0"}>
                        <div className="flex items-center gap-2">
                          {/*<span className="text-muted-foreground text-xs tabular-nums">#{rowNumber}</span>*/}
                          <div className="truncate text-wrap font-medium text-sm">{row.original.description}</div>
                        </div>
                        <div className="text-muted-foreground text-sm">
                          {row.original.customerName ?? "No customer"}
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-muted-foreground/10 px-1.5">
                        {statusIcon(row.original.status)}
                        {row.original.status}
                      </Badge>
                    </div>
                    {getJobOverdueDate(row.original) ? (
                      <div className="-mt-2 text-amber-700 text-xs dark:text-amber-400">
                        Overdue since {getJobOverdueDate(row.original)}
                      </div>
                    ) : null}
                    <div className="grid gap-1 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="shrink-0 text-muted-foreground text-xs">Service Location</span>
                        <span className={"line-clamp-2 w-48 min-w-0 text-right sm:w-64"}>
                          {row.original.serviceLocation ? row.original.serviceLocation : "Not address on file"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground text-xs">Start Date</span>
                        <span>
                          {row.original.dateBegin
                            ? new Date(row.original.dateBegin).toLocaleDateString()
                            : "Not scheduled"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground text-xs">End Date</span>
                        <span>
                          {row.original.dateEnd ? new Date(row.original.dateEnd).toLocaleDateString() : "Not scheduled"}
                        </span>
                      </div>
                      {/*<div className="flex items-center justify-between gap-3">*/}
                      {/*<span className="text-muted-foreground text-xs">Status</span>*/}
                      {/*<Badge variant="outline" className={`px-1.5 text-[11px] ${amountDue.badgeClassName}`}>*/}
                      {/*  {amountDue.label}*/}
                      {/*</Badge>*/}
                      {/*</div>*/}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground text-xs">Final Cost</span>
                        <span>{row.original.finalCost ? `$${row.original.finalCost}` : "Not set"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground text-xs">Billing Status</span>
                        <span className={amountDue.amountClassName}>{amountDue.label}</span>
                      </div>
                    </div>
                    <div>
                      {row.original.invoiceId ? (
                        <Badge
                          asChild
                          variant="outline"
                          className="h-7 border-sky-200 bg-sky-50 px-2 text-sky-700 hover:bg-sky-100 hover:text-sky-800"
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
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedJob(row.original)}>
                        <Eye className="size-4" />
                        View
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setJobToEdit(row.original)}>
                        <Pencil className="size-4" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm">No results.</div>
          )}
        </div>

        <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
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
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="h-16 cursor-pointer"
                    tabIndex={0}
                    role="button"
                    aria-label={`View ${row.original.description} details`}
                    onClick={(event) => {
                      if (shouldIgnoreRowClick(event.target)) return;
                      setSelectedJob(row.original);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      if (shouldIgnoreRowClick(event.target)) return;

                      event.preventDefault();
                      setSelectedJob(row.original);
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
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden flex-1 text-muted-foreground text-sm lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s)
            selected.
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="jobs-rows-per-page" className="font-medium text-sm">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger size="sm" className="w-20" id="jobs-rows-per-page">
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
    </>
  );
}
