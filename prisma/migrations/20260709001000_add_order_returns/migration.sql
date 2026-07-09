CREATE TABLE "order_returns" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "returnNumber" TEXT NOT NULL,
  "refundStatus" TEXT NOT NULL DEFAULT 'No Refund',
  "returnStatus" TEXT NOT NULL DEFAULT 'Draft',
  "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "refundAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "refundMethod" TEXT,
  "refundReference" TEXT,
  "reason" TEXT,
  "customerNote" TEXT,
  "internalNotes" TEXT,
  "restockItems" BOOLEAN NOT NULL DEFAULT true,
  "savedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "order_returns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_return_items" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "orderReturnId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "inventoryItemId" TEXT,
  "sku" TEXT,
  "product" TEXT NOT NULL,
  "category" TEXT,
  "orderedQuantity" INTEGER NOT NULL DEFAULT 0,
  "returnQuantity" INTEGER NOT NULL DEFAULT 0,
  "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "lineRefund" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "restock" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "order_return_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_returns_id_ownerId_key" ON "order_returns"("id", "ownerId");
CREATE UNIQUE INDEX "order_returns_ownerId_orderId_key" ON "order_returns"("ownerId", "orderId");
CREATE UNIQUE INDEX "order_returns_ownerId_returnNumber_key" ON "order_returns"("ownerId", "returnNumber");
CREATE INDEX "order_returns_ownerId_idx" ON "order_returns"("ownerId");
CREATE INDEX "order_returns_orderId_idx" ON "order_returns"("orderId");
CREATE INDEX "order_returns_returnStatus_idx" ON "order_returns"("returnStatus");

CREATE UNIQUE INDEX "order_return_items_id_ownerId_key" ON "order_return_items"("id", "ownerId");
CREATE UNIQUE INDEX "order_return_items_orderReturnId_orderItemId_key" ON "order_return_items"("orderReturnId", "orderItemId");
CREATE INDEX "order_return_items_ownerId_idx" ON "order_return_items"("ownerId");
CREATE INDEX "order_return_items_orderReturnId_idx" ON "order_return_items"("orderReturnId");
CREATE INDEX "order_return_items_orderItemId_idx" ON "order_return_items"("orderItemId");
CREATE INDEX "order_return_items_inventoryItemId_idx" ON "order_return_items"("inventoryItemId");

ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_orderReturnId_fkey" FOREIGN KEY ("orderReturnId") REFERENCES "order_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
