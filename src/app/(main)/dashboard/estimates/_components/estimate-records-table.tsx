"use client";

import * as React from "react";

import Link from "next/link";

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
import { format, parseISO } from "date-fns";
import {
  ArrowUpDown,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  NotebookText,
  Pencil,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

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

import type { JobCustomer } from "../../jobs/_components/jobs-table/schema";
import type { ServiceTemplateRow } from "../../services/types";
import type { EstimateRecordMutationState } from "../records-actions";
import {
  ConvertEstimateButton,
  DeleteEstimateRecordDialog,
  EditEstimateRecordDialog,
  PrintableEstimateButton,
} from "./estimate-record-dialogs";
import { getEstimateRecordsColumns } from "./estimate-records-table/columns";
import type { EstimateRecordRow } from "./schema";

const pageSize = 10;
const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "Draft", label: "Draft" },
  { value: "Estimate Provided", label: "Estimate provided" },
  { value: "Won", label: "Won" },
  { value: "Lost", label: "Lost" },
] as const;
const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "value-asc", label: "Value low-high" },
  { value: "value-desc", label: "Value high-low" },
] as const;

function formatMoney(value?: string) {
  return value ? `$${Number(value).toFixed(2)}` : "$0.00";
}

export function EstimateRecordsTable({
  convertEstimateToJobAction,
  createPrintableEstimateAction,
  customers,
  data,
  deleteEstimateRecordAction,
  services,
  updateEstimateRecordAction,
}: {
  convertEstimateToJobAction: (
    state: EstimateRecordMutationState,
    formData: FormData,
  ) => Promise<EstimateRecordMutationState>;
  createPrintableEstimateAction: (
    state: EstimateRecordMutationState,
    formData: FormData,
  ) => Promise<EstimateRecordMutationState>;
  customers: JobCustomer[];
  data: EstimateRecordRow[];
  deleteEstimateRecordAction: (
    state: EstimateRecordMutationState,
    formData: FormData,
  ) => Promise<EstimateRecordMutationState>;
  services: ServiceTemplateRow[];
  updateEstimateRecordAction: (
    state: EstimateRecordMutationState,
    formData: FormData,
  ) => Promise<EstimateRecordMutationState>;
}) {
  const [estimateToDelete, setEstimateToDelete] = React.useState<EstimateRecordRow | null>(null);
  const [estimateToEdit, setEstimateToEdit] = React.useState<EstimateRecordRow | null>(null);
  const [selectedEstimate, setSelectedEstimate] = React.useState<EstimateRecordRow | null>(null);
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
  const openEstimateEditor = React.useCallback((estimate: EstimateRecordRow) => {
    setSelectedEstimate(null);
    setEstimateToEdit(estimate);
  }, []);
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
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string) ?? "all";
  const paginatedData = table.getRowModel().rows.map((row) => row.original);
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

  React.useEffect(() => {
    if (!selectedEstimate) return;
    const refreshedEstimate = data.find((estimate) => estimate.id === selectedEstimate.id);
    if (!refreshedEstimate) {
      setSelectedEstimate(null);
      return;
    }
    if (refreshedEstimate && refreshedEstimate !== selectedEstimate) {
      setSelectedEstimate(refreshedEstimate);
    }
  }, [data, selectedEstimate]);

  React.useEffect(() => {
    if (!estimateToEdit) return;
    const refreshedEstimate = data.find((estimate) => estimate.id === estimateToEdit.id);
    if (!refreshedEstimate) {
      setEstimateToEdit(null);
      return;
    }
    if (refreshedEstimate !== estimateToEdit) {
      setEstimateToEdit(refreshedEstimate);
    }
  }, [data, estimateToEdit]);

  return (
    <>
      <DeleteEstimateRecordDialog
        key={estimateToDelete?.id ?? "delete-estimate"}
        action={deleteEstimateRecordAction}
        estimate={estimateToDelete}
        open={!!estimateToDelete}
        onOpenChange={(open) => {
          if (!open) setEstimateToDelete(null);
        }}
      />
      <EditEstimateRecordDialog
        key={estimateToEdit?.id ?? "edit-estimate"}
        action={updateEstimateRecordAction}
        customers={customers}
        estimate={estimateToEdit}
        onDeleteEstimate={(estimate) => {
          setEstimateToEdit(null);
          window.setTimeout(() => setEstimateToDelete(estimate), 0);
        }}
        open={!!estimateToEdit}
        onOpenChange={(open) => {
          if (!open) setEstimateToEdit(null);
        }}
        services={services}
      />
      <div className="grid gap-4">
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
                      setSelectedEstimate(row.original);
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
            <Card key={estimate.id} size="sm" className={"gap-0 py-0"}>
              <CardContent className="grid gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-wrap font-medium text-sm">{estimate.description}</div>
                    <div className="text-muted-foreground text-xs">{estimate.customerName ?? "No customer"}</div>
                  </div>
                  <span className="font-medium text-sm">{formatMoney(estimate.estimatedTotal)}</span>
                </div>

                <div className="grid gap-1 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs">Date</span>
                    <span>{new Date(estimate.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs">Status</span>
                    <span>{estimate.status}</span>
                  </div>
                </div>

                <div>
                  {estimate.printableEstimateId ? (
                    <Button asChild variant="outline" size="sm" className="border-sky-200 bg-sky-50 text-sky-700">
                      <Link
                        prefetch={false}
                        href={`/dashboard/estimates/${estimate.printableEstimateId}?from=estimates`}
                      >
                        <NotebookText />
                        Open Estimate PDF
                      </Link>
                    </Button>
                  ) : (
                    <Badge
                      variant="outline"
                      className="flex h-7 w-min justify-center px-2 text-muted-foreground text-xs"
                    >
                      <NotebookText className="size-3.5" />
                      PDF Not Created
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedEstimate(estimate)}>
                    View
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => openEstimateEditor(estimate)}>
                    Edit
                  </Button>
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
      {selectedEstimate ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/10 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="estimate-details-title"
          tabIndex={-1}
          onClick={() => setSelectedEstimate(null)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setSelectedEstimate(null);
            }
          }}
        >
          <Card
            className="max-h-[calc(100svh-2rem)] w-full max-w-xl overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <CardContent className="grid gap-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="grid min-w-0 gap-1">
                  <h2 id="estimate-details-title" className="text-wrap font-semibold text-lg">
                    {selectedEstimate.description}
                  </h2>
                  <p className="text-muted-foreground text-sm">{selectedEstimate.customerName ?? "No customer"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit estimate"
                    onClick={() => {
                      openEstimateEditor(selectedEstimate);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close estimate details"
                    onClick={() => setSelectedEstimate(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 rounded-lg bg-muted/20 p-3 text-sm sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 sm:block">
                  <div className="text-muted-foreground text-xs">Date</div>
                  <div className="font-medium">{format(parseISO(selectedEstimate.createdAt), "MMM d, yyyy")}</div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:block">
                  <div className="text-muted-foreground text-xs">Value</div>
                  <div className="font-medium">{formatMoney(selectedEstimate.estimatedTotal)}</div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:block">
                  <div className="text-muted-foreground text-xs">Status</div>
                  <div className="font-medium">{selectedEstimate.status}</div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:block">
                  <div className="text-muted-foreground text-xs">Category</div>
                  <div className="font-medium">{selectedEstimate.category}</div>
                </div>
              </div>
              {selectedEstimate.scope ? (
                <p className="max-h-40 overflow-y-auto whitespace-pre-line rounded-md border bg-background/70 p-3 text-sm">
                  {selectedEstimate.scope}
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                <PrintableEstimateButton action={createPrintableEstimateAction} estimate={selectedEstimate} />
                <ConvertEstimateButton action={convertEstimateToJobAction} estimate={selectedEstimate} />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
