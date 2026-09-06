ALTER TABLE "time_entry_requests" ADD COLUMN "pendingKey" TEXT;

CREATE UNIQUE INDEX "time_entry_requests_pendingKey_key" ON "time_entry_requests"("pendingKey");
