ALTER TABLE "payment_webhook_events"
  ADD COLUMN "rawPayload" TEXT,
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3);

CREATE INDEX "payment_webhook_events_provider_status_nextAttemptAt_idx"
  ON "payment_webhook_events"("provider", "status", "nextAttemptAt");

CREATE TABLE "payment_disputes" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalDisputeId" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "evidenceDueAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_disputes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_disputes_id_ownerId_key" ON "payment_disputes"("id", "ownerId");
CREATE UNIQUE INDEX "payment_disputes_ownerId_provider_externalDisputeId_key"
  ON "payment_disputes"("ownerId", "provider", "externalDisputeId");
CREATE INDEX "payment_disputes_paymentId_idx" ON "payment_disputes"("paymentId");
CREATE INDEX "payment_disputes_ownerId_status_idx" ON "payment_disputes"("ownerId", "status");

ALTER TABLE "payment_disputes"
  ADD CONSTRAINT "payment_disputes_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_disputes"
  ADD CONSTRAINT "payment_disputes_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "job_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
