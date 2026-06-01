"use client";
"use no memo";

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
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { type CsvColumn, CsvExportMenu, CsvExportSlot } from "@/components/csv-export-menu";
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

import type { CustomerMutationState } from "../../actions";
import { CustomerDueJobsPopover, getCustomerBillingDisplay, getRecentCustomersColumns } from "./columns";
import { CustomerDetailsDialog } from "./customer-details-dialog";
import { DeleteCustomerDialog } from "./delete-customer-dialog";
import { EditCustomerDialog } from "./edit-customer-dialog";
import type { RecentCustomerRow } from "./schema";

const billingOptions = [
  { value: "all", label: "All billing" },
  { value: "outstanding-balance", label: "Outstanding balance" },
  { value: "no-balance", label: "No balance" },
] as const;
const lastScheduledOptions = [
  { value: "all", label: "Any time" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;
const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
] as const;

function shouldIgnoreRowClick(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? !!target.closest("a, button, input, label, select, textarea, [data-row-click-ignore]")
    : false;
}

function formatExportDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : "";
}

function formatCustomerAddress(customer: RecentCustomerRow) {
  const address = customer.addresses?.[0] ?? customer.address;

  if (!address) return "";

  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(", ");
  return [address.line1, address.line2, cityLine, address.country].filter(Boolean).join(", ");
}

const customerExportColumns: CsvColumn<RecentCustomerRow>[] = [
  { header: "Customer name", value: (customer) => customer.name },
  { header: "Email", value: (customer) => customer.email },
  { header: "Phone", value: (customer) => customer.phoneNumbers?.map((phone) => phone.value).join("; ") },
  { header: "Billing status", value: (customer) => customer.billing },
  { header: "Outstanding balance", value: (customer) => customer.outstandingAmount },
  { header: "Job count", value: (customer) => customer.jobCount },
  { header: "Last scheduled job", value: (customer) => formatExportDate(customer.lastScheduledJobDate) },
  { header: "Joined date", value: (customer) => formatExportDate(customer.joined) },
  { header: "Address", value: formatCustomerAddress },
  { header: "Notes", value: (customer) => customer.notes },
];

export function RecentCustomersTable({
  data,
  deleteCustomerAction,
  exportSlotId,
  updateCustomerAction,
}: {
  data: RecentCustomerRow[];
  deleteCustomerAction: (state: CustomerMutationState, formData: FormData) => Promise<CustomerMutationState>;
  exportSlotId?: string;
  updateCustomerAction: (state: CustomerMutationState, formData: FormData) => Promise<CustomerMutationState>;
}) {
  const [customerToDelete, setCustomerToDelete] = React.useState<RecentCustomerRow | null>(null);
  const [customerToEdit, setCustomerToEdit] = React.useState<RecentCustomerRow | null>(null);
  const [selectedCustomer, setSelectedCustomer] = React.useState<RecentCustomerRow | null>(null);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "lastScheduledJobDate", desc: true }]);
  const [columnVisibility] = React.useState<VisibilityState>({
    billingBucket: false,
    search: false,
    lastScheduledWindow: false,
  });
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const columns = React.useMemo(
    () =>
      getRecentCustomersColumns({
        onEditCustomer: setCustomerToEdit,
        onViewCustomer: setSelectedCustomer,
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
  const selectedExportRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original);
  const currentExportRows = table.getPrePaginationRowModel().rows.map((row) => row.original);
  const exportMenu = (
    <CsvExportMenu
      allRows={data}
      columns={customerExportColumns}
      currentRows={currentExportRows}
      filenamePrefix="customers"
      selectedRows={selectedExportRows}
      triggerClassName={exportSlotId ? "hidden w-7 px-0 sm:w-auto sm:px-2.5 md:flex" : undefined}
    />
  );
  const billingFilter = (table.getColumn("billingBucket")?.getFilterValue() as string) ?? "all";
  const lastScheduledFilter = (table.getColumn("lastScheduledWindow")?.getFilterValue() as string) ?? "all";
  const sortValue = React.useMemo(() => {
    const currentSort = sorting[0];

    if (!currentSort) return "newest";
    if (currentSort.id === "lastScheduledJobDate" && currentSort.desc) return "newest";
    if (currentSort.id === "lastScheduledJobDate" && !currentSort.desc) return "oldest";
    if (currentSort.id === "name" && !currentSort.desc) return "name-asc";
    if (currentSort.id === "name" && currentSort.desc) return "name-desc";

    return "newest";
  }, [sorting]);

  return (
    <>
      <DeleteCustomerDialog
        key={customerToDelete?.id ?? "delete-customer"}
        action={deleteCustomerAction}
        customer={customerToDelete}
        open={!!customerToDelete}
        onOpenChange={(open) => {
          if (!open) setCustomerToDelete(null);
        }}
      />
      <EditCustomerDialog
        key={customerToEdit?.id ?? "edit-customer"}
        action={updateCustomerAction}
        customer={customerToEdit}
        onDeleteCustomer={setCustomerToDelete}
        open={!!customerToEdit}
        onOpenChange={(open) => {
          if (!open) setCustomerToEdit(null);
        }}
      />
      <CustomerDetailsDialog
        customer={selectedCustomer}
        onEditCustomer={(customer) => {
          setSelectedCustomer(null);
          setCustomerToEdit(customer);
        }}
        open={!!selectedCustomer}
        onOpenChange={(open) => {
          if (!open) setSelectedCustomer(null);
        }}
      />
      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
                placeholder="Search customers..."
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
                    <DrawerTitle>Customer filters</DrawerTitle>
                    <DrawerDescription>Filter and sort the customer list on mobile.</DrawerDescription>
                  </DrawerHeader>
                  <div className="grid gap-4 px-4">
                    <div className="grid gap-2">
                      <Label htmlFor="customers-mobile-last-scheduled">Last scheduled job</Label>
                      <Select
                        value={lastScheduledFilter}
                        onValueChange={(value) => {
                          table.getColumn("lastScheduledWindow")?.setFilterValue(value === "all" ? undefined : value);
                          table.setPageIndex(0);
                        }}
                      >
                        <SelectTrigger id="customers-mobile-last-scheduled" className="w-full">
                          <SelectValue placeholder="Last scheduled job" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {lastScheduledOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="customers-mobile-billing">Billing</Label>
                      <Select
                        value={billingFilter}
                        onValueChange={(value) => {
                          table.getColumn("billingBucket")?.setFilterValue(value === "all" ? undefined : value);
                          table.setPageIndex(0);
                        }}
                      >
                        <SelectTrigger id="customers-mobile-billing" className="w-full">
                          <SelectValue placeholder="Billing" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {billingOptions.map((billing) => (
                              <SelectItem key={billing.value} value={billing.value}>
                                {billing.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="customers-mobile-sort">Sort</Label>
                      <Select
                        value={sortValue}
                        onValueChange={(value) => {
                          const nextSorting: SortingState =
                            value === "oldest"
                              ? [{ id: "lastScheduledJobDate", desc: false }]
                              : value === "name-asc"
                                ? [{ id: "name", desc: false }]
                                : value === "name-desc"
                                  ? [{ id: "name", desc: true }]
                                  : [{ id: "lastScheduledJobDate", desc: true }];

                          table.setSorting(nextSorting);
                          table.setPageIndex(0);
                        }}
                      >
                        <SelectTrigger id="customers-mobile-sort" className="w-full">
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
                    <CalendarDays />
                    Last scheduled
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40" align="start">
                  <DropdownMenuRadioGroup
                    value={lastScheduledFilter}
                    onValueChange={(value) => {
                      table.getColumn("lastScheduledWindow")?.setFilterValue(value === "all" ? undefined : value);
                      table.setPageIndex(0);
                    }}
                  >
                    {lastScheduledOptions.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CreditCard />
                    Billing
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup
                    value={billingFilter}
                    onValueChange={(value) => {
                      table.getColumn("billingBucket")?.setFilterValue(value === "all" ? undefined : value);
                      table.setPageIndex(0);
                    }}
                  >
                    {billingOptions.map((billing) => (
                      <DropdownMenuRadioItem key={billing.value} value={billing.value}>
                        {billing.label}
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
                  <DropdownMenuRadioGroup
                    value={sortValue}
                    onValueChange={(value) => {
                      const nextSorting: SortingState =
                        value === "oldest"
                          ? [{ id: "lastScheduledJobDate", desc: false }]
                          : value === "name-asc"
                            ? [{ id: "name", desc: false }]
                            : value === "name-desc"
                              ? [{ id: "name", desc: true }]
                              : [{ id: "lastScheduledJobDate", desc: true }];

                      table.setSorting(nextSorting);
                      table.setPageIndex(0);
                    }}
                  >
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

        <div className="grid gap-3 md:hidden">
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => {
              const billingDisplay = getCustomerBillingDisplay(row.original);

              return (
                <Card
                  key={row.id}
                  size="sm"
                  className="cursor-pointer gap-0 transition-colors hover:bg-muted/40"
                  role="link"
                  tabIndex={0}
                  onClick={(event) => {
                    if (shouldIgnoreRowClick(event.target)) return;
                    setSelectedCustomer(row.original);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setSelectedCustomer(row.original);
                  }}
                >
                  <CardContent className="grid gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-sm">{row.original.name}</div>
                        <div className="truncate text-muted-foreground text-sm">{row.original.email}</div>
                      </div>
                      <span
                        className={
                          billingDisplay.tone === "settled"
                            ? "shrink-0 font-medium text-emerald-700 text-sm dark:text-emerald-400"
                            : "shrink-0 font-medium text-rose-700 text-sm dark:text-rose-400"
                        }
                      >
                        {billingDisplay.amountLabel}
                      </span>
                    </div>
                    <div className="grid gap-1 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground text-xs">Billing</span>
                        <span className="text-right">{billingDisplay.detail}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground text-xs">Last scheduled</span>
                        <span>
                          {row.original.lastScheduledJobDate
                            ? new Date(row.original.lastScheduledJobDate).toLocaleDateString()
                            : "No jobs yet"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground text-xs">Jobs</span>
                        <span>{row.original.jobCount === 1 ? "1 job" : `${row.original.jobCount} jobs`}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground text-xs">Phone</span>
                        <span className="truncate">{row.original.phoneNumbers?.[0]?.value ?? "Not on file"}</span>
                      </div>
                    </div>
                    {row.original.unpaidJobs?.length ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CustomerDueJobsPopover customer={row.original} />
                      </div>
                    ) : null}
                    <div className="flex items-center justify-end">
                      <span className="text-muted-foreground text-sm">Open customer</span>
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
                    className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    tabIndex={0}
                    role="button"
                    aria-label={`View ${row.original.name} details`}
                    onClick={(event) => {
                      if (shouldIgnoreRowClick(event.target)) return;
                      setSelectedCustomer(row.original);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      if (shouldIgnoreRowClick(event.target)) return;

                      event.preventDefault();
                      setSelectedCustomer(row.original);
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
              <Label htmlFor="recent-customers-rows-per-page" className="font-medium text-sm">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger size="sm" className="w-20" id="recent-customers-rows-per-page">
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
      {exportSlotId ? <CsvExportSlot id={exportSlotId}>{exportMenu}</CsvExportSlot> : null}
    </>
  );
}
