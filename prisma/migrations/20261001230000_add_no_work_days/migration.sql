CREATE TABLE "no_work_days" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "jobId" TEXT,
  "workedOn" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "no_work_days_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "no_work_days_reason_check" CHECK (
    "reason" IN (
      'weather',
      'customer_cancellation',
      'no_work_scheduled',
      'company_closure',
      'material_or_equipment_delay',
      'personal',
      'other'
    )
  )
);

CREATE UNIQUE INDEX "no_work_days_id_ownerId_key" ON "no_work_days"("id", "ownerId");
CREATE UNIQUE INDEX "no_work_days_ownerId_employeeId_workedOn_key"
  ON "no_work_days"("ownerId", "employeeId", "workedOn");
CREATE INDEX "no_work_days_ownerId_workedOn_idx" ON "no_work_days"("ownerId", "workedOn");
CREATE INDEX "no_work_days_employeeId_workedOn_idx" ON "no_work_days"("employeeId", "workedOn");
CREATE INDEX "no_work_days_jobId_idx" ON "no_work_days"("jobId");

ALTER TABLE "no_work_days"
  ADD CONSTRAINT "no_work_days_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "no_work_days"
  ADD CONSTRAINT "no_work_days_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "no_work_days"
  ADD CONSTRAINT "no_work_days_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
