BEGIN;

-- Snapshot the VadosStack fee charged for each payment separately from Stripe's processing fee.
ALTER TABLE "job_payments"
  ADD COLUMN "applicationFeeAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD CONSTRAINT "job_payments_application_fee_check"
    CHECK ("applicationFeeAmount" >= 0 AND "applicationFeeAmount" < "amount");

COMMIT;

