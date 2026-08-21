-- A converted estimate is Won; an estimate without a converted job is not Won.
UPDATE "estimate_records"
SET "status" = 'Won'
WHERE "convertedJobId" IS NOT NULL
  AND "status" IS DISTINCT FROM 'Won';

UPDATE "estimate_records"
SET "status" = 'Waiting on Customer'
WHERE "convertedJobId" IS NULL
  AND "status" IN ('Won', 'Estimate Provided');

-- Keep issued customer copies aligned with their working estimate.
UPDATE "estimates" AS issued_estimate
SET "jobStatus" = estimate_record."status"
FROM "estimate_records" AS estimate_record
WHERE issued_estimate."estimateRecordId" = estimate_record."id"
  AND issued_estimate."jobStatus" IS DISTINCT FROM estimate_record."status";

-- Reopen leads that were marked Won without a converted job.
UPDATE "leads" AS lead
SET
  "status" = 'Estimate Sent',
  "convertedAt" = NULL
FROM "estimate_records" AS estimate_record
WHERE lead."estimateRecordId" = estimate_record."id"
  AND estimate_record."convertedJobId" IS NULL
  AND lead."status" = 'Won';
