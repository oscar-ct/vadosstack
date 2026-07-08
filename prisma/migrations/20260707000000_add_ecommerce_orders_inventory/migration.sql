ALTER TABLE "users"
ADD COLUMN "orderMessageText" TEXT NOT NULL DEFAULT 'Thank you for your order. We appreciate your business and will keep you updated if anything changes.';

CREATE TABLE "inventory_categories" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_locations" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_items" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "categoryId" TEXT,
  "locationId" TEXT,
  "sku" TEXT NOT NULL,
  "product" TEXT NOT NULL,
  "description" TEXT,
  "stock" INTEGER NOT NULL DEFAULT 0,
  "reorderPoint" INTEGER NOT NULL DEFAULT 0,
  "maxStock" INTEGER NOT NULL DEFAULT 0,
  "unit" TEXT NOT NULL DEFAULT 'each',
  "cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "taxable" BOOLEAN NOT NULL DEFAULT true,
  "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "itemStatus" TEXT NOT NULL DEFAULT 'Active',
  "barcode" TEXT,
  "vendor" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "customerId" TEXT,
  "orderNumber" TEXT NOT NULL,
  "paymentStatus" TEXT NOT NULL DEFAULT 'Paid',
  "fulfillmentStatus" TEXT NOT NULL DEFAULT 'Unfulfilled',
  "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "estimatedDelivery" TIMESTAMP(3),
  "shippingService" TEXT,
  "trackingNumber" TEXT,
  "paymentMethod" TEXT,
  "paymentReference" TEXT,
  "customerNotes" TEXT,
  "internalNotes" TEXT,
  "customerName" TEXT,
  "customerEmail" TEXT,
  "customerPhone" TEXT,
  "shippingLine1" TEXT,
  "shippingLine2" TEXT,
  "shippingCity" TEXT,
  "shippingState" TEXT,
  "shippingPostalCode" TEXT,
  "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "shippingAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "footerMessage" TEXT NOT NULL DEFAULT 'Thank you for your order. We appreciate your business and will keep you updated if anything changes.',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_items" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "inventoryItemId" TEXT,
  "sku" TEXT,
  "product" TEXT NOT NULL,
  "category" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "lineTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "taxable" BOOLEAN NOT NULL DEFAULT true,
  "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_stock_movements" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "orderId" TEXT,
  "orderItemId" TEXT,
  "quantityChange" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_categories_id_ownerId_key" ON "inventory_categories"("id", "ownerId");
CREATE UNIQUE INDEX "inventory_categories_ownerId_name_key" ON "inventory_categories"("ownerId", "name");
CREATE INDEX "inventory_categories_ownerId_idx" ON "inventory_categories"("ownerId");

CREATE UNIQUE INDEX "inventory_locations_id_ownerId_key" ON "inventory_locations"("id", "ownerId");
CREATE UNIQUE INDEX "inventory_locations_ownerId_name_key" ON "inventory_locations"("ownerId", "name");
CREATE INDEX "inventory_locations_ownerId_idx" ON "inventory_locations"("ownerId");

CREATE UNIQUE INDEX "inventory_items_id_ownerId_key" ON "inventory_items"("id", "ownerId");
CREATE UNIQUE INDEX "inventory_items_ownerId_sku_key" ON "inventory_items"("ownerId", "sku");
CREATE INDEX "inventory_items_ownerId_idx" ON "inventory_items"("ownerId");
CREATE INDEX "inventory_items_categoryId_idx" ON "inventory_items"("categoryId");
CREATE INDEX "inventory_items_locationId_idx" ON "inventory_items"("locationId");
CREATE INDEX "inventory_items_itemStatus_idx" ON "inventory_items"("itemStatus");

CREATE UNIQUE INDEX "orders_id_ownerId_key" ON "orders"("id", "ownerId");
CREATE UNIQUE INDEX "orders_ownerId_orderNumber_key" ON "orders"("ownerId", "orderNumber");
CREATE INDEX "orders_ownerId_idx" ON "orders"("ownerId");
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");
CREATE INDEX "orders_paymentStatus_idx" ON "orders"("paymentStatus");
CREATE INDEX "orders_fulfillmentStatus_idx" ON "orders"("fulfillmentStatus");
CREATE INDEX "orders_orderDate_idx" ON "orders"("orderDate");

CREATE UNIQUE INDEX "order_items_id_ownerId_key" ON "order_items"("id", "ownerId");
CREATE INDEX "order_items_ownerId_idx" ON "order_items"("ownerId");
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");
CREATE INDEX "order_items_inventoryItemId_idx" ON "order_items"("inventoryItemId");

CREATE UNIQUE INDEX "inventory_stock_movements_id_ownerId_key" ON "inventory_stock_movements"("id", "ownerId");
CREATE INDEX "inventory_stock_movements_ownerId_idx" ON "inventory_stock_movements"("ownerId");
CREATE INDEX "inventory_stock_movements_inventoryItemId_idx" ON "inventory_stock_movements"("inventoryItemId");
CREATE INDEX "inventory_stock_movements_orderId_idx" ON "inventory_stock_movements"("orderId");
CREATE INDEX "inventory_stock_movements_orderItemId_idx" ON "inventory_stock_movements"("orderItemId");
CREATE INDEX "inventory_stock_movements_createdAt_idx" ON "inventory_stock_movements"("createdAt");

ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
