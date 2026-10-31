-- Duplicate-label consolidation is distinct from a physical stock transfer.
-- Approval is immutable and applies only to the listed records in the creating transaction.
CREATE TABLE "inventory_location_merges" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "sourceLocationId" TEXT NOT NULL,
  "targetLocationId" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "targetName" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "itemIds" TEXT[],
  "transactionId" BIGINT NOT NULL DEFAULT txid_current(),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_location_merges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_location_merges_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inventory_location_merge_distinct" CHECK ("sourceLocationId" <> "targetLocationId"),
  CONSTRAINT "inventory_location_merge_reason" CHECK (length(trim(reason)) BETWEEN 1 AND 500)
);
CREATE UNIQUE INDEX "inventory_location_merges_ownerId_sourceLocationId_key" ON "inventory_location_merges"("ownerId", "sourceLocationId");
CREATE INDEX "inventory_location_merge_guard_idx" ON "inventory_location_merges"("ownerId", "sourceLocationId", "targetLocationId", "transactionId");
CREATE TRIGGER inventory_location_merge_immutable BEFORE UPDATE OR DELETE ON inventory_location_merges
  FOR EACH ROW EXECUTE FUNCTION commerce_immutable_ledger();

CREATE OR REPLACE FUNCTION commerce_inventory_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked BOOLEAN;
BEGIN
  IF NEW."productId" IS DISTINCT FROM OLD."productId" OR NEW."ownerId" IS DISTINCT FROM OLD."ownerId" THEN
    RAISE EXCEPTION 'Inventory product identity and workspace cannot be changed';
  END IF;
  linked := OLD.stock <> 0
    OR EXISTS (SELECT 1 FROM order_items WHERE "inventoryItemId" = OLD.id)
    OR EXISTS (SELECT 1 FROM order_return_items WHERE "inventoryItemId" = OLD.id)
    OR EXISTS (SELECT 1 FROM inventory_stock_movements WHERE "inventoryItemId" = OLD.id);
  IF linked AND NEW."locationId" IS DISTINCT FROM OLD."locationId" AND NOT EXISTS (
    SELECT 1 FROM inventory_location_merges m
    WHERE m."ownerId" = OLD."ownerId"
      AND m."sourceLocationId" = OLD."locationId"
      AND m."targetLocationId" = NEW."locationId"
      AND m."transactionId" = txid_current()
      AND OLD.id = ANY(m."itemIds")
  ) THEN
    RAISE EXCEPTION 'Inventory location is locked; use a stock transfer';
  END IF;
  IF (linked OR EXISTS (SELECT 1 FROM inventory_items WHERE "productId" = OLD."productId" AND id <> OLD.id))
    AND (NEW.product IS DISTINCT FROM OLD.product OR NEW.sku IS DISTINCT FROM OLD.sku
      OR NEW.unit IS DISTINCT FROM OLD.unit OR NEW.barcode IS DISTINCT FROM OLD.barcode) THEN
    RAISE EXCEPTION 'Recorded inventory identity is locked; create a new product instead';
  END IF;
  RETURN NEW;
END $$;
