"use client";

import * as React from "react";

import {
  ArrowDownUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleAlert,
  Layers3,
  MoreHorizontal,
  PackageCheck,
  RotateCcw,
  Search,
  X,
  XCircle,
} from "lucide-react";

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCommerceSearch } from "@/components/use-commerce-search";
import { useWorkspaceRouter as useRouter } from "@/components/workspace-path-provider";
import { formatCalendarDate } from "@/lib/business-time";
import type { OrderListSummary } from "@/lib/commerce/order-list-summary";
import { getOrderDisplayStatuses } from "@/lib/commerce/order-resolution";
import { cn, formatCurrency } from "@/lib/utils";

import { FulfillmentWizard } from "./fulfillment-wizard";

export type OrderPaymentStatus = import("../create/_components/data").OrderPaymentStatus;
export type OrderFulfillmentStatus = import("../create/_components/data").OrderFulfillmentStatus;

export type OrderTableItem = {
  summary?: OrderListSummary;
  version: number;
  orderStatus: string;
  customerName: string;
  fulfillmentStatus: OrderFulfillmentStatus;
  id: string;
  itemCount: number;
  primaryProduct?: string | null;
  fulfillmentItems?: Array<{ id: string; product: string; remaining: number }>;
  orderNumber: string;
  orderedAt: string;
  paymentStatus: OrderPaymentStatus;
  returnRefundAmount?: number | null;
  returnRefundStatus?: string | null;
  returnNumber?: string | null;
  originalValue: number;
  discounts: number;
  collected: number;
  creditOwed: number;
  nextAction: "Cancelled" | "Refund customer" | "Collect payment" | "Complete refund" | "Fulfill items" | "Complete";
  total: number;
};

type OrderFilter = "all" | "needs-action" | "fulfillment" | "returns" | "completed" | "cancelled";
type OrderSort =
  | "customer-asc"
  | "customer-desc"
  | "collected-asc"
  | "collected-desc"
  | "discounts-asc"
  | "discounts-desc"
  | "newest"
  | "oldest"
  | "order-asc"
  | "order-desc"
  | "status-asc"
  | "status-desc"
  | "total-asc"
  | "total-desc";

const filterOptions = [
  {
    value: "all",
    label: "All orders",
    action: "All order activity",
    icon: Layers3,
    accent: "bg-primary/10 text-primary",
  },
  {
    value: "needs-action",
    label: "Needs attention",
    action: "Action outstanding",
    icon: CircleAlert,
    accent: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  {
    value: "fulfillment",
    label: "Awaiting fulfillment",
    action: "Items still to fulfill",
    icon: PackageCheck,
    accent: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    value: "returns",
    label: "Returns & refunds",
    action: "Orders with resolutions",
    icon: RotateCcw,
    accent: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  {
    value: "completed",
    label: "Completed",
    action: "Nothing outstanding",
    icon: CheckCircle2,
    accent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  {
    value: "cancelled",
    label: "Cancelled",
    action: "Fully cancelled orders",
    icon: XCircle,
    accent: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
] as const satisfies ReadonlyArray<{
  value: OrderFilter;
  label: string;
  action: string;
  icon: typeof Layers3;
  accent: string;
}>;

const sortOptions: Array<{ label: string; value: OrderSort }> = [
  { value: "customer-asc", label: "Customer A-Z" },
  { value: "customer-desc", label: "Customer Z-A" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "total-asc", label: "Value low-high" },
  { value: "total-desc", label: "Value high-low" },
  { value: "discounts-asc", label: "Discounts low-high" },
  { value: "discounts-desc", label: "Discounts high-low" },
  { value: "collected-asc", label: "Collected low-high" },
  { value: "collected-desc", label: "Collected high-low" },
  { value: "order-asc", label: "Order number A-Z" },
  { value: "order-desc", label: "Order number Z-A" },
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
  { header: "Product", value: (order) => order.primaryProduct ?? "" },
  { header: "Payment status", value: (order) => order.paymentStatus },
  { header: "Fulfillment status", value: (order) => order.fulfillmentStatus },
  { header: "Items", value: (order) => order.itemCount },
  { header: "Units ordered", value: (order) => order.summary?.orderedUnits ?? "" },
  { header: "Units fulfilled", value: (order) => order.summary?.fulfilledUnits ?? "" },
  { header: "Units cancelled", value: (order) => order.summary?.cancelledUnits ?? "" },
  { header: "Units returned", value: (order) => order.summary?.returnedUnits ?? "" },
  { header: "Refund due", value: (order) => (order.summary?.refundDue ?? order.creditOwed).toFixed(2) },
  { header: "Refunded", value: (order) => (order.summary?.refunded ?? 0).toFixed(2) },
  { header: "Resolution count", value: (order) => order.summary?.resolutionCount ?? "" },
  { header: "Stock hold expires", value: (order) => order.summary?.reservationExpiresAt ?? "" },
  { header: "Total", value: (order) => order.originalValue.toFixed(2) },
  { header: "Balance", value: (order) => order.discounts.toFixed(2) },
  { header: "Net paid", value: (order) => order.collected.toFixed(2) },
  { header: "Next action", value: (order) => order.nextAction },
  { header: "Date", value: (order) => formatOrderDate(order.orderedAt) },
];

function formatOrderDate(value: string) {
  return formatCalendarDate(value);
}

function getPaymentStatusClassName(status: string) {
  if (status === "No payment required") return "border-slate-200 bg-slate-50 text-slate-600";
  if (status === "Paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Refunded" || status === "Partially Refunded") return "border-violet-200 bg-violet-50 text-violet-700";
  if (status === "Partially Paid") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getFulfillmentStatusClassName(status: string) {
  if (status === "Fulfilled") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Partially Fulfilled") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "Cancelled") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "Resolved") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getDotClassName(status: string) {
  if (status === "Paid" || status === "Fulfilled") return "bg-emerald-600";
  if (status === "Refunded" || status === "Partially Refunded") return "bg-violet-600";
  if (status === "Partially Paid" || status === "Partially Fulfilled") return "bg-sky-600";
  if (status === "Cancelled") return "bg-rose-600";
  if (status === "Resolved" || status === "No payment required") return "bg-slate-500";
  return "bg-amber-600";
}

function OrderStatusBadge({ status, type }: { status: string; type: "fulfillment" | "payment" }) {
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

function OrderResolutionBadges({ order }: { order: OrderTableItem }) {
  const summary = order.summary;
  if (!summary?.hasResolutions && order.orderStatus !== "Cancelled") return null;
  const notes = summary
    ? `${summary.resolutionCount > 0 ? `${summary.resolutionCount} saved resolutions · ` : ""}${formatCurrency(summary.credited)} credited · ${formatCurrency(summary.refunded)} refunded`
    : "Cancelled order";
  return (
    <div className="mt-1 flex flex-wrap gap-1" title={notes}>
      {order.orderStatus !== "Cancelled" && summary && summary.activeUnits > 0 && summary.cancelledUnits > 0 ? (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
          {summary.cancelledUnits} cancelled
        </Badge>
      ) : null}
      {summary && summary.returnedUnits > 0 ? (
        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
          {summary.returnedUnits} returned
        </Badge>
      ) : null}
      {summary?.hasResolutions && summary.cancelledUnits === 0 && summary.returnedUnits === 0 ? (
        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
          {summary.credited > 0 ? "Credit recorded" : "Resolution recorded"}
        </Badge>
      ) : null}
      {summary && summary.resolutionCount > 1 ? (
        <span className="self-center text-muted-foreground text-xs">{summary.resolutionCount} resolutions</span>
      ) : null}
    </div>
  );
}

function OrderStates({ order }: { order: OrderTableItem }) {
  const summary = order.summary;
  const { cancellation, payment, fulfillment } = summary
    ? getOrderDisplayStatuses(summary, order.orderStatus)
    : {
        cancellation: order.orderStatus === "Cancelled" ? "Cancelled" : null,
        payment: order.orderStatus === "Cancelled" && order.collected === 0 ? null : order.paymentStatus,
        fulfillment: order.orderStatus === "Cancelled" ? null : order.fulfillmentStatus,
      };
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {cancellation ? <OrderStatusBadge status={cancellation} type="fulfillment" /> : null}
        {payment ? <OrderStatusBadge status={payment} type="payment" /> : null}
        {fulfillment ? <OrderStatusBadge status={fulfillment} type="fulfillment" /> : null}
      </div>
      {summary && summary.fulfilledUnits > 0 && summary.fulfilledUnits < summary.activeUnits ? (
        <p className="text-muted-foreground text-xs tabular-nums">
          {summary.fulfilledUnits} of {summary.activeUnits} fulfilled
        </p>
      ) : null}
      {summary?.holdState ? (
        <p className="w-fit text-amber-700 text-xs" title={`Stock hold deadline: ${summary.reservationExpiresAt}`}>
          {summary.holdState === "expired" ? "Hold expired" : "Hold expires soon"}
        </p>
      ) : null}
    </div>
  );
}

function OrderBalance({ order, mobile = false }: { order: OrderTableItem; mobile?: boolean }) {
  const refundDue = order.summary?.refundDue ?? order.creditOwed;
  return (
    <div className="grid gap-0.5 text-right tabular-nums">
      {order.discounts > 0 || refundDue === 0 ? (
        <div className={cn(mobile && "flex items-baseline justify-end gap-2")}>
          {mobile ? <span className="text-muted-foreground text-xs">Balance</span> : null}
          <span className={mobile ? "text-sm" : "font-mono"}>{formatCurrency(order.discounts)}</span>
        </div>
      ) : null}
      {refundDue > 0 ? (
        <div className={cn("text-amber-700", mobile ? "flex items-baseline justify-end gap-2" : "grid gap-0.5")}>
          <span className="text-xs">Refund due</span>
          <span className={mobile ? "font-medium text-sm" : "font-mono"}>{formatCurrency(refundDue)}</span>
        </div>
      ) : null}
    </div>
  );
}

function RefundAmountText({ order }: { order: OrderTableItem }) {
  const refunded = order.summary?.refunded ?? 0;
  if (refunded <= 0) return null;
  return (
    <div className="font-normal text-muted-foreground text-xs tabular-nums">Refunded {formatCurrency(refunded)}</div>
  );
}

function matchesFilter(order: OrderTableItem, filter: OrderFilter) {
  if (filter === "all") return true;
  if (filter === "cancelled") return order.orderStatus === "Cancelled";
  if (filter === "needs-action")
    return (
      (order.summary?.refundDue ?? order.creditOwed) > 0 ||
      (order.summary?.pendingRefund ?? 0) > 0 ||
      (order.orderStatus === "Active" && order.nextAction !== "Complete")
    );
  if (filter === "returns")
    return order.summary
      ? order.summary.hasReturnActivity ||
          order.summary.refunded > 0 ||
          order.summary.refundDue > 0 ||
          order.summary.pendingRefund > 0
      : Boolean(order.returnNumber) || order.creditOwed > 0.001;
  if (order.orderStatus !== "Active") return false;
  if (filter === "fulfillment") return order.nextAction === "Fulfill items";
  if (filter === "completed") return order.nextAction === "Complete";
  return true;
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
  const [fulfillmentOpen, setFulfillmentOpen] = React.useState(false);
  const returnHref = `/dashboard/orders/${order.id}/return`;

  return (
    <>
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
              !canUpdate ||
              order.orderStatus !== "Active" ||
              order.fulfillmentStatus === "Fulfilled" ||
              !order.fulfillmentItems?.length
            }
            onSelect={() => setFulfillmentOpen(true)}
          >
            <PackageCheck className="size-4" />
            Record fulfillment{canUpdate ? "" : " (unavailable)"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canManageReturns || (order.orderStatus !== "Active" && !order.summary?.hasResolutions)}
            onSelect={() =>
              router.push(order.summary?.hasResolutions ? `/dashboard/orders/${order.id}/edit` : `${returnHref}?new=1`)
            }
          >
            <RotateCcw className="size-4" />
            {order.summary?.hasResolutions ? "View resolutions" : "Resolve items"}
            {canManageReturns ? "" : " (unavailable)"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FulfillmentWizard
        orderId={order.id}
        open={fulfillmentOpen}
        onOpenChange={setFulfillmentOpen}
        initialOrder={
          order.fulfillmentItems
            ? { id: order.id, version: order.version, orderNumber: order.orderNumber, items: order.fulfillmentItems }
            : undefined
        }
      />
    </>
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
            <div className="truncate text-muted-foreground text-xs">
              {order.primaryProduct ?? "No products"}
              {order.itemCount > 1 ? ` + ${order.itemCount - 1} more` : null}
            </div>
          </div>
          <div className="grid shrink-0 gap-0.5 text-right">
            <div className="flex items-baseline justify-end gap-2">
              <span className="text-muted-foreground text-xs">Total</span>
              <span className="text-sm tabular-nums">{formatCurrency(order.originalValue)}</span>
            </div>
            <OrderBalance order={order} mobile />
            <div className="mt-1 flex items-baseline justify-end gap-2">
              <span className="text-xs">Net paid</span>
              <span className="font-medium text-sm tabular-nums">{formatCurrency(order.collected)}</span>
            </div>
            <RefundAmountText order={order} />
          </div>
        </div>
        <OrderResolutionBadges order={order} />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-3 text-sm sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:border-l sm:pl-6">
          <div className="min-w-0">
            <div className="text-muted-foreground text-xs">Customer</div>
            <div className="truncate">{order.customerName}</div>
          </div>
          <div className="shrink-0 text-right text-muted-foreground text-xs">{formatOrderDate(order.orderedAt)}</div>
          <div className="col-span-2 flex min-w-0 flex-wrap gap-2">
            <OrderStates order={order} />
          </div>
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
  query,
}: {
  canExport?: boolean;
  canManageReturns?: boolean;
  canUpdate?: boolean;
  exportSlotId?: string;
  orders: OrderTableItem[];
  query: string;
}) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = React.useState<OrderFilter>("all");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  const [searchQuery, setSearchQuery] = useCommerceSearch("/dashboard/orders", query);
  const [sortValue, setSortValue] = React.useState<OrderSort>("newest");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const workflowCards = React.useMemo(
    () =>
      filterOptions.map((option) => {
        const matching = orders.filter((order) => matchesFilter(order, option.value));
        return {
          ...option,
          count: matching.length,
        };
      }),
    [orders],
  );
  const filteredOrders = React.useMemo(() => {
    const visibleOrders = orders.filter((order) => matchesFilter(order, activeFilter));

    return [...visibleOrders].sort((left, right) => {
      const leftTime = new Date(left.orderedAt).getTime();
      const rightTime = new Date(right.orderedAt).getTime();

      if (sortValue === "customer-asc") return left.customerName.localeCompare(right.customerName);
      if (sortValue === "customer-desc") return right.customerName.localeCompare(left.customerName);
      if (sortValue === "oldest") return leftTime - rightTime;
      if (sortValue === "total-asc") return left.originalValue - right.originalValue;
      if (sortValue === "total-desc") return right.originalValue - left.originalValue;
      if (sortValue === "discounts-asc")
        return (
          left.discounts -
          (left.summary?.refundDue ?? left.creditOwed) -
          (right.discounts - (right.summary?.refundDue ?? right.creditOwed))
        );
      if (sortValue === "discounts-desc")
        return (
          right.discounts -
          (right.summary?.refundDue ?? right.creditOwed) -
          (left.discounts - (left.summary?.refundDue ?? left.creditOwed))
        );
      if (sortValue === "collected-asc") return left.collected - right.collected;
      if (sortValue === "collected-desc") return right.collected - left.collected;
      if (sortValue === "order-asc")
        return left.orderNumber.localeCompare(right.orderNumber, undefined, { numeric: true });
      if (sortValue === "order-desc")
        return right.orderNumber.localeCompare(left.orderNumber, undefined, { numeric: true });
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
  }, [activeFilter, orders, sortValue]);
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
        <fieldset
          className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 xl:grid-cols-6"
          aria-label="Order workflow"
        >
          {workflowCards.map((stage) => {
            const isActive = activeFilter === stage.value;
            const StageIcon = stage.icon;
            return (
              <button
                key={stage.value}
                type="button"
                aria-pressed={isActive}
                aria-label={`${stage.label}: ${stage.count} orders`}
                title={`${stage.label} · ${stage.action}`}
                className={cn(
                  "group relative grid min-w-0 content-start gap-2 overflow-hidden rounded-lg border bg-card p-2.5 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none sm:rounded-xl sm:p-3",
                  isActive && "border-primary bg-primary/[0.06] shadow-sm ring-1 ring-primary/15",
                )}
                onClick={() => updateFilter(stage.value)}
              >
                <div className="flex min-h-8 items-center gap-2">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md",
                      isActive ? "bg-primary text-primary-foreground" : stage.accent,
                    )}
                  >
                    <StageIcon className="size-3" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 font-medium text-xs leading-tight">{stage.label}</span>
                </div>
                <span className="block text-2xl tabular-nums leading-none">{stage.count}</span>
                <span className="hidden text-[11px] text-muted-foreground leading-snug sm:block">{stage.action}</span>
              </button>
            );
          })}
        </fieldset>
        {orders.length === 50 ? (
          <p className="text-muted-foreground text-xs">
            Summary reflects the orders on this page. Workflow groups can overlap.
          </p>
        ) : null}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
                value={searchQuery}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search orders..."
                maxLength={200}
              />
            </div>
            <div className="md:hidden">
              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm" className="md:hidden">
                    <ArrowDownUp />
                    Sort
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader className="landscape:py-2">
                    <DrawerTitle>Sort orders</DrawerTitle>
                    <DrawerDescription className="landscape:hidden">
                      Choose how orders are arranged in the list.
                    </DrawerDescription>
                  </DrawerHeader>
                  <DrawerBody className="grid gap-4 px-4 pb-4 landscape:gap-3 landscape:pb-3">
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
            {hasFilters && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <X />
                Reset
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">{!exportSlotId && canExport ? exportMenu : null}</div>
        </div>

        <div className="hidden w-full min-w-0 max-w-full overflow-x-auto md:block [&_th]:top-0">
          <Table className="min-w-[66rem] table-fixed">
            <colgroup>
              <col className="w-[3%]" />
              <col className="w-[18%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[22%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
              <col className="w-[5%]" />
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
                <TableHead className="sticky top-12 z-20 w-[7rem] border-b bg-card">
                  <SortableTableHeader
                    direction={orderSortDirection(sortValue, "oldest", "newest")}
                    label="Date"
                    onSort={() => updateSort(sortValue === "oldest" ? "newest" : "oldest")}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 border-b bg-card">
                  <SortableTableHeader
                    direction={orderSortDirection(sortValue, "customer-asc", "customer-desc")}
                    label="Customer"
                    onSort={() => updateSort(sortValue === "customer-asc" ? "customer-desc" : "customer-asc")}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 min-w-[9rem] border-b bg-card">
                  <SortableTableHeader
                    direction={orderSortDirection(sortValue, "status-asc", "status-desc")}
                    label="Status"
                    onSort={() => updateSort(sortValue === "status-asc" ? "status-desc" : "status-asc")}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 w-[6rem] border-b bg-card text-right">
                  <SortableTableHeader
                    align="right"
                    direction={orderSortDirection(sortValue, "total-asc", "total-desc")}
                    label="Total"
                    onSort={() => updateSort(sortValue === "total-asc" ? "total-desc" : "total-asc")}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 w-[6rem] border-b bg-card text-right">
                  <SortableTableHeader
                    align="right"
                    direction={orderSortDirection(sortValue, "discounts-asc", "discounts-desc")}
                    label="Balance"
                    onSort={() => updateSort(sortValue === "discounts-asc" ? "discounts-desc" : "discounts-asc")}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 w-[6rem] border-b bg-card text-right">
                  <SortableTableHeader
                    align="right"
                    direction={orderSortDirection(sortValue, "collected-asc", "collected-desc")}
                    label="Net paid"
                    onSort={() => updateSort(sortValue === "collected-asc" ? "collected-desc" : "collected-asc")}
                  />
                </TableHead>
                <TableHead className="border-b bg-card">
                  <span className="sr-only">Actions</span>
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
                      <div
                        className="max-w-[16rem] truncate text-muted-foreground text-xs"
                        title={order.primaryProduct ?? ""}
                      >
                        {order.primaryProduct ?? "No products"}
                        {order.itemCount > 1 ? ` + ${order.itemCount - 1} more` : null}
                      </div>
                      <OrderResolutionBadges order={order} />
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap text-muted-foreground">
                        {formatOrderDate(order.orderedAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="truncate" title={order.customerName}>
                        {order.customerName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <OrderStates order={order} />
                    </TableCell>
                    <TableCell>
                      <div className="text-right font-mono tabular-nums">{formatCurrency(order.originalValue)}</div>
                    </TableCell>
                    <TableCell>
                      <OrderBalance order={order} />
                    </TableCell>
                    <TableCell>
                      <div className="text-right font-mono tabular-nums">{formatCurrency(order.collected)}</div>
                      <div className="text-right">
                        <RefundAmountText order={order} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <OrderActions canManageReturns={canManageReturns} canUpdate={canUpdate} order={order} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
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
