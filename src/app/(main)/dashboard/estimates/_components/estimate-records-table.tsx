"use client";

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
import {
  ArrowUpDown,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  NotebookText,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { type CsvColumn, CsvExportMenu, CsvExportSlot } from "@/components/csv-export-menu";
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
import { cn } from "@/lib/utils";

import { getEstimateRecordsColumns } from "./estimate-records-table/columns";
import type { EstimateRecordRow } from "./schema";

const pageSize = 10;
const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "Draft", label: "Draft" },
  { value: "Ready to Send", label: "Ready to send" },
  { value: "Waiting on Customer", label: "Waiting" },
  { value: "Won", label: "Won" },
  { value: "Lost", label: "Lost" },
] as const;
const pipelineStages = [
  {
    action: "Write estimate",
    description: "Work has been discussed and the estimate is still being prepared.",
    label: "Drafts",
    status: "Draft",
  },
  {
    action: "Send estimate",
    description: "Estimate is prepared and ready to provide to the customer.",
    label: "Ready",
    status: "Ready to Send",
  },
  {
    action: "Follow up",
    description: "Estimate has been sent and you are waiting for a decision.",
    label: "Waiting",
    status: "Waiting on Customer",
  },
  {
    action: "Convert to job",
    description: "Customer approved the estimate.",
    label: "Won",
    status: "Won",
  },
  {
    action: "Reopen if needed",
    description: "Customer declined or the opportunity is no longer active.",
    label: "Lost",
    status: "Lost",
  },
] as const;
const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "value-asc", label: "Value low-high" },
  { value: "value-desc", label: "Value high-low" },
] as const;

function formatExportDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : "";
}

const estimateExportColumns: CsvColumn<EstimateRecordRow>[] = [
  { header: "Estimate title", value: (estimate) => estimate.description },
  { header: "Customer", value: (estimate) => estimate.customerName },
  { header: "Status", value: (estimate) => estimate.status },
  { header: "Category", value: (estimate) => estimate.category },
  { header: "Service location", value: (estimate) => estimate.serviceLocation },
  { header: "Scheduled date", value: (estimate) => formatExportDate(estimate.dateBegin) },
  { header: "Labor cost", value: (estimate) => estimate.laborCost },
  { header: "Material tax rate", value: (estimate) => estimate.materialTaxRate },
  { header: "Estimated total", value: (estimate) => estimate.estimatedTotal },
  { header: "Printable estimate", value: (estimate) => (estimate.printableEstimateId ? "Yes" : "No") },
  { header: "Converted to job", value: (estimate) => (estimate.convertedJobId ? "Yes" : "No") },
  { header: "Created date", value: (estimate) => formatExportDate(estimate.createdAt) },
  { header: "Notes", value: (estimate) => estimate.notes },
];

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

export function EstimateRecordsTable({ data, exportSlotId }: { data: EstimateRecordRow[]; exportSlotId?: string }) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [columnVisibility] = React.useState<VisibilityState>({
    search: false,
  });
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const openEstimateEditor = React.useCallback(
    (estimate: EstimateRecordRow) => {
      router.push(`/dashboard/estimates/records/${estimate.id}/edit`);
    },
    [router],
  );
  const columns = React.useMemo(
    () =>
      getEstimateRecordsColumns({
        onEditEstimate: openEstimateEditor,
      }),
    [openEstimateEditor],
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
  const selectedExportRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original);
  const currentExportRows = table.getPrePaginationRowModel().rows.map((row) => row.original);
  const exportMenu = (
    <CsvExportMenu
      allRows={data}
      columns={estimateExportColumns}
      currentRows={currentExportRows}
      filenamePrefix="estimates"
      selectedRows={selectedExportRows}
      triggerClassName={exportSlotId ? "hidden w-7 px-0 sm:w-auto sm:px-2.5 md:flex" : undefined}
    />
  );
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string) ?? "all";
  const paginatedData = table.getRowModel().rows.map((row) => row.original);
  const pipelineCounts = React.useMemo(
    () =>
      pipelineStages.map((stage) => {
        const estimates = data.filter((estimate) => estimate.status === stage.status);
        const total = estimates.reduce((sum, estimate) => sum + Number(estimate.estimatedTotal ?? 0), 0);

        return {
          ...stage,
          count: estimates.length,
          total,
        };
      }),
    [data],
  );
  const sortValue = React.useMemo(() => {
    const currentSort = sorting[0];

    if (!currentSort) return "newest";
    if (currentSort.id === "createdAt" && !currentSort.desc) return "oldest";
    if (currentSort.id === "createdAt" && currentSort.desc) return "newest";
    if (currentSort.id === "estimatedTotal" && !currentSort.desc) return "value-asc";
    if (currentSort.id === "estimatedTotal" && currentSort.desc) return "value-desc";

    return "newest";
  }, [sorting]);

  function updateSort(value: string) {
    const nextSorting: SortingState =
      value === "oldest"
        ? [{ id: "createdAt", desc: false }]
        : value === "value-asc"
          ? [{ id: "estimatedTotal", desc: false }]
          : value === "value-desc"
            ? [{ id: "estimatedTotal", desc: true }]
            : [{ id: "createdAt", desc: true }];

    table.setSorting(nextSorting);
    table.setPageIndex(0);
  }

  function updateStatusFilter(value: string) {
    table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value);
    table.setPageIndex(0);
  }

  return (
    <>
      <div className="grid gap-4">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className={"pt-2"}>
              <h2 className="font-semibold text-sm">Estimate pipeline</h2>
              <p className="text-muted-foreground text-xs">Move each estimate from draft to customer decision.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => updateStatusFilter("all")}>
              All estimates
            </Button>
          </div>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))] sm:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            {pipelineCounts.map((stage) => {
              const isActive = statusFilter === stage.status;

              return (
                <button
                  key={stage.status}
                  type="button"
                  className={cn(
                    "grid gap-2 rounded-lg border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-muted/20",
                    isActive && "border-primary bg-primary/5",
                  )}
                  onClick={() => updateStatusFilter(isActive ? "all" : stage.status)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{stage.label}</span>
                    <Badge variant="outline" className={estimateStatusClassName(stage.status)}>
                      {stage.count}
                    </Badge>
                  </div>
                  <p className="min-h-8 text-muted-foreground text-xs">{stage.description}</p>
                  <div className="flex flex-col items-center justify-between gap-2 border-t pt-2 min-[420px]:flex-row">
                    <span className="text-muted-foreground text-xs">{stage.action}</span>
                    <span className="font-medium text-xs tabular-nums">{formatMoney(stage.total.toFixed(2))}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
                placeholder="Search estimates..."
                value={searchQuery}
                onChange={(event) => {
                  table.getColumn("search")?.setFilterValue(event.target.value || undefined);
                  table.setPageIndex(0);
                }}
              />
            </div>
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
                    <DrawerTitle>Estimate filters</DrawerTitle>
                    <DrawerDescription>Filter and sort the estimates list on mobile.</DrawerDescription>
                  </DrawerHeader>
                  <div className="grid gap-4 px-4">
                    <div className="grid gap-2">
                      <Label htmlFor="estimates-mobile-status">Status</Label>
                      <Select
                        value={statusFilter}
                        onValueChange={(value) => {
                          table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value);
                          table.setPageIndex(0);
                        }}
                      >
                        <SelectTrigger id="estimates-mobile-status" className="w-full">
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
                      <Label htmlFor="estimates-mobile-sort">Sort</Label>
                      <Select value={sortValue} onValueChange={updateSort}>
                        <SelectTrigger id="estimates-mobile-sort" className="w-full">
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
        <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
          <Table>
            <TableHeader className="bg-muted/15">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
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
                    className="h-16 cursor-pointer"
                    data-state={row.getIsSelected() && "selected"}
                    onClick={(event) => {
                      if (event.target instanceof HTMLElement && event.target.closest("button, a, input, label"))
                        return;
                      router.push(`/dashboard/estimates/records/${row.original.id}`);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No estimates found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="grid gap-6 md:hidden">
          {paginatedData.map((estimate) => (
            <Card
              key={estimate.id}
              size="sm"
              className="cursor-pointer gap-0 transition-colors hover:bg-muted/40"
              role="link"
              tabIndex={0}
              onClick={(event) => {
                if (event.target instanceof HTMLElement && event.target.closest("button, a, input, label")) return;
                router.push(`/dashboard/estimates/records/${estimate.id}`);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                router.push(`/dashboard/estimates/records/${estimate.id}`);
              }}
            >
              <CardContent className="grid gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className={"min-w-0"}>
                    <div className="truncate text-wrap font-medium text-sm">{estimate.description}</div>
                    <div className="text-muted-foreground text-sm">{estimate.customerName ?? "No customer"}</div>
                  </div>
                  <span className="font-medium text-sm">{formatMoney(estimate.estimatedTotal)}</span>
                </div>
                <div className="grid gap-1 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="shrink-0 text-muted-foreground text-xs">Service Location</span>
                    <span className={"line-clamp-2 w-48 min-w-0 text-right sm:w-64"}>
                      {estimate.serviceLocation ? estimate.serviceLocation : "Not address on file"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs">Status</span>
                    <Badge variant="outline" className={estimateStatusClassName(estimate.status)}>
                      {estimate.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs">Next step</span>
                    <span className="text-right">{nextActionLabel(estimate.status)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs">Scheduled date</span>
                    <span>
                      {estimate.dateBegin ? new Date(estimate.dateBegin).toLocaleDateString() : "Unscheduled"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs">Created date</span>
                    <span>{new Date(estimate.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div>
                  {estimate.printableEstimateId ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="border-sky-200 bg-sky-50 px-2 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950"
                    >
                      <Link prefetch={false} href={`/dashboard/estimates/${estimate.printableEstimateId}`}>
                        <NotebookText />
                        Final estimate
                      </Link>
                    </Button>
                  ) : (
                    <span className={"text-muted-foreground"}>No final estimate</span>
                  )}
                </div>

                <div className="flex items-center justify-end">
                  <span className="text-muted-foreground text-sm">Open estimate</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {!paginatedData.length ? (
            <div className="rounded-lg border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
              No estimates found.
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden flex-1 text-muted-foreground text-sm lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s)
            selected.
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="estimates-rows-per-page" className="font-medium text-sm">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger size="sm" className="w-20" id="estimates-rows-per-page">
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
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
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
      {exportSlotId ? <CsvExportSlot id={exportSlotId}>{exportMenu}</CsvExportSlot> : null}
    </>
  );
}
