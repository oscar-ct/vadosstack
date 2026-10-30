"use server";

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { formatStockHistoryEntry, parseLocationChange } from "@/lib/commerce/stock-history";
import { parseCommerceInput } from "@/lib/commerce/validation";
import { prisma } from "@/lib/prisma";

const historyInput = z
  .object({
    page: z.number().int().min(1).max(100000).default(1),
    query: z.string().trim().max(200).default(""),
    filter: z
      .enum(["activity", "Receive", "Count", "Damage", "Transfer", "Location changed", "Migration reconciliation"])
      .default("activity"),
  })
  .strict();

export async function getInventoryStockHistoryAction(raw: z.input<typeof historyInput>) {
  const auth = await getPermittedDashboardAuthorization("inventory.manage");
  if (!auth) throw new Error("You do not have permission to view stock history.");
  const input = parseCommerceInput(historyInput, raw);
  const where: Prisma.InventoryStockMovementWhereInput = {
    ownerId: auth.workspaceId,
    inventoryItem: { ownerId: auth.workspaceId },
    reason: input.filter === "activity" ? { not: "Migration reconciliation" } : input.filter,
    ...(input.query
      ? {
          OR: [
            { itemSnapshot: { path: ["product"], string_contains: input.query, mode: "insensitive" } },
            { itemSnapshot: { path: ["sku"], string_contains: input.query, mode: "insensitive" } },
            { inventoryItem: { product: { contains: input.query, mode: "insensitive" } } },
            { inventoryItem: { sku: { contains: input.query, mode: "insensitive" } } },
            { notes: { contains: input.query, mode: "insensitive" } },
            { reason: { contains: input.query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const pageSize = 10;
  const total = await prisma.inventoryStockMovement.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(input.page, pageCount);
  const movements = await prisma.inventoryStockMovement.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize,
    skip: (page - 1) * pageSize,
    include: { inventoryItem: { select: { product: true, sku: true, location: { select: { name: true } } } } },
  });
  const locationIds = [
    ...new Set(
      movements.flatMap((movement) => {
        const change = movement.reason === "Location changed" ? parseLocationChange(movement.notes) : null;
        return change ? [change.from, change.to].filter((id) => id !== "Unassigned") : [];
      }),
    ),
  ];
  const locations = locationIds.length
    ? await prisma.inventoryLocation.findMany({
        where: { ownerId: auth.workspaceId, id: { in: locationIds } },
        select: { id: true, name: true },
      })
    : [];
  const names = new Map(locations.map((location) => [location.id, location.name]));
  return {
    entries: movements.map((movement) => formatStockHistoryEntry(movement, names)),
    page,
    pageCount,
    total,
    pageSize,
  };
}
