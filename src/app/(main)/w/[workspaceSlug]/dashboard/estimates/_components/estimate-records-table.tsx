"use client";

import * as React from "react";

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
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  FilePenLine,
  Layers3,
  MailWarning,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Trophy,
} from "lucide-react";

import { type CsvColumn, CsvExportMenu, CsvExportSlot } from "@/components/csv-export-menu";
import { CustomerLink } from "@/components/customer-link";
import { MobileLocationCard } from "@/components/mobile-location-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Drawer,
  DrawerBody,
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
import { useWorkspaceRouter as useRouter } from "@/components/workspace-path-provider";
import { cn } from "@/lib/utils";

import { getEstimateRecordsColumns } from "./estimate-records-table/columns";
import type { EstimateRecordRow } from "./schema";

const pageSize = 20;
const desktopColumnWidths: Record<string, string> = {
  select: "3.5%",
  estimateNumber: "10%",
  estimateDate: "10%",
  customerName: "18%",
  description: "28%",
  estimatedTotal: "10%",
  status: "17%",
  actions: "3.5%",
};
const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "Draft", label: "Draft" },
  { value: "Ready to Send", label: "Ready to send" },
  { value: "Waiting on Customer", label: "Awaiting decision" },
  { value: "Won", label: "Won" },
  { value: "Lost", label: "Lost" },
] as const;
const pipelineStages = [
  {
    action: "Continue writing",
    accent: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    icon: FilePenLine,
    label: "Draft",
    mobileLabel: "Draft",
    status: "Draft",
  },
  {
    action: "Send estimate",
    accent: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: Send,
    label: "Ready to send",
    mobileLabel: "Ready",
    status: "Ready to Send",
  },
  {
    action: "Follow up",
    accent: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    icon: Clock3,
    label: "Awaiting decision",
    mobileLabel: "Waiting",
    status: "Waiting on Customer",
  },
  {
    action: "View job",
    accent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: Trophy,
    label: "Won",
    mobileLabel: "Won",
    status: "Won",
  },
  {
    action: "Review or reopen",
    accent: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    icon: RotateCcw,
    label: "Lost",
    mobileLabel: "Lost",
    status: "Lost",
  },
] as const;
const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "value-asc", label: "Value low-high" },
  { value: "value-desc", label: "Value high-low" },
  { value: "number-asc", label: "Estimate number A-Z" },
  { value: "number-desc", label: "Estimate number Z-A" },
  { value: "customer-asc", label: "Customer A-Z" },
  { value: "customer-desc", label: "Customer Z-A" },
  { value: "status-asc", label: "Status A-Z" },
  { value: "status-desc", label: "Status Z-A" },
] as const;

function formatExportDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : "";
}

const estimateExportColumns: CsvColumn<EstimateRecordRow>[] = [
  { header: "Estimate number", value: (estimate) => estimate.estimateNumber },
  { header: "Estimate title", value: (estimate) => estimate.description },
  { header: "Customer/Lead", value: (estimate) => estimate.customerName ?? estimate.leadName },
  { header: "Status", value: (estimate) => estimate.status },
  { header: "Category", value: (estimate) => estimate.category },
  { header: "Service location", value: (estimate) => estimate.serviceLocation },
  { header: "Scheduled date", value: (estimate) => formatExportDate(estimate.dateBegin) },
  { header: "Labor cost", value: (estimate) => estimate.laborCost },
  { header: "Material tax rate", value: (estimate) => estimate.materialTaxRate },
  { header: "Estimated total", value: (estimate) => estimate.estimatedTotal },
  { header: "Printable estimate", value: (estimate) => (estimate.printableEstimateId ? "Yes" : "No") },
  { header: "Converted to job", value: (estimate) => (estimate.convertedJobId ? "Yes" : "No") },
  { header: "Issued date", value: (estimate) => formatExportDate(estimate.issuedAt) },
  { header: "Created date", value: (estimate) => formatExportDate(estimate.createdAt) },
  { header: "Notes", value: (estimate) => estimate.notes },
];

function formatMoney(value?: string) {
  return value ? `$${Number(value).toFixed(2)}` : "$0.00";
}

const pipelineMoneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatPipelineMoney(value: number) {
  return pipelineMoneyFormatter.format(value);
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
  if (status === "Waiting on Customer") return "Convert or mark lost";
  if (status === "Won") return "View job";
  if (status === "Lost") return "Reopen if needed";
  return "Review";
}

export function EstimateRecordsTable({
  canEdit = true,
  canExport = true,
  data,
  exportSlotId,
}: {
  canEdit?: boolean;
  canExport?: boolean;
  data: EstimateRecordRow[];
  exportSlotId?: string;
}) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "estimateDate", desc: true }]);
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
        canEdit,
        canSelect: canExport,
        onEditEstimate: openEstimateEditor,
      }),
    [canEdit, canExport, openEstimateEditor],
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
    enableRowSelection: canExport,
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
  const pipelineCards = React.useMemo(
    () => [
      {
        action: "Entire pipeline",
        accent: "bg-primary/10 text-primary",
        count: data.length,
        icon: Layers3,
        label: "All estimates",
        mobileLabel: "All",
        status: "all",
        total: pipelineCounts.reduce((sum, stage) => sum + stage.total, 0),
      },
      ...pipelineCounts,
    ],
    [data.length, pipelineCounts],
  );
  const sortValue = React.useMemo(() => {
    const currentSort = sorting[0];

    if (!currentSort) return "newest";
    if (currentSort.id === "estimateDate" && !currentSort.desc) return "oldest";
    if (currentSort.id === "estimateDate" && currentSort.desc) return "newest";
    if (currentSort.id === "estimatedTotal" && !currentSort.desc) return "value-asc";
    if (currentSort.id === "estimatedTotal" && currentSort.desc) return "value-desc";
    if (currentSort.id === "estimateNumber" && !currentSort.desc) return "number-asc";
    if (currentSort.id === "estimateNumber" && currentSort.desc) return "number-desc";
    if (currentSort.id === "customerName" && !currentSort.desc) return "customer-asc";
    if (currentSort.id === "customerName" && currentSort.desc) return "customer-desc";
    if (currentSort.id === "status" && !currentSort.desc) return "status-asc";
    if (currentSort.id === "status" && currentSort.desc) return "status-desc";

    return "newest";
  }, [sorting]);

  function updateSort(value: string) {
    const nextSorting: SortingState =
      value === "oldest"
        ? [{ id: "estimateDate", desc: false }]
        : value === "value-asc"
          ? [{ id: "estimatedTotal", desc: false }]
          : value === "value-desc"
            ? [{ id: "estimatedTotal", desc: true }]
            : value === "number-asc"
              ? [{ id: "estimateNumber", desc: false }]
              : value === "number-desc"
                ? [{ id: "estimateNumber", desc: true }]
                : value === "customer-asc"
                  ? [{ id: "customerName", desc: false }]
                  : value === "customer-desc"
                    ? [{ id: "customerName", desc: true }]
                    : value === "status-asc"
                      ? [{ id: "status", desc: false }]
                      : value === "status-desc"
                        ? [{ id: "status", desc: true }]
                        : [{ id: "estimateDate", desc: true }];

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
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 xl:grid-cols-6">
            {pipelineCards.map((stage) => {
              const isActive = statusFilter === stage.status;
              const StageIcon = stage.icon;

              return (
                <button
                  key={stage.status}
                  type="button"
                  className={cn(
                    "group relative grid min-h-20 content-between gap-1.5 overflow-hidden rounded-lg border bg-card p-2.5 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-28 sm:gap-2 sm:rounded-xl sm:p-3",
                    isActive && "border-primary bg-primary/[0.06] shadow-sm ring-1 ring-primary/15",
                  )}
                  onClick={() => updateStatusFilter(stage.status)}
                  aria-pressed={isActive}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "hidden size-8 shrink-0 items-center justify-center rounded-lg transition-colors sm:flex",
                        isActive ? "bg-primary text-primary-foreground" : stage.accent,
                      )}
                    >
                      <StageIcon className="size-4" />
                    </span>
                    <span className="min-w-0 font-medium text-xs leading-tight sm:hidden">{stage.mobileLabel}</span>
                    <Badge
                      variant={isActive ? "default" : "outline"}
                      className={cn(
                        "gap-1 tabular-nums",
                        !isActive && stage.status !== "all" && estimateStatusClassName(stage.status),
                      )}
                    >
                      {isActive ? <Check className="size-3" /> : null}
                      {stage.count}
                    </Badge>
                  </div>
                  <div className="min-w-0">
                    <span className="hidden font-medium text-sm leading-tight sm:block">{stage.label}</span>
                    <span className="mt-0.5 block font-semibold text-sm tabular-nums tracking-tight sm:mt-1 sm:text-base">
                      {formatPipelineMoney(stage.total)}
                    </span>
                    <span className="mt-1 hidden truncate text-[11px] text-muted-foreground sm:block">
                      {stage.action}
                    </span>
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
            {!exportSlotId && canExport ? exportMenu : null}
            <div className="md:hidden">
              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm" className="md:hidden">
                    <SlidersHorizontal />
                    Filters
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader className="landscape:py-2">
                    <DrawerTitle>Estimate filters</DrawerTitle>
                    <DrawerDescription className="landscape:hidden">
                      Filter and sort the estimates list on mobile.
                    </DrawerDescription>
                  </DrawerHeader>
                  <DrawerBody className="grid gap-4 px-4 pb-1 landscape:gap-3">
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
                  </DrawerBody>
                  <DrawerFooter className="border-t bg-popover pb-[max(1rem,env(safe-area-inset-bottom))] landscape:pt-2 landscape:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
            </div>
          </div>
        </div>
        <div className="hidden w-full min-w-0 max-w-full overflow-hidden md:block [&_th]:top-0">
          <Table className="min-w-[67.5rem] table-fixed">
            <colgroup>
              {table.getVisibleLeafColumns().map((column) => (
                <col key={column.id} style={{ width: desktopColumnWidths[column.id] }} />
              ))}
            </colgroup>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="sticky top-12 z-20 border-b bg-card">
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
              <CardContent className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 overflow-hidden sm:grid-cols-[minmax(0,1fr)_minmax(18rem,1fr)] sm:gap-x-6">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 font-medium font-mono text-muted-foreground text-xs">
                      {estimate.estimateNumber ?? "Not issued"}
                    </div>
                    <div className="line-clamp-2 min-w-0 font-medium text-sm">{estimate.description}</div>
                    <CustomerLink
                      customerId={estimate.customerId}
                      fallback="No customer or lead"
                      name={estimate.customerName ?? estimate.leadName}
                      className="block truncate text-muted-foreground text-sm"
                    />
                    {!estimate.customerEmail ? (
                      <span className="mt-1 flex w-fit items-center gap-1.5 text-amber-700 text-xs dark:text-amber-300">
                        <MailWarning className="size-3 shrink-0" />
                        Email missing
                      </span>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-medium text-sm">{formatMoney(estimate.estimatedTotal)}</span>
                </div>
                <div className="grid min-w-0 gap-2 text-sm sm:row-span-2">
                  <MobileLocationCard address={estimate.serviceLocation} />
                  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3">
                    <span className="text-muted-foreground text-xs">Status</span>
                    <Badge variant="outline" className={`${estimateStatusClassName(estimate.status)} justify-self-end`}>
                      {estimate.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3">
                    <span className="text-muted-foreground text-xs">Next step</span>
                    <span className="min-w-0 break-words text-right">{nextActionLabel(estimate.status)}</span>
                  </div>
                  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3">
                    <span className="text-muted-foreground text-xs">Scheduled date</span>
                    <span className="min-w-0 text-right">
                      {estimate.dateBegin ? new Date(estimate.dateBegin).toLocaleDateString() : "Unscheduled"}
                    </span>
                  </div>
                  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-3">
                    <span className="text-muted-foreground text-xs leading-6">Date</span>
                    <span className="grid min-w-0 justify-items-end text-right">
                      <span>{new Date(estimate.issuedAt ?? estimate.createdAt).toLocaleDateString()}</span>
                      <span className="text-muted-foreground text-xs">{estimate.issuedAt ? "Issued" : "Created"}</span>
                    </span>
                  </div>
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
                    {[20, 30, 40, 50].map((pageSize) => (
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
      {exportSlotId && canExport ? <CsvExportSlot id={exportSlotId}>{exportMenu}</CsvExportSlot> : null}
    </>
  );
}
