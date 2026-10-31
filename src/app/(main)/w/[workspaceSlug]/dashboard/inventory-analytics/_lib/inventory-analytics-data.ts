import type { Prisma } from "@prisma/client";

import {
  type CommercePulsePeriod,
  getPeriodRange,
} from "@/app/(main)/w/[workspaceSlug]/dashboard/commerce-pulse/_lib/commerce-pulse-data";
import { refundLineSales } from "@/lib/commerce/reporting";
import { prisma } from "@/lib/prisma";

export type InventoryAnalyticsData = Awaited<ReturnType<typeof getInventoryAnalyticsData>>;

type InventoryAnalyticsFilters = {
  categoryId?: string;
  locationId?: string;
};

type LossReason = "Damage" | "Lost" | "Stolen";

const lossReasons: LossReason[] = ["Damage", "Lost", "Stolen"];

function snapshotNumber(snapshot: Prisma.JsonValue, key: string) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return 0;
  const value = snapshot[key];
  return typeof value === "number" || typeof value === "string" ? Number(value) || 0 : 0;
}

function buildBuckets(start: Date, end: Date) {
  const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
  const bucketDays = durationDays > 100 ? 30 : durationDays > 35 ? 14 : durationDays > 16 ? 7 : 1;
  const buckets: Array<{
    start: Date;
    end: Date;
    period: string;
    received: number;
    sold: number;
    returned: number;
    shrinkage: number;
  }> = [];
  for (let cursor = new Date(start); cursor < end; cursor = new Date(cursor.getTime() + bucketDays * 86_400_000)) {
    const bucketEnd = new Date(Math.min(end.getTime(), cursor.getTime() + bucketDays * 86_400_000));
    buckets.push({
      start: cursor,
      end: bucketEnd,
      period: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      received: 0,
      sold: 0,
      returned: 0,
      shrinkage: 0,
    });
  }
  return buckets;
}

function findBucket<T extends { start: Date; end: Date }>(buckets: T[], date: Date) {
  return buckets.find((bucket) => date >= bucket.start && date < bucket.end);
}

export async function getInventoryAnalyticsData(
  ownerId: string,
  period: CommercePulsePeriod,
  filters: InventoryAnalyticsFilters = {},
) {
  const range = getPeriodRange(period);
  const itemWhere: Prisma.InventoryItemWhereInput = {
    ownerId,
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
  };
  const activityItemWhere: Prisma.InventoryItemWhereInput = { ...itemWhere };

  const [
    items,
    movements,
    orderItems,
    returnItems,
    lifetimeOrderItems,
    lifetimeReturnItems,
    lifetimeDirectRefunds,
    categories,
    locations,
    settings,
  ] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { ...itemWhere, itemStatus: "Active" },
      select: {
        id: true,
        product: true,
        sku: true,
        stock: true,
        cost: true,
        unitPrice: true,
        reorderPoint: true,
        category: { select: { name: true } },
        location: { select: { name: true } },
      },
      orderBy: [{ product: "asc" }, { id: "asc" }],
    }),
    prisma.inventoryStockMovement.findMany({
      where: {
        ownerId,
        createdAt: { gte: range.start, lt: range.end },
        reason: { in: ["Receive", ...lossReasons] },
        inventoryItem: activityItemWhere,
      },
      select: {
        inventoryItemId: true,
        itemSnapshot: true,
        quantityChange: true,
        reason: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.orderItem.findMany({
      where: {
        ownerId,
        inventoryItemId: { not: null },
        order: { orderStatus: "Active", orderDate: { gte: range.start, lt: range.end } },
        inventoryItem: activityItemWhere,
      },
      select: {
        inventoryItemId: true,
        quantity: true,
        unitCost: true,
        order: { select: { orderDate: true } },
      },
    }),
    prisma.orderReturnItem.findMany({
      where: {
        ownerId,
        inventoryItemId: { not: null },
        orderReturn: { returnStatus: "Returned", returnDate: { gte: range.start, lt: range.end } },
        inventoryItem: activityItemWhere,
      },
      select: {
        inventoryItemId: true,
        disposition: true,
        restock: true,
        returnQuantity: true,
        unitCost: true,
        orderReturn: { select: { returnDate: true } },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        ownerId,
        inventoryItemId: { not: null },
        order: { orderStatus: "Active" },
        inventoryItem: activityItemWhere,
      },
      select: { discountAmount: true, lineTotal: true, quantity: true, unitCost: true },
    }),
    prisma.orderReturnItem.findMany({
      where: {
        ownerId,
        inventoryItemId: { not: null },
        orderReturn: { returnStatus: "Returned" },
        inventoryItem: activityItemWhere,
      },
      select: {
        discountAmount: true,
        lineRefund: true,
        restock: true,
        returnQuantity: true,
        taxAmount: true,
        unitCost: true,
        unitPrice: true,
        orderReturn: { select: { refundState: true } },
      },
    }),
    prisma.orderRefund.findMany({
      where: {
        ownerId,
        orderReturnId: null,
        status: "succeeded",
        order: {
          orderStatus: "Active",
          items: { some: { inventoryItemId: { not: null }, inventoryItem: activityItemWhere } },
        },
      },
      select: {
        amount: true,
        order: {
          select: {
            total: true,
            items: {
              where: { inventoryItemId: { not: null }, inventoryItem: activityItemWhere },
              select: { discountAmount: true, lineTotal: true },
            },
          },
        },
      },
    }),
    prisma.inventoryCategory.findMany({
      where: { ownerId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.inventoryLocation.findMany({
      where: { ownerId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.inventorySettings.findUnique({ where: { ownerId }, select: { lowStockThreshold: true } }),
  ]);

  const totalUnits = items.reduce((sum, item) => sum + Math.max(0, item.stock), 0);
  const costValue = items.reduce((sum, item) => sum + Math.max(0, item.stock) * Number(item.cost), 0);
  const retailValue = items.reduce((sum, item) => sum + Math.max(0, item.stock) * Number(item.unitPrice), 0);
  const lowStockThreshold = settings?.lowStockThreshold ?? 25;
  const lowStock = items.filter(
    (item) => item.stock > 0 && item.stock <= Math.max(item.reorderPoint, lowStockThreshold),
  ).length;
  const outOfStock = items.filter((item) => item.stock <= 0).length;

  const lossByReason = Object.fromEntries(lossReasons.map((reason) => [reason, { cost: 0, units: 0 }])) as Record<
    LossReason,
    { cost: number; units: number }
  >;
  let receivedUnits = 0;
  let receivedCost = 0;
  const itemLoss = new Map<string, { cost: number; units: number }>();
  const flow = buildBuckets(range.start, range.end);

  for (const movement of movements) {
    const units = Math.abs(movement.quantityChange);
    const cost = units * snapshotNumber(movement.itemSnapshot, "cost");
    const bucket = findBucket(flow, movement.createdAt);
    if (movement.reason === "Receive") {
      receivedUnits += Math.max(0, movement.quantityChange);
      receivedCost += Math.max(0, movement.quantityChange) * snapshotNumber(movement.itemSnapshot, "cost");
      if (bucket) bucket.received += Math.max(0, movement.quantityChange);
      continue;
    }
    if (lossReasons.includes(movement.reason as LossReason)) {
      const reason = movement.reason as LossReason;
      lossByReason[reason].units += units;
      lossByReason[reason].cost += cost;
      const current = itemLoss.get(movement.inventoryItemId) ?? { cost: 0, units: 0 };
      current.units += units;
      current.cost += cost;
      itemLoss.set(movement.inventoryItemId, current);
      if (bucket) bucket.shrinkage += units;
    }
  }

  let committedUnits = 0;
  let committedCost = 0;
  for (const item of orderItems) {
    committedUnits += item.quantity;
    committedCost += item.quantity * Number(item.unitCost ?? 0);
    const bucket = findBucket(flow, item.order.orderDate);
    if (bucket) bucket.sold += item.quantity;
  }

  let restockedUnits = 0;
  let returnLossUnits = 0;
  let returnLossCost = 0;
  for (const item of returnItems) {
    const cost = item.returnQuantity * Number(item.unitCost ?? 0);
    const bucket = findBucket(flow, item.orderReturn.returnDate);
    if (item.restock) {
      restockedUnits += item.returnQuantity;
      if (bucket) bucket.returned += item.returnQuantity;
    } else if (item.disposition === "Damaged" || item.disposition === "Lost") {
      returnLossUnits += item.returnQuantity;
      returnLossCost += cost;
      const reason: LossReason = item.disposition === "Damaged" ? "Damage" : "Lost";
      lossByReason[reason].units += item.returnQuantity;
      lossByReason[reason].cost += cost;
      if (item.inventoryItemId) {
        const current = itemLoss.get(item.inventoryItemId) ?? { cost: 0, units: 0 };
        current.units += item.returnQuantity;
        current.cost += cost;
        itemLoss.set(item.inventoryItemId, current);
      }
    }
  }

  const breakdown = items
    .map((item) => ({
      category: item.category?.name ?? "Uncategorized",
      costValue: Math.max(0, item.stock) * Number(item.cost),
      id: item.id,
      location: item.location?.name ?? "Unassigned",
      lossCost: itemLoss.get(item.id)?.cost ?? 0,
      lossUnits: itemLoss.get(item.id)?.units ?? 0,
      product: item.product,
      retailValue: Math.max(0, item.stock) * Number(item.unitPrice),
      sku: item.sku,
      units: Math.max(0, item.stock),
    }))
    .sort((left, right) => right.costValue - left.costValue)
    .slice(0, 12);

  const shrinkageUnits = lossReasons.reduce((sum, reason) => sum + lossByReason[reason].units, 0);
  const shrinkageCost = lossReasons.reduce((sum, reason) => sum + lossByReason[reason].cost, 0);
  const stockAdjustmentLossUnits = shrinkageUnits - returnLossUnits;
  const lifetimeSales = lifetimeOrderItems.reduce(
    (sum, item) => sum + Number(item.lineTotal) - Number(item.discountAmount),
    0,
  );
  const lifetimeOrderCost = lifetimeOrderItems.reduce(
    (sum, item) => sum + item.quantity * Number(item.unitCost ?? 0),
    0,
  );
  const lifetimeRecoveredCost = lifetimeReturnItems
    .filter((item) => item.restock)
    .reduce((sum, item) => sum + item.returnQuantity * Number(item.unitCost ?? 0), 0);
  const lifetimeReturnRefunds = lifetimeReturnItems
    .filter((item) => item.orderReturn.refundState === "succeeded")
    .reduce((sum, item) => sum + refundLineSales(item), 0);
  const lifetimeDirectRefundSales = lifetimeDirectRefunds.reduce((sum, refund) => {
    const orderTotal = Number(refund.order.total);
    if (!orderTotal) return sum;
    const inventorySales = refund.order.items.reduce(
      (value, item) => value + Number(item.lineTotal) - Number(item.discountAmount),
      0,
    );
    return sum + (Number(refund.amount) * inventorySales) / orderTotal;
  }, 0);
  const recordedGrossProfit =
    lifetimeSales - lifetimeReturnRefunds - lifetimeDirectRefundSales - (lifetimeOrderCost - lifetimeRecoveredCost);
  const profitHasUnknownCosts =
    lifetimeOrderItems.some((item) => item.unitCost === null) ||
    lifetimeReturnItems.some((item) => item.restock && item.unitCost === null);

  return {
    activity: {
      committedCost,
      committedUnits,
      receivedCost,
      receivedUnits,
      restockedUnits,
      returnLossCost,
      returnLossUnits,
      shrinkageCost,
      shrinkageUnits,
      stockAdjustmentLossUnits,
    },
    breakdown,
    current: {
      activeItems: items.length,
      costValue,
      lowStock,
      netPosition: recordedGrossProfit - costValue,
      outOfStock,
      profitHasUnknownCosts,
      recordedGrossProfit,
      retailValue,
      totalUnits,
    },
    filterOptions: { categories, locations },
    flow: flow.map(({ start: _start, end: _end, ...bucket }) => bucket),
    lossByReason: lossReasons.map((reason) => ({
      cost: lossByReason[reason].cost,
      reason,
      units: lossByReason[reason].units,
    })),
    periodLabel: range.label,
  };
}
