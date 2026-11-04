"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { formatStockHistoryEntry, parseLocationChange } from "@/lib/commerce/stock-history";
import { parseCommerceInput } from "@/lib/commerce/validation";
import { prisma } from "@/lib/prisma";

const historyInput = z
  .object({
    pageSize: z.union([z.literal(10), z.literal(25), z.literal(50)]).default(10),
    locationId: z.string().max(200).default(""),
    from: z.iso.datetime().optional(),
    until: z.iso.datetime().optional(),
    page: z.number().int().min(1).max(100000).default(1),
    query: z.string().trim().max(200).default(""),
    filter: z
      .enum([
        "activity",
        "orders",
        "Return",
        "Order cancellation",
        "Receive",
        "Count",
        "Damage",
        "Lost",
        "Stolen",
        "Transfer",
        "Location changed",
        "Migration reconciliation",
      ])
      .default("activity"),
  })
  .strict();

export async function getInventoryStockHistoryAction(raw: z.input<typeof historyInput>) {
  const auth = await getPermittedDashboardAuthorization("inventory.manage");
  if (!auth) throw new Error("You do not have permission to view stock history.");
  const input = parseCommerceInput(historyInput, raw);
  if (input.from && input.until && new Date(input.until) <= new Date(input.from))
    throw new Error("Choose an end date on or after the start date.");
  const where: Prisma.InventoryStockMovementWhereInput = {
    ownerId: auth.workspaceId,
    inventoryItem: { ownerId: auth.workspaceId },
    reason:
      input.filter === "activity"
        ? { not: "Migration reconciliation" }
        : input.filter === "orders"
          ? { startsWith: "Order " }
          : input.filter,
    ...(input.from || input.until
      ? {
          createdAt: {
            ...(input.from ? { gte: new Date(input.from) } : {}),
            ...(input.until ? { lt: new Date(input.until) } : {}),
          },
        }
      : {}),
    ...(input.locationId
      ? {
          AND:
            input.locationId === "unknown"
              ? [{ NOT: { snapshotSource: "event" } }]
              : [
                  { snapshotSource: "event" },
                  {
                    itemSnapshot: {
                      path: ["locationId"],
                      equals: input.locationId === "unassigned" ? Prisma.JsonNull : input.locationId,
                    },
                  },
                ],
        }
      : {}),
    ...(input.query
      ? {
          OR: [
            { itemSnapshot: { path: ["product"], string_contains: input.query, mode: "insensitive" } },
            { itemSnapshot: { path: ["sku"], string_contains: input.query, mode: "insensitive" } },
            { inventoryItem: { product: { contains: input.query, mode: "insensitive" } } },
            { inventoryItem: { sku: { contains: input.query, mode: "insensitive" } } },
            { order: { ownerId: auth.workspaceId, orderNumber: { contains: input.query, mode: "insensitive" } } },
            { notes: { contains: input.query, mode: "insensitive" } },
            { reason: { contains: input.query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const pageSize = input.pageSize;
  const total = await prisma.inventoryStockMovement.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(input.page, pageCount);
  const movements = await prisma.inventoryStockMovement.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize,
    skip: (page - 1) * pageSize,
    include: {
      inventoryItem: { select: { product: true, sku: true, location: { select: { name: true } } } },
      ...(can(auth.membership, "orders.view") ? { order: { select: { id: true, orderNumber: true } } } : {}),
    },
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
  const [locationOptions, actors] = await Promise.all([
    prisma.inventoryLocation.findMany({
      where: { ownerId: auth.workspaceId },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    movements.some((movement) => movement.actorUserId)
      ? prisma.user.findMany({
          where: {
            id: {
              in: [...new Set(movements.flatMap((movement) => (movement.actorUserId ? [movement.actorUserId] : [])))],
            },
          },
          select: { id: true, name: true },
        })
      : [],
  ]);
  const actorsById = new Map(actors.map((actor) => [actor.id, actor.name]));
  const names = new Map(locations.map((location) => [location.id, location.name]));
  return {
    locations: locationOptions,
    entries: movements.map((movement) =>
      formatStockHistoryEntry(
        {
          ...movement,
          order: can(auth.membership, "orders.view") ? movement.order : null,
          actorName: movement.actorUserId ? (actorsById.get(movement.actorUserId) ?? "Former user") : null,
        },
        names,
      ),
    ),
    page,
    pageCount,
    total,
    pageSize,
  };
}
