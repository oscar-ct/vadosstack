import { prisma } from "@/lib/prisma";

import type { InventoryItem } from "../_components/inventory-table";

export type InventoryStockRules = {
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

export async function getInventoryItems(ownerId: string): Promise<InventoryItem[]> {
  const items = await prisma.inventoryItem.findMany({
    where: {
      ownerId,
    },
    include: {
      category: true,
      location: true,
    },
    orderBy: {
      product: "asc",
    },
  });

  return items.map((item) => ({
    id: item.id,
    sku: item.sku ?? "",
    product: item.product,
    category: item.category?.name ?? "Uncategorized",
    description: item.description ?? "",
    stock: item.stock,
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
    autoRestockAlerts: settings.autoRestockAlerts,
    criticalStockThreshold: settings.criticalStockThreshold,
    defaultMaxStock: settings.defaultMaxStock,
    defaultReorderPoint: settings.defaultReorderPoint,
    includeOutOfStock: settings.includeOutOfStock,
    lowStockThreshold: settings.lowStockThreshold,
  };
}
