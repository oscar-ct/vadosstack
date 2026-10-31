import type { Prisma } from "@prisma/client";

export type InventoryVisibility = "active" | "archived" | "all";

export function parseInventoryVisibility(value?: string): InventoryVisibility {
  return value === "archived" || value === "all" ? value : "active";
}

export function inventoryListWhere(
  ownerId: string,
  query = "",
  visibility: InventoryVisibility = "active",
): Prisma.InventoryItemWhereInput {
  return {
    ownerId,
    ...(visibility === "all" ? {} : { itemStatus: visibility === "archived" ? "Inactive" : "Active" }),
    ...(query
      ? {
          OR: [
            { product: { contains: query, mode: "insensitive" as const } },
            { sku: { contains: query, mode: "insensitive" as const } },
            { category: { name: { contains: query, mode: "insensitive" as const } } },
            { location: { name: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}
