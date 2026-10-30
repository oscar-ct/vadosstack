import { PrismaClient } from "@prisma/client";

import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

const urlIndex = process.argv.indexOf("--url");
const url = urlIndex >= 0 ? process.argv[urlIndex + 1] : undefined;
const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

async function main() {
  // Works before and after the hardening migration. Emit counts, never customer data.
  const results = await prisma.$queryRaw<Array<{ check: string; count: bigint }>>`
    SELECT 'invalid_inventory' AS "check", COUNT(*) FROM inventory_items
      WHERE stock < 0 OR cost < 0 OR "unitPrice" < 0 OR "taxRate" NOT BETWEEN 0 AND 100 OR "reorderPoint" < 0 OR "maxStock" < 0
    UNION ALL SELECT 'invalid_order_money', COUNT(*) FROM orders
      WHERE subtotal < 0 OR total < 0 OR "shippingAmount" < 0 OR "taxAmount" < 0 OR "discountAmount" NOT BETWEEN 0 AND subtotal
      OR ABS(total - (subtotal + "shippingAmount" + "taxAmount" - "discountAmount")) > 0.01
    UNION ALL SELECT 'invalid_order_lines', COUNT(*) FROM order_items
      WHERE quantity <= 0 OR "unitPrice" < 0 OR "lineTotal" < 0 OR "taxRate" NOT BETWEEN 0 AND 100
    UNION ALL SELECT 'invalid_return_quantities', COUNT(*) FROM order_return_items r JOIN order_items i ON i.id = r."orderItemId"
      WHERE r."returnQuantity" < 0 OR r."returnQuantity" > i.quantity OR r."returnQuantity" > r."orderedQuantity"
    UNION ALL SELECT 'invalid_refund_amounts', COUNT(*) FROM order_returns WHERE "refundAmount" < 0
    UNION ALL SELECT 'cross_workspace_order_items', COUNT(*) FROM order_items i JOIN orders o ON o.id = i."orderId"
      LEFT JOIN inventory_items p ON p.id = i."inventoryItemId" WHERE i."ownerId" <> o."ownerId" OR (p.id IS NOT NULL AND p."ownerId" <> i."ownerId")
    UNION ALL SELECT 'cross_workspace_returns', COUNT(*) FROM order_returns r JOIN orders o ON o.id = r."orderId" WHERE r."ownerId" <> o."ownerId"
    UNION ALL SELECT 'cross_workspace_return_items', COUNT(*) FROM order_return_items i JOIN order_returns r ON r.id = i."orderReturnId"
      JOIN order_items o ON o.id = i."orderItemId" WHERE i."ownerId" <> r."ownerId" OR i."ownerId" <> o."ownerId" OR r."orderId" <> o."orderId"
  `;
  const checks = results.map((result) => ({ check: result.check, count: Number(result.count) }));
  const identitySchema = await prisma.$queryRaw<Array<{ present: boolean }>>`
    SELECT to_regclass('inventory_products') IS NOT NULL AS present
  `;
  if (identitySchema[0]?.present) {
    const identityChecks = await prisma.$queryRaw<Array<{ check: string; count: bigint }>>`
      SELECT 'invalid_product_identity' AS "check", COUNT(*) FROM inventory_items i
        LEFT JOIN inventory_products p ON p.id = i."productId" AND p."ownerId" = i."ownerId" WHERE p.id IS NULL
      UNION ALL SELECT 'missing_event_snapshots', COUNT(*) FROM inventory_stock_movements
        WHERE "snapshotSource" = 'event' AND ("itemSnapshot" IS NULL OR "itemSnapshot"->>'product' IS NULL)
      UNION ALL SELECT 'stock_ledger_difference', COUNT(*) FROM inventory_items i
        WHERE i.stock <> COALESCE((SELECT SUM(m."quantityChange") FROM inventory_stock_movements m WHERE m."inventoryItemId" = i.id), 0)
      UNION ALL SELECT 'unpaired_stock_transfers', COUNT(*) FROM inventory_stock_movements a
        WHERE a.reason = 'Transfer' AND a."quantityChange" < 0 AND a."idempotencyKey" IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM inventory_stock_movements b
            WHERE b."ownerId" = a."ownerId" AND b."idempotencyKey" = a."idempotencyKey" || ':destination'
              AND b.reason = 'Transfer' AND b."quantityChange" = -a."quantityChange")
    `;
    checks.push(...identityChecks.map((result) => ({ check: result.check, count: Number(result.count) })));
  }
  console.table(checks);
  const failed = checks.some((result) => result.count > 0);
  console.log(
    failed
      ? "Commerce preflight failed. Investigate and correct these records before deployment; do not discard history."
      : "Commerce preflight passed.",
  );
  process.exitCode = failed ? 1 : 0;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
