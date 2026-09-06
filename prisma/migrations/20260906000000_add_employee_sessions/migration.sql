CREATE TABLE "employee_sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_sessions_tokenHash_key" ON "employee_sessions"("tokenHash");
CREATE INDEX "employee_sessions_ownerId_idx" ON "employee_sessions"("ownerId");
CREATE INDEX "employee_sessions_employeeId_idx" ON "employee_sessions"("employeeId");
CREATE INDEX "employee_sessions_expiresAt_idx" ON "employee_sessions"("expiresAt");

ALTER TABLE "employee_sessions" ADD CONSTRAINT "employee_sessions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_sessions" ADD CONSTRAINT "employee_sessions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
