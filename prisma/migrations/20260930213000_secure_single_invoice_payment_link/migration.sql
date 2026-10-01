BEGIN;

ALTER TABLE "invoice_payment_links" ADD COLUMN "tokenCipher" TEXT;

-- Preserve the newest active link for each invoice and retire any older duplicates.
WITH ranked_active_links AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "invoiceId"
      ORDER BY ("expiresAt" IS NULL OR "expiresAt" > CURRENT_TIMESTAMP) DESC, "createdAt" DESC, "id" DESC
    ) AS position
  FROM "invoice_payment_links"
  WHERE "revokedAt" IS NULL
)
UPDATE "invoice_payment_links" AS link
SET "revokedAt" = CURRENT_TIMESTAMP,
    "updatedAt" = CURRENT_TIMESTAMP
FROM ranked_active_links AS ranked
WHERE link."id" = ranked."id"
  AND ranked.position > 1;

CREATE UNIQUE INDEX "invoice_payment_links_one_active_per_invoice"
  ON "invoice_payment_links"("invoiceId")
  WHERE "revokedAt" IS NULL;

COMMIT;
