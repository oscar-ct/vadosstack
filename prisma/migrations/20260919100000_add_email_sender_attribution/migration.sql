-- Preserve the human actor independently from the connected Gmail mailbox.
ALTER TABLE "email_records"
  ADD COLUMN "sentByUserId" TEXT,
  ADD COLUMN "sentByName" TEXT,
  ADD COLUMN "sentByEmail" TEXT;

CREATE INDEX "email_records_sentByUserId_idx" ON "email_records"("sentByUserId");
