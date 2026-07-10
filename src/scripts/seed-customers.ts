import customersData from "../app/(main)/dashboard/customers/_components/data.json";
import { prisma } from "../lib/prisma";

type CustomerSeedRow = {
  city: string;
  id: string;
  name: string;
  email: string;
  line1: string;
  phone: string;
  postalCode: string;
  state: string;
  billing: string;
  joined: string;
};

const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();

async function main() {
  const customers = customersData as CustomerSeedRow[];
  if (!ownerEmail) throw new Error("Set SEED_OWNER_EMAIL before seeding customers.");
  const owner = await prisma.user.findUnique({
    where: {
      email: ownerEmail,
    },
    select: {
      id: true,
    },
  });

  if (!owner) {
    throw new Error("Run the auth setup before seeding customers.");
  }

  await prisma.user.update({
    where: { id: owner.id },
    data: {
      name: "Demo Workspace Owner",
      companyName: "BluePeak Service & Supply",
      companyAddress: "4100 Demo Way, Austin, TX 78701",
      companyEmail: "hello@bluepeak-demo.example.com",
      companyPhone: "(512) 555-0142",
      workspaceMode: "both",
    },
  });

  for (const customer of customers) {
    const row = await prisma.customer.upsert({
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
        notes: "Fictional demo customer created for VadosStack product screenshots.",
      },
      create: {
        id: customer.id,
        ownerId: owner.id,
        name: customer.name,
        email: customer.email,
        billingStatus: customer.billing,
        joinedAt: new Date(customer.joined),
        notes: "Fictional demo customer created for VadosStack product screenshots.",
      },
    });
    await prisma.customerAddress.deleteMany({ where: { customerId: row.id } });
    await prisma.customerPhoneNumber.deleteMany({ where: { customerId: row.id } });
    await prisma.customerAddress.create({
      data: {
        customerId: row.id,
        label: "Primary",
        line1: customer.line1,
        city: customer.city,
        state: customer.state,
        postalCode: customer.postalCode,
        country: "USA",
      },
    });
    await prisma.customerPhoneNumber.create({
      data: { customerId: row.id, label: "Mobile", value: customer.phone },
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
