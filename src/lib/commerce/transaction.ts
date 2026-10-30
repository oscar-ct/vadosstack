import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export class CommerceError extends Error {}

export async function commerceTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (["P2034", "P2002"].includes(error.code) ||
          (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code))));
      if (!retryable || attempt >= 3) throw error;
      // Retry the entire transaction so availability and idempotency are read again.
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
}

export async function lockOrder(tx: Prisma.TransactionClient, ownerId: string, orderId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM orders WHERE id = ${orderId} AND "ownerId" = ${ownerId} FOR UPDATE
  `;
  if (!rows.length) throw new CommerceError("Order was not found.");
}

export async function adjustStock(
  tx: Prisma.TransactionClient,
  input: {
    ownerId: string;
    inventoryItemId: string;
    quantityChange: number;
    reason: string;
    actorUserId?: string;
    orderId?: string;
    orderItemId?: string;
    notes?: string;
    idempotencyKey?: string;
  },
) {
  if (!input.quantityChange) return;
  const result = await tx.inventoryItem.updateMany({
    where: {
      id: input.inventoryItemId,
      ownerId: input.ownerId,
      ...(input.quantityChange < 0 ? { stock: { gte: -input.quantityChange } } : {}),
    },
    data: { stock: { increment: input.quantityChange } },
  });
  if (result.count !== 1)
    throw new CommerceError("Insufficient stock or inventory item unavailable. Refresh and try again.");
  const item = await tx.inventoryItem.findUniqueOrThrow({
    where: { id: input.inventoryItemId },
    select: { stock: true },
  });
  await tx.inventoryStockMovement.create({ data: { ...input, balanceAfter: item.stock } });
}
