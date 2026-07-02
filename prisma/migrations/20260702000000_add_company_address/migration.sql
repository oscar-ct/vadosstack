ALTER TABLE "users"
ADD COLUMN "companyAddress" TEXT;

ALTER TABLE "pending_account_confirmations"
ADD COLUMN "companyAddress" TEXT;
