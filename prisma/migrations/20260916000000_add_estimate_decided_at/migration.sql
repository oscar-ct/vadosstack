ALTER TABLE "estimate_records"
ADD COLUMN "decidedAt" TIMESTAMP(3);

-- Job creation and estimate conversion happen in the same transaction, so the
-- linked job's creation time is an exact historical decision time for wins.
UPDATE "estimate_records" AS estimate_record
SET "decidedAt" = job."createdAt"
FROM "jobs" AS job
WHERE estimate_record."convertedJobId" = job."id"
  AND estimate_record."status" = 'Won';

CREATE INDEX "estimate_records_ownerId_decidedAt_idx"
ON "estimate_records"("ownerId", "decidedAt");
