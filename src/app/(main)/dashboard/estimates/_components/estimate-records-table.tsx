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
  CircleDollarSign,
  FileText,
  NotebookText,
  Pencil,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

function formatOptionalMoney(value?: string) {
  return value === undefined ? undefined : formatMoney(value);
}

// function formatDate(value?: string) {
//   return value ? format(parseISO(value), "MMM d, yyyy") : undefined;
// }

// function formatDateStartToEnd(value?: string, value2?: string) {
//   const startDate = value ? format(parseISO(value), "MMM d, yyyy") : undefined;
//   const endDate = value2 ? format(parseISO(value2), "MMM d, yyyy") : undefined;
//
//   if (!startDate) {
//     return "Unscheduled";
//   }
//
//   if (!endDate) {
//     return `${startDate} - Not scheduled`;
//   }
//
//   return `${startDate} - ${endDate}`;
// }

function DetailItem({ label, value, className }: { label: string; value?: string; className?: string }) {
  return (
    <div className={cn(className, "grid", "gap-1")}>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-sm">{value ?? "Not on file"}</span>
    </div>
  );
}

function withLineItemKeys<T extends { description: string; price: string }>(items: T[]) {
  const seen = new Map<string, number>();

  return items.map((item) => {
    const baseKey = `${item.description}-${item.price}`;
    const occurrence = (seen.get(baseKey) ?? 0) + 1;
    seen.set(baseKey, occurrence);

    return {
      ...item,
      key: `${baseKey}-${occurrence}`,
    };
  });
}

function getLaborSubtotal(estimate: EstimateRecordRow) {
  return estimate.laborItems.length
    ? estimate.laborItems.reduce((total, item) => total + Number(item.price || 0), 0).toFixed(2)
    : (estimate.laborCost ?? "0.00");
}

function getMaterialsSubtotal(estimate: EstimateRecordRow) {
  return estimate.materials.reduce((total, material) => total + Number(material.price || 0), 0).toFixed(2);
}

function getMaterialTaxAmount(estimate: EstimateRecordRow) {
  const subtotal = Number(getMaterialsSubtotal(estimate));
  const laborCost = Number(getLaborSubtotal(estimate));
  const taxRate = Number(estimate.materialTaxRate ?? 0);

  return (((laborCost + subtotal) * taxRate) / 100).toFixed(2);
}

function estimateStatusClassName(status: string) {
  if (status === "Won") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900";
  if (status === "Lost") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900";
  if (status === "Estimate Provided") return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900";
  return "bg-muted-foreground/10 text-muted-foreground";
}

function EstimateDetailsDialog({
  convertEstimateToJobAction,
  createPrintableEstimateAction,
  estimate,
  onEditEstimate,
  onOpenChange,
}: {
  convertEstimateToJobAction: (
    state: EstimateRecordMutationState,
    formData: FormData,
  ) => Promise<EstimateRecordMutationState>;
  createPrintableEstimateAction: (
    state: EstimateRecordMutationState,
    formData: FormData,
  ) => Promise<EstimateRecordMutationState>;
  estimate: EstimateRecordRow | null;
  onEditEstimate: (estimate: EstimateRecordRow) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const laborItems = React.useMemo(() => withLineItemKeys(estimate?.laborItems ?? []), [estimate?.laborItems]);
  const materials = React.useMemo(() => withLineItemKeys(estimate?.materials ?? []), [estimate?.materials]);

  return (
    <Dialog open={!!estimate} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden sm:max-w-5xl">
        {estimate ? (
          <>
            <DialogHeader className="border-b pt-2 pr-10 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-md border bg-muted">
                  <FileText className="size-5 text-muted-foreground" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-wrap font-semibold tracking-tight">
                      {estimate.description}
                    </DialogTitle>
                    <p className="truncate text-muted-foreground text-sm">{estimate.customerName ?? "No customer"}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`h-8 w-fit shrink-0 px-2 ${estimateStatusClassName(estimate.status)}`}
                  >
                    {estimate.status}
                  </Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onEditEstimate(estimate);
                  }}
                >
                  <Pencil />
                  Edit estimate
                </Button>
                <PrintableEstimateButton
                  action={createPrintableEstimateAction}
                  className=""
                  estimate={estimate}
                  size="sm"
                />
                <ConvertEstimateButton action={convertEstimateToJobAction} className="" estimate={estimate} size="sm" />
              </div>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                <section className="grid gap-4 rounded-lg border p-4">
                  <div className="grid gap-1">
                    <Badge variant="secondary" className="w-fit">
                      {estimate.category}
                    </Badge>
                    <p className="text-muted-foreground text-sm">{estimate.scope || "No description on file."}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailItem label="Customer" value={estimate.customerName} />
                    <DetailItem label="Service location" value={estimate.serviceLocation} />
                    <DetailItem
                      className={"sm:col-span-2"}
                      label="Notes"
                      value={estimate.notes || "No notes on file"}
                    />
                  </div>
                </section>

                <section className="grid gap-3 rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <CircleDollarSign className="size-4 text-muted-foreground" />
                    Estimate summary
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailItem label="Estimate value" value={formatOptionalMoney(estimate.estimatedTotal)} />
                    <DetailItem label="Created" value={format(parseISO(estimate.createdAt), "MMM d, yyyy")} />
                    <DetailItem label="Labor" value={formatMoney(getLaborSubtotal(estimate))} />
                    <DetailItem label="Materials" value={formatMoney(getMaterialsSubtotal(estimate))} />
                    <DetailItem
                      label={`Tax${estimate.materialTaxRate ? ` (${estimate.materialTaxRate}%)` : ""}`}
                      value={formatMoney(getMaterialTaxAmount(estimate))}
                    />
                    <DetailItem label="Status" value={estimate.status} />
                  </div>
                </section>
              </div>

              <section className="grid gap-3">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <CircleDollarSign className="size-4 text-muted-foreground" />
                  Labor and materials
                </div>
                <div className="grid gap-3">
                  <div className="rounded-lg border border-sky-200/80 bg-sky-50/50 p-3 dark:border-sky-900/60 dark:bg-sky-950/20">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="font-medium text-sm">Labor</div>
                      <span className="text-muted-foreground text-xs">{laborItems.length} item(s)</span>
                    </div>
                    {laborItems.length ? (
                      <div className="divide-y divide-sky-200/70 dark:divide-sky-900/60">
                        {laborItems.map((item) => (
                          <div
                            key={item.key}
                            className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2 text-sm first:pt-0 last:pb-0"
                          >
                            <span className="min-w-0 whitespace-normal break-words">{item.description}</span>
                            <span className="whitespace-nowrap text-right tabular-nums">{formatMoney(item.price)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No labor line items.</p>
                    )}
                  </div>
                  {laborItems.length ? (
                    <div className="flex justify-end pt-2">
                      <span className="whitespace-nowrap text-right font-medium tabular-nums">
                        Labor total: {formatMoney(getLaborSubtotal(estimate))}
                      </span>
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="font-medium text-sm">Materials</div>
                      <span className="text-muted-foreground text-xs">{materials.length} item(s)</span>
                    </div>
                    {materials.length ? (
                      <div className="divide-y divide-amber-200/70 dark:divide-amber-900/60">
                        {materials.map((material) => (
                          <div
                            key={material.key}
                            className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2 text-sm first:pt-0 last:pb-0"
                          >
                            <span className="min-w-0 whitespace-normal break-words">
                              {material.description}
                              <span className="mt-0.5 block text-muted-foreground text-xs">
                                {material.quantity && material.unitPrice
                                  ? `Qty ${material.quantity} × ${formatMoney(material.unitPrice)}`
                                  : "Line item"}
                              </span>
                            </span>
                            <span className="whitespace-nowrap text-right tabular-nums">
                              {formatMoney(material.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No material line items.</p>
                    )}
                  </div>
                  {materials.length ? (
                    <div className="flex justify-end pt-2">
                      <span className="whitespace-nowrap text-right font-medium tabular-nums">
                        Materials total: {formatMoney(getMaterialsSubtotal(estimate))}
                      </span>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
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
      <EstimateDetailsDialog
        convertEstimateToJobAction={convertEstimateToJobAction}
        createPrintableEstimateAction={createPrintableEstimateAction}
        estimate={selectedEstimate}
        onEditEstimate={openEstimateEditor}
        onOpenChange={(open) => {
          if (!open) setSelectedEstimate(null);
        }}
      />
    </>
  );
}
