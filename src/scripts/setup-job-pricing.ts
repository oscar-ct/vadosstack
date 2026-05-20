import { deriveCustomerBillingStatus } from "../lib/customer-billing";
import { prisma } from "../lib/prisma";

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "laborCost" DECIMAL DEFAULT 0`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "materialTaxRate" DECIMAL DEFAULT 0`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "materials" TEXT NOT NULL DEFAULT '[]'`);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'Pending Payment'`,
  );
  await prisma.$executeRawUnsafe(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "amountPaid" DECIMAL DEFAULT 0`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "job_payments" (
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "job_payments_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_payments_ownerId_fkey') THEN
        ALTER TABLE "job_payments"
        ADD CONSTRAINT "job_payments_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_payments_jobId_fkey') THEN
        ALTER TABLE "job_payments"
        ADD CONSTRAINT "job_payments_jobId_fkey"
        FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "job_payments_id_ownerId_key" ON "job_payments"("id", "ownerId")`,
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "job_payments_ownerId_idx" ON "job_payments"("ownerId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "job_payments_jobId_idx" ON "job_payments"("jobId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "job_payments_paidOn_idx" ON "job_payments"("paidOn")`);

  await prisma.$executeRawUnsafe(`UPDATE "jobs" SET "laborCost" = 0 WHERE "laborCost" IS NULL`);
  await prisma.$executeRawUnsafe(`UPDATE "jobs" SET "materialTaxRate" = 0 WHERE "materialTaxRate" IS NULL`);
  await prisma.$executeRawUnsafe(`UPDATE "jobs" SET "materials" = '[]' WHERE "materials" IS NULL`);
  await prisma.$executeRawUnsafe(`UPDATE "jobs" SET "paymentStatus" = 'Pending Payment' WHERE "paymentStatus" IS NULL`);
  await prisma.$executeRawUnsafe(`UPDATE "jobs" SET "amountPaid" = 0 WHERE "amountPaid" IS NULL`);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "job_payments" (
      "id",
      "ownerId",
      "jobId",
      "paidOn",
      "amount",
      "method",
      "description",
      "createdAt",
      "updatedAt"
    )
    SELECT
      concat('legacy_', "id"),
      "ownerId",
      "id",
      COALESCE("updatedAt", CURRENT_TIMESTAMP),
      "amountPaid",
      'Imported',
      'Imported payment total',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM "jobs"
    WHERE "amountPaid" > 0
      AND NOT EXISTS (
        SELECT 1
        FROM "job_payments"
        WHERE "job_payments"."jobId" = "jobs"."id"
      )
  `);

  const customers = await prisma.customer.findMany({
    include: {
      jobs: {
        select: {
          status: true,
          paymentStatus: true,
          finalCost: true,
          amountPaid: true,
        },
      },
    },
  });

  for (const customer of customers) {
    await prisma.customer.update({
      where: {
        id: customer.id,
      },
      data: {
        billingStatus: deriveCustomerBillingStatus(
          customer.jobs.map((job) => ({
            status: job.status,
            paymentStatus: job.paymentStatus,
            finalCost: job.finalCost?.toString(),
            amountPaid: job.amountPaid?.toString(),
          })),
        ),
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
