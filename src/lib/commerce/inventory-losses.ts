import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Lifetime losses use saved event-time costs and prices, across all locations. */
export async function getInventoryLosses(
  ownerId: string,
  client: Pick<Prisma.TransactionClient, "$queryRaw"> = prisma,
) {
  const rows = await client.$queryRaw<
    Array<{ reason: string; units: bigint; cost: Prisma.Decimal; retail: Prisma.Decimal; unknown: bigint }>
  >`
 WITH entries AS (
 SELECT reason,-"quantityChange" AS qty,("itemSnapshot"->>'cost')::numeric AS cost,("itemSnapshot"->>'unitPrice')::numeric AS retail
 FROM inventory_stock_movements WHERE "ownerId"=${ownerId} AND reason IN('Damage','Lost','Stolen') AND "quantityChange"<0
 UNION ALL
 SELECT CASE i.disposition WHEN 'Damaged' THEN 'Damage' ELSE 'Lost' END,
 GREATEST(i."returnQuantity"-COALESCE(p.qty,0),0),i."unitCost",i."unitPrice"
 FROM order_return_items i JOIN order_returns r ON r.id=i."orderReturnId"
 LEFT JOIN (SELECT r."orderReturnId",i."orderItemId",SUM(i."receivedQuantity") AS qty FROM order_return_receipt_items i JOIN order_return_receipts r ON r.id=i."receiptId" WHERE r."ownerId"=${ownerId} GROUP BY r."orderReturnId",i."orderItemId") p ON p."orderReturnId"=r.id AND p."orderItemId"=i."orderItemId"
 WHERE i."ownerId"=${ownerId} AND r."returnStatus"='Returned' AND i.disposition IN('Damaged','Lost') AND NOT i.restock
 UNION ALL
 SELECT 'Damage',i."receivedQuantity",i."unitCost",i."retailUnitPrice"
 FROM order_return_receipt_items i WHERE i."ownerId"=${ownerId} AND i.condition='Damaged')
 SELECT reason,SUM(qty)::bigint AS units,COALESCE(SUM(qty*cost),0) AS cost,COALESCE(SUM(qty*retail),0) AS retail,COUNT(*) FILTER(WHERE qty>0 AND (cost IS NULL OR retail IS NULL)) AS unknown FROM entries GROUP BY reason`;
  return rows.map((row) => ({
    ...row,
    units: Number(row.units),
    cost: Number(row.cost),
    retail: Number(row.retail),
    unknown: Number(row.unknown),
  }));
}
export type InventoryLoss = Awaited<ReturnType<typeof getInventoryLosses>>[number];
