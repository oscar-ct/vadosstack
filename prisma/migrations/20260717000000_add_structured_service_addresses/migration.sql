ALTER TABLE "jobs"
  ADD COLUMN "serviceAddressLine1" TEXT,
  ADD COLUMN "serviceAddressLine2" TEXT,
  ADD COLUMN "serviceCity" TEXT,
  ADD COLUMN "serviceState" TEXT,
  ADD COLUMN "servicePostalCode" TEXT;

ALTER TABLE "estimate_records"
  ADD COLUMN "serviceAddressLine1" TEXT,
  ADD COLUMN "serviceAddressLine2" TEXT,
  ADD COLUMN "serviceCity" TEXT,
  ADD COLUMN "serviceState" TEXT,
  ADD COLUMN "servicePostalCode" TEXT;

ALTER TABLE "leads"
  ADD COLUMN "serviceAddressLine1" TEXT,
  ADD COLUMN "serviceAddressLine2" TEXT,
  ADD COLUMN "serviceCity" TEXT,
  ADD COLUMN "serviceState" TEXT,
  ADD COLUMN "servicePostalCode" TEXT;

ALTER TABLE "estimates"
  ADD COLUMN "serviceAddressLine1" TEXT,
  ADD COLUMN "serviceAddressLine2" TEXT,
  ADD COLUMN "serviceCity" TEXT,
  ADD COLUMN "serviceState" TEXT,
  ADD COLUMN "servicePostalCode" TEXT;

ALTER TABLE "invoices"
  ADD COLUMN "serviceAddressLine1" TEXT,
  ADD COLUMN "serviceAddressLine2" TEXT,
  ADD COLUMN "serviceCity" TEXT,
  ADD COLUMN "serviceState" TEXT,
  ADD COLUMN "servicePostalCode" TEXT;
