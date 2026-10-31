-- Nullable fields preserve legacy prices without inventing historical catalog prices.
ALTER TABLE "order_items"
ADD COLUMN "catalogUnitPrice" DECIMAL(65,30),
ADD COLUMN "priceOverrideReason" TEXT;

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_catalog_price_nonnegative"
CHECK ("catalogUnitPrice" IS NULL OR "catalogUnitPrice" >= 0),
ADD CONSTRAINT "order_items_override_reason_length"
CHECK ("priceOverrideReason" IS NULL OR length(trim("priceOverrideReason")) BETWEEN 1 AND 500);
