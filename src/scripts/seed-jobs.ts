import { prisma } from "../lib/prisma";

type DemoMaterial = {
  description: string;
  price: string;
};

type DemoJobTemplate = {
  description: string;
  scope: string;
  category: string;
  status: string;
  paymentStatus: string;
  estimatedCost: string;
  laborCost: string;
  materialTaxRate: string;
  amountPaid: string;
  materials: DemoMaterial[];
  dateBegin: string;
  dateEnd: string;
  notes: string;
};

const ownerEmail = "oscar.a.castro818@gmail.com";

const jobTemplates: DemoJobTemplate[] = [
  {
    description: "Demo Water Heater Replacement",
    scope:
      "Remove the failed water heater, install a new 50-gallon unit, reconnect gas and water lines, and test the system.",
    category: "Installation",
    status: "Scheduled",
    paymentStatus: "Pending Payment",
    estimatedCost: "1850.00",
    laborCost: "650.00",
    materialTaxRate: "8.25",
    amountPaid: "0.00",
    materials: [
      { description: "50-gallon water heater", price: "925.00" },
      { description: "Expansion tank", price: "85.00" },
      { description: "Shutoff valve and fittings", price: "92.00" },
    ],
    dateBegin: "2026-05-19T09:00:00.000Z",
    dateEnd: "2026-05-19T13:30:00.000Z",
    notes: "Customer requested disposal of old unit and a 30-minute walkthrough after install.",
  },
  {
    description: "Demo Kitchen Faucet Repair",
    scope:
      "Diagnose leak under sink, replace supply lines, install new faucet cartridge, and verify pressure and seal.",
    category: "Repair",
    status: "In Progress",
    paymentStatus: "Partial Payment",
    estimatedCost: "420.00",
    laborCost: "180.00",
    materialTaxRate: "8.25",
    amountPaid: "120.00",
    materials: [
      { description: "Faucet cartridge", price: "46.00" },
      { description: "Braided supply lines", price: "34.00" },
    ],
    dateBegin: "2026-05-15T14:00:00.000Z",
    dateEnd: "2026-05-15T16:00:00.000Z",
    notes: "Leave removed parts on-site for customer approval before disposal.",
  },
  {
    description: "Demo Exterior Lighting Upgrade",
    scope: "Swap out front porch and garage fixtures for LED units and verify timer settings.",
    category: "Installation",
    status: "Completed",
    paymentStatus: "Paid in Full",
    estimatedCost: "980.00",
    laborCost: "360.00",
    materialTaxRate: "8.25",
    amountPaid: "678.72",
    materials: [
      { description: "LED coach lights", price: "210.00" },
      { description: "Exterior-rated wire and connectors", price: "54.00" },
      { description: "Weatherproof junction box covers", price: "29.00" },
    ],
    dateBegin: "2026-05-10T10:00:00.000Z",
    dateEnd: "2026-05-10T14:30:00.000Z",
    notes: "Photos uploaded after completion for before/after reference.",
  },
  {
    description: "Demo Drywall Patch and Paint",
    scope:
      "Patch hallway drywall damage, sand smooth, prime, and apply two finish coats to blend with existing wall color.",
    category: "Other",
    status: "On Hold",
    paymentStatus: "Pending Payment",
    estimatedCost: "760.00",
    laborCost: "420.00",
    materialTaxRate: "8.25",
    amountPaid: "0.00",
    materials: [
      { description: "Drywall patch kit", price: "38.00" },
      { description: "Primer and paint", price: "112.00" },
      { description: "Sanding and masking supplies", price: "24.00" },
    ],
    dateBegin: "2026-05-22T08:30:00.000Z",
    dateEnd: "2026-05-22T15:00:00.000Z",
    notes: "Waiting on customer to confirm final paint sheen.",
  },
  {
    description: "Demo HVAC Thermostat Swap",
    scope:
      "Install smart thermostat, connect to existing HVAC wiring, program schedule, and test heating/cooling cycles.",
    category: "Installation",
    status: "Scheduled",
    paymentStatus: "Pending Payment",
    estimatedCost: "540.00",
    laborCost: "210.00",
    materialTaxRate: "8.25",
    amountPaid: "0.00",
    materials: [
      { description: "Smart thermostat", price: "189.00" },
      { description: "Mounting plate and anchors", price: "14.00" },
    ],
    dateBegin: "2026-05-20T11:00:00.000Z",
    dateEnd: "2026-05-20T13:00:00.000Z",
    notes: "Need homeowner present for app setup and Wi-Fi pairing.",
  },
  {
    description: "Demo Bathroom Regrout",
    scope:
      "Remove failing grout in shower surround, apply mildew-resistant grout, seal after cure, and clean the work area.",
    category: "Repair",
    status: "Cancelled",
    paymentStatus: "Pending Payment",
    estimatedCost: "690.00",
    laborCost: "390.00",
    materialTaxRate: "8.25",
    amountPaid: "0.00",
    materials: [
      { description: "Mildew-resistant grout", price: "58.00" },
      { description: "Grout sealant", price: "21.00" },
      { description: "Removal blades and sponges", price: "27.00" },
    ],
    dateBegin: "2026-05-12T09:30:00.000Z",
    dateEnd: "2026-05-12T15:00:00.000Z",
    notes: "Cancelled by customer due to remodeling schedule changes.",
  },
];

function calculateFinalCost(laborCost: string, materialTaxRate: string, materials: DemoMaterial[]) {
  const labor = Number(laborCost);
  const subtotal = materials.reduce((sum, material) => sum + Number(material.price), 0);
  const tax = subtotal * (Number(materialTaxRate) / 100);

  return (labor + subtotal + tax).toFixed(2);
}

function formatAddress(customer: {
  addresses: Array<{
    line1: string;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  }>;
}) {
  const address = customer.addresses[0];

  if (!address) {
    return null;
  }

  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(", ");
  return [address.line1, address.line2, cityLine, address.country].filter(Boolean).join(", ");
}

async function main() {
  const owner = await prisma.user.findUnique({
    where: {
      email: ownerEmail,
    },
    select: {
      id: true,
    },
  });

  if (!owner) {
    throw new Error("Run the auth setup before seeding jobs.");
  }

  const customers = await prisma.customer.findMany({
    where: {
      ownerId: owner.id,
    },
    include: {
      addresses: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  if (!customers.length) {
    throw new Error("Seed customers before seeding jobs.");
  }

  let created = 0;
  let updated = 0;

  for (const [index, template] of jobTemplates.entries()) {
    const customer = customers[index % customers.length];
    const existing = await prisma.job.findFirst({
      where: {
        ownerId: owner.id,
        description: template.description,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      await prisma.job.update({
        where: {
          id: existing.id,
        },
        data: {
          customerId: customer.id,
          scope: template.scope,
          category: template.category,
          status: template.status,
          estimatedCost: template.estimatedCost,
          laborCost: template.laborCost,
          materialTaxRate: template.materialTaxRate,
          materials: JSON.stringify(template.materials),
          paymentStatus: template.paymentStatus,
          amountPaid: template.amountPaid,
          finalCost: calculateFinalCost(template.laborCost, template.materialTaxRate, template.materials),
          serviceLocation: formatAddress(customer),
          dateBegin: new Date(template.dateBegin),
          dateEnd: new Date(template.dateEnd),
          notes: template.notes,
        },
      });

      updated += 1;
      continue;
    }

    await prisma.job.create({
      data: {
        ownerId: owner.id,
        customerId: customer.id,
        description: template.description,
        scope: template.scope,
        category: template.category,
        status: template.status,
        estimatedCost: template.estimatedCost,
        laborCost: template.laborCost,
        materialTaxRate: template.materialTaxRate,
        materials: JSON.stringify(template.materials),
        paymentStatus: template.paymentStatus,
        amountPaid: template.amountPaid,
        finalCost: calculateFinalCost(template.laborCost, template.materialTaxRate, template.materials),
        serviceLocation: formatAddress(customer),
        dateBegin: new Date(template.dateBegin),
        dateEnd: new Date(template.dateEnd),
        notes: template.notes,
      },
    });

    created += 1;
  }

  console.info(`Seeded ${created} jobs. Updated ${updated} existing demo jobs.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
