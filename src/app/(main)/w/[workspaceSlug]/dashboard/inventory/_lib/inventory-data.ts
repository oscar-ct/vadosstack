import { type InventoryVisibility, inventoryListWhere } from "@/lib/commerce/inventory-filter";
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
  const [categories, locations] = await Promise.all([
    prisma.inventoryCategory.findMany({
      where: {
        ownerId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        name: true,
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
        name: true,
      },
    }),
  ]);

  return {
    categories: categories.map((category) => category.name),
    locations: locations.map((location) => location.name),
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
