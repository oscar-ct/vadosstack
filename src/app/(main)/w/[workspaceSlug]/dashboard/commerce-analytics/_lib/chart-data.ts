import type { Prisma } from "@prisma/client";

import { businessDateKey, DEFAULT_BUSINESS_TIME_ZONE } from "@/lib/business-time";
import { buildSalesTrend } from "@/lib/commerce/analytics-charts";

export async function getSalesChartData(
  tx: Prisma.TransactionClient,
  ownerId: string,
  start: Date | null,
  end: Date,
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
) {
  const since = start ?? new Date(0);
  const [days, products] = await Promise.all([
    tx.$queryRaw<Array<{ date: string; gross: Prisma.Decimal; discounts: Prisma.Decimal; refunds: Prisma.Decimal }>>`
      WITH cancellations AS (
 SELECT "orderId",SUM("merchandiseAmount"-"discountAmount"+"shippingAmount") AS net,SUM("merchandiseAmount"+"shippingAmount") AS gross,SUM("discountAmount") AS discounts
 FROM order_adjustments WHERE "ownerId"=${ownerId} AND kind='Cancellation' GROUP BY "orderId"
), events AS (
        SELECT ((o."orderDate"::date AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC') AS date, o.subtotal+o."shippingAmount"-COALESCE(c.gross,0) AS gross, o."discountAmount"-COALESCE(c.discounts,0) AS discounts, 0::numeric AS refunds
        FROM orders o LEFT JOIN cancellations c ON c."orderId"=o.id WHERE o."ownerId"=${ownerId} AND o."orderStatus"='Active' AND ((o."orderDate"::date AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC')>=${since} AND ((o."orderDate"::date AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC')<${end}
        UNION ALL
        SELECT r."refundedAt",0,0,COALESCE(r."merchandiseAmount",r.amount*(o.subtotal-o."discountAmount")/NULLIF(o.total,0),0)+COALESCE(r."shippingAmount",r.amount*o."shippingAmount"/NULLIF(o.total,0),0)
        FROM order_refunds r JOIN orders o ON o.id=r."orderId" AND o."ownerId"=${ownerId} LEFT JOIN order_adjustments ca ON ca.id=r."adjustmentId"
        WHERE COALESCE(ca.kind,'')<>'Cancellation' AND r."ownerId"=${ownerId} AND o."orderStatus"='Active' AND r.status='succeeded' AND r."refundedAt">=${since} AND r."refundedAt"<${end}
      ) SELECT to_char((date AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone},'YYYY-MM-DD') AS date,SUM(gross) AS gross,SUM(discounts) AS discounts,SUM(refunds) AS refunds FROM events GROUP BY 1 ORDER BY 1`,
    tx.$queryRaw<Array<{ key: string; product: string; sold: bigint; returned: bigint; net: Prisma.Decimal }>>`
      WITH cancellations AS (
 SELECT ai."orderItemId",SUM(ai.quantity) AS qty,SUM(ai."grossAmount"-ai."discountAmount") AS net
 FROM order_adjustment_items ai JOIN order_adjustments a ON a.id=ai."adjustmentId"
 WHERE a."ownerId"=${ownerId} AND a.kind='Cancellation' GROUP BY ai."orderItemId"
), lines AS (
        SELECT i.id,i."orderId",i.product,i.sku,GREATEST(i.quantity-COALESCE(c.qty,0),0) AS quantity,i."lineTotal"-i."discountAmount"-COALESCE(c.net,0) AS revenue,o."orderDate",
          COALESCE('inventory:'||v."productId",'manual:'||i.product||':'||COALESCE(i.sku,'')) AS key
        FROM order_items i JOIN orders o ON o.id=i."orderId" AND o."ownerId"=${ownerId}
        LEFT JOIN cancellations c ON c."orderItemId"=i.id
        LEFT JOIN inventory_items v ON v.id=i."inventoryItemId" AND v."ownerId"=${ownerId}
        WHERE i."ownerId"=${ownerId} AND o."orderStatus"='Active'
      ), refund_weights AS (
        SELECT r.id,r."orderReturnId",l.id AS line_id,
          COALESCE(r."merchandiseAmount",r.amount*(o.subtotal-o."discountAmount")/NULLIF(o.total,0),0) AS amount,
          GREATEST(l.revenue,0) AS order_weight,
          GREATEST(COALESCE(ri."unitPrice"*ri."returnQuantity"-ri."discountAmount",0),0) AS return_weight
        FROM order_refunds r JOIN orders o ON o.id=r."orderId" AND o."ownerId"=${ownerId} LEFT JOIN order_adjustments ca ON ca.id=r."adjustmentId"
        JOIN lines l ON l."orderId"=o.id
        LEFT JOIN order_return_items ri ON ri."orderReturnId"=r."orderReturnId" AND ri."orderItemId"=l.id AND ri."ownerId"=${ownerId}
        WHERE COALESCE(ca.kind,'')<>'Cancellation' AND r."ownerId"=${ownerId} AND r.status='succeeded' AND r."refundedAt">=${since} AND r."refundedAt"<${end}
      ), weights AS (
        SELECT *,CASE WHEN SUM(return_weight) OVER(PARTITION BY id)>0 THEN return_weight ELSE order_weight END AS weight FROM refund_weights
      ), allocations AS (
        SELECT *,SUM(weight) OVER(PARTITION BY id) AS total_weight,COUNT(*) OVER(PARTITION BY id) AS line_count FROM weights
      ), activity AS (
        SELECT id AS line_id,quantity::bigint AS sold,0::bigint AS returned,revenue AS net FROM lines WHERE (("orderDate"::date AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC')>=${since} AND (("orderDate"::date AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC')<${end}
        UNION ALL
        SELECT line_id,0,0,-amount*CASE WHEN total_weight>0 THEN weight/total_weight ELSE 1.0/line_count END FROM allocations
        UNION ALL
        SELECT i."orderItemId",0,i."receivedQuantity",0 FROM order_return_receipt_items i JOIN order_return_receipts r ON r.id=i."receiptId"
        WHERE r."ownerId"=${ownerId} AND r."receivedAt">=${since} AND r."receivedAt"<${end}
        UNION ALL
        SELECT i."orderItemId",0,i."returnQuantity",0 FROM order_return_items i JOIN order_returns r ON r.id=i."orderReturnId"
        WHERE i."ownerId"=${ownerId} AND r."ownerId"=${ownerId} AND r."returnStatus"='Returned' AND i.disposition='Returned' AND r."returnDate">=${since} AND r."returnDate"<${end}
          AND NOT EXISTS(SELECT 1 FROM order_return_receipts p JOIN order_return_receipt_items pi ON pi."receiptId"=p.id WHERE p."orderReturnId"=r.id AND pi."orderItemId"=i."orderItemId")
      ) SELECT l.key,(ARRAY_AGG(l.product ORDER BY l."orderDate" DESC,l.id))[1] AS product,
        SUM(a.sold)::bigint AS sold,SUM(a.returned)::bigint AS returned,SUM(a.net) AS net
      FROM activity a JOIN lines l ON l.id=a.line_id GROUP BY l.key
      HAVING SUM(a.sold)>0 OR SUM(a.returned)>0 OR SUM(a.net)<>0 ORDER BY net DESC,l.key LIMIT 5`,
  ]);
  return {
    trend: buildSalesTrend(
      days.map((row) => ({
        date: row.date,
        gross: Number(row.gross),
        discounts: Number(row.discounts),
        refunds: Number(row.refunds),
      })),
      start ? new Date(`${businessDateKey(start, timeZone)}T00:00:00Z`) : null,
      new Date(`${businessDateKey(end, timeZone)}T00:00:00Z`),
    ),
    products: products.map((row) => ({
      ...row,
      sold: Number(row.sold),
      returned: Number(row.returned),
      net: Number(row.net),
    })),
  };
}
