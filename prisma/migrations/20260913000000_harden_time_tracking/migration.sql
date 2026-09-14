-- Protect employee requests from overwriting newer manager changes.
ALTER TABLE "time_entry_requests"
ADD COLUMN "baseEntryUpdatedAt" TIMESTAMP(3),
ADD COLUMN "reviewReason" TEXT;

-- Preserve a durable audit trail even when the original time entry is removed.
CREATE TABLE "time_entry_audits" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "timeEntryId" TEXT,
  "requestId" TEXT,
  "action" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "beforeSnapshot" JSONB,
  "afterSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "time_entry_audits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "timesheet_locks" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "lockedById" TEXT NOT NULL,
  "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "timesheet_locks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "timesheet_locks_ownerId_weekStart_key" ON "timesheet_locks"("ownerId", "weekStart");
CREATE INDEX "timesheet_locks_ownerId_lockedAt_idx" ON "timesheet_locks"("ownerId", "lockedAt");
CREATE INDEX "time_entry_audits_ownerId_createdAt_idx" ON "time_entry_audits"("ownerId", "createdAt");
CREATE INDEX "time_entry_audits_employeeId_createdAt_idx" ON "time_entry_audits"("employeeId", "createdAt");
CREATE INDEX "time_entry_audits_timeEntryId_idx" ON "time_entry_audits"("timeEntryId");
CREATE INDEX "time_entry_audits_requestId_idx" ON "time_entry_audits"("requestId");
CREATE INDEX "time_entries_ownerId_workedOn_idx" ON "time_entries"("ownerId", "workedOn");
CREATE INDEX "time_entries_ownerId_employeeId_workedOn_idx" ON "time_entries"("ownerId", "employeeId", "workedOn");
CREATE INDEX "time_entry_requests_ownerId_status_requestedAt_idx" ON "time_entry_requests"("ownerId", "status", "requestedAt");

ALTER TABLE "time_entry_audits"
ADD CONSTRAINT "time_entry_audits_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "time_entry_audits"
ADD CONSTRAINT "time_entry_audits_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "timesheet_locks"
ADD CONSTRAINT "timesheet_locks_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
