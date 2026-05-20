import { prisma } from "../lib/prisma";

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "invoices" (
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
      "laborCost" DECIMAL NOT NULL DEFAULT 0,
      "materialTaxRate" DECIMAL NOT NULL DEFAULT 0,
      "materials" TEXT NOT NULL DEFAULT '[]',
      "materialsSubtotal" DECIMAL NOT NULL DEFAULT 0,
      "materialTaxAmount" DECIMAL NOT NULL DEFAULT 0,
      "finalCost" DECIMAL NOT NULL DEFAULT 0,
      "amountPaid" DECIMAL NOT NULL DEFAULT 0,
      "balanceDue" DECIMAL NOT NULL DEFAULT 0,
      "paymentStatus" TEXT NOT NULL,
      "jobStatus" TEXT NOT NULL,
      "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT`);

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "invoices_id_ownerId_key" ON "invoices"("id", "ownerId")`,
  );
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "invoices_jobId_key" ON "invoices"("jobId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "invoices_ownerId_idx" ON "invoices"("ownerId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "invoices_jobId_idx" ON "invoices"("jobId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "invoices_customerId_idx" ON "invoices"("customerId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "invoices_issuedAt_idx" ON "invoices"("issuedAt")`);
  await prisma
    .$executeRawUnsafe(`
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
  `)
    .catch(() => undefined);
  await prisma
    .$executeRawUnsafe(`
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_jobId_fkey"
      FOREIGN KEY ("jobId") REFERENCES "jobs"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
  `)
    .catch(() => undefined);
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
