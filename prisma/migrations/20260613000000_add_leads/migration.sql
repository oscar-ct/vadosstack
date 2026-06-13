CREATE TABLE "leads" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "customerId" TEXT,
  "estimateRecordId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "source" TEXT,
  "serviceType" TEXT,
  "serviceLocation" TEXT,
  "estimatedValue" DECIMAL(65,30),
  "status" TEXT NOT NULL DEFAULT 'New',
  "priority" TEXT NOT NULL DEFAULT 'Normal',
  "notes" TEXT,
  "followUpAt" TIMESTAMP(3),
  "lostReason" TEXT,
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leads_id_ownerId_key" ON "leads"("id", "ownerId");
CREATE UNIQUE INDEX "leads_estimateRecordId_key" ON "leads"("estimateRecordId");
CREATE INDEX "leads_ownerId_idx" ON "leads"("ownerId");
CREATE INDEX "leads_customerId_idx" ON "leads"("customerId");
CREATE INDEX "leads_estimateRecordId_idx" ON "leads"("estimateRecordId");
CREATE INDEX "leads_status_idx" ON "leads"("status");
CREATE INDEX "leads_followUpAt_idx" ON "leads"("followUpAt");
CREATE INDEX "leads_source_idx" ON "leads"("source");

ALTER TABLE "leads" ADD CONSTRAINT "leads_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leads" ADD CONSTRAINT "leads_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads" ADD CONSTRAINT "leads_estimateRecordId_fkey"
  FOREIGN KEY ("estimateRecordId") REFERENCES "estimate_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
