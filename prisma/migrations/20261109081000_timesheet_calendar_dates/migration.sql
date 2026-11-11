BEGIN;
-- Work dates and payroll weeks are calendar dates, not event timestamps.
-- Preserve the original selected UTC calendar day; never shift createdAt.
ALTER TABLE "time_entries" ALTER COLUMN "workedOn" TYPE DATE USING "workedOn"::date;
ALTER TABLE "no_work_days" ALTER COLUMN "workedOn" TYPE DATE USING "workedOn"::date;
ALTER TABLE "time_entry_requests" ALTER COLUMN "workedOn" TYPE DATE USING "workedOn"::date;
ALTER TABLE "timesheet_locks" ALTER COLUMN "weekStart" TYPE DATE USING "weekStart"::date;
COMMIT;
