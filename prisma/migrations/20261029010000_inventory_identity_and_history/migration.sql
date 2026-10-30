BEGIN;

CREATE TABLE inventory_products (
  id TEXT PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT inventory_products_id_ownerId_key UNIQUE (id, "ownerId")
);
CREATE INDEX "inventory_products_ownerId_idx" ON inventory_products("ownerId");
ALTER TABLE inventory_items ADD COLUMN "productId" TEXT;
-- Each legacy record starts separately. Names and SKUs are not reliable grouping evidence.
UPDATE inventory_items SET "productId" = 'legacy_product_' || id;
INSERT INTO inventory_products(id, "ownerId") SELECT "productId", "ownerId" FROM inventory_items;
-- A committed, paired transfer proves that two records represented the same product.
DO $$
DECLARE edge RECORD; source_key TEXT; destination_key TEXT;
BEGIN
  FOR edge IN
    SELECT DISTINCT a."ownerId", a."inventoryItemId" AS source, b."inventoryItemId" AS destination
    FROM inventory_stock_movements a
    JOIN inventory_stock_movements b ON b."ownerId" = a."ownerId"
      AND b."idempotencyKey" = a."idempotencyKey" || ':destination'
    WHERE a.reason = 'Transfer' AND b.reason = 'Transfer'
      AND a."quantityChange" < 0 AND b."quantityChange" = -a."quantityChange"
  LOOP
    SELECT "productId" INTO source_key FROM inventory_items WHERE id = edge.source AND "ownerId" = edge."ownerId";
    SELECT "productId" INTO destination_key FROM inventory_items WHERE id = edge.destination AND "ownerId" = edge."ownerId";
    IF source_key IS NOT NULL AND destination_key IS NOT NULL AND source_key <> destination_key THEN
      UPDATE inventory_items SET "productId" = LEAST(source_key, destination_key)
      WHERE "ownerId" = edge."ownerId" AND "productId" IN (source_key, destination_key);
    END IF;
  END LOOP;
END $$;
DELETE FROM inventory_products p WHERE NOT EXISTS (SELECT 1 FROM inventory_items i WHERE i."productId" = p.id);
ALTER TABLE inventory_items ALTER COLUMN "productId" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE inventory_items ALTER COLUMN "productId" SET NOT NULL;
ALTER TABLE inventory_items ADD CONSTRAINT "inventory_items_productId_ownerId_fkey"
  FOREIGN KEY ("productId", "ownerId") REFERENCES inventory_products(id, "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "inventory_items_ownerId_productId_idx" ON inventory_items("ownerId", "productId");

-- Also supports existing import/seed writers that insert an item directly.
CREATE FUNCTION commerce_inventory_identity_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO inventory_products(id, "ownerId") VALUES (NEW."productId", NEW."ownerId") ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_identity_insert BEFORE INSERT ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION commerce_inventory_identity_insert();

CREATE FUNCTION commerce_inventory_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked BOOLEAN;
BEGIN
  IF NEW."productId" IS DISTINCT FROM OLD."productId" OR NEW."ownerId" IS DISTINCT FROM OLD."ownerId" THEN
    RAISE EXCEPTION 'Inventory product identity and workspace cannot be changed';
  END IF;
  linked := OLD.stock <> 0
    OR EXISTS (SELECT 1 FROM order_items WHERE "inventoryItemId" = OLD.id)
    OR EXISTS (SELECT 1 FROM order_return_items WHERE "inventoryItemId" = OLD.id)
    OR EXISTS (SELECT 1 FROM inventory_stock_movements WHERE "inventoryItemId" = OLD.id);
  IF linked AND NEW."locationId" IS DISTINCT FROM OLD."locationId" THEN
    RAISE EXCEPTION 'Inventory location is locked; use a stock transfer';
  END IF;
  IF (linked OR EXISTS (SELECT 1 FROM inventory_items WHERE "productId" = OLD."productId" AND id <> OLD.id))
    AND (NEW.product IS DISTINCT FROM OLD.product OR NEW.sku IS DISTINCT FROM OLD.sku
      OR NEW.unit IS DISTINCT FROM OLD.unit OR NEW.barcode IS DISTINCT FROM OLD.barcode) THEN
    RAISE EXCEPTION 'Recorded inventory identity is locked; create a new product instead';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_identity_guard BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION commerce_inventory_identity_guard();

ALTER TABLE order_items ADD COLUMN description TEXT, ADD COLUMN unit TEXT;
ALTER TABLE order_return_items ADD COLUMN description TEXT, ADD COLUMN unit TEXT;
-- No description/unit backfill: those values were never recorded for older lines.
CREATE FUNCTION commerce_order_item_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW."inventoryItemId", NEW.product, NEW.sku, NEW.category, NEW.description, NEW.unit, NEW."unitCost")
      IS DISTINCT FROM ROW(OLD."inventoryItemId", OLD.product, OLD.sku, OLD.category, OLD.description, OLD.unit, OLD."unitCost") THEN
      RAISE EXCEPTION 'Saved order item details are immutable';
    END IF;
  ELSIF NEW."inventoryItemId" IS NOT NULL THEN
    SELECT i.*, c.name AS category_name INTO item FROM inventory_items i
      LEFT JOIN inventory_categories c ON c.id = i."categoryId"
      WHERE i.id = NEW."inventoryItemId" AND i."ownerId" = NEW."ownerId";
    IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item was not found in this workspace'; END IF;
    NEW.product := item.product; NEW.sku := item.sku; NEW.category := item.category_name;
    NEW.description := item.description; NEW.unit := item.unit;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER order_item_snapshot BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION commerce_order_item_snapshot();
CREATE FUNCTION commerce_return_item_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE line RECORD;
BEGIN
  SELECT * INTO line FROM order_items WHERE id = NEW."orderItemId" AND "ownerId" = NEW."ownerId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Original order line was not found in this workspace'; END IF;
  NEW.product := line.product; NEW.sku := line.sku; NEW.category := line.category;
  NEW.description := line.description; NEW.unit := line.unit;
  RETURN NEW;
END $$;
CREATE TRIGGER return_item_snapshot BEFORE INSERT ON order_return_items
  FOR EACH ROW EXECUTE FUNCTION commerce_return_item_snapshot();

ALTER TABLE inventory_stock_movements ADD COLUMN "itemSnapshot" JSONB,
  ADD COLUMN "snapshotSource" TEXT NOT NULL DEFAULT 'legacy_unrecorded';
ALTER TABLE inventory_stock_movements DISABLE TRIGGER inventory_movement_immutable;
-- Preserve only labels already stored on the original order line, never today's inventory metadata.
UPDATE inventory_stock_movements m SET "itemSnapshot" = jsonb_build_object(
    'product', o.product, 'sku', o.sku, 'category', o.category,
    'description', o.description, 'unit', o.unit), "snapshotSource" = 'legacy_order'
FROM order_items o WHERE o.id = m."orderItemId" AND o."ownerId" = m."ownerId";
ALTER TABLE inventory_stock_movements ENABLE TRIGGER inventory_movement_immutable;
ALTER TABLE inventory_stock_movements ALTER COLUMN "snapshotSource" SET DEFAULT 'event';
CREATE FUNCTION commerce_stock_item_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT jsonb_build_object(
    'inventoryItemId', i.id, 'productId', i."productId", 'product', i.product, 'sku', i.sku,
    'description', i.description, 'unit', i.unit, 'barcode', i.barcode,
    'category', c.name, 'locationId', i."locationId", 'location', l.name,
    'cost', i.cost, 'unitPrice', i."unitPrice"
  ) INTO NEW."itemSnapshot" FROM inventory_items i
  LEFT JOIN inventory_categories c ON c.id = i."categoryId"
  LEFT JOIN inventory_locations l ON l.id = i."locationId"
  WHERE i.id = NEW."inventoryItemId" AND i."ownerId" = NEW."ownerId";
  IF NEW."itemSnapshot" IS NULL THEN RAISE EXCEPTION 'Stock item was not found in this workspace'; END IF;
  NEW."snapshotSource" := 'event';
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_movement_snapshot BEFORE INSERT ON inventory_stock_movements
  FOR EACH ROW EXECUTE FUNCTION commerce_stock_item_snapshot();

COMMIT;
