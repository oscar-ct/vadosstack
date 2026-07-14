CREATE TABLE "document_number_events" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "documentNumber" TEXT NOT NULL,
  "documentId" TEXT,
  "action" TEXT NOT NULL,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_number_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_number_events_ownerId_idx" ON "document_number_events"("ownerId");
CREATE INDEX "document_number_events_type_sequenceNumber_idx" ON "document_number_events"("type", "sequenceNumber");
CREATE INDEX "document_number_events_documentId_idx" ON "document_number_events"("documentId");
CREATE INDEX "document_number_events_createdAt_idx" ON "document_number_events"("createdAt");

ALTER TABLE "document_number_events"
ADD CONSTRAINT "document_number_events_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "document_number_events" (
  "id",
  "ownerId",
  "type",
  "sequenceNumber",
  "documentNumber",
  "documentId",
  "action",
  "createdAt"
)
SELECT
  'document_number_event_' || md5(assignment."id" || ':assigned'),
  assignment."ownerId",
  assignment."type",
  assignment."sequenceNumber",
  assignment."documentNumber",
  assignment."documentId",
  'assigned',
  assignment."assignedAt"
FROM "document_number_assignments" AS assignment;

UPDATE "document_number_assignments" AS assignment
SET
  "status" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "email_records" AS email
      WHERE email."ownerId" = assignment."ownerId"
        AND email."documentType" = 'invoice'
        AND email."documentId" = assignment."documentId"
        AND email."status" = 'success'
    ) THEN 'voided'
    ELSE 'released'
  END,
  "deletedAt" = CURRENT_TIMESTAMP,
  "voidedAt" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "email_records" AS email
      WHERE email."ownerId" = assignment."ownerId"
        AND email."documentType" = 'invoice'
        AND email."documentId" = assignment."documentId"
        AND email."status" = 'success'
    ) THEN CURRENT_TIMESTAMP
    ELSE NULL
  END
WHERE assignment."type" = 'invoice'
  AND assignment."status" = 'assigned'
  AND NOT EXISTS (
    SELECT 1
    FROM "invoices" AS invoice
    WHERE invoice."id" = assignment."documentId"
      AND invoice."ownerId" = assignment."ownerId"
  );

INSERT INTO "document_number_events" (
  "id",
  "ownerId",
  "type",
  "sequenceNumber",
  "documentNumber",
  "documentId",
  "action",
  "detail"
)
SELECT
  'document_number_event_' || md5(assignment."id" || ':migration-lifecycle'),
  assignment."ownerId",
  assignment."type",
  assignment."sequenceNumber",
  assignment."documentNumber",
  assignment."documentId",
  assignment."status",
  'Classified during invoice number lifecycle migration.'
FROM "document_number_assignments" AS assignment
WHERE assignment."type" = 'invoice'
  AND assignment."status" IN ('released', 'voided')
  AND assignment."deletedAt" IS NOT NULL;

UPDATE "document_sequences" AS sequence
SET "nextNumber" = COALESCE((
  SELECT MAX(assignment."sequenceNumber") + 1
  FROM "document_number_assignments" AS assignment
  WHERE assignment."ownerId" = sequence."ownerId"
    AND assignment."type" = sequence."type"
    AND assignment."status" <> 'released'
), 1)
WHERE sequence."type" = 'invoice';
