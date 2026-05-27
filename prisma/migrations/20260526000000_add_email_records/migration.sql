CREATE TABLE IF NOT EXISTS "email_records" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentId" TEXT,
  "documentNumber" TEXT,
  "recipientName" TEXT,
  "recipientEmail" TEXT,
  "senderEmail" TEXT,
  "subject" TEXT,
  "documentTotal" DECIMAL(65,30),
  "status" TEXT NOT NULL,
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_records_id_ownerId_key" ON "email_records"("id", "ownerId");
CREATE INDEX IF NOT EXISTS "email_records_ownerId_idx" ON "email_records"("ownerId");
CREATE INDEX IF NOT EXISTS "email_records_documentType_idx" ON "email_records"("documentType");
CREATE INDEX IF NOT EXISTS "email_records_documentId_idx" ON "email_records"("documentId");
CREATE INDEX IF NOT EXISTS "email_records_status_idx" ON "email_records"("status");
CREATE INDEX IF NOT EXISTS "email_records_sentAt_idx" ON "email_records"("sentAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_records_ownerId_fkey'
  ) THEN
    ALTER TABLE "email_records"
      ADD CONSTRAINT "email_records_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "email_records" ADD COLUMN IF NOT EXISTS "documentTotal" DECIMAL(65,30);
