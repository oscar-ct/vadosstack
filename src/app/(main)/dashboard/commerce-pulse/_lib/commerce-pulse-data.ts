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

function getScopedItems(order: OrderWithItems, scope: CommercePulseScope) {
  return scope === "inventory" ? order.items.filter((item) => item.inventoryItemId) : order.items;
}

function getScopedOrderRevenue(order: OrderWithItems, scope: CommercePulseScope) {
  if (scope === "all") return Number(order.total);
  return getScopedItems(order, scope).reduce((total, item) => total + Number(item.lineTotal), 0);
}

function getItemProfit(item: OrderWithItems["items"][number]) {
  const revenue = Number(item.lineTotal);
  const unitCost = item.inventoryItem
    ? Number(item.inventoryItem.cost)
    : Number(item.unitPrice) * (1 - estimatedFallbackMargin);
  return revenue - unitCost * item.quantity;
}

function summarizeOrders(orders: OrderWithItems[], scope: CommercePulseScope) {
  const visibleOrders =
    scope === "inventory" ? orders.filter((order) => getScopedItems(order, scope).length > 0) : orders;
  const revenue = visibleOrders.reduce((total, order) => total + getScopedOrderRevenue(order, scope), 0);
  const profit = visibleOrders.reduce(
    (total, order) =>
      total + getScopedItems(order, scope).reduce((itemTotal, item) => itemTotal + getItemProfit(item), 0),
    0,
  );
  const orderCount = visibleOrders.length;
  const unitsSold = visibleOrders.reduce(
    (total, order) => total + getScopedItems(order, scope).reduce((itemTotal, item) => itemTotal + item.quantity, 0),
    0,
  );

  return {
    averageOrder: orderCount ? revenue / orderCount : 0,
    orderCount,
    profit,
    revenue,
    unitsSold,
    unfulfilledCount: visibleOrders.filter((order) => order.fulfillmentStatus !== "Fulfilled").length,
    unpaidCount: visibleOrders.filter((order) => order.paymentStatus !== "Paid").length,
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

function buildSalesOverview(orders: OrderWithItems[], scope: CommercePulseScope, start: Date, end: Date) {
  const bucketCount = 12;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    period: formatBucketLabel(index, bucketCount, start, end),
    profit: 0,
    revenue: 0,
  }));

  for (const order of orders) {
    const bucket = buckets[getBucketKey(order.orderDate, bucketCount, start, end)];
    bucket.revenue += getScopedOrderRevenue(order, scope);
    bucket.profit += getScopedItems(order, scope).reduce((total, item) => total + getItemProfit(item), 0);
  }

  return buckets.map((bucket) => ({
    ...bucket,
    profit: Math.round(bucket.profit),
    revenue: Math.round(bucket.revenue),
  }));
}

function buildTopProducts(orders: OrderWithItems[], scope: CommercePulseScope) {
  const products = new Map<string, { category: string; name: string; quantity: number; revenue: number }>();
  let totalRevenue = 0;

  for (const order of orders) {
    for (const item of getScopedItems(order, scope)) {
      const key = item.inventoryItemId ?? item.product;
      const current = products.get(key) ?? {
        category: item.category ?? "Uncategorized",
        name: item.product,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += item.quantity;
      current.revenue += Number(item.lineTotal);
      totalRevenue += Number(item.lineTotal);
      products.set(key, current);
    }
  }

  const items = Array.from(products.values())
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 5)
    .map((product) => ({
      ...product,
      share: totalRevenue ? Math.round((product.revenue / totalRevenue) * 100) : 0,
    }));

  const categoryRevenue = new Map<string, number>();
  for (const product of products.values()) {
    categoryRevenue.set(product.category, (categoryRevenue.get(product.category) ?? 0) + product.revenue);
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
  const [currentOrders, previousOrders, inventory] = await Promise.all([
    getOrdersForRange(ownerId, range.start, range.end),
    getOrdersForRange(ownerId, previousRange.start, previousRange.end),
    getInventorySummary(ownerId),
  ]);
  const current = summarizeOrders(currentOrders, scope);
  const previous = summarizeOrders(previousOrders, scope);

  return {
    inventory,
    kpis: {
      averageOrder: { delta: getDelta(current.averageOrder, previous.averageOrder), value: current.averageOrder },
      estimatedProfit: { delta: getDelta(current.profit, previous.profit), value: current.profit },
      openFulfillment: {
        delta: getDelta(current.unfulfilledCount, previous.unfulfilledCount),
        value: current.unfulfilledCount,
      },
      totalOrders: { delta: getDelta(current.orderCount, previous.orderCount), value: current.orderCount },
      totalSales: { delta: getDelta(current.revenue, previous.revenue), value: current.revenue },
      unitsSold: { delta: getDelta(current.unitsSold, previous.unitsSold), value: current.unitsSold },
      unpaidOrders: { delta: getDelta(current.unpaidCount, previous.unpaidCount), value: current.unpaidCount },
    },
    range,
    salesOverview: buildSalesOverview(currentOrders, scope, range.start, range.end),
    topProducts: buildTopProducts(currentOrders, scope),
  };
}
