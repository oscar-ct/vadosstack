import { refundLineSales } from "@/lib/commerce/reporting";
import { prisma } from "@/lib/prisma";

export const commercePulsePeriodOptions = [
  { label: "This Month", value: "this-month" },
  { label: "Last Month", value: "last-month" },
  { label: "Last 30 Days", value: "last-30-days" },
  { label: "Year to Date", value: "year-to-date" },
] as const;

export const commercePulseScopeOptions = [
  { label: "All Order Lines", value: "all" },
  { label: "Inventory Linked", value: "inventory" },
] as const;

export type CommercePulsePeriod = (typeof commercePulsePeriodOptions)[number]["value"];
export type CommercePulseScope = (typeof commercePulseScopeOptions)[number]["value"];

export type CommercePulseData = Awaited<ReturnType<typeof getCommercePulseData>>;

type OrderWithItems = Awaited<ReturnType<typeof getOrdersForRange>>[number];
type ReturnWithItems = Awaited<ReturnType<typeof getReturnsForRange>>[number];

const dayInMs = 24 * 60 * 60 * 1000;

export function parseCommercePulsePeriod(value?: string | string[]): CommercePulsePeriod {
  const period = Array.isArray(value) ? value[0] : value;
  return commercePulsePeriodOptions.some((option) => option.value === period)
    ? (period as CommercePulsePeriod)
    : "this-month";
}

export function parseCommercePulseScope(value?: string | string[]): CommercePulseScope {
  const scope = Array.isArray(value) ? value[0] : value;
  return commercePulseScopeOptions.some((option) => option.value === scope) ? (scope as CommercePulseScope) : "all";
}

function startOfDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * dayInMs);
}

function addMonths(value: Date, months: number) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, value.getUTCDate()));
}

export function getPeriodRange(period: CommercePulsePeriod, now = new Date()) {
  const today = startOfDay(now);
  const thisMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  if (period === "last-month") {
    const start = addMonths(thisMonthStart, -1);
    return {
      end: thisMonthStart,
      label: "Last month",
      start,
    };
  }

  if (period === "last-30-days") {
    return {
      end: addDays(today, 1),
      label: "Last 30 days",
      start: addDays(today, -29),
    };
  }

  if (period === "year-to-date") {
    return {
      end: addDays(today, 1),
      label: "Year to date",
      start: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)),
    };
  }

  return {
    end: addDays(today, 1),
    label: "This month",
    start: thisMonthStart,
  };
}

function getPreviousRange(start: Date, end: Date) {
  const duration = end.getTime() - start.getTime();
  return {
    end: start,
    start: new Date(start.getTime() - duration),
  };
}

function getOrdersForRange(ownerId: string, start: Date, end: Date) {
  return prisma.order.findMany({
    where: {
      ownerId,
      orderStatus: "Active",
      orderDate: {
        gte: start,
        lt: end,
      },
    },
    include: {
      items: {
        include: {
          inventoryItem: {
            select: {
              cost: true,
            },
          },
        },
      },
    },
    orderBy: {
      orderDate: "asc",
    },
  });
}

function getReturnsForRange(ownerId: string, start: Date, end: Date) {
  return prisma.orderReturn.findMany({
    where: {
      ownerId,
      returnDate: {
        gte: start,
        lt: end,
      },
    },
    include: {
      items: true,
    },
    orderBy: {
      returnDate: "asc",
    },
  });
}

function getScopedItems(order: OrderWithItems, scope: CommercePulseScope) {
  return scope === "inventory" ? order.items.filter((item) => item.inventoryItemId) : order.items;
}

function getScopedReturnItems(orderReturn: ReturnWithItems, scope: CommercePulseScope) {
  return scope === "inventory" ? orderReturn.items.filter((item) => item.inventoryItemId) : orderReturn.items;
}

function getScopedOrderRevenue(order: OrderWithItems, scope: CommercePulseScope) {
  return (
    getScopedItems(order, scope).reduce(
      (total, item) => total + Number(item.lineTotal) - Number(item.discountAmount),
      0,
    ) + (scope === "all" ? Number(order.shippingAmount) : 0)
  );
}

type RefundWithOrder = Awaited<ReturnType<typeof getRefundsForRange>>[number];

function getRefundsForRange(ownerId: string, start: Date, end: Date) {
  return prisma.orderRefund.findMany({
    where: { ownerId, status: "succeeded", refundedAt: { gte: start, lt: end } },
    include: { order: { include: { items: true } }, orderReturn: { include: { items: true } } },
  });
}

function getRefundSalesAmount(refund: RefundWithOrder, scope: CommercePulseScope) {
  if (refund.order.orderStatus === "Cancelled") return 0;
  const amount = Number(refund.amount);
  if (refund.orderReturn) {
    const receipt = refund.orderReturn;
    if (!Number(receipt.refundAmount)) return 0;
    const items = scope === "inventory" ? receipt.items.filter((item) => item.inventoryItemId) : receipt.items;
    const attributed = items.reduce((sum, item) => sum + refundLineSales(item), 0);
    const merchandise = (attributed * amount) / Number(receipt.refundAmount);
    const tax = receipt.items.reduce((sum, item) => sum + Number(item.lineRefund) - refundLineSales(item), 0);
    return scope === "all" ? Math.max(amount - (tax * amount) / Number(receipt.refundAmount), 0) : merchandise;
  }
  const total = Number(refund.order.total);
  if (!total) return 0;
  const sales =
    scope === "inventory"
      ? refund.order.items
          .filter((item) => item.inventoryItemId)
          .reduce((sum, item) => sum + Number(item.lineTotal) - Number(item.discountAmount), 0)
      : total - Number(refund.order.taxAmount);
  return (amount * sales) / total;
}

function getItemProfit(item: OrderWithItems["items"][number]) {
  return Number(item.lineTotal) - Number(item.discountAmount) - Number(item.unitCost ?? 0) * item.quantity;
}

function summarizeCommerce(
  orders: OrderWithItems[],
  orderReturns: ReturnWithItems[],
  scope: CommercePulseScope,
  moneyRefunds: RefundWithOrder[],
) {
  const visibleOrders =
    scope === "inventory" ? orders.filter((order) => getScopedItems(order, scope).length > 0) : orders;
  const visibleReturns =
    scope === "inventory"
      ? orderReturns.filter((receipt) => getScopedReturnItems(receipt, scope).length > 0)
      : orderReturns;
  const discountedRevenue = visibleOrders.reduce((sum, order) => sum + getScopedOrderRevenue(order, scope), 0);
  const grossRevenue = visibleOrders.reduce(
    (sum, order) =>
      sum +
      getScopedItems(order, scope).reduce((value, item) => value + Number(item.lineTotal), 0) +
      (scope === "all" ? Number(order.shippingAmount) : 0),
    0,
  );
  const refundedSales = moneyRefunds.reduce((sum, refund) => sum + getRefundSalesAmount(refund, scope), 0);
  const refunds = moneyRefunds.reduce(
    (sum, refund) => sum + (scope === "all" ? Number(refund.amount) : getRefundSalesAmount(refund, scope)),
    0,
  );
  const recoveredCost = visibleReturns.reduce(
    (sum, receipt) =>
      sum +
      getScopedReturnItems(receipt, scope)
        .filter((item) => item.restock)
        .reduce((value, item) => value + Number(item.unitCost ?? 0) * item.returnQuantity, 0),
    0,
  );
  const unknownCosts =
    visibleOrders.some((order) => getScopedItems(order, scope).some((item) => item.unitCost === null)) ||
    visibleReturns.some((receipt) =>
      getScopedReturnItems(receipt, scope).some((item) => item.restock && item.unitCost === null),
    );
  const grossProfit = visibleOrders.reduce(
    (sum, order) =>
      sum +
      getScopedItems(order, scope).reduce((value, item) => value + getItemProfit(item), 0) +
      (scope === "all" ? Number(order.shippingAmount) : 0),
    0,
  );
  const grossUnitsSold = visibleOrders.reduce(
    (sum, order) => sum + getScopedItems(order, scope).reduce((value, item) => value + item.quantity, 0),
    0,
  );
  const returnedUnits = visibleReturns.reduce(
    (sum, receipt) =>
      sum + getScopedReturnItems(receipt, scope).reduce((value, item) => value + item.returnQuantity, 0),
    0,
  );
  const netRevenue = discountedRevenue - refundedSales;
  return {
    averageOrder: visibleOrders.length ? netRevenue / visibleOrders.length : 0,
    grossProfit,
    grossRevenue,
    grossUnitsSold,
    netProfit: grossProfit - refundedSales + recoveredCost,
    unknownCosts,
    netRevenue,
    netUnitsSold: grossUnitsSold - returnedUnits,
    orderCount: visibleOrders.length,
    refundCount: moneyRefunds.filter((refund) => scope === "all" || getRefundSalesAmount(refund, scope) > 0).length,
    refunds,
    returnCount: visibleReturns.length,
    returnRate: visibleOrders.length ? (visibleReturns.length / visibleOrders.length) * 100 : 0,
    returnedUnits,
    unfulfilledCount: visibleOrders.filter((order) => order.fulfillmentStatus !== "Fulfilled").length,
    unpaidCount: visibleOrders.filter(
      (order) => order.paymentStatus === "Pending" || order.paymentStatus === "Partially Paid",
    ).length,
  };
}

function getDelta(current: number, previous: number) {
  if (!previous && !current) return { direction: "flat" as const, label: "No change" };
  if (!previous) return { direction: "up" as const, label: "New activity" };

  const difference = current - previous;
  const percent = Math.abs((difference / previous) * 100);
  const direction = difference > 0 ? ("up" as const) : difference < 0 ? ("down" as const) : ("flat" as const);
  return {
    direction,
    label: `${difference > 0 ? "+" : difference < 0 ? "-" : ""}${percent.toFixed(percent >= 10 ? 0 : 1)}% vs previous period`,
  };
}

function getBucketKey(date: Date, bucketCount: number, start: Date, end: Date) {
  const duration = Math.max(1, end.getTime() - start.getTime());
  const position = Math.min(bucketCount - 1, Math.floor(((date.getTime() - start.getTime()) / duration) * bucketCount));
  return Math.max(0, position);
}

function formatBucketLabel(index: number, bucketCount: number, start: Date, end: Date) {
  const duration = end.getTime() - start.getTime();
  const bucketStart = new Date(start.getTime() + (duration / bucketCount) * index);
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(bucketStart);
}

function buildSalesOverview(
  orders: OrderWithItems[],
  moneyRefunds: RefundWithOrder[],
  scope: CommercePulseScope,
  start: Date,
  end: Date,
) {
  const bucketCount = 12;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    grossSales: 0,
    discounts: 0,
    netSales: 0,
    period: formatBucketLabel(index, bucketCount, start, end),
    refunds: 0,
  }));

  for (const order of orders) {
    const bucket = buckets[getBucketKey(order.orderDate, bucketCount, start, end)];
    const discount = getScopedItems(order, scope).reduce((sum, item) => sum + Number(item.discountAmount), 0);
    bucket.grossSales += getScopedOrderRevenue(order, scope) + discount;
    bucket.discounts += discount;
  }

  for (const refund of moneyRefunds) {
    const bucket = buckets[getBucketKey(refund.refundedAt, bucketCount, start, end)];
    bucket.refunds += getRefundSalesAmount(refund, scope);
  }

  return buckets.map((bucket) => ({
    ...bucket,
    grossSales: Math.round(bucket.grossSales),
    netSales: Math.round(bucket.grossSales - bucket.discounts - bucket.refunds),
    refunds: Math.round(bucket.refunds),
  }));
}

function buildTopProducts(
  orders: OrderWithItems[],
  orderReturns: ReturnWithItems[],
  scope: CommercePulseScope,
  moneyRefunds: RefundWithOrder[],
) {
  type Product = {
    category: string;
    grossQuantity: number;
    grossRevenue: number;
    name: string;
    returnedQuantity: number;
    returnRevenue: number;
  };
  const products = new Map<string, Product>();
  function row(item: { inventoryItemId: string | null; product: string; category: string | null }) {
    const key = item.inventoryItemId ?? item.product;
    let current = products.get(key);
    if (!current) {
      current = {
        category: item.category ?? "Uncategorized",
        grossQuantity: 0,
        grossRevenue: 0,
        name: item.product,
        returnedQuantity: 0,
        returnRevenue: 0,
      };
      products.set(key, current);
    }
    return current;
  }
  for (const order of orders)
    for (const item of getScopedItems(order, scope)) {
      const current = row(item);
      current.grossQuantity += item.quantity;
      current.grossRevenue += Number(item.lineTotal) - Number(item.discountAmount);
    }
  for (const receipt of orderReturns)
    for (const item of getScopedReturnItems(receipt, scope)) row(item).returnedQuantity += item.returnQuantity;
  // Attribute by refund date even when the return happened in an earlier period.
  for (const refund of moneyRefunds) {
    if (refund.order.orderStatus === "Cancelled") continue;
    if (refund.orderReturn && Number(refund.orderReturn.refundAmount) > 0) {
      for (const item of refund.orderReturn.items) {
        if (scope === "inventory" && !item.inventoryItemId) continue;
        row(item).returnRevenue +=
          (refundLineSales(item) * Number(refund.amount)) / Number(refund.orderReturn.refundAmount);
      }
    } else if (Number(refund.order.total) > 0) {
      for (const item of refund.order.items) {
        if (scope === "inventory" && !item.inventoryItemId) continue;
        row(item).returnRevenue +=
          (Number(refund.amount) * (Number(item.lineTotal) - Number(item.discountAmount))) / Number(refund.order.total);
      }
    }
  }

  const totalRevenue = Array.from(products.values()).reduce(
    (total, product) => total + Math.max(product.grossRevenue - product.returnRevenue, 0),
    0,
  );
  const items = Array.from(products.values())
    .map((product) => ({
      ...product,
      quantity: Math.max(product.grossQuantity - product.returnedQuantity, 0),
      revenue: Math.max(product.grossRevenue - product.returnRevenue, 0),
    }))
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 5)
    .map((product) => ({
      ...product,
      share: totalRevenue ? Math.round((product.revenue / totalRevenue) * 100) : 0,
    }));

  const returnedItems = Array.from(products.values())
    .filter((product) => product.returnedQuantity > 0)
    .sort((left, right) => right.returnRevenue - left.returnRevenue)
    .slice(0, 3);

  const categoryRevenue = new Map<string, number>();
  for (const product of products.values()) {
    const netRevenue = Math.max(product.grossRevenue - product.returnRevenue, 0);
    categoryRevenue.set(product.category, (categoryRevenue.get(product.category) ?? 0) + netRevenue);
  }

  const categories = Array.from(categoryRevenue.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([name, revenue]) => ({
      name,
      share: totalRevenue ? Math.round((revenue / totalRevenue) * 100) : 0,
    }));

  return {
    categories,
    items,
    returnedItems,
    topShare: items.reduce((total, item) => total + item.share, 0),
  };
}

async function getInventorySummary(ownerId: string) {
  const [items, settings] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: {
        ownerId,
        itemStatus: "Active",
      },
      select: {
        cost: true,
        itemStatus: true,
        maxStock: true,
        product: true,
        reorderPoint: true,
        stock: true,
        unitPrice: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.inventorySettings.findUnique({
      where: {
        ownerId,
      },
    }),
  ]);
  const lowStockThreshold = settings?.lowStockThreshold ?? 25;
  const inStock = items.filter((item) => item.stock > Math.max(item.reorderPoint, lowStockThreshold)).length;
  const lowStock = items.filter(
    (item) => item.stock > 0 && item.stock <= Math.max(item.reorderPoint, lowStockThreshold),
  ).length;
  const outOfStock = items.filter((item) => item.stock <= 0).length;
  const activeItems = items.filter((item) => item.itemStatus === "Active").length;
  const totalUnits = items.reduce((total, item) => total + Math.max(0, item.stock), 0);
  const retailValue = items.reduce((total, item) => total + Number(item.unitPrice) * Math.max(0, item.stock), 0);
  const costValue = items.reduce((total, item) => total + Number(item.cost) * Math.max(0, item.stock), 0);

  return {
    activeItems,
    availablePercent: items.length ? Math.round((inStock / items.length) * 100) : 0,
    costValue,
    inStock,
    lowStock,
    outOfStock,
    retailValue,
    totalItems: items.length,
    totalUnits,
  };
}

export async function getCommercePulseData(ownerId: string, period: CommercePulsePeriod, scope: CommercePulseScope) {
  const range = getPeriodRange(period);
  const previousRange = getPreviousRange(range.start, range.end);
  const [
    currentOrders,
    previousOrders,
    currentReturns,
    previousReturns,
    inventory,
    currentRefunds,
    previousRefunds,
    collections,
  ] = await Promise.all([
    getOrdersForRange(ownerId, range.start, range.end),
    getOrdersForRange(ownerId, previousRange.start, previousRange.end),
    getReturnsForRange(ownerId, range.start, range.end),
    getReturnsForRange(ownerId, previousRange.start, previousRange.end),
    getInventorySummary(ownerId),
    getRefundsForRange(ownerId, range.start, range.end),
    getRefundsForRange(ownerId, previousRange.start, previousRange.end),
    prisma.orderPayment.aggregate({
      where: { ownerId, paidAt: { gte: range.start, lt: range.end } },
      _sum: { amount: true },
    }),
  ]);
  const current = summarizeCommerce(currentOrders, currentReturns, scope, currentRefunds);
  const previous = summarizeCommerce(previousOrders, previousReturns, scope, previousRefunds);

  return {
    collections: Number(collections._sum.amount ?? 0),
    profitHasUnknownCosts: current.unknownCosts,
    inventory,
    kpis: {
      averageOrder: { delta: getDelta(current.averageOrder, previous.averageOrder), value: current.averageOrder },
      estimatedProfit: { delta: getDelta(current.netProfit, previous.netProfit), value: current.netProfit },
      grossSales: { delta: getDelta(current.grossRevenue, previous.grossRevenue), value: current.grossRevenue },
      netSales: { delta: getDelta(current.netRevenue, previous.netRevenue), value: current.netRevenue },
      openFulfillment: {
        delta: getDelta(current.unfulfilledCount, previous.unfulfilledCount),
        value: current.unfulfilledCount,
      },
      refundCount: { delta: getDelta(current.refundCount, previous.refundCount), value: current.refundCount },
      refunds: { delta: getDelta(current.refunds, previous.refunds), value: current.refunds },
      returnRate: { delta: getDelta(current.returnRate, previous.returnRate), value: current.returnRate },
      returnedUnits: { delta: getDelta(current.returnedUnits, previous.returnedUnits), value: current.returnedUnits },
      totalOrders: { delta: getDelta(current.orderCount, previous.orderCount), value: current.orderCount },
      totalSales: { delta: getDelta(current.netRevenue, previous.netRevenue), value: current.netRevenue },
      unitsSold: { delta: getDelta(current.netUnitsSold, previous.netUnitsSold), value: current.netUnitsSold },
      unpaidOrders: { delta: getDelta(current.unpaidCount, previous.unpaidCount), value: current.unpaidCount },
    },
    range,
    salesOverview: buildSalesOverview(currentOrders, currentRefunds, scope, range.start, range.end),
    topProducts: buildTopProducts(currentOrders, currentReturns, scope, currentRefunds),
  };
}
