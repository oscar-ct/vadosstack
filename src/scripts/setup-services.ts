import { prisma } from "../lib/prisma";

const examples = [
  {
    title: "Seasonal HVAC Tune-Up",
    description: "Inspect, clean, and test a residential heating and cooling system.",
    category: "Maintenance",
    notes: "Includes filter inspection and a customer-ready system summary.",
    laborItems: [{ description: "HVAC inspection and tune-up", price: "189.00" }],
    materials: [{ description: "Standard replacement filter allowance", price: "28.00" }],
  },
  {
    title: "Smart Thermostat Installation",
    description: "Install, configure, and test a customer-selected smart thermostat.",
    category: "Installation",
    notes: "Confirm compatible HVAC wiring before arrival.",
    laborItems: [{ description: "Installation and configuration", price: "245.00" }],
    materials: [{ description: "Mounting plate and wiring kit", price: "36.00" }],
  },
  {
    title: "Fixture and Supply-Line Refresh",
    description: "Replace fixture hardware and braided supply lines, then test for leaks.",
    category: "Repair",
    notes: "Fixture pricing varies by the fictional demo customer selection.",
    laborItems: [{ description: "Fixture installation labor", price: "285.00" }],
    materials: [{ description: "Supply line and shutoff kit", price: "74.00" }],
  },
];

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "service_templates" (
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "service_templates_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_templates_ownerId_fkey') THEN
        ALTER TABLE "service_templates"
        ADD CONSTRAINT "service_templates_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "service_templates_id_ownerId_key" ON "service_templates"("id", "ownerId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "service_templates_ownerId_idx" ON "service_templates"("ownerId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "service_templates_category_idx" ON "service_templates"("category")`,
  );

  const users = await prisma.user.findMany({ select: { id: true } });

  for (const user of users) {
    for (const service of examples) {
      const existing = await prisma.serviceTemplate.findFirst({
        where: {
          ownerId: user.id,
          title: service.title,
        },
        select: {
          id: true,
        },
      });

      if (existing) continue;

      await prisma.serviceTemplate.create({
        data: {
          ownerId: user.id,
          title: service.title,
          description: service.description,
          category: service.category,
          notes: service.notes,
          laborItems: JSON.stringify(service.laborItems),
          materialTaxRate: "8.25",
          materials: JSON.stringify(service.materials),
        },
      });
    }
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
