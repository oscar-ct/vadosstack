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

const estimatedFallbackMargin = 0.3;
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
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * dayInMs);
}

function addMonths(value: Date, months: number) {
  return new Date(value.getFullYear(), value.getMonth() + months, value.getDate());
}

function getPeriodRange(period: CommercePulsePeriod, now = new Date()) {
  const today = startOfDay(now);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

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
      start: new Date(today.getFullYear(), 0, 1),
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
  if (scope === "all") return Number(order.total);
  return getScopedItems(order, scope).reduce((total, item) => total + Number(item.lineTotal), 0);
}

function getScopedRefundAmount(orderReturn: ReturnWithItems, scope: CommercePulseScope) {
  if (scope === "all") return Number(orderReturn.refundAmount);

  return getScopedReturnItems(orderReturn, scope).reduce((total, item) => total + Number(item.lineRefund), 0);
}

function getItemProfit(item: OrderWithItems["items"][number]) {
  const revenue = Number(item.lineTotal);
  const unitCost = item.inventoryItem
    ? Number(item.inventoryItem.cost)
    : Number(item.unitPrice) * (1 - estimatedFallbackMargin);
  return revenue - unitCost * item.quantity;
}

function summarizeCommerce(orders: OrderWithItems[], orderReturns: ReturnWithItems[], scope: CommercePulseScope) {
  const visibleOrders =
    scope === "inventory" ? orders.filter((order) => getScopedItems(order, scope).length > 0) : orders;
  const visibleReturns =
    scope === "inventory"
      ? orderReturns.filter((orderReturn) => getScopedReturnItems(orderReturn, scope).length > 0)
      : orderReturns;
  const grossRevenue = visibleOrders.reduce((total, order) => total + getScopedOrderRevenue(order, scope), 0);
  const refunds = visibleReturns.reduce((total, orderReturn) => total + getScopedRefundAmount(orderReturn, scope), 0);
  const grossProfit = visibleOrders.reduce(
    (total, order) =>
      total + getScopedItems(order, scope).reduce((itemTotal, item) => itemTotal + getItemProfit(item), 0),
    0,
  );
  const orderCount = visibleOrders.length;
  const grossUnitsSold = visibleOrders.reduce(
    (total, order) => total + getScopedItems(order, scope).reduce((itemTotal, item) => itemTotal + item.quantity, 0),
    0,
  );
  const returnedUnits = visibleReturns.reduce(
    (total, orderReturn) =>
      total + getScopedReturnItems(orderReturn, scope).reduce((itemTotal, item) => itemTotal + item.returnQuantity, 0),
    0,
  );
  const netRevenue = Math.max(grossRevenue - refunds, 0);
  const netUnitsSold = Math.max(grossUnitsSold - returnedUnits, 0);

  return {
    averageOrder: orderCount ? netRevenue / orderCount : 0,
    grossProfit,
    grossRevenue,
    grossUnitsSold,
    netProfit: grossProfit - refunds,
    netRevenue,
    netUnitsSold,
    orderCount,
    refundCount: visibleReturns.filter((orderReturn) => getScopedRefundAmount(orderReturn, scope) > 0).length,
    refunds,
    returnCount: visibleReturns.length,
    returnRate: orderCount ? (visibleReturns.length / orderCount) * 100 : 0,
    returnedUnits,
    unfulfilledCount: visibleOrders.filter((order) => order.fulfillmentStatus === "Unfulfilled").length,
    unpaidCount: visibleOrders.filter((order) => order.paymentStatus === "Pending").length,
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
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(bucketStart);
}

function buildSalesOverview(
  orders: OrderWithItems[],
  orderReturns: ReturnWithItems[],
  scope: CommercePulseScope,
  start: Date,
  end: Date,
) {
  const bucketCount = 12;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    grossSales: 0,
    netSales: 0,
    period: formatBucketLabel(index, bucketCount, start, end),
    refunds: 0,
  }));

  for (const order of orders) {
    const bucket = buckets[getBucketKey(order.orderDate, bucketCount, start, end)];
    bucket.grossSales += getScopedOrderRevenue(order, scope);
  }

  for (const orderReturn of orderReturns) {
    const bucket = buckets[getBucketKey(orderReturn.returnDate, bucketCount, start, end)];
    bucket.refunds += getScopedRefundAmount(orderReturn, scope);
  }

  return buckets.map((bucket) => ({
    ...bucket,
    grossSales: Math.round(bucket.grossSales),
    netSales: Math.round(Math.max(bucket.grossSales - bucket.refunds, 0)),
    refunds: Math.round(bucket.refunds),
  }));
}

function buildTopProducts(orders: OrderWithItems[], orderReturns: ReturnWithItems[], scope: CommercePulseScope) {
  const products = new Map<
    string,
    {
      category: string;
      grossQuantity: number;
      grossRevenue: number;
      name: string;
      returnedQuantity: number;
      returnRevenue: number;
    }
  >();

  for (const order of orders) {
    for (const item of getScopedItems(order, scope)) {
      const key = item.inventoryItemId ?? item.product;
      const current = products.get(key) ?? {
        category: item.category ?? "Uncategorized",
        grossQuantity: 0,
        grossRevenue: 0,
        name: item.product,
        returnedQuantity: 0,
        returnRevenue: 0,
      };
      current.grossQuantity += item.quantity;
      current.grossRevenue += Number(item.lineTotal);
      products.set(key, current);
    }
  }

  for (const orderReturn of orderReturns) {
    for (const item of getScopedReturnItems(orderReturn, scope)) {
      const key = item.inventoryItemId ?? item.product;
      const current = products.get(key) ?? {
        category: item.category ?? "Uncategorized",
        grossQuantity: 0,
        grossRevenue: 0,
        name: item.product,
        returnedQuantity: 0,
        returnRevenue: 0,
      };
      current.returnedQuantity += item.returnQuantity;
      current.returnRevenue += Number(item.lineRefund);
      products.set(key, current);
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
  const [currentOrders, previousOrders, currentReturns, previousReturns, inventory] = await Promise.all([
    getOrdersForRange(ownerId, range.start, range.end),
    getOrdersForRange(ownerId, previousRange.start, previousRange.end),
    getReturnsForRange(ownerId, range.start, range.end),
    getReturnsForRange(ownerId, previousRange.start, previousRange.end),
    getInventorySummary(ownerId),
  ]);
  const current = summarizeCommerce(currentOrders, currentReturns, scope);
  const previous = summarizeCommerce(previousOrders, previousReturns, scope);

  return {
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
    salesOverview: buildSalesOverview(currentOrders, currentReturns, scope, range.start, range.end),
    topProducts: buildTopProducts(currentOrders, currentReturns, scope),
  };
}
