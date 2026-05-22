ALTER TABLE "jobs" ADD COLUMN "depositPaid" DECIMAL(65,30) DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "depositPaid" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "job_payments" ADD COLUMN "paymentType" TEXT NOT NULL DEFAULT 'deposit';

UPDATE "jobs"
SET "depositPaid" = COALESCE("amountPaid", 0);

UPDATE "invoices"
SET "depositPaid" = COALESCE("amountPaid", 0);
