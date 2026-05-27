CREATE TABLE "pending_account_confirmations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "companyName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_account_confirmations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pending_account_confirmations_email_key" ON "pending_account_confirmations"("email");
CREATE UNIQUE INDEX "pending_account_confirmations_tokenHash_key" ON "pending_account_confirmations"("tokenHash");
CREATE INDEX "pending_account_confirmations_expiresAt_idx" ON "pending_account_confirmations"("expiresAt");
