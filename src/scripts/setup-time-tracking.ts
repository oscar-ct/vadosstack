import { prisma } from "../lib/prisma";

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "employees" (
      "id" TEXT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "employeeNumber" TEXT NOT NULL DEFAULT '0000',
      "name" TEXT NOT NULL,
      "email" TEXT,
      "phone" TEXT,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "time_entries" (
      "id" TEXT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "employeeId" TEXT NOT NULL,
      "workedOn" TIMESTAMP(3) NOT NULL,
      "startTime" TEXT,
      "endTime" TEXT,
      "hours" DECIMAL NOT NULL,
      "deductLunch" BOOLEAN NOT NULL DEFAULT true,
      "lunchMinutes" INTEGER NOT NULL DEFAULT 60,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "time_entry_requests" (
      "id" TEXT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "employeeId" TEXT NOT NULL,
      "timeEntryId" TEXT,
      "action" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'Pending',
      "workedOn" TIMESTAMP(3),
      "startTime" TEXT,
      "endTime" TEXT,
      "hours" DECIMAL,
      "deductLunch" BOOLEAN NOT NULL DEFAULT true,
      "lunchMinutes" INTEGER NOT NULL DEFAULT 60,
      "notes" TEXT,
      "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "reviewedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "time_entry_requests_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "employees_id_ownerId_key" ON "employees"("id", "ownerId")`,
  );
  await prisma.$executeRawUnsafe(`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "employeeNumber" TEXT`);
  const employeesMissingNumbers = await prisma.$queryRawUnsafe<Array<{ id: string; ownerId: string }>>(
    `SELECT "id", "ownerId" FROM "employees" WHERE "employeeNumber" IS NULL OR "employeeNumber" = '' ORDER BY "createdAt" ASC`,
  );
  const usedNumbersByOwner = new Map<string, Set<string>>();
  const employeesWithNumbers = await prisma.$queryRawUnsafe<Array<{ employeeNumber: string; ownerId: string }>>(
    `SELECT "employeeNumber", "ownerId" FROM "employees" WHERE "employeeNumber" IS NOT NULL AND "employeeNumber" <> ''`,
  );

  for (const employee of employeesWithNumbers) {
    if (!usedNumbersByOwner.has(employee.ownerId)) {
      usedNumbersByOwner.set(employee.ownerId, new Set());
    }
    usedNumbersByOwner.get(employee.ownerId)?.add(employee.employeeNumber);
  }

  for (const employee of employeesMissingNumbers) {
    const usedNumbers = usedNumbersByOwner.get(employee.ownerId) ?? new Set<string>();
    let nextNumber = "";

    for (let attempt = 0; attempt < 9000; attempt += 1) {
      const candidate = String(Math.floor(1000 + Math.random() * 9000));
      if (!usedNumbers.has(candidate)) {
        nextNumber = candidate;
        break;
      }
    }

    if (!nextNumber) {
      nextNumber = String(1000 + usedNumbers.size)
        .slice(0, 4)
        .padStart(4, "0");
    }

    usedNumbers.add(nextNumber);
    usedNumbersByOwner.set(employee.ownerId, usedNumbers);
    await prisma.employee.update({
      where: {
        id: employee.id,
      },
      data: {
        employeeNumber: nextNumber,
      },
    });
  }
  await prisma
    .$executeRawUnsafe(`ALTER TABLE "employees" ALTER COLUMN "employeeNumber" SET NOT NULL`)
    .catch(() => undefined);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "employees_ownerId_employeeNumber_key" ON "employees"("ownerId", "employeeNumber")`,
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "employees_ownerId_idx" ON "employees"("ownerId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "employees_active_idx" ON "employees"("active")`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "time_entries_id_ownerId_key" ON "time_entries"("id", "ownerId")`,
  );
  await prisma.$executeRawUnsafe(`ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "startTime" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "endTime" TEXT`);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "deductLunch" BOOLEAN NOT NULL DEFAULT true`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "lunchMinutes" INTEGER NOT NULL DEFAULT 60`,
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "time_entries_ownerId_idx" ON "time_entries"("ownerId")`);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "time_entries_employeeId_idx" ON "time_entries"("employeeId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "time_entries_workedOn_idx" ON "time_entries"("workedOn")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "time_entry_requests_ownerId_idx" ON "time_entry_requests"("ownerId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "time_entry_requests_employeeId_idx" ON "time_entry_requests"("employeeId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "time_entry_requests_status_idx" ON "time_entry_requests"("status")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "time_entry_requests_requestedAt_idx" ON "time_entry_requests"("requestedAt")`,
  );
  await prisma
    .$executeRawUnsafe(`
    ALTER TABLE "employees"
      ADD CONSTRAINT "employees_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
  `)
    .catch(() => undefined);
  await prisma
    .$executeRawUnsafe(`
    ALTER TABLE "time_entries"
      ADD CONSTRAINT "time_entries_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
  `)
    .catch(() => undefined);
  await prisma
    .$executeRawUnsafe(`
    ALTER TABLE "time_entries"
      ADD CONSTRAINT "time_entries_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
  `)
    .catch(() => undefined);
  await prisma
    .$executeRawUnsafe(`
    ALTER TABLE "time_entry_requests"
      ADD CONSTRAINT "time_entry_requests_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
  `)
    .catch(() => undefined);
  await prisma
    .$executeRawUnsafe(`
    ALTER TABLE "time_entry_requests"
      ADD CONSTRAINT "time_entry_requests_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
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
