-- Expand the existing manual payment record into a provider-neutral payment ledger.
BEGIN;

ALTER TABLE "job_payments"
  ADD COLUMN "invoiceId" TEXT,
  ADD COLUMN "refundedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "feeAmount" DECIMAL(65,30),
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'succeeded',
  ADD COLUMN "methodType" TEXT,
  ADD COLUMN "externalPaymentId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "failureCode" TEXT,
  ADD COLUMN "failureMessage" TEXT;

UPDATE "job_payments" payment
SET "invoiceId" = invoice."id"
FROM "invoices" invoice
WHERE invoice."jobId" = payment."jobId"
  AND invoice."ownerId" = payment."ownerId";

ALTER TABLE "job_payments"
  ADD CONSTRAINT "job_payments_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "job_payments_amount_positive_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "job_payments_refunded_amount_check" CHECK ("refundedAmount" >= 0 AND "refundedAmount" <= "amount");

CREATE UNIQUE INDEX "job_payments_ownerId_provider_externalPaymentId_key"
  ON "job_payments"("ownerId", "provider", "externalPaymentId");
CREATE UNIQUE INDEX "job_payments_ownerId_idempotencyKey_key"
  ON "job_payments"("ownerId", "idempotencyKey");
CREATE INDEX "job_payments_invoiceId_idx" ON "job_payments"("invoiceId");
CREATE INDEX "job_payments_ownerId_status_idx" ON "job_payments"("ownerId", "status");
CREATE UNIQUE INDEX "job_payments_one_open_attempt_per_invoice"
  ON "job_payments"("invoiceId")
  WHERE "invoiceId" IS NOT NULL
    AND "provider" <> 'manual'
    AND "status" IN ('created', 'pending', 'processing');

CREATE TABLE "payment_provider_connections" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalAccountId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
  "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "encryptedCredentials" TEXT,
  "credentialKeyVersion" INTEGER,
  "connectedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_provider_connections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_provider_connections_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "payment_provider_connections_ownerId_provider_key"
  ON "payment_provider_connections"("ownerId", "provider");
CREATE UNIQUE INDEX "payment_provider_connections_provider_externalAccountId_key"
  ON "payment_provider_connections"("provider", "externalAccountId");
CREATE INDEX "payment_provider_connections_ownerId_status_idx"
  ON "payment_provider_connections"("ownerId", "status");

CREATE TABLE "invoice_payment_links" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastAccessedAt" TIMESTAMP(3),
  "accessCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoice_payment_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_payment_links_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "invoice_payment_links_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "invoice_payment_links_tokenHash_key" ON "invoice_payment_links"("tokenHash");
CREATE UNIQUE INDEX "invoice_payment_links_id_ownerId_key" ON "invoice_payment_links"("id", "ownerId");
CREATE INDEX "invoice_payment_links_ownerId_idx" ON "invoice_payment_links"("ownerId");
CREATE INDEX "invoice_payment_links_invoiceId_idx" ON "invoice_payment_links"("invoiceId");
CREATE INDEX "invoice_payment_links_expiresAt_idx" ON "invoice_payment_links"("expiresAt");

CREATE TABLE "payment_refunds" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalRefundId" TEXT,
  "amount" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reason" TEXT,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "refundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_refunds_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_refunds_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "job_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_refunds_amount_positive_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "payment_refunds_id_ownerId_key" ON "payment_refunds"("id", "ownerId");
CREATE UNIQUE INDEX "payment_refunds_ownerId_provider_externalRefundId_key"
  ON "payment_refunds"("ownerId", "provider", "externalRefundId");
CREATE INDEX "payment_refunds_paymentId_idx" ON "payment_refunds"("paymentId");
CREATE INDEX "payment_refunds_ownerId_status_idx" ON "payment_refunds"("ownerId", "status");

CREATE TABLE "payment_webhook_events" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT,
  "provider" TEXT NOT NULL,
  "externalEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerObjectId" TEXT,
  "payloadHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'received',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_webhook_events_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "payment_webhook_events_provider_externalEventId_key"
  ON "payment_webhook_events"("provider", "externalEventId");
CREATE INDEX "payment_webhook_events_ownerId_idx" ON "payment_webhook_events"("ownerId");
CREATE INDEX "payment_webhook_events_provider_status_idx"
  ON "payment_webhook_events"("provider", "status");
CREATE INDEX "payment_webhook_events_receivedAt_idx" ON "payment_webhook_events"("receivedAt");

-- New permissions are additive. Existing custom roles remain unchanged; protected templates receive sensible defaults.
INSERT INTO "workspace_role_permissions" ("roleId", "permissionKey", "createdAt")
SELECT role."id", permission.permission_key, NOW()
FROM "workspace_roles" role
CROSS JOIN unnest(ARRAY['payments.view', 'payments.refund', 'payments.settings.manage']::text[]) AS permission(permission_key)
WHERE role."systemKey" IN ('OWNER', 'ADMIN', 'MANAGER')
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;

INSERT INTO "workspace_role_permissions" ("roleId", "permissionKey", "createdAt")
SELECT role."id", 'payments.view', NOW()
FROM "workspace_roles" role
WHERE role."systemKey" IN ('OFFICE_STAFF', 'READ_ONLY')
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;

COMMIT;
