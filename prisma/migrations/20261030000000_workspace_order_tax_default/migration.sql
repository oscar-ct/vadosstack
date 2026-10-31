-- Preserve the existing order preset. Saved order and return taxes are unchanged.
ALTER TABLE "workspaces"
ADD COLUMN "defaultOrderTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 8.25;

ALTER TABLE "workspaces"
ADD CONSTRAINT "workspaces_default_order_tax_rate_range"
CHECK ("defaultOrderTaxRate" >= 0 AND "defaultOrderTaxRate" <= 100);
