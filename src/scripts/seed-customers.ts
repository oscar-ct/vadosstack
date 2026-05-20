import customersData from "../app/(main)/dashboard/customers/_components/data.json";
import { prisma } from "../lib/prisma";

type CustomerSeedRow = {
  id: string;
  name: string;
  email: string;
  billing: string;
  joined: string;
};

async function main() {
  const customers = customersData as CustomerSeedRow[];
  const owner = await prisma.user.findUnique({
    where: {
      email: "oscar.a.castro818@gmail.com",
    },
    select: {
      id: true,
    },
  });

  if (!owner) {
    throw new Error("Run the auth setup before seeding customers.");
  }

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: {
        ownerId_email: {
          ownerId: owner.id,
          email: customer.email,
        },
      },
      update: {
        id: customer.id,
        name: customer.name,
        billingStatus: customer.billing,
        joinedAt: new Date(customer.joined),
      },
      create: {
        id: customer.id,
        ownerId: owner.id,
        name: customer.name,
        email: customer.email,
        billingStatus: customer.billing,
        joinedAt: new Date(customer.joined),
      },
    });
  }

  console.info(`Seeded ${customers.length} customers.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
