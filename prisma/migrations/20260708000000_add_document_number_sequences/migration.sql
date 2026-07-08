ALTER TABLE "invoices" ADD COLUMN "invoiceNumber" TEXT;
ALTER TABLE "estimates" ADD COLUMN "estimateNumber" TEXT;

CREATE TABLE "document_sequences" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  "padding" INTEGER NOT NULL DEFAULT 4,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_number_assignments" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "sequenceId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "documentNumber" TEXT NOT NULL,
  "documentId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'assigned',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  CONSTRAINT "document_number_assignments_pkey" PRIMARY KEY ("id")
);

WITH numbered AS (
  SELECT
    "id",
    "ownerId",
    ROW_NUMBER() OVER (PARTITION BY "ownerId" ORDER BY "issuedAt" ASC, "createdAt" ASC, "id" ASC) AS sequence_number
  FROM "invoices"
)
UPDATE "invoices" AS invoice
SET "invoiceNumber" = 'INV' || LPAD(numbered.sequence_number::TEXT, 4, '0')
FROM numbered
WHERE invoice."id" = numbered."id";

WITH numbered AS (
  SELECT
    "id",
    "ownerId",
    ROW_NUMBER() OVER (PARTITION BY "ownerId" ORDER BY "issuedAt" ASC, "createdAt" ASC, "id" ASC) AS sequence_number
  FROM "estimates"
)
UPDATE "estimates" AS estimate
SET "estimateNumber" = 'EST' || LPAD(numbered.sequence_number::TEXT, 4, '0')
FROM numbered
WHERE estimate."id" = numbered."id";

WITH invoice_sequences AS (
  SELECT
    "ownerId",
    COALESCE(MAX(NULLIF(regexp_replace("invoiceNumber", '\D', '', 'g'), '')::INTEGER), 0) + 1 AS next_number
  FROM "invoices"
  GROUP BY "ownerId"
)
INSERT INTO "document_sequences" ("id", "ownerId", "type", "prefix", "nextNumber", "padding")
SELECT
  'document_sequence_' || md5("ownerId" || ':invoice'),
  "ownerId",
  'invoice',
  'INV',
  next_number,
  4
FROM invoice_sequences;

WITH estimate_sequences AS (
  SELECT
    "ownerId",
    COALESCE(MAX(NULLIF(regexp_replace("estimateNumber", '\D', '', 'g'), '')::INTEGER), 0) + 1 AS next_number
  FROM "estimates"
  GROUP BY "ownerId"
)
INSERT INTO "document_sequences" ("id", "ownerId", "type", "prefix", "nextNumber", "padding")
SELECT
  'document_sequence_' || md5("ownerId" || ':estimate'),
  "ownerId",
  'estimate',
  'EST',
  next_number,
  4
FROM estimate_sequences;

WITH order_sequences AS (
  SELECT
    "ownerId",
    COALESCE(MAX(NULLIF(regexp_replace("orderNumber", '\D', '', 'g'), '')::INTEGER), 0) + 1 AS next_number
  FROM "orders"
  GROUP BY "ownerId"
)
INSERT INTO "document_sequences" ("id", "ownerId", "type", "prefix", "nextNumber", "padding")
SELECT
  'document_sequence_' || md5("ownerId" || ':order'),
  "ownerId",
  'order',
  'ORD',
  next_number,
  4
FROM order_sequences;

INSERT INTO "document_number_assignments" (
  "id",
  "ownerId",
  "sequenceId",
  "type",
  "sequenceNumber",
  "documentNumber",
  "documentId"
)
SELECT
  'document_number_' || md5(invoice."ownerId" || ':invoice:' || invoice."invoiceNumber"),
  invoice."ownerId",
  sequence."id",
  'invoice',
  NULLIF(regexp_replace(invoice."invoiceNumber", '\D', '', 'g'), '')::INTEGER,
  invoice."invoiceNumber",
  invoice."id"
FROM "invoices" AS invoice
JOIN "document_sequences" AS sequence
  ON sequence."ownerId" = invoice."ownerId" AND sequence."type" = 'invoice'
WHERE invoice."invoiceNumber" IS NOT NULL;

INSERT INTO "document_number_assignments" (
  "id",
  "ownerId",
  "sequenceId",
  "type",
  "sequenceNumber",
  "documentNumber",
  "documentId"
)
SELECT
  'document_number_' || md5(estimate."ownerId" || ':estimate:' || estimate."estimateNumber"),
  estimate."ownerId",
  sequence."id",
  'estimate',
  NULLIF(regexp_replace(estimate."estimateNumber", '\D', '', 'g'), '')::INTEGER,
  estimate."estimateNumber",
  estimate."id"
FROM "estimates" AS estimate
JOIN "document_sequences" AS sequence
  ON sequence."ownerId" = estimate."ownerId" AND sequence."type" = 'estimate'
WHERE estimate."estimateNumber" IS NOT NULL;

INSERT INTO "document_number_assignments" (
  "id",
  "ownerId",
  "sequenceId",
  "type",
  "sequenceNumber",
  "documentNumber",
  "documentId"
)
SELECT
  'document_number_' || md5("orders"."ownerId" || ':order:' || "orders"."orderNumber"),
  "orders"."ownerId",
  sequence."id",
  'order',
  NULLIF(regexp_replace("orders"."orderNumber", '\D', '', 'g'), '')::INTEGER,
  "orders"."orderNumber",
  "orders"."id"
FROM "orders"
JOIN "document_sequences" AS sequence
  ON sequence."ownerId" = "orders"."ownerId" AND sequence."type" = 'order'
WHERE NULLIF(regexp_replace("orders"."orderNumber", '\D', '', 'g'), '') IS NOT NULL;

CREATE UNIQUE INDEX "invoices_ownerId_invoiceNumber_key" ON "invoices"("ownerId", "invoiceNumber");
CREATE UNIQUE INDEX "estimates_ownerId_estimateNumber_key" ON "estimates"("ownerId", "estimateNumber");

CREATE UNIQUE INDEX "document_sequences_ownerId_type_key" ON "document_sequences"("ownerId", "type");
CREATE INDEX "document_sequences_ownerId_idx" ON "document_sequences"("ownerId");

CREATE UNIQUE INDEX "document_number_assignments_ownerId_type_sequenceNumber_key" ON "document_number_assignments"("ownerId", "type", "sequenceNumber");
CREATE UNIQUE INDEX "document_number_assignments_ownerId_type_documentNumber_key" ON "document_number_assignments"("ownerId", "type", "documentNumber");
CREATE INDEX "document_number_assignments_ownerId_idx" ON "document_number_assignments"("ownerId");
CREATE INDEX "document_number_assignments_documentId_idx" ON "document_number_assignments"("documentId");
CREATE INDEX "document_number_assignments_type_idx" ON "document_number_assignments"("type");

ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_number_assignments" ADD CONSTRAINT "document_number_assignments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_number_assignments" ADD CONSTRAINT "document_number_assignments_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "document_sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
