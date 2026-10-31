import { type InventoryVisibility, inventoryListWhere } from "@/lib/commerce/inventory-filter";
import type { InventoryOptionSummary } from "@/lib/commerce/inventory-options";
import { summarizeInventoryStock } from "@/lib/commerce/inventory-summary";
import { prisma } from "@/lib/prisma";

import type { InventoryItem } from "../_components/inventory-table";

export type InventoryStockRules = {
  restockAlertEmail?: string;
  autoRestockAlerts: boolean;
  criticalStockThreshold: number;
  defaultMaxStock: number;
  defaultReorderPoint: number;
  includeOutOfStock: boolean;
  lowStockThreshold: number;
};

export const defaultInventoryStockRules: InventoryStockRules = {
  autoRestockAlerts: true,
  criticalStockThreshold: 8,
  defaultMaxStock: 100,
  defaultReorderPoint: 20,
  includeOutOfStock: true,
  lowStockThreshold: 25,
};

export async function getInventoryItems(
  ownerId: string,
  options: { q?: string; page?: number; visibility?: InventoryVisibility } = {},
): Promise<InventoryItem[]> {
  const items = await prisma.inventoryItem.findMany({
    where: inventoryListWhere(ownerId, options.q, options.visibility),
    take: 50,
    skip: ((options.page ?? 1) - 1) * 50,
    include: {
      category: true,
      location: true,
      _count: { select: { orderItems: true, returnItems: true, stockMovements: true } },
    },
    orderBy: [{ product: "asc" }, { id: "asc" }],
  });

  const balances = items.length
    ? await prisma.inventoryItem.findMany({
        where: { ownerId, productId: { in: [...new Set(items.map((item) => item.productId))] } },
        select: {
          productId: true,
          stock: true,
          itemStatus: true,
          locationId: true,
          location: { select: { name: true } },
          orderItems: {
            where: { order: { orderStatus: "Active" } },
            select: { quantity: true, shippedQuantity: true, returnItems: { select: { returnQuantity: true } } },
          },
        },
      })
    : [];
  const now = Date.now();
  const soldSince30d = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const soldSince90d = new Date(now - 90 * 24 * 60 * 60 * 1000);
  const soldItems = items.length
    ? await prisma.orderItem.findMany({
        where: {
          ownerId,
          inventoryItemId: { in: items.map((item) => item.id) },
          order: { orderStatus: "Active" },
        },
        select: {
          inventoryItemId: true,
          quantity: true,
          order: { select: { orderDate: true } },
          returnItems: { select: { returnQuantity: true, createdAt: true } },
        },
      })
    : [];
  const salesByItem = new Map<
    string,
    {
      totalSold: number;
      sold30d: number;
      sold90d: number;
      totalReturned: number;
      returned30d: number;
      returned90d: number;
    }
  >();
  for (const orderItem of soldItems) {
    if (!orderItem.inventoryItemId) continue;
    const sales = salesByItem.get(orderItem.inventoryItemId) ?? {
      totalSold: 0,
      sold30d: 0,
      sold90d: 0,
      totalReturned: 0,
      returned30d: 0,
      returned90d: 0,
    };
    sales.totalSold += orderItem.quantity;
    if (orderItem.order.orderDate >= soldSince90d) sales.sold90d += orderItem.quantity;
    if (orderItem.order.orderDate >= soldSince30d) sales.sold30d += orderItem.quantity;
    for (const returnItem of orderItem.returnItems) {
      sales.totalReturned += returnItem.returnQuantity;
      if (returnItem.createdAt >= soldSince90d) sales.returned90d += returnItem.returnQuantity;
      if (returnItem.createdAt >= soldSince30d) sales.returned30d += returnItem.returnQuantity;
    }
    salesByItem.set(orderItem.inventoryItemId, sales);
  }
  const overviews = summarizeInventoryStock(balances);
  return items.map((item) => ({
    id: item.id,
    productId: item.productId,
    stockOverview: overviews.get(item.productId),
    identityLocked:
      item.stock !== 0 ||
      item._count.orderItems > 0 ||
      item._count.returnItems > 0 ||
      item._count.stockMovements > 0 ||
      balances.filter((balance) => balance.productId === item.productId).length > 1,
    updatedAt: item.updatedAt.toISOString(),
    sku: item.sku ?? "",
    product: item.product,
    category: item.category?.name ?? "Uncategorized",
    description: item.description ?? "",
    stock: item.stock,
    sales: salesByItem.get(item.id),
    locationLocked:
      item.stock !== 0 || item._count.orderItems > 0 || item._count.returnItems > 0 || item._count.stockMovements > 0,
    reorderPoint: item.reorderPoint,
    maxStock: item.maxStock,
    location: item.location?.name ?? "Unassigned",
    unit: item.unit,
    cost: Number(item.cost),
    unitPrice: Number(item.unitPrice),
    taxable: item.taxable,
    taxRate: Number(item.taxRate),
    itemStatus: item.itemStatus === "Inactive" ? "Inactive" : "Active",
    barcode: item.barcode ?? undefined,
    vendor: item.vendor ?? undefined,
    notes: item.notes ?? undefined,
  }));
}

export async function getInventoryOptions(ownerId: string) {
  const [categories, locations, usage] = await Promise.all([
    prisma.inventoryCategory.findMany({
      where: {
        ownerId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
    }),
    prisma.inventoryLocation.findMany({
      where: {
        ownerId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
    }),
    prisma.$queryRaw<
      Array<{
        kind: string;
        id: string | null;
        records: bigint;
        products: bigint;
        archived: bigint;
        available: bigint;
        reserved: bigint;
      }>
    >`
      WITH reservations AS (
        SELECT oi."inventoryItemId", SUM(GREATEST(oi.quantity - GREATEST(oi."shippedQuantity",
          COALESCE((SELECT SUM(r."returnQuantity") FROM order_return_items r WHERE r."orderItemId" = oi.id), 0)), 0)) AS reserved
        FROM order_items oi JOIN orders o ON o.id = oi."orderId"
        WHERE oi."ownerId" = ${ownerId} AND o."orderStatus" = 'Active'
        GROUP BY oi."inventoryItemId"
      ), records AS (
        SELECT i.*, COALESCE(r.reserved, 0) AS reserved FROM inventory_items i
        LEFT JOIN reservations r ON r."inventoryItemId" = i.id WHERE i."ownerId" = ${ownerId}
      )
      SELECT 'category' AS kind, "categoryId" AS id, COUNT(*) AS records, COUNT(DISTINCT "productId") AS products,
        COUNT(*) FILTER (WHERE "itemStatus" = 'Inactive') AS archived, COALESCE(SUM(stock),0)::bigint AS available,
        COALESCE(SUM(reserved),0)::bigint AS reserved FROM records GROUP BY "categoryId"
      UNION ALL
      SELECT 'location', "locationId", COUNT(*), COUNT(DISTINCT "productId"), COUNT(*) FILTER (WHERE "itemStatus" = 'Inactive'),
        COALESCE(SUM(stock),0)::bigint, COALESCE(SUM(reserved),0)::bigint FROM records GROUP BY "locationId"
    `,
  ]);
  const countsByKey = new Map(usage.map((entry) => [`${entry.kind}:${entry.id}`, entry]));
  function details(kind: string, records: typeof categories): InventoryOptionSummary[] {
    return records.map((record) => {
      const counts = countsByKey.get(`${kind}:${record.id}`);
      return {
        id: record.id,
        name: record.name,
        updatedAt: record.updatedAt.toISOString(),
        recordCount: Number(counts?.records ?? 0),
        productCount: Number(counts?.products ?? 0),
        archivedCount: Number(counts?.archived ?? 0),
        available: Number(counts?.available ?? 0),
        reserved: Number(counts?.reserved ?? 0),
      };
    });
  }
  return {
    categories: categories.map((category) => category.name),
    locations: locations.map((location) => location.name),
    categoryDetails: details("category", categories),
    locationDetails: details("location", locations),
  };
}

export async function getInventoryStockRules(ownerId: string): Promise<InventoryStockRules> {
  const settings = await prisma.inventorySettings.findUnique({
    where: {
      ownerId,
    },
  });

  if (!settings) {
    return defaultInventoryStockRules;
  }

  return {
    restockAlertEmail: settings.restockAlertEmail ?? "",
    autoRestockAlerts: settings.autoRestockAlerts,
    criticalStockThreshold: settings.criticalStockThreshold,
    defaultMaxStock: settings.defaultMaxStock,
    defaultReorderPoint: settings.defaultReorderPoint,
    includeOutOfStock: settings.includeOutOfStock,
    lowStockThreshold: settings.lowStockThreshold,
  };
}
