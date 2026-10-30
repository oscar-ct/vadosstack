-- Run the commerce preflight audit and take a backup before applying this migration.
-- Existing money totals are preserved; historical costs remain unknown rather than invented.
BEGIN;

-- DropForeignKey
ALTER TABLE "order_return_items" DROP CONSTRAINT "order_return_items_orderItemId_fkey";

-- DropForeignKey
ALTER TABLE "inventory_stock_movements" DROP CONSTRAINT "inventory_stock_movements_inventoryItemId_fkey";

-- DropIndex
DROP INDEX "order_returns_ownerId_orderId_key";

-- AlterTable
ALTER TABLE "inventory_settings" ADD COLUMN     "restockAlertEmail" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "orderStatus" TEXT NOT NULL DEFAULT 'Active',
ADD COLUMN     "reservationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "submissionHash" TEXT,
ADD COLUMN     "submissionKey" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "shippedQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "unitCost" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "order_returns" ADD COLUMN     "refundState" TEXT NOT NULL DEFAULT 'not_required',
ADD COLUMN     "submissionHash" TEXT,
ADD COLUMN     "submissionKey" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "order_return_items" ADD COLUMN     "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "unitCost" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "inventory_stock_movements" ADD COLUMN     "actorUserId" TEXT,
ADD COLUMN     "balanceAfter" INTEGER,
ADD COLUMN     "idempotencyKey" TEXT;

-- CreateTable
CREATE TABLE "order_payments" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "source" TEXT NOT NULL DEFAULT 'external',
    "idempotencyKey" TEXT NOT NULL,
    "actorUserId" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_refunds" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderReturnId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'succeeded',
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "source" TEXT NOT NULL DEFAULT 'external',
    "idempotencyKey" TEXT NOT NULL,
    "actorUserId" TEXT,
    "refundedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_shipments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actorUserId" TEXT,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "shippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_shipment_items" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "order_shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_alerts" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "episodeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "deliveredAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stock_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_payments_orderId_idx" ON "order_payments"("orderId");

-- CreateIndex
CREATE INDEX "order_payments_ownerId_paidAt_idx" ON "order_payments"("ownerId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_payments_ownerId_idempotencyKey_key" ON "order_payments"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "order_refunds_orderId_idx" ON "order_refunds"("orderId");

-- CreateIndex
CREATE INDEX "order_refunds_paymentId_idx" ON "order_refunds"("paymentId");

-- CreateIndex
CREATE INDEX "order_refunds_orderReturnId_idx" ON "order_refunds"("orderReturnId");

-- CreateIndex
CREATE INDEX "order_refunds_ownerId_refundedAt_idx" ON "order_refunds"("ownerId", "refundedAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_refunds_ownerId_idempotencyKey_key" ON "order_refunds"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "order_shipments_orderId_shippedAt_idx" ON "order_shipments"("orderId", "shippedAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_shipments_orderId_idempotencyKey_key" ON "order_shipments"("orderId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "order_shipment_items_orderItemId_idx" ON "order_shipment_items"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "order_shipment_items_shipmentId_orderItemId_key" ON "order_shipment_items"("shipmentId", "orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_alerts_inventoryItemId_key" ON "inventory_stock_alerts"("inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_stock_alerts_status_deliveredAt_idx" ON "inventory_stock_alerts"("status", "deliveredAt");

-- CreateIndex
CREATE INDEX "orders_ownerId_orderDate_id_idx" ON "orders"("ownerId", "orderDate", "id");

-- CreateIndex
CREATE INDEX "orders_orderStatus_reservationExpiresAt_idx" ON "orders"("orderStatus", "reservationExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_ownerId_submissionKey_key" ON "orders"("ownerId", "submissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "order_returns_ownerId_submissionKey_key" ON "order_returns"("ownerId", "submissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_movements_ownerId_idempotencyKey_key" ON "inventory_stock_movements"("ownerId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "order_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_orderReturnId_fkey" FOREIGN KEY ("orderReturnId") REFERENCES "order_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipment_items" ADD CONSTRAINT "order_shipment_items_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "order_shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipment_items" ADD CONSTRAINT "order_shipment_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_alerts" ADD CONSTRAINT "inventory_stock_alerts_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE orders ALTER COLUMN "paymentStatus" SET DEFAULT 'Pending';

-- Preserve fulfillment and paid opening balances from the previous status-only workflow.
UPDATE order_items i SET "shippedQuantity" = i.quantity
FROM orders o WHERE o.id = i."orderId" AND o."fulfillmentStatus" IN ('Fulfilled', 'Returned');

INSERT INTO order_payments (id, "ownerId", "orderId", amount, method, reference, source, "idempotencyKey", "paidAt", "createdAt")
SELECT 'legacy-payment-' || id, "ownerId", id, total, COALESCE(NULLIF("paymentMethod", ''), 'Legacy external payment'),
       "paymentReference", 'legacy', 'legacy-order:' || id, "orderDate", "createdAt"
FROM orders WHERE "paymentStatus" = 'Paid' AND total > 0;

-- Allocate the stored order discount and tax without changing any historical order total.
WITH weights AS (
  SELECT i.id, i."orderId", i."lineTotal" AS gross,
         CASE WHEN i.taxable THEN i."lineTotal" * i."taxRate" ELSE 0 END AS tax_weight,
         o."discountAmount", o."taxAmount"
  FROM order_items i JOIN orders o ON o.id = i."orderId"
), sums AS (
  SELECT *, SUM(gross) OVER (PARTITION BY "orderId") AS total_gross,
     SUM(tax_weight) OVER (PARTITION BY "orderId") AS total_tax_weight,
     SUM(gross) OVER (PARTITION BY "orderId" ORDER BY id) AS cumulative_gross,
     SUM(tax_weight) OVER (PARTITION BY "orderId" ORDER BY id) AS cumulative_tax
  FROM weights
), allocated AS (
  SELECT id,
    CASE WHEN total_gross > 0 THEN ROUND("discountAmount" * cumulative_gross / total_gross, 2) - ROUND("discountAmount" * (cumulative_gross - gross) / total_gross, 2) ELSE 0 END AS discount,
    CASE WHEN total_tax_weight > 0 THEN ROUND("taxAmount" * cumulative_tax / total_tax_weight, 2) - ROUND("taxAmount" * (cumulative_tax - tax_weight) / total_tax_weight, 2)
      WHEN total_gross > 0 THEN ROUND("taxAmount" * cumulative_gross / total_gross, 2) - ROUND("taxAmount" * (cumulative_gross - gross) / total_gross, 2) ELSE 0 END AS tax
  FROM sums
)
UPDATE order_items i SET "discountAmount" = a.discount, "taxAmount" = a.tax FROM allocated a WHERE i.id = a.id;

UPDATE order_return_items r SET "discountAmount" = ROUND(i."discountAmount" * r."returnQuantity" / NULLIF(i.quantity, 0), 2),
  "taxAmount" = ROUND(i."taxAmount" * r."returnQuantity" / NULLIF(i.quantity, 0), 2)
FROM order_items i WHERE i.id = r."orderItemId" AND i.quantity > 0;

-- A legacy return is a refund request until staff confirm the actual external transaction.
UPDATE order_returns SET "refundState" = CASE WHEN "refundAmount" > 0 THEN 'requested' ELSE 'not_required' END;
UPDATE order_return_items i SET "lineRefund" = 0 FROM order_returns r WHERE r.id = i."orderReturnId" AND r."refundAmount" = 0;

-- Make the movement ledger reconcile with today's count, including historical manual edits.
INSERT INTO inventory_stock_movements (id, "ownerId", "inventoryItemId", "quantityChange", reason, notes, "createdAt", "balanceAfter", "idempotencyKey")
SELECT 'commerce-opening-' || i.id, i."ownerId", i.id, i.stock - COALESCE(m.net, 0),
 'Migration reconciliation', 'Opening adjustment for stock changes predating the audited workflow', CURRENT_TIMESTAMP, i.stock, 'commerce-opening:' || i.id
FROM inventory_items i LEFT JOIN (SELECT "inventoryItemId", SUM("quantityChange")::integer AS net FROM inventory_stock_movements GROUP BY "inventoryItemId") m ON m."inventoryItemId" = i.id;

-- Database invariants backstop every application entry point. Invalid legacy data stops the migration.
ALTER TABLE inventory_items ADD CONSTRAINT inventory_stock_nonnegative CHECK (stock >= 0),
 ADD CONSTRAINT inventory_prices_nonnegative CHECK (cost >= 0 AND "unitPrice" >= 0 AND "taxRate" BETWEEN 0 AND 100 AND "reorderPoint" >= 0 AND "maxStock" >= 0);
ALTER TABLE order_items ADD CONSTRAINT order_item_quantity_valid CHECK (quantity > 0 AND "shippedQuantity" BETWEEN 0 AND quantity),
 ADD CONSTRAINT order_item_money_valid CHECK ("unitPrice" >= 0 AND "lineTotal" >= 0 AND "discountAmount" >= 0 AND "discountAmount" <= "lineTotal" AND "taxAmount" >= 0 AND "taxRate" BETWEEN 0 AND 100 AND ("unitCost" IS NULL OR "unitCost" >= 0));
ALTER TABLE orders ADD CONSTRAINT order_money_valid CHECK (subtotal >= 0 AND "shippingAmount" >= 0 AND "discountAmount" BETWEEN 0 AND subtotal AND "taxAmount" >= 0 AND total >= 0),
 ADD CONSTRAINT order_status_valid CHECK ("orderStatus" IN ('Active', 'Cancelled')),
 ADD CONSTRAINT order_payment_status_valid CHECK ("paymentStatus" IN ('Paid', 'Pending', 'Partially Paid', 'Refunded', 'Partially Refunded')),
 ADD CONSTRAINT order_version_positive CHECK (version > 0);
ALTER TABLE order_return_items ADD CONSTRAINT return_item_quantity_valid CHECK ("returnQuantity" >= 0 AND "returnQuantity" <= "orderedQuantity"),
 ADD CONSTRAINT return_item_money_valid CHECK ("lineRefund" >= 0 AND "taxAmount" >= 0 AND "discountAmount" >= 0);
ALTER TABLE order_returns ADD CONSTRAINT return_refund_nonnegative CHECK ("refundAmount" >= 0);
ALTER TABLE order_payments ADD CONSTRAINT order_payment_amount_positive CHECK (amount > 0 AND currency = 'USD');
ALTER TABLE order_refunds ADD CONSTRAINT order_refund_amount_positive CHECK (amount > 0 AND currency = 'USD' AND status = 'succeeded');
ALTER TABLE order_shipment_items ADD CONSTRAINT shipment_quantity_positive CHECK (quantity > 0);

INSERT INTO workspace_role_permissions ("roleId", "permissionKey")
SELECT id, 'orders.payments.manage' FROM workspace_roles WHERE "systemKey" IN ('OWNER', 'ADMIN', 'MANAGER')
ON CONFLICT DO NOTHING;

CREATE FUNCTION commerce_immutable_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Commerce ledger entries are immutable; record a separate correcting transaction';
END;
$$;
CREATE TRIGGER order_payment_immutable BEFORE UPDATE OR DELETE ON order_payments FOR EACH ROW EXECUTE FUNCTION commerce_immutable_ledger();
CREATE TRIGGER order_refund_immutable BEFORE UPDATE OR DELETE ON order_refunds FOR EACH ROW EXECUTE FUNCTION commerce_immutable_ledger();

CREATE TRIGGER order_return_item_immutable BEFORE UPDATE OR DELETE ON order_return_items FOR EACH ROW EXECUTE FUNCTION commerce_immutable_ledger();
CREATE TRIGGER inventory_movement_immutable BEFORE UPDATE OR DELETE ON inventory_stock_movements FOR EACH ROW EXECUTE FUNCTION commerce_immutable_ledger();
CREATE TRIGGER order_shipment_immutable BEFORE UPDATE OR DELETE ON order_shipments FOR EACH ROW EXECUTE FUNCTION commerce_immutable_ledger();
CREATE TRIGGER order_shipment_item_immutable BEFORE UPDATE OR DELETE ON order_shipment_items FOR EACH ROW EXECUTE FUNCTION commerce_immutable_ledger();

CREATE FUNCTION commerce_final_return() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (to_jsonb(NEW) - 'refundState' - 'updatedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'refundState' - 'updatedAt') THEN
    RAISE EXCEPTION 'Saved returns are immutable; record another return event';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER order_return_final BEFORE UPDATE OR DELETE ON order_returns FOR EACH ROW EXECUTE FUNCTION commerce_final_return();

COMMIT;
