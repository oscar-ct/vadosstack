import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Workspace-wide physical balances; independent of table filters and pagination. */
export async function getInventoryOnHand(
  ownerId: string,
  client: Pick<Prisma.TransactionClient, "$queryRaw"> = prisma,
) {
  const [row] = await client.$queryRaw<
    Array<{ available: bigint; reserved: bigint; units: bigint; cost: Prisma.Decimal; retail: Prisma.Decimal }>
  >`
    WITH returns AS (
      SELECT "orderItemId", SUM("returnQuantity") AS qty FROM order_return_items
      WHERE "ownerId"=${ownerId} GROUP BY "orderItemId"
    ), cancellations AS (
      SELECT i."orderItemId", SUM(i.quantity) AS qty FROM order_adjustment_items i
      JOIN order_adjustments a ON a.id=i."adjustmentId" AND a."ownerId"=i."ownerId"
      WHERE i."ownerId"=${ownerId} AND a.kind='Cancellation' GROUP BY i."orderItemId"
    ), reserved AS (
      SELECT i."inventoryItemId", SUM(GREATEST(i.quantity-COALESCE(c.qty,0)-GREATEST(i."shippedQuantity",COALESCE(r.qty,0)),0)) AS qty
      FROM order_items i JOIN orders o ON o.id=i."orderId" LEFT JOIN returns r ON r."orderItemId"=i.id LEFT JOIN cancellations c ON c."orderItemId"=i.id
      WHERE o."ownerId"=${ownerId} AND i."ownerId"=${ownerId} AND o."orderStatus"='Active'
      GROUP BY i."inventoryItemId"
    )
    SELECT COALESCE(SUM(i.stock),0)::bigint AS available,
      COALESCE(SUM(r.qty),0)::bigint AS reserved,
      COALESCE(SUM(i.stock+COALESCE(r.qty,0)),0)::bigint AS units,
      COALESCE(SUM((i.stock+COALESCE(r.qty,0))*i.cost),0) AS cost,
      COALESCE(SUM((i.stock+COALESCE(r.qty,0))*i."unitPrice"),0) AS retail
    FROM inventory_items i LEFT JOIN reserved r ON r."inventoryItemId"=i.id WHERE i."ownerId"=${ownerId}
  `;
  return {
    available: Number(row.available),
    reserved: Number(row.reserved),
    units: Number(row.units),
    cost: Number(row.cost),
    retail: Number(row.retail),
  };
}
