CREATE TABLE "inventory_settings" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "lowStockThreshold" INTEGER NOT NULL DEFAULT 25,
  "criticalStockThreshold" INTEGER NOT NULL DEFAULT 8,
  "defaultReorderPoint" INTEGER NOT NULL DEFAULT 20,
  "defaultMaxStock" INTEGER NOT NULL DEFAULT 100,
  "autoRestockAlerts" BOOLEAN NOT NULL DEFAULT true,
  "includeOutOfStock" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_settings_ownerId_key" ON "inventory_settings"("ownerId");

ALTER TABLE "inventory_settings" ADD CONSTRAINT "inventory_settings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
