"use client";

import * as React from "react";

import {
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
import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWorkspaceRouter as useRouter } from "@/components/workspace-path-provider";
import { cn, formatCurrency } from "@/lib/utils";

import { updateOrderStatusesAction } from "../actions";

export type OrderPaymentStatus = import("../create/_components/data").OrderPaymentStatus;
export type OrderFulfillmentStatus = import("../create/_components/data").OrderFulfillmentStatus;

export type OrderTableItem = {
  version: number;
  orderStatus: string;
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
type OrderSort =
  | "customer-asc"
  | "customer-desc"
  | "newest"
  | "oldest"
  | "order-asc"
  | "order-desc"
  | "status-asc"
  | "status-desc"
  | "total-asc"
  | "total-desc";

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
  { value: "order-asc", label: "Order number A-Z" },
  { value: "order-desc", label: "Order number Z-A" },
  { value: "customer-asc", label: "Customer A-Z" },
  { value: "customer-desc", label: "Customer Z-A" },
  { value: "status-asc", label: "Status A-Z" },
  { value: "status-desc", label: "Status Z-A" },
];

function orderSortDirection(sortValue: OrderSort, ascending: OrderSort, descending: OrderSort): TableSortDirection {
  if (sortValue === ascending) return "asc";
  if (sortValue === descending) return "desc";
  return false;
}

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
  if (order.orderStatus === "Cancelled") return "Cancelled";
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
    <Badge variant="outline" className="mt-1 max-w-full border-sky-200 bg-sky-50 text-sky-700">
      <span className="min-w-0 truncate">
        {label} · {order.returnNumber}
      </span>
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
  if (filter === "all") return true;
  if (order.orderStatus !== "Active") return false;
  const unpaid = order.paymentStatus === "Pending" || order.paymentStatus === "Partially Paid";
  const unfulfilled = order.fulfillmentStatus !== "Fulfilled";
  if (filter === "needs-action") return unpaid || unfulfilled;
  if (filter === "returns") return Boolean(order.returnNumber);
  if (filter === "unfulfilled") return unfulfilled;
  if (filter === "unpaid") return unpaid;
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

function OrderActions({
  canManageReturns,
  canUpdate,
  order,
}: {
  canManageReturns: boolean;
  canUpdate: boolean;
  order: OrderTableItem;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const returnHref = `/dashboard/orders/${order.id}/return`;

  function updateStatus(statuses: Parameters<typeof updateOrderStatusesAction>[1], successMessage: string) {
    startTransition(async () => {
      try {
        const result = await updateOrderStatusesAction(order.id, statuses, order.version);
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
          disabled={
            !canUpdate || isPending || order.orderStatus !== "Active" || order.fulfillmentStatus === "Fulfilled"
          }
          onSelect={() => updateStatus({ fulfillmentStatus: "Fulfilled" }, "Order marked fulfilled.")}
        >
          <PackageCheck className="size-4" />
          Mark fulfilled{canUpdate ? "" : " (unavailable)"}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canManageReturns} onSelect={() => router.push(returnHref)}>
          <RotateCcw className="size-4" />
          {order.returnNumber ? "View return/refund" : "Start return/refund"}
          {canManageReturns ? "" : " (unavailable)"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileOrderCard({
  canManageReturns,
  canUpdate,
  onOpen,
  order,
}: {
  canManageReturns: boolean;
  canUpdate: boolean;
  onOpen: () => void;
  order: OrderTableItem;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden p-4 text-left hover:bg-muted/35 sm:grid-cols-[minmax(0,1fr)_minmax(18rem,1fr)] sm:gap-x-6"
        onClick={onOpen}
      >
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 pr-10">
          <div className="min-w-0">
            <div className="font-medium text-sm">{order.orderNumber}</div>
            <div className="text-muted-foreground text-xs">
              {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
            </div>
          </div>
          <div className="grid shrink-0 gap-0.5 text-right">
            <div className="text-muted-foreground text-xs">Total</div>
            <div className="font-medium text-sm tabular-nums">{formatCurrency(order.total)}</div>
            <RefundAmountText order={order} />
          </div>
        </div>
        <ReturnBadge order={order} />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-3 text-sm sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:border-l sm:pl-6">
          <div className="min-w-0">
            <div className="text-muted-foreground text-xs">Customer</div>
            <div className="truncate">{order.customerName}</div>
          </div>
          <div className="shrink-0 text-right text-muted-foreground text-xs">{formatOrderDate(order.orderedAt)}</div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <OrderStatusBadge status={order.paymentStatus} type="payment" />
            <OrderStatusBadge status={order.fulfillmentStatus} type="fulfillment" />
          </div>
          <div className="self-end text-right text-muted-foreground text-sm">Open order</div>
        </div>
      </button>
      <div className="absolute top-3 right-3">
        <OrderActions canManageReturns={canManageReturns} canUpdate={canUpdate} order={order} />
      </div>
    </div>
  );
}

export function OrdersTable({
  canExport = true,
  canManageReturns = true,
  canUpdate = true,
  exportSlotId,
  orders,
}: {
  canExport?: boolean;
  canManageReturns?: boolean;
  canUpdate?: boolean;
  exportSlotId?: string;
  orders: OrderTableItem[];
}) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = React.useState<OrderFilter>("all");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
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
      if (sortValue === "order-asc")
        return left.orderNumber.localeCompare(right.orderNumber, undefined, { numeric: true });
      if (sortValue === "order-desc")
        return right.orderNumber.localeCompare(left.orderNumber, undefined, { numeric: true });
      if (sortValue === "customer-asc") return left.customerName.localeCompare(right.customerName);
      if (sortValue === "customer-desc") return right.customerName.localeCompare(left.customerName);
      if (sortValue === "status-asc") {
        return `${left.paymentStatus} ${left.fulfillmentStatus}`.localeCompare(
          `${right.paymentStatus} ${right.fulfillmentStatus}`,
        );
      }
      if (sortValue === "status-desc") {
        return `${right.paymentStatus} ${right.fulfillmentStatus}`.localeCompare(
          `${left.paymentStatus} ${left.fulfillmentStatus}`,
        );
      }
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
      {exportSlotId && canExport ? <CsvExportSlot id={exportSlotId}>{exportMenu}</CsvExportSlot> : null}
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
                  <Button variant="outline" size="sm" className="md:hidden">
                    <SlidersHorizontal />
                    Filters
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader className="landscape:py-2">
                    <DrawerTitle>Order filters</DrawerTitle>
                    <DrawerDescription className="landscape:hidden">
                      Filter and sort the orders list on mobile.
                    </DrawerDescription>
                  </DrawerHeader>
                  <DrawerBody className="grid gap-4 px-4 pb-1 landscape:gap-3">
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
            </div>
            {hasFilters && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <X />
                Reset
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">{!exportSlotId && canExport ? exportMenu : null}</div>
        </div>

        <div className="hidden w-full min-w-0 max-w-full overflow-hidden md:block [&_th]:top-0">
          <Table className="min-w-[60.5rem] table-fixed">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
              <col className="w-[24%]" />
              <col className="w-[14%]" />
              <col className="w-[24%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky top-12 z-20 w-10 border-b bg-card">
                  <Checkbox
                    checked={allVisibleSelected || (someVisibleSelected ? "indeterminate" : false)}
                    aria-label="Select all visible orders"
                    onCheckedChange={(value) => toggleVisibleOrders(value === true)}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 w-[8rem] border-b bg-card">
                  <SortableTableHeader
                    direction={orderSortDirection(sortValue, "order-asc", "order-desc")}
                    label="Order"
                    onSort={() => updateSort(sortValue === "order-asc" ? "order-desc" : "order-asc")}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 min-w-[10rem] border-b bg-card">
                  <SortableTableHeader
                    direction={orderSortDirection(sortValue, "customer-asc", "customer-desc")}
                    label="Customer"
                    onSort={() => updateSort(sortValue === "customer-asc" ? "customer-desc" : "customer-asc")}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 min-w-[14rem] border-b bg-card">
                  <SortableTableHeader
                    direction={orderSortDirection(sortValue, "status-asc", "status-desc")}
                    label="Status"
                    onSort={() => updateSort(sortValue === "status-asc" ? "status-desc" : "status-asc")}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 w-[8rem] border-b bg-card">
                  <SortableTableHeader
                    direction={orderSortDirection(sortValue, "total-asc", "total-desc")}
                    label="Total"
                    onSort={() => updateSort(sortValue === "total-asc" ? "total-desc" : "total-asc")}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 w-[13rem] border-b bg-card">
                  <SortableTableHeader
                    direction={orderSortDirection(sortValue, "oldest", "newest")}
                    label="Date"
                    onSort={() => updateSort(sortValue === "oldest" ? "newest" : "oldest")}
                  />
                </TableHead>
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
                    <TableCell>
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate text-muted-foreground">{formatOrderDate(order.orderedAt)}</span>
                        <OrderActions canManageReturns={canManageReturns} canUpdate={canUpdate} order={order} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
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
              <MobileOrderCard
                key={order.id}
                canManageReturns={canManageReturns}
                canUpdate={canUpdate}
                order={order}
                onOpen={() => openOrder(order)}
              />
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
                    {[20, 30, 40, 50].map((size) => (
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
