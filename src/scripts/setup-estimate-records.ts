import { prisma } from "../lib/prisma";

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "laborItems" TEXT NOT NULL DEFAULT '[]'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "estimates" ALTER COLUMN "jobId" DROP NOT NULL`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "estimateRecordId" TEXT`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "estimate_records" (
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "estimate_records_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estimate_records_ownerId_fkey') THEN
        ALTER TABLE "estimate_records"
        ADD CONSTRAINT "estimate_records_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estimates_estimateRecordId_fkey') THEN
        ALTER TABLE "estimates"
        ADD CONSTRAINT "estimates_estimateRecordId_fkey"
        FOREIGN KEY ("estimateRecordId") REFERENCES "estimate_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estimate_records_customerId_fkey') THEN
        ALTER TABLE "estimate_records"
        ADD CONSTRAINT "estimate_records_customerId_fkey"
        FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "estimate_records_id_ownerId_key" ON "estimate_records"("id", "ownerId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "estimate_records_ownerId_idx" ON "estimate_records"("ownerId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "estimate_records_customerId_idx" ON "estimate_records"("customerId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "estimate_records_status_idx" ON "estimate_records"("status")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "estimate_records_createdAt_idx" ON "estimate_records"("createdAt")`,
  );
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "estimate_records_requestedOn_idx"`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "estimate_records" DROP COLUMN IF EXISTS "requestedOn"`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "estimates_estimateRecordId_key" ON "estimates"("estimateRecordId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "estimates_estimateRecordId_idx" ON "estimates"("estimateRecordId")`,
  );
  await prisma.$executeRawUnsafe(`UPDATE "estimate_records" SET "status" = 'Won' WHERE "status" = 'Estimate Accepted'`);
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
