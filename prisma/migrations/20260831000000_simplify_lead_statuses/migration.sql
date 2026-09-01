-- Lead estimate stages are derived from their linked estimate record.
UPDATE "leads" AS lead
SET
  "status" = CASE
    WHEN estimate."convertedJobId" IS NOT NULL OR estimate."status" = 'Won' THEN 'Won'
    WHEN estimate."status" = 'Lost' THEN 'Lost'
    ELSE 'In Progress'
  END,
  "convertedAt" = CASE
    WHEN estimate."convertedJobId" IS NOT NULL OR estimate."status" = 'Won'
      THEN COALESCE(lead."convertedAt", NOW())
    ELSE NULL
  END
FROM "estimate_records" AS estimate
WHERE lead."estimateRecordId" = estimate."id";

-- Preserve the simplified manual states and translate older estimate-specific stages.
UPDATE "leads"
SET
  "status" = CASE
    WHEN "status" IN ('Estimate Needed', 'Estimate Draft', 'Estimate Ready', 'Estimate Sent') THEN 'In Progress'
    WHEN "status" IN ('New', 'In Progress', 'Won', 'Lost') THEN "status"
    ELSE 'New'
  END,
  "convertedAt" = CASE WHEN "status" = 'Won' THEN "convertedAt" ELSE NULL END
WHERE
  "estimateRecordId" IS NULL;

-- Lead value belongs to estimates, so the basic lead record no longer stores a separate amount.
ALTER TABLE "leads" DROP COLUMN "estimatedValue";
