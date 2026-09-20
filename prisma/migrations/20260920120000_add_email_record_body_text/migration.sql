-- Keep a plain-text snapshot of the message that was sent or attempted.
ALTER TABLE "email_records"
  ADD COLUMN "bodyText" TEXT;
