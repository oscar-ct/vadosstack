import { prisma } from "../lib/prisma";

const examples = [
  {
    title: "Water Heater Replacement",
    description: "Remove existing water heater, install replacement unit, connect supply lines, and test operation.",
    category: "Installation",
    notes: "Confirm unit size, venting, and access before scheduling.",
    laborItems: [
      { description: "Remove and dispose existing water heater", price: "225.00" },
      { description: "Install new water heater and reconnect plumbing", price: "650.00" },
    ],
    materials: [
      { description: "Water heater installation kit", price: "85.00" },
      { description: "Supply lines and fittings", price: "65.00" },
    ],
  },
  {
    title: "Garbage Disposal Installation",
    description: "Install customer-selected garbage disposal, connect drain assembly, and test for leaks.",
    category: "Installation",
    notes: "Verify electrical outlet/switch is present before work begins.",
    laborItems: [{ description: "Install disposal and test operation", price: "225.00" }],
    materials: [
      { description: "Plumber putty and drain fittings", price: "28.00" },
      { description: "Disposal mounting hardware", price: "35.00" },
    ],
  },
  {
    title: "Faucet Repair",
    description: "Diagnose faucet issue, replace common wear parts, and test fixture.",
    category: "Repair",
    notes: "Final parts may vary by fixture brand and model.",
    laborItems: [{ description: "Diagnose and repair faucet", price: "165.00" }],
    materials: [
      { description: "Cartridge or repair kit allowance", price: "55.00" },
      { description: "Supply line allowance", price: "24.00" },
    ],
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
