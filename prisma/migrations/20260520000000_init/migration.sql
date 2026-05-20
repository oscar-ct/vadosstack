-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "billingStatus" TEXT NOT NULL DEFAULT 'Pending',
    "notes" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "customerId" TEXT,
    "description" TEXT NOT NULL,
    "serviceLocation" TEXT,
    "dateBegin" TIMESTAMP(3),
    "dateEnd" TIMESTAMP(3),
    "estimatedCost" DECIMAL(65,30),
    "laborCost" DECIMAL(65,30) DEFAULT 0,
    "laborItems" TEXT NOT NULL DEFAULT '[]',
    "materialTaxRate" DECIMAL(65,30) DEFAULT 0,
    "materials" TEXT NOT NULL DEFAULT '[]',
    "paymentStatus" TEXT NOT NULL DEFAULT 'Pending Payment',
    "amountPaid" DECIMAL(65,30) DEFAULT 0,
    "finalCost" DECIMAL(65,30),
    "scope" TEXT,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "pictures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_payments" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(65,30) NOT NULL,
    "method" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "companyName" TEXT NOT NULL,
    "companyEmail" TEXT,
    "companyPhone" TEXT,
    "companyLogoDataUrl" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "admin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_records" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "customerId" TEXT,
    "description" TEXT NOT NULL,
    "serviceLocation" TEXT,
    "dateBegin" TIMESTAMP(3),
    "dateEnd" TIMESTAMP(3),
    "laborCost" DECIMAL(65,30) DEFAULT 0,
    "laborItems" TEXT NOT NULL DEFAULT '[]',
    "materialTaxRate" DECIMAL(65,30) DEFAULT 0,
    "materials" TEXT NOT NULL DEFAULT '[]',
    "estimatedTotal" DECIMAL(65,30) DEFAULT 0,
    "scope" TEXT,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Estimate Provided',
    "notes" TEXT,
    "convertedJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimate_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "jobTitle" TEXT NOT NULL,
    "jobDescription" TEXT,
    "serviceLocation" TEXT,
    "dateBegin" TIMESTAMP(3),
    "dateEnd" TIMESTAMP(3),
    "laborCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "materialTaxRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "materials" TEXT NOT NULL DEFAULT '[]',
    "materialsSubtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "materialTaxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "finalCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL,
    "jobStatus" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "jobId" TEXT,
    "estimateRecordId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "jobTitle" TEXT NOT NULL,
    "jobDescription" TEXT,
    "serviceLocation" TEXT,
    "dateBegin" TIMESTAMP(3),
    "dateEnd" TIMESTAMP(3),
    "laborCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "materialTaxRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "materials" TEXT NOT NULL DEFAULT '[]',
    "materialsSubtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "materialTaxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estimatedTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "jobStatus" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_templates" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "notes" TEXT,
    "laborItems" TEXT NOT NULL DEFAULT '[]',
    "materialTaxRate" DECIMAL(65,30) NOT NULL DEFAULT 8.25,
    "materials" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workedOn" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "hours" DECIMAL(65,30) NOT NULL,
    "deductLunch" BOOLEAN NOT NULL DEFAULT true,
    "lunchMinutes" INTEGER NOT NULL DEFAULT 60,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entry_requests" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "timeEntryId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "workedOn" TIMESTAMP(3),
    "startTime" TEXT,
    "endTime" TEXT,
    "hours" DECIMAL(65,30),
    "deductLunch" BOOLEAN NOT NULL DEFAULT true,
    "lunchMinutes" INTEGER NOT NULL DEFAULT 60,
    "notes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entry_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_phone_numbers" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_ownerId_idx" ON "customers"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_id_ownerId_key" ON "customers"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_ownerId_email_key" ON "customers"("ownerId", "email");

-- CreateIndex
CREATE INDEX "jobs_ownerId_idx" ON "jobs"("ownerId");

-- CreateIndex
CREATE INDEX "jobs_customerId_idx" ON "jobs"("customerId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_dateBegin_idx" ON "jobs"("dateBegin");

-- CreateIndex
CREATE INDEX "jobs_category_idx" ON "jobs"("category");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_id_ownerId_key" ON "jobs"("id", "ownerId");

-- CreateIndex
CREATE INDEX "job_payments_ownerId_idx" ON "job_payments"("ownerId");

-- CreateIndex
CREATE INDEX "job_payments_jobId_idx" ON "job_payments"("jobId");

-- CreateIndex
CREATE INDEX "job_payments_paidOn_idx" ON "job_payments"("paidOn");

-- CreateIndex
CREATE UNIQUE INDEX "job_payments_id_ownerId_key" ON "job_payments"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "estimate_records_ownerId_idx" ON "estimate_records"("ownerId");

-- CreateIndex
CREATE INDEX "estimate_records_customerId_idx" ON "estimate_records"("customerId");

-- CreateIndex
CREATE INDEX "estimate_records_status_idx" ON "estimate_records"("status");

-- CreateIndex
CREATE INDEX "estimate_records_createdAt_idx" ON "estimate_records"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_records_id_ownerId_key" ON "estimate_records"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_jobId_key" ON "invoices"("jobId");

-- CreateIndex
CREATE INDEX "invoices_ownerId_idx" ON "invoices"("ownerId");

-- CreateIndex
CREATE INDEX "invoices_jobId_idx" ON "invoices"("jobId");

-- CreateIndex
CREATE INDEX "invoices_customerId_idx" ON "invoices"("customerId");

-- CreateIndex
CREATE INDEX "invoices_issuedAt_idx" ON "invoices"("issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_id_ownerId_key" ON "invoices"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_jobId_key" ON "estimates"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_estimateRecordId_key" ON "estimates"("estimateRecordId");

-- CreateIndex
CREATE INDEX "estimates_ownerId_idx" ON "estimates"("ownerId");

-- CreateIndex
CREATE INDEX "estimates_jobId_idx" ON "estimates"("jobId");

-- CreateIndex
CREATE INDEX "estimates_estimateRecordId_idx" ON "estimates"("estimateRecordId");

-- CreateIndex
CREATE INDEX "estimates_customerId_idx" ON "estimates"("customerId");

-- CreateIndex
CREATE INDEX "estimates_issuedAt_idx" ON "estimates"("issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_id_ownerId_key" ON "estimates"("id", "ownerId");

-- CreateIndex
CREATE INDEX "service_templates_ownerId_idx" ON "service_templates"("ownerId");

-- CreateIndex
CREATE INDEX "service_templates_category_idx" ON "service_templates"("category");

-- CreateIndex
CREATE UNIQUE INDEX "service_templates_id_ownerId_key" ON "service_templates"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "employees_ownerId_idx" ON "employees"("ownerId");

-- CreateIndex
CREATE INDEX "employees_active_idx" ON "employees"("active");

-- CreateIndex
CREATE UNIQUE INDEX "employees_id_ownerId_key" ON "employees"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_ownerId_employeeNumber_key" ON "employees"("ownerId", "employeeNumber");

-- CreateIndex
CREATE INDEX "time_entries_ownerId_idx" ON "time_entries"("ownerId");

-- CreateIndex
CREATE INDEX "time_entries_employeeId_idx" ON "time_entries"("employeeId");

-- CreateIndex
CREATE INDEX "time_entries_workedOn_idx" ON "time_entries"("workedOn");

-- CreateIndex
CREATE UNIQUE INDEX "time_entries_id_ownerId_key" ON "time_entries"("id", "ownerId");

-- CreateIndex
CREATE INDEX "time_entry_requests_ownerId_idx" ON "time_entry_requests"("ownerId");

-- CreateIndex
CREATE INDEX "time_entry_requests_employeeId_idx" ON "time_entry_requests"("employeeId");

-- CreateIndex
CREATE INDEX "time_entry_requests_status_idx" ON "time_entry_requests"("status");

-- CreateIndex
CREATE INDEX "time_entry_requests_requestedAt_idx" ON "time_entry_requests"("requestedAt");

-- CreateIndex
CREATE INDEX "customer_addresses_customerId_idx" ON "customer_addresses"("customerId");

-- CreateIndex
CREATE INDEX "customer_phone_numbers_customerId_idx" ON "customer_phone_numbers"("customerId");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_payments" ADD CONSTRAINT "job_payments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_payments" ADD CONSTRAINT "job_payments_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_records" ADD CONSTRAINT "estimate_records_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_records" ADD CONSTRAINT "estimate_records_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_estimateRecordId_fkey" FOREIGN KEY ("estimateRecordId") REFERENCES "estimate_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_templates" ADD CONSTRAINT "service_templates_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_requests" ADD CONSTRAINT "time_entry_requests_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_requests" ADD CONSTRAINT "time_entry_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_phone_numbers" ADD CONSTRAINT "customer_phone_numbers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

