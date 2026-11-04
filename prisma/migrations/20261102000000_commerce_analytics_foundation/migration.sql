BEGIN;
LOCK TABLE inventory_items, order_items, orders, order_returns, order_return_items, inventory_stock_movements IN SHARE ROW EXCLUSIVE MODE;
-- AlterTable
ALTER TABLE "inventory_settings" ADD COLUMN     "investmentTrackingStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "order_payments" ADD COLUMN     "allocationSource" TEXT,
ADD COLUMN     "merchandiseAmount" DECIMAL(20,2),
ADD COLUMN     "shippingAmount" DECIMAL(20,2),
ADD COLUMN     "taxAmount" DECIMAL(20,2);

-- AlterTable
ALTER TABLE "order_refunds" ADD COLUMN     "adjustmentId" TEXT,
ADD COLUMN     "allocationSource" TEXT,
ADD COLUMN     "merchandiseAmount" DECIMAL(20,2),
ADD COLUMN     "shippingAmount" DECIMAL(20,2),
ADD COLUMN     "taxAmount" DECIMAL(20,2);

-- CreateTable
CREATE TABLE "inventory_investment_entries" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "stockMovementId" TEXT,
    "quantity" INTEGER,
    "unitCost" DECIMAL(20,2),
    "amount" DECIMAL(20,2) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "evidence" JSONB,
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    "correctionOfId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "submissionHash" TEXT NOT NULL,

    CONSTRAINT "inventory_investment_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_adjustments" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "merchandiseAmount" DECIMAL(20,2) NOT NULL,
    "discountAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(20,2) NOT NULL,
    "shippingAmount" DECIMAL(20,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,
    "submissionHash" TEXT NOT NULL,

    CONSTRAINT "order_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_adjustment_items" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "grossAmount" DECIMAL(20,2) NOT NULL,
    "discountAmount" DECIMAL(20,2) NOT NULL,
    "taxAmount" DECIMAL(20,2) NOT NULL,

    CONSTRAINT "order_adjustment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_return_receipts" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderReturnId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "order_return_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_return_receipt_items" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "stockMovementId" TEXT,
    "receivedQuantity" INTEGER NOT NULL,
    "restockedQuantity" INTEGER NOT NULL,
    "condition" TEXT NOT NULL,
    "unitCost" DECIMAL(20,2),
    "retailUnitPrice" DECIMAL(20,2) NOT NULL,
    "evidence" JSONB,

    CONSTRAINT "order_return_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_shipping_expenses" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "incurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "reference" TEXT,
    "notes" TEXT NOT NULL,
    "correctionOfId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "submissionHash" TEXT NOT NULL,

    CONSTRAINT "order_shipping_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_investment_entries_stockMovementId_key" ON "inventory_investment_entries"("stockMovementId");

-- CreateIndex
CREATE INDEX "inventory_investment_entries_ownerId_effectiveAt_idx" ON "inventory_investment_entries"("ownerId", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_investment_entries_id_ownerId_key" ON "inventory_investment_entries"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_investment_entries_ownerId_idempotencyKey_key" ON "inventory_investment_entries"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_investment_entries_stockMovementId_ownerId_key" ON "inventory_investment_entries"("stockMovementId", "ownerId");

-- CreateIndex
CREATE INDEX "order_adjustments_ownerId_effectiveAt_idx" ON "order_adjustments"("ownerId", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_adjustments_id_ownerId_key" ON "order_adjustments"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "order_adjustments_ownerId_idempotencyKey_key" ON "order_adjustments"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "order_adjustment_items_ownerId_orderItemId_idx" ON "order_adjustment_items"("ownerId", "orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "order_adjustment_items_adjustmentId_orderItemId_key" ON "order_adjustment_items"("adjustmentId", "orderItemId");

-- CreateIndex
CREATE INDEX "order_return_receipts_ownerId_receivedAt_idx" ON "order_return_receipts"("ownerId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_return_receipts_id_ownerId_key" ON "order_return_receipts"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "order_return_receipts_ownerId_idempotencyKey_key" ON "order_return_receipts"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "order_return_receipt_items_stockMovementId_key" ON "order_return_receipt_items"("stockMovementId");

-- CreateIndex
CREATE INDEX "order_return_receipt_items_ownerId_orderItemId_idx" ON "order_return_receipt_items"("ownerId", "orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "order_return_receipt_items_receiptId_orderItemId_key" ON "order_return_receipt_items"("receiptId", "orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "order_return_receipt_items_stockMovementId_ownerId_key" ON "order_return_receipt_items"("stockMovementId", "ownerId");

-- CreateIndex
CREATE INDEX "order_shipping_expenses_ownerId_incurredAt_idx" ON "order_shipping_expenses"("ownerId", "incurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_shipping_expenses_id_ownerId_key" ON "order_shipping_expenses"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "order_shipping_expenses_ownerId_idempotencyKey_key" ON "order_shipping_expenses"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "order_shipments_id_orderId_key" ON "order_shipments"("id", "orderId");

-- AddForeignKey
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_adjustmentId_ownerId_fkey" FOREIGN KEY ("adjustmentId", "ownerId") REFERENCES "order_adjustments"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_investment_entries" ADD CONSTRAINT "inventory_investment_entries_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_investment_entries" ADD CONSTRAINT "inventory_investment_entries_inventoryItemId_ownerId_fkey" FOREIGN KEY ("inventoryItemId", "ownerId") REFERENCES "inventory_items"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_investment_entries" ADD CONSTRAINT "inventory_investment_entries_stockMovementId_ownerId_fkey" FOREIGN KEY ("stockMovementId", "ownerId") REFERENCES "inventory_stock_movements"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_investment_entries" ADD CONSTRAINT "inventory_investment_entries_correctionOfId_ownerId_fkey" FOREIGN KEY ("correctionOfId", "ownerId") REFERENCES "inventory_investment_entries"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_adjustments" ADD CONSTRAINT "order_adjustments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_adjustments" ADD CONSTRAINT "order_adjustments_orderId_ownerId_fkey" FOREIGN KEY ("orderId", "ownerId") REFERENCES "orders"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_adjustment_items" ADD CONSTRAINT "order_adjustment_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_adjustment_items" ADD CONSTRAINT "order_adjustment_items_adjustmentId_ownerId_fkey" FOREIGN KEY ("adjustmentId", "ownerId") REFERENCES "order_adjustments"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_adjustment_items" ADD CONSTRAINT "order_adjustment_items_orderItemId_ownerId_fkey" FOREIGN KEY ("orderItemId", "ownerId") REFERENCES "order_items"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_receipts" ADD CONSTRAINT "order_return_receipts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_receipts" ADD CONSTRAINT "order_return_receipts_orderId_ownerId_fkey" FOREIGN KEY ("orderId", "ownerId") REFERENCES "orders"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_receipts" ADD CONSTRAINT "order_return_receipts_orderReturnId_ownerId_fkey" FOREIGN KEY ("orderReturnId", "ownerId") REFERENCES "order_returns"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_receipt_items" ADD CONSTRAINT "order_return_receipt_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_receipt_items" ADD CONSTRAINT "order_return_receipt_items_receiptId_ownerId_fkey" FOREIGN KEY ("receiptId", "ownerId") REFERENCES "order_return_receipts"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_receipt_items" ADD CONSTRAINT "order_return_receipt_items_orderItemId_ownerId_fkey" FOREIGN KEY ("orderItemId", "ownerId") REFERENCES "order_items"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_receipt_items" ADD CONSTRAINT "order_return_receipt_items_inventoryItemId_ownerId_fkey" FOREIGN KEY ("inventoryItemId", "ownerId") REFERENCES "inventory_items"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_receipt_items" ADD CONSTRAINT "order_return_receipt_items_stockMovementId_ownerId_fkey" FOREIGN KEY ("stockMovementId", "ownerId") REFERENCES "inventory_stock_movements"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipping_expenses" ADD CONSTRAINT "order_shipping_expenses_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipping_expenses" ADD CONSTRAINT "order_shipping_expenses_orderId_ownerId_fkey" FOREIGN KEY ("orderId", "ownerId") REFERENCES "orders"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipping_expenses" ADD CONSTRAINT "order_shipping_expenses_shipmentId_orderId_fkey" FOREIGN KEY ("shipmentId", "orderId") REFERENCES "order_shipments"("id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipping_expenses" ADD CONSTRAINT "order_shipping_expenses_correctionOfId_ownerId_fkey" FOREIGN KEY ("correctionOfId", "ownerId") REFERENCES "order_shipping_expenses"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Old money ledgers remain unchanged. Nullable allocations distinguish legacy evidence.
ALTER TABLE order_payments ADD CONSTRAINT payment_components_valid CHECK (
 ("merchandiseAmount" IS NULL AND "taxAmount" IS NULL AND "shippingAmount" IS NULL AND "allocationSource" IS NULL)
 OR ("merchandiseAmount" IS NOT NULL AND "taxAmount" IS NOT NULL AND "shippingAmount" IS NOT NULL AND "allocationSource" IS NOT NULL
 AND "merchandiseAmount">=0 AND "taxAmount">=0 AND "shippingAmount">=0 AND "merchandiseAmount"+"taxAmount"+"shippingAmount"=amount));
ALTER TABLE order_refunds ADD CONSTRAINT refund_components_valid CHECK (
 ("merchandiseAmount" IS NULL AND "taxAmount" IS NULL AND "shippingAmount" IS NULL AND "allocationSource" IS NULL)
 OR ("merchandiseAmount" IS NOT NULL AND "taxAmount" IS NOT NULL AND "shippingAmount" IS NOT NULL AND "allocationSource" IS NOT NULL
 AND "merchandiseAmount">=0 AND "taxAmount">=0 AND "shippingAmount">=0 AND "merchandiseAmount"+"taxAmount"+"shippingAmount"=amount));
ALTER TABLE inventory_investment_entries ADD CONSTRAINT investment_valid CHECK (
 kind IN ('Opening','Purchase','Correction') AND (kind='Correction' OR amount>=0)
 AND (quantity IS NULL OR quantity>0) AND ("unitCost" IS NULL OR "unitCost">=0)
 AND (kind<>'Purchase' OR (quantity IS NOT NULL AND "unitCost" IS NOT NULL AND amount=quantity*"unitCost" AND "stockMovementId" IS NOT NULL))
 AND (kind<>'Correction' OR ("correctionOfId" IS NOT NULL AND notes IS NOT NULL AND length(trim(notes))>0)));
CREATE UNIQUE INDEX investment_one_opening ON inventory_investment_entries("ownerId") WHERE kind='Opening';
ALTER TABLE order_adjustments ADD CONSTRAINT adjustment_valid CHECK (kind IN ('Cancellation','ReturnCredit','PriceCredit') AND "merchandiseAmount">=0 AND "discountAmount">=0 AND "taxAmount">=0 AND "shippingAmount">=0 AND length(trim(reason))>0);
ALTER TABLE order_adjustment_items ADD CONSTRAINT adjustment_item_valid CHECK(quantity>0 AND "grossAmount">=0 AND "discountAmount">=0 AND "discountAmount"<="grossAmount" AND "taxAmount">=0);
ALTER TABLE order_return_receipt_items ADD CONSTRAINT receipt_quantity_valid CHECK("receivedQuantity">0 AND "restockedQuantity" BETWEEN 0 AND "receivedQuantity" AND condition IN ('Sellable','Damaged') AND ("restockedQuantity"=0 OR (condition='Sellable' AND "stockMovementId" IS NOT NULL)));
ALTER TABLE order_shipping_expenses ADD CONSTRAINT shipping_expense_valid CHECK(kind IN ('Outbound','ReturnLabel','CarrierCredit','Correction') AND ((kind IN ('Outbound','ReturnLabel') AND amount>0) OR (kind='CarrierCredit' AND amount<0) OR (kind='Correction' AND "correctionOfId" IS NOT NULL)) AND length(trim(notes))>0);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['inventory_investment_entries','order_adjustments','order_adjustment_items','order_return_receipts','order_return_receipt_items','order_shipping_expenses'] LOOP
 EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION commerce_immutable_ledger()', t||'_immutable', t);
 END LOOP;
END $$;

-- Investment receipts must point to the same positive stock receipt and exact quantity.
CREATE FUNCTION commerce_investment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.kind='Correction' THEN
  PERFORM id FROM workspaces WHERE id=NEW."ownerId" FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM inventory_investment_entries WHERE id=NEW."correctionOfId" AND "ownerId"=NEW."ownerId" AND kind IN('Opening','Purchase')) THEN RAISE EXCEPTION 'Investment correction requires an opening or purchase entry'; END IF;
  IF (SELECT amount FROM inventory_investment_entries WHERE id=NEW."correctionOfId") + COALESCE((SELECT SUM(amount) FROM inventory_investment_entries WHERE "correctionOfId"=NEW."correctionOfId"),0)+NEW.amount<0 THEN RAISE EXCEPTION 'Corrected investment cannot be negative'; END IF;
 END IF;
 IF NEW.kind='Purchase'  AND NOT EXISTS (SELECT 1 FROM inventory_stock_movements m WHERE m.id=NEW."stockMovementId" AND m."ownerId"=NEW."ownerId" AND m."inventoryItemId"=NEW."inventoryItemId" AND m."quantityChange"=NEW.quantity AND m.reason IN ('Receive','Opening balance')) THEN
 RAISE EXCEPTION 'Purchase must match its inventory receipt'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER investment_receipt_guard BEFORE INSERT ON inventory_investment_entries FOR EACH ROW EXECUTE FUNCTION commerce_investment_guard();

-- Capture an opening estimate once, under the same transaction and write lock as this migration.
-- Physically held = available + reserved. Consumed units exclude restocked returns.
WITH resolved AS (
 SELECT "orderItemId", SUM("returnQuantity") AS qty, SUM(CASE WHEN restock THEN "returnQuantity" ELSE 0 END) AS restocked
 FROM order_return_items GROUP BY "orderItemId"
), line_costs AS (
 SELECT i.*, GREATEST(i.quantity-GREATEST(i."shippedQuantity",COALESCE(r.qty,0)),0) AS reserved,
 GREATEST(i."shippedQuantity",COALESCE(r.qty,0))-COALESCE(r.restocked,0) AS consumed
 FROM order_items i JOIN orders o ON o.id=i."orderId" LEFT JOIN resolved r ON r."orderItemId"=i.id
 WHERE o."orderStatus"='Active' AND i."inventoryItemId" IS NOT NULL
), reservations AS (
 SELECT "inventoryItemId", SUM(reserved) AS qty FROM line_costs GROUP BY "inventoryItemId"
), held AS (
 SELECT i."ownerId", SUM((i.stock+COALESCE(r.qty,0))*i.cost) AS cost,
 jsonb_agg(jsonb_build_object('inventoryItemId',i.id,'available',i.stock,'reserved',COALESCE(r.qty,0),'unitCost',i.cost)) AS records
 FROM inventory_items i LEFT JOIN reservations r ON r."inventoryItemId"=i.id GROUP BY i."ownerId"
), consumed AS (
 SELECT "ownerId", SUM(consumed*COALESCE("unitCost",0)) AS cost,
 COUNT(*) FILTER(WHERE "unitCost" IS NULL AND consumed>0) AS unknown FROM line_costs GROUP BY "ownerId"
), losses AS (
 SELECT "ownerId", SUM(-"quantityChange"*COALESCE(("itemSnapshot"->>'cost')::numeric,0)) AS cost,
 COUNT(*) FILTER(WHERE "itemSnapshot"->>'cost' IS NULL) AS unknown
 FROM inventory_stock_movements WHERE reason IN ('Damage','Lost','Stolen') AND "quantityChange"<0 GROUP BY "ownerId"
)
INSERT INTO inventory_investment_entries(id,"ownerId",kind,amount,"effectiveAt","idempotencyKey","submissionHash",estimated,evidence,notes)
SELECT 'opening:'||w.id,w.id,'Opening',ROUND(COALESCE(h.cost,0)+COALESCE(c.cost,0)+COALESCE(l.cost,0),2),CURRENT_TIMESTAMP,
 'opening:commerce-analytics','migration:20261102000000',true,
 jsonb_build_object('currentInventoryCost',COALESCE(h.cost,0),'consumedInventoryCost',COALESCE(c.cost,0),'stockLossCost',COALESCE(l.cost,0),'unknownHistoricalCosts',COALESCE(c.unknown,0)+COALESCE(l.unknown,0),'inventory',COALESCE(h.records,'[]'::jsonb)),
 'Calculated opening estimate from existing physical stock, recorded consumed costs and inventory losses; review before relying on historical investment.'
FROM workspaces w LEFT JOIN held h ON h."ownerId"=w.id LEFT JOIN consumed c ON c."ownerId"=w.id LEFT JOIN losses l ON l."ownerId"=w.id;
INSERT INTO inventory_settings (id,"ownerId","investmentTrackingStartedAt","updatedAt")
SELECT 'analytics:'||id,id,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM workspaces
ON CONFLICT ("ownerId") DO UPDATE SET "investmentTrackingStartedAt"=EXCLUDED."investmentTrackingStartedAt";

-- Keep physical receipts and future cancellation events tied to the right order and quantity.
CREATE FUNCTION commerce_analytics_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_order text; fulfilled integer; prior bigint; legacy bigint; linked integer;
BEGIN
 IF TG_TABLE_NAME='order_return_receipt_items' THEN
  SELECT "orderId" INTO parent_order FROM order_return_receipts WHERE id=NEW."receiptId" AND "ownerId"=NEW."ownerId";
  PERFORM id FROM orders WHERE id=parent_order FOR UPDATE;
  SELECT "shippedQuantity" INTO fulfilled FROM order_items WHERE id=NEW."orderItemId" AND "orderId"=parent_order AND "ownerId"=NEW."ownerId";
  IF fulfilled IS NULL THEN RAISE EXCEPTION 'Return receipt line belongs to another order'; END IF;
  SELECT COALESCE(SUM("receivedQuantity"),0) INTO prior FROM order_return_receipt_items WHERE "orderItemId"=NEW."orderItemId";
  SELECT COALESCE(SUM(i."returnQuantity"),0) INTO legacy FROM order_return_items i JOIN order_returns r ON r.id=i."orderReturnId" WHERE i."orderItemId"=NEW."orderItemId" AND i.disposition='Returned' AND NOT EXISTS(SELECT 1 FROM order_return_receipts p WHERE p."orderReturnId"=r.id);
  IF prior+legacy+NEW."receivedQuantity">fulfilled THEN RAISE EXCEPTION 'Physical returns exceed fulfilled units'; END IF;
  IF NEW."restockedQuantity">0 AND NOT EXISTS(SELECT 1 FROM inventory_stock_movements WHERE id=NEW."stockMovementId" AND "ownerId"=NEW."ownerId" AND "inventoryItemId"=NEW."inventoryItemId" AND "orderItemId"=NEW."orderItemId" AND "quantityChange"=NEW."restockedQuantity" AND reason='Return') THEN RAISE EXCEPTION 'Restock receipt does not match stock movement'; END IF;
 ELSIF TG_TABLE_NAME='order_adjustment_items' THEN
  SELECT "orderId" INTO parent_order FROM order_adjustments WHERE id=NEW."adjustmentId" AND "ownerId"=NEW."ownerId";
  PERFORM id FROM orders WHERE id=parent_order FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM order_items WHERE id=NEW."orderItemId" AND "orderId"=parent_order AND "ownerId"=NEW."ownerId") THEN RAISE EXCEPTION 'Adjustment line belongs to another order'; END IF;
  IF (SELECT kind FROM order_adjustments WHERE id=NEW."adjustmentId")='Cancellation' THEN
   SELECT COALESCE(SUM(i.quantity),0) INTO prior FROM order_adjustment_items i JOIN order_adjustments a ON a.id=i."adjustmentId" WHERE i."orderItemId"=NEW."orderItemId" AND a.kind='Cancellation';
   IF prior+NEW.quantity>(SELECT quantity-"shippedQuantity" FROM order_items WHERE id=NEW."orderItemId") THEN RAISE EXCEPTION 'Cancellation exceeds unfulfilled units'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='order_return_receipts' THEN
  IF NEW."orderReturnId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM order_returns WHERE id=NEW."orderReturnId" AND "orderId"=NEW."orderId" AND "ownerId"=NEW."ownerId") THEN RAISE EXCEPTION 'Return receipt belongs to another order'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER physical_receipt_line_guard BEFORE INSERT ON order_return_receipt_items FOR EACH ROW EXECUTE FUNCTION commerce_analytics_event_guard();
CREATE TRIGGER adjustment_line_order_guard BEFORE INSERT ON order_adjustment_items FOR EACH ROW EXECUTE FUNCTION commerce_analytics_event_guard();
CREATE TRIGGER physical_receipt_order_guard BEFORE INSERT ON order_return_receipts FOR EACH ROW EXECUTE FUNCTION commerce_analytics_event_guard();

CREATE FUNCTION commerce_refund_allocation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE paid order_payments%ROWTYPE; refunded numeric; merchandise numeric; tax numeric; shipping numeric; unknown integer;
BEGIN
 PERFORM id FROM orders WHERE id=NEW."orderId" AND "ownerId"=NEW."ownerId" FOR UPDATE;
 SELECT * INTO paid FROM order_payments WHERE id=NEW."paymentId" AND "orderId"=NEW."orderId" AND "ownerId"=NEW."ownerId";
 IF paid.id IS NULL THEN RAISE EXCEPTION 'Refund payment belongs to another order'; END IF;
 IF NEW."orderReturnId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM order_returns WHERE id=NEW."orderReturnId" AND "orderId"=NEW."orderId" AND "ownerId"=NEW."ownerId") THEN RAISE EXCEPTION 'Refund return belongs to another order'; END IF;
 SELECT COALESCE(SUM(amount),0),COALESCE(SUM("merchandiseAmount"),0),COALESCE(SUM("taxAmount"),0),COALESCE(SUM("shippingAmount"),0),COUNT(*) FILTER(WHERE "taxAmount" IS NULL)
 INTO refunded,merchandise,tax,shipping,unknown FROM order_refunds WHERE "paymentId"=NEW."paymentId" AND status='succeeded';
 IF refunded+NEW.amount>paid.amount THEN RAISE EXCEPTION 'Refund exceeds payment'; END IF;
 IF paid."taxAmount" IS NOT NULL AND NEW."taxAmount" IS NOT NULL AND unknown=0 AND (merchandise+NEW."merchandiseAmount">paid."merchandiseAmount" OR tax+NEW."taxAmount">paid."taxAmount" OR shipping+NEW."shippingAmount">paid."shippingAmount") THEN RAISE EXCEPTION 'Refund exceeds payment component'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER refund_allocation_guard BEFORE INSERT ON order_refunds FOR EACH ROW EXECUTE FUNCTION commerce_refund_allocation_guard();

COMMIT;
