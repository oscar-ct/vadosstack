ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "jobId" TEXT;
ALTER TABLE "time_entry_requests" ADD COLUMN IF NOT EXISTS "jobId" TEXT;

CREATE INDEX IF NOT EXISTS "time_entries_jobId_idx" ON "time_entries"("jobId");
CREATE INDEX IF NOT EXISTS "time_entry_requests_jobId_idx" ON "time_entry_requests"("jobId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'time_entries_jobId_fkey'
  ) THEN
    ALTER TABLE "time_entries"
      ADD CONSTRAINT "time_entries_jobId_fkey"
      FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'time_entry_requests_jobId_fkey'
  ) THEN
    ALTER TABLE "time_entry_requests"
      ADD CONSTRAINT "time_entry_requests_jobId_fkey"
      FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
