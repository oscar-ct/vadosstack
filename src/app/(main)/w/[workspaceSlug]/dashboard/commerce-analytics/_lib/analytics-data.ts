import type { Prisma } from "@prisma/client";

import {
  calculateInvestmentPosition,
  calculateNetShipping,
  calculateReportedSales,
} from "@/lib/commerce/sales-recovery";
import { prisma } from "@/lib/prisma";

import { getSalesChartData } from "./chart-data";

export const analyticsPeriods = ["30", "90", "365", "ytd"] as const;
export type AnalyticsPeriod = (typeof analyticsPeriods)[number];
export function periodStart(period: AnalyticsPeriod, now = new Date()) {
  if (period === "ytd") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  if (period === "365") {
    // Keep existing bookmarked URLs; the window is now 12 calendar months ending after today.
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const year = end.getUTCFullYear() - 1;
    const month = end.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(end.getUTCDate(), lastDay)));
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - Number(period) + 1));
}
type Sales = {
  gross: Prisma.Decimal;
  discounts: Prisma.Decimal;
  refunds: Prisma.Decimal;
  merchandiseRefunds: Prisma.Decimal;
  orders: bigint;
  sold: bigint;
  returned: bigint;
  taxCollected: Prisma.Decimal;
  taxRefunded: Prisma.Decimal;
  shippingCharged: Prisma.Decimal;
  shippingExpense: Prisma.Decimal;
  shippingRefunded: Prisma.Decimal;
  unknownRefunds: bigint;
  unknownPayments: bigint;
  unknownReturns: bigint;
};

async function sales(tx: Prisma.TransactionClient, ownerId: string, start: Date, end: Date) {
  const rows = await tx.$queryRaw<Sales[]>`
 WITH cancellations AS (
 SELECT "orderId",SUM("merchandiseAmount") AS gross,SUM("discountAmount") AS discounts,SUM("shippingAmount") AS shipping
 FROM order_adjustments WHERE "ownerId"=${ownerId} AND kind='Cancellation' GROUP BY "orderId"
 ), sale AS (
 SELECT COALESCE(SUM(GREATEST(o.subtotal-COALESCE(c.gross,0),0)),0) AS gross,COALESCE(SUM(GREATEST(o."discountAmount"-COALESCE(c.discounts,0),0)),0) AS discounts, COUNT(*) AS orders,
 COALESCE(SUM(GREATEST(o."shippingAmount"-COALESCE(c.shipping,0),0)),0) AS shipping FROM orders o LEFT JOIN cancellations c ON c."orderId"=o.id
 WHERE o."ownerId"=${ownerId} AND o."orderStatus"='Active' AND o."orderDate">=${start} AND o."orderDate"<${end}
 ), refunds AS (
 SELECT COALESCE(SUM(r.amount),0) AS total,
 COALESCE(SUM(CASE WHEN o."orderStatus"='Active' AND COALESCE(a.kind,'')<>'Cancellation' THEN COALESCE(r."merchandiseAmount",r.amount*(o.subtotal-o."discountAmount")/NULLIF(o.total,0),0) ELSE 0 END),0) AS merchandise,
 COALESCE(SUM(CASE WHEN o."orderStatus"='Active' AND COALESCE(a.kind,'')<>'Cancellation' THEN COALESCE(r."shippingAmount",r.amount*o."shippingAmount"/NULLIF(o.total,0),0) ELSE 0 END),0) AS shipping,
 COALESCE(SUM(COALESCE(r."taxAmount",r.amount*o."taxAmount"/NULLIF(o.total,0),0)),0) AS tax,
 COUNT(*) FILTER(WHERE r."taxAmount" IS NULL OR r."shippingAmount" IS NULL OR r."allocationSource"='estimated') AS unknown
 FROM order_refunds r JOIN orders o ON o.id=r."orderId" LEFT JOIN order_adjustments a ON a.id=r."adjustmentId"
 WHERE r."ownerId"=${ownerId} AND r.status='succeeded' AND r."refundedAt">=${start} AND r."refundedAt"<${end}
 ), payments AS (
 SELECT COALESCE(SUM(COALESCE(p."taxAmount",p.amount*o."taxAmount"/NULLIF(o.total,0),0)),0) AS tax,
 COUNT(*) FILTER(WHERE p."taxAmount" IS NULL OR p."allocationSource"='estimated') AS unknown
 FROM order_payments p JOIN orders o ON o.id=p."orderId"
 WHERE p."ownerId"=${ownerId} AND p."paidAt">=${start} AND p."paidAt"<${end}
 ), units AS (
 SELECT COALESCE(SUM(GREATEST(i.quantity-COALESCE(c.qty,0),0)),0)::bigint AS sold FROM order_items i JOIN orders o ON o.id=i."orderId"
 LEFT JOIN (SELECT ai."orderItemId",SUM(ai.quantity) AS qty FROM order_adjustment_items ai JOIN order_adjustments a ON a.id=ai."adjustmentId" WHERE a."ownerId"=${ownerId} AND a.kind='Cancellation' GROUP BY ai."orderItemId") c ON c."orderItemId"=i.id
 WHERE o."ownerId"=${ownerId} AND o."orderStatus"='Active' AND o."orderDate">=${start} AND o."orderDate"<${end}
 ), physical AS (
 SELECT COALESCE(SUM(i."receivedQuantity"),0)::bigint AS returned FROM order_return_receipt_items i JOIN order_return_receipts r ON r.id=i."receiptId"
 WHERE r."ownerId"=${ownerId} AND r."receivedAt">=${start} AND r."receivedAt"<${end}
 ), legacy_returns AS (
 SELECT COALESCE(SUM(i."returnQuantity") FILTER(WHERE i.disposition='Returned'),0)::bigint AS returned,
 COALESCE(SUM(i."returnQuantity") FILTER(WHERE i.disposition='Damaged'),0)::bigint AS unknown
 FROM order_return_items i JOIN order_returns r ON r.id=i."orderReturnId"
 WHERE r."ownerId"=${ownerId} AND r."returnStatus"='Returned' AND r."returnDate">=${start} AND r."returnDate"<${end}
 AND NOT EXISTS(SELECT 1 FROM order_return_receipts p JOIN order_return_receipt_items pi ON pi."receiptId"=p.id WHERE p."orderReturnId"=r.id AND pi."orderItemId"=i."orderItemId")
 ), expenses AS (
 SELECT COALESCE(SUM(amount),0) AS amount FROM order_shipping_expenses WHERE "ownerId"=${ownerId} AND "incurredAt">=${start} AND "incurredAt"<${end}
 ) SELECT sale.gross,sale.discounts,sale.orders,sale.shipping AS "shippingCharged",units.sold,
 physical.returned+legacy_returns.returned AS returned,legacy_returns.unknown AS "unknownReturns",
 refunds.shipping AS "shippingRefunded",refunds.total AS refunds,refunds.merchandise AS "merchandiseRefunds",refunds.tax AS "taxRefunded",refunds.unknown AS "unknownRefunds",
 payments.tax AS "taxCollected",payments.unknown AS "unknownPayments",expenses.amount AS "shippingExpense"
 FROM sale,refunds,payments,units,physical,legacy_returns,expenses`;
  const r = rows[0];
  return {
    ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v)])),
    ...calculateReportedSales(
      Number(r.gross),
      Number(r.discounts),
      Number(r.merchandiseRefunds),
      Number(r.shippingCharged),
      Number(r.shippingRefunded),
    ),
    netTax: Number(r.taxCollected) - Number(r.taxRefunded),
    netShipping: calculateNetShipping(Number(r.shippingCharged), Number(r.shippingRefunded), Number(r.shippingExpense)),
  } as Record<keyof Sales | "net" | "netTax" | "netShipping", number>;
}

export async function getCommerceAnalytics(
  ownerId: string,
  period: AnalyticsPeriod,
  chartPeriod: AnalyticsPeriod | "lifetime" = period,
) {
  return prisma.$transaction(
    async (tx) => {
      const now = new Date();
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const [lifetime, recent, purchases, opening, charts] = await Promise.all([
        sales(tx, ownerId, new Date(0), end),
        sales(tx, ownerId, periodStart(period, now), end),
        tx.inventoryInvestmentEntry.findMany({
          where: { ownerId, kind: "Purchase" },
          include: { corrections: true },
          orderBy: { createdAt: "desc" },
          take: 99,
        }),
        tx.inventoryInvestmentEntry.findFirst({ where: { ownerId, kind: "Opening" }, include: { corrections: true } }),
        getSalesChartData(tx, ownerId, chartPeriod === "lifetime" ? null : periodStart(chartPeriod, now), end),
      ]);
      const investments = opening ? [opening, ...purchases] : purchases;
      // Aggregate independently of the paginated ledger list.
      const aggregate = await tx.inventoryInvestmentEntry.aggregate({
        where: { ownerId },
        _sum: { amount: true },
        _count: true,
      });
      return {
        lifetime,
        recent,
        charts,
        period,
        investment: Number(aggregate._sum.amount ?? 0),
        investmentPosition: calculateInvestmentPosition(
          lifetime.net,
          lifetime.shippingExpense,
          Number(aggregate._sum.amount ?? 0),
        ),
        investmentEntries: investments.map((r) => ({
          id: r.id,
          kind: r.kind,
          amount: r.corrections.reduce((sum, c) => sum.plus(c.amount), r.amount).toFixed(2),
          originalAmount: r.amount.toFixed(2),
          estimated: r.estimated,
          date: r.effectiveAt.toISOString(),
          notes: r.notes,
          evidence: r.evidence,
          corrections: r.corrections.map((c) => ({
            id: c.id,
            amount: c.amount.toString(),
            notes: c.notes,
            date: c.createdAt.toISOString(),
          })),
        })),
        hasOpening: Boolean(opening),
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 20000 },
  );
}
