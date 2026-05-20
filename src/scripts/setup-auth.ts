import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";

const email = "oscar.a.castro818@gmail.com";
const password = "CodexIsAwesome123";
const name = "Oscar Castro";
const companyName = "Castro Home Services";

async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" TEXT NOT NULL,
      "name" TEXT,
      "companyName" TEXT NOT NULL DEFAULT 'Company Dashboard',
      "companyEmail" TEXT,
      "companyPhone" TEXT,
      "companyLogoDataUrl" TEXT,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "admin" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "users_email_key" UNIQUE ("email")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "sessions" (
      "id" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "sessions_tokenHash_key" UNIQUE ("tokenHash"),
      CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "ownerId" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "ownerId" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "companyName" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "companyEmail" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "companyPhone" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "companyLogoDataUrl" TEXT`);
  await prisma.$executeRawUnsafe(
    `UPDATE "users"
     SET "companyName" = CASE
       WHEN "email" = $1 THEN $2
       WHEN "companyName" IS NULL OR "companyName" = '' THEN 'Bright Oak Services'
       ELSE "companyName"
     END`,
    email,
    companyName,
  );
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ALTER COLUMN "companyName" SET NOT NULL`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ALTER COLUMN "email" DROP NOT NULL`);
}

async function ensureUser() {
  return prisma.user.upsert({
    where: {
      email,
    },
    update: {
      name,
      companyName,
      companyEmail: email,
      companyPhone: null,
      admin: true,
      passwordHash: hashPassword(password),
    },
    create: {
      name,
      companyName,
      companyEmail: email,
      companyPhone: null,
      email,
      admin: true,
      passwordHash: hashPassword(password),
    },
  });
}

async function backfillOwnership(userId: string) {
  await prisma.$executeRawUnsafe(`UPDATE "customers" SET "ownerId" = $1 WHERE "ownerId" IS NULL`, userId);
  await prisma.$executeRawUnsafe(`UPDATE "jobs" SET "ownerId" = $1 WHERE "ownerId" IS NULL`, userId);
}

async function ensureConstraints() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_email_key"`);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customers_ownerId_fkey'
      ) THEN
        ALTER TABLE "customers"
        ADD CONSTRAINT "customers_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ownerId_fkey'
      ) THEN
        ALTER TABLE "jobs"
        ADD CONSTRAINT "jobs_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ALTER COLUMN "ownerId" SET NOT NULL`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "jobs" ALTER COLUMN "ownerId" SET NOT NULL`);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "customers_ownerId_idx" ON "customers"("ownerId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "jobs_ownerId_idx" ON "jobs"("ownerId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions"("userId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "sessions_expiresAt_idx" ON "sessions"("expiresAt")`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "customers_id_ownerId_key" ON "customers"("id", "ownerId")`,
  );
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "jobs_id_ownerId_key" ON "jobs"("id", "ownerId")`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "customers_ownerId_email_key" ON "customers"("ownerId", "email")`,
  );
}

async function main() {
  await ensureTables();
  const user = await ensureUser();
  await backfillOwnership(user.id);
  await ensureConstraints();
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
