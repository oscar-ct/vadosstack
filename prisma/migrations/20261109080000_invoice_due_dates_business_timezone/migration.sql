-- Business-local display/reporting does not shift stored event timestamps.
ALTER TABLE "workspaces" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'America/Chicago';
ALTER TABLE "invoices" ADD COLUMN "dueAt" DATE;
-- Historical original terms were not captured. Freeze the date derived from
-- the current business terms once; later settings changes will not move it.
UPDATE "invoices" AS i SET "dueAt" =
  ((i."issuedAt" AT TIME ZONE 'UTC') AT TIME ZONE w."timeZone")::date + w."invoiceDueDays"
FROM "workspaces" AS w WHERE w.id = i."ownerId";
ALTER TABLE "invoices" ALTER COLUMN "dueAt" SET NOT NULL;
CREATE INDEX "invoices_ownerId_dueAt_idx" ON "invoices"("ownerId", "dueAt");
