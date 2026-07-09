"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  PackageCheck,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { type CsvColumn, CsvExportMenu, CsvExportSlot } from "@/components/csv-export-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";

import { updateOrderStatusesAction } from "../actions";

export type OrderPaymentStatus = "Paid" | "Pending";
export type OrderFulfillmentStatus = "Fulfilled" | "Unfulfilled";

export type OrderTableItem = {
  customerName: string;
  fulfillmentStatus: OrderFulfillmentStatus;
  id: string;
  itemCount: number;
  orderNumber: string;
  orderedAt: string;
  paymentStatus: OrderPaymentStatus;
  returnRefundAmount?: number | null;
  returnRefundStatus?: string | null;
  returnNumber?: string | null;
  total: number;
};

type OrderFilter = "all" | "needs-action" | "returns" | "unfulfilled" | "unpaid";
type OrderSort = "newest" | "oldest" | "total-asc" | "total-desc";

const filterOptions: Array<{ label: string; value: OrderFilter }> = [
  { value: "all", label: "All" },
  { value: "needs-action", label: "Needs action" },
  { value: "unfulfilled", label: "Unfulfilled" },
  { value: "unpaid", label: "Unpaid" },
  { value: "returns", label: "Returns" },
];

const sortOptions: Array<{ label: string; value: OrderSort }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "total-asc", label: "Total low-high" },
  { value: "total-desc", label: "Total high-low" },
];

const orderExportColumns: CsvColumn<OrderTableItem>[] = [
  { header: "Order", value: (order) => order.orderNumber },
  { header: "Customer", value: (order) => order.customerName },
  { header: "Payment status", value: (order) => order.paymentStatus },
  { header: "Fulfillment status", value: (order) => order.fulfillmentStatus },
  { header: "Items", value: (order) => order.itemCount },
  { header: "Total", value: (order) => order.total.toFixed(2) },
  { header: "Date", value: (order) => formatOrderDate(order.orderedAt) },
];

function formatOrderDate(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getPaymentStatusClassName(status: OrderPaymentStatus) {
  if (status === "Paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getFulfillmentStatusClassName(status: OrderFulfillmentStatus) {
  if (status === "Fulfilled") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-red-100 bg-red-50 text-red-600";
}

function getDotClassName(status: OrderPaymentStatus | OrderFulfillmentStatus) {
  if (status === "Paid" || status === "Fulfilled") return "bg-emerald-600";
  if (status === "Pending") return "bg-amber-600";
  return "bg-red-600";
}

function OrderStatusBadge({
  status,
  type,
}: {
  status: OrderFulfillmentStatus | OrderPaymentStatus;
  type: "fulfillment" | "payment";
}) {
  const className =
    type === "payment"
      ? getPaymentStatusClassName(status as OrderPaymentStatus)
      : getFulfillmentStatusClassName(status as OrderFulfillmentStatus);

  return (
    <Badge variant="outline" className={cn("gap-1.5 px-2", className)}>
      <span className={cn("size-1.5 rounded-full", getDotClassName(status))} />
      {status}
    </Badge>
  );
}

function getReturnBadgeLabel(order: OrderTableItem) {
  if (!order.returnNumber) return null;
  if (order.returnRefundStatus === "Full Refund") return "Refunded";
  if (order.returnRefundStatus === "Partial Refund") return "Partial refund";
  if (order.returnRefundStatus === "No Refund" || order.returnRefundAmount === 0) return "Return on file";
  return "Return on file";
}

function ReturnBadge({ order }: { order: OrderTableItem }) {
  const label = getReturnBadgeLabel(order);

  if (!label) return null;

  return (
    <Badge variant="outline" className="mt-1 border-sky-200 bg-sky-50 text-sky-700">
      {label} · {order.returnNumber}
    </Badge>
  );
}

function RefundAmountText({ order }: { order: OrderTableItem }) {
  if (!order.returnRefundAmount || order.returnRefundAmount <= 0) return null;

  return (
    <div className="font-normal text-destructive text-xs tabular-nums">
      Refunded {formatCurrency(order.returnRefundAmount)}
    </div>
  );
}

function matchesFilter(order: OrderTableItem, filter: OrderFilter) {
  if (filter === "needs-action") return order.paymentStatus === "Pending" || order.fulfillmentStatus === "Unfulfilled";
  if (filter === "returns") return Boolean(order.returnNumber);
  if (filter === "unfulfilled") return order.fulfillmentStatus === "Unfulfilled";
  if (filter === "unpaid") return order.paymentStatus === "Pending";
  return true;
}

function getSearchText(order: OrderTableItem) {
  return [
    order.orderNumber,
    order.customerName,
    order.paymentStatus,
    order.fulfillmentStatus,
    order.returnNumber,
    order.returnRefundStatus,
    getReturnBadgeLabel(order),
    formatCurrency(order.total),
    formatOrderDate(order.orderedAt),
  ]
    .join(" ")
    .toLowerCase();
}

function shouldIgnoreRowClick(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? !!target.closest("a, button, input, label, select, textarea, [data-row-click-ignore]")
    : false;
}

function OrderActions({ order }: { order: OrderTableItem }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const returnHref = `/dashboard/orders/${order.id}/return`;

  function updateStatus(statuses: Parameters<typeof updateOrderStatusesAction>[1], successMessage: string) {
    startTransition(async () => {
      try {
        const result = await updateOrderStatusesAction(order.id, statuses);
        toast.success(result.message || successMessage);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Order could not be updated.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Open ${order.orderNumber} actions`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44" data-row-click-ignore>
        <DropdownMenuItem
          disabled={isPending || order.fulfillmentStatus === "Fulfilled"}
          onSelect={() => updateStatus({ fulfillmentStatus: "Fulfilled" }, "Order marked fulfilled.")}
        >
          <PackageCheck className="size-4" />
          Mark fulfilled
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(returnHref)}>
          <RotateCcw className="size-4" />
          {order.returnNumber ? "View return/refund" : "Start return/refund"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileOrderCard({ onOpen, order }: { onOpen: () => void; order: OrderTableItem }) {
  return (
    <div className="relative overflow-hidden rounded-lg border bg-card">
      <button type="button" className="grid w-full gap-3 p-4 text-left hover:bg-muted/35" onClick={onOpen}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 pr-10">
          <div className="min-w-0">
            <div className="font-medium text-sm">{order.orderNumber}</div>
            <div className="text-muted-foreground text-xs">
              {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
            </div>
            <ReturnBadge order={order} />
          </div>
          <div className="grid gap-0.5 text-right">
            <div className="text-muted-foreground text-xs">Total</div>
            <div className="font-medium text-sm tabular-nums">{formatCurrency(order.total)}</div>
            <RefundAmountText order={order} />
          </div>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Customer</div>
            <div className="truncate">{order.customerName}</div>
          </div>
          <div className="text-right text-muted-foreground text-xs">{formatOrderDate(order.orderedAt)}</div>
          <div className="flex flex-wrap gap-2">
            <OrderStatusBadge status={order.paymentStatus} type="payment" />
            <OrderStatusBadge status={order.fulfillmentStatus} type="fulfillment" />
          </div>
          <div className="self-end text-right text-muted-foreground text-sm">Open order</div>
        </div>
      </button>
      <div className="absolute top-3 right-3">
        <OrderActions order={order} />
      </div>
    </div>
  );
}

export function OrdersTable({ exportSlotId, orders }: { exportSlotId?: string; orders: OrderTableItem[] }) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = React.useState<OrderFilter>("all");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortValue, setSortValue] = React.useState<OrderSort>("newest");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredOrders = React.useMemo(() => {
    const visibleOrders = orders
      .filter((order) => matchesFilter(order, activeFilter))
      .filter((order) => (normalizedQuery ? getSearchText(order).includes(normalizedQuery) : true));

    return [...visibleOrders].sort((left, right) => {
      const leftTime = new Date(left.orderedAt).getTime();
      const rightTime = new Date(right.orderedAt).getTime();

      if (sortValue === "oldest") return leftTime - rightTime;
      if (sortValue === "total-asc") return left.total - right.total;
      if (sortValue === "total-desc") return right.total - left.total;
      return rightTime - leftTime;
    });
  }, [activeFilter, normalizedQuery, orders, sortValue]);
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const paginatedOrders = filteredOrders.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize);
  const selectedOrders = orders.filter((order) => selectedIds.has(order.id));
  const allVisibleSelected = paginatedOrders.length > 0 && paginatedOrders.every((order) => selectedIds.has(order.id));
  const someVisibleSelected = paginatedOrders.some((order) => selectedIds.has(order.id));
  const exportMenu = (
    <CsvExportMenu
      allRows={orders}
      columns={orderExportColumns}
      currentRows={filteredOrders}
      filenamePrefix="orders"
      selectedRows={selectedOrders}
      triggerClassName={exportSlotId ? "hidden w-7 px-0 sm:w-auto sm:px-2.5 md:flex" : undefined}
    />
  );

  function toggleOrder(orderId: string, checked: boolean) {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (checked) nextIds.add(orderId);
      else nextIds.delete(orderId);

      return nextIds;
    });
  }

  function toggleVisibleOrders(checked: boolean) {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);

      for (const order of paginatedOrders) {
        if (checked) nextIds.add(order.id);
        else nextIds.delete(order.id);
      }

      return nextIds;
    });
  }

  function openOrder(order: OrderTableItem) {
    router.push(`/dashboard/orders/${order.id}/edit`);
  }

  function prefetchOrder(order: OrderTableItem) {
    router.prefetch(`/dashboard/orders/${order.id}/edit`);
  }

  function clearFilters() {
    setActiveFilter("all");
    setPageIndex(0);
    setSearchQuery("");
    setSortValue("newest");
  }

  function updateFilter(value: OrderFilter) {
    setActiveFilter(value);
    setPageIndex(0);
  }

  function updateSearch(value: string) {
    setSearchQuery(value);
    setPageIndex(0);
  }

  function updateSort(value: OrderSort) {
    setSortValue(value);
    setPageIndex(0);
  }

  const hasFilters = activeFilter !== "all" || Boolean(normalizedQuery) || sortValue !== "newest";
  const canPreviousPage = safePageIndex > 0;
  const canNextPage = safePageIndex < pageCount - 1;
  const pageStart = filteredOrders.length ? safePageIndex * pageSize + 1 : 0;
  const pageEnd = Math.min(filteredOrders.length, safePageIndex * pageSize + paginatedOrders.length);

  React.useEffect(() => {
    if (pageIndex > pageCount - 1) setPageIndex(pageCount - 1);
  }, [pageCount, pageIndex]);

  return (
    <>
      {exportSlotId ? <CsvExportSlot id={exportSlotId}>{exportMenu}</CsvExportSlot> : null}
      <div className="grid gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
                value={searchQuery}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search orders..."
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
                    <DrawerTitle>Order filters</DrawerTitle>
                    <DrawerDescription>Filter and sort the orders list on mobile.</DrawerDescription>
                  </DrawerHeader>
                  <div className="grid gap-4 px-4">
                    <div className="grid gap-2">
                      <Label htmlFor="orders-mobile-status">Status</Label>
                      <Select value={activeFilter} onValueChange={(value) => updateFilter(value as OrderFilter)}>
                        <SelectTrigger id="orders-mobile-status" className="w-full">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {filterOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="orders-mobile-sort">Sort</Label>
                      <Select value={sortValue} onValueChange={(value) => updateSort(value as OrderSort)}>
                        <SelectTrigger id="orders-mobile-sort" className="w-full">
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
                    <PackageCheck />
                    Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup
                    value={activeFilter}
                    onValueChange={(value) => updateFilter(value as OrderFilter)}
                  >
                    {filterOptions.map((option) => (
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
                    <ArrowUpDown />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={sortValue} onValueChange={(value) => updateSort(value as OrderSort)}>
                    {sortOptions.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {hasFilters && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <X />
                Reset
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">{exportSlotId ? null : exportMenu}</div>
        </div>

        <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
          <Table>
            <TableHeader className="bg-muted/15">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected || (someVisibleSelected ? "indeterminate" : false)}
                    aria-label="Select all visible orders"
                    onCheckedChange={(value) => toggleVisibleOrders(value === true)}
                  />
                </TableHead>
                <TableHead className="w-[8rem] text-foreground">Order</TableHead>
                <TableHead className="min-w-[10rem] text-foreground">Customer</TableHead>
                <TableHead className="min-w-[14rem] text-foreground">Status</TableHead>
                <TableHead className="w-[8rem] text-foreground">Total</TableHead>
                <TableHead className="w-[13rem] text-foreground">Date</TableHead>
                <TableHead className="w-20 text-right text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOrders.length ? (
                paginatedOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      if (shouldIgnoreRowClick(event.target)) return;
                      openOrder(order);
                    }}
                    onFocus={() => prefetchOrder(order)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      if (shouldIgnoreRowClick(event.target)) return;
                      event.preventDefault();
                      openOrder(order);
                    }}
                    onMouseEnter={() => prefetchOrder(order)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(order.id)}
                        aria-label={`Select ${order.orderNumber}`}
                        data-row-click-ignore
                        onCheckedChange={(value) => toggleOrder(order.id, value === true)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.orderNumber}</div>
                      <div className="text-muted-foreground text-xs">
                        {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                      </div>
                      <ReturnBadge order={order} />
                    </TableCell>
                    <TableCell>
                      <div>{order.customerName}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <OrderStatusBadge status={order.paymentStatus} type="payment" />
                        <OrderStatusBadge status={order.fulfillmentStatus} type="fulfillment" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium tabular-nums">{formatCurrency(order.total)}</div>
                      <RefundAmountText order={order} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatOrderDate(order.orderedAt)}</TableCell>
                    <TableCell className="text-right">
                      <OrderActions order={order} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No orders found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 md:hidden">
          {filteredOrders.length ? (
            paginatedOrders.map((order) => (
              <MobileOrderCard key={order.id} order={order} onOpen={() => openOrder(order)} />
            ))
          ) : (
            <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm">No orders found.</div>
          )}
        </div>

        <div className="text-muted-foreground text-sm">
          Showing {pageStart}-{pageEnd} of {filteredOrders.length} filtered orders.
        </div>

        <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden flex-1 text-muted-foreground text-sm lg:flex">
            {selectedIds.size} of {filteredOrders.length} row(s) selected.
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="orders-rows-per-page" className="font-medium text-sm">
                Rows per page
              </Label>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPageIndex(0);
                }}
              >
                <SelectTrigger size="sm" className="w-20" id="orders-rows-per-page">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectGroup>
                    {[10, 20, 30, 40, 50].map((size) => (
                      <SelectItem key={size} value={`${size}`}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-center font-medium text-sm sm:w-fit">
              Page {safePageIndex + 1} of {pageCount}
            </div>
            <div className="flex items-center justify-center gap-2 sm:ml-auto lg:ml-0">
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => setPageIndex(0)}
                disabled={!canPreviousPage}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => setPageIndex((currentPage) => Math.max(0, currentPage - 1))}
                disabled={!canPreviousPage}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => setPageIndex((currentPage) => Math.min(pageCount - 1, currentPage + 1))}
                disabled={!canNextPage}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => setPageIndex(pageCount - 1)}
                disabled={!canNextPage}
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
