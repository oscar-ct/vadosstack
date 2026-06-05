CREATE TABLE "rate_limit_attempts" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rate_limit_attempts_action_keyHash_createdAt_idx" ON "rate_limit_attempts"("action", "keyHash", "createdAt");
CREATE INDEX "rate_limit_attempts_createdAt_idx" ON "rate_limit_attempts"("createdAt");
