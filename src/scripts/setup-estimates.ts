import { prisma } from "../lib/prisma";

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "estimates" (
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
      "estimatedTotal" DECIMAL NOT NULL DEFAULT 0,
      "jobStatus" TEXT NOT NULL,
      "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "estimates_id_ownerId_key" ON "estimates"("id", "ownerId")`,
  );
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "estimates_jobId_key" ON "estimates"("jobId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "estimates_ownerId_idx" ON "estimates"("ownerId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "estimates_jobId_idx" ON "estimates"("jobId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "estimates_customerId_idx" ON "estimates"("customerId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "estimates_issuedAt_idx" ON "estimates"("issuedAt")`);
  await prisma
    .$executeRawUnsafe(`
    ALTER TABLE "estimates"
      ADD CONSTRAINT "estimates_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
  `)
    .catch(() => undefined);
  await prisma
    .$executeRawUnsafe(`
    ALTER TABLE "estimates"
      ADD CONSTRAINT "estimates_jobId_fkey"
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
