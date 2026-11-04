"use server";

import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export async function searchStockInventoryAction(query: string, page: number) {
  const auth = await getPermittedDashboardAuthorization("inventory.manage");
  if (!auth) throw new Error("You do not have permission to adjust stock.");
  const input = z
    .object({ query: z.string().trim().max(200), page: z.number().int().min(1).max(100000) })
    .parse({ query, page });
  const rows = await prisma.inventoryItem.findMany({
    where: {
      ownerId: auth.workspaceId,
      itemStatus: "Active",
      ...(input.query
        ? {
            OR: [
              { product: { contains: input.query, mode: "insensitive" as const } },
              { sku: { contains: input.query, mode: "insensitive" as const } },
              { location: { name: { contains: input.query, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      product: true,
      sku: true,
      stock: true,
      unitPrice: true,
      cost: true,
      updatedAt: true,
      itemStatus: true,
      category: { select: { name: true } },
      location: { select: { name: true } },
    },
    orderBy: [{ product: "asc" }, { id: "asc" }],
    skip: (input.page - 1) * 50,
    take: 51,
  });
  return {
    hasMore: rows.length > 50,
    items: rows.slice(0, 50).map((item) => ({
      ...item,
      sku: item.sku ?? "",
      category: item.category?.name ?? "Uncategorized",
      location: item.location?.name ?? "Unassigned",
      unitPrice: Number(item.unitPrice),
      cost: Number(item.cost),
      updatedAt: item.updatedAt.toISOString(),
      itemStatus: item.itemStatus === "Inactive" ? ("Inactive" as const) : ("Active" as const),
    })),
  };
}
