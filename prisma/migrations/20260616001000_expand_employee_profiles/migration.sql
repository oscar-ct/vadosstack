ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "jobTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "employmentType" TEXT NOT NULL DEFAULT 'Employee',
  ADD COLUMN IF NOT EXISTS "payType" TEXT NOT NULL DEFAULT 'Hourly',
  ADD COLUMN IF NOT EXISTS "payRate" DECIMAL(65,30),
  ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyName" TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyRelation" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE INDEX IF NOT EXISTS "employees_department_idx" ON "employees"("department");
CREATE INDEX IF NOT EXISTS "employees_employmentType_idx" ON "employees"("employmentType");
