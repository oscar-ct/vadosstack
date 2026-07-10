import { prisma } from "../lib/prisma";

type DemoMaterial = { description: string; price: string };

type DemoJob = {
  amountPaid: string;
  category: string;
  dateBegin: string | null;
  dateEnd: string | null;
  description: string;
  estimatedCost: string;
  laborCost: string;
  materials: DemoMaterial[];
  notes: string;
  paymentStatus: string;
  scope: string;
  status: string;
};

const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();

const jobs: DemoJob[] = [
  {
    description: "Smart thermostat installation",
    scope: "Install, configure, connect to Wi-Fi, and test heating and cooling cycles.",
    category: "Installation",
    status: "Scheduled",
    paymentStatus: "Pending Payment",
    estimatedCost: "495.00",
    laborCost: "245.00",
    amountPaid: "0.00",
    materials: [
      { description: "Smart thermostat", price: "189.00" },
      { description: "Mounting plate and wiring kit", price: "36.00" },
    ],
    dateBegin: "2026-07-10T14:00:00-05:00",
    dateEnd: "2026-07-10T16:00:00-05:00",
    notes: "Fictional demo job. Confirm the preferred mobile app before setup.",
  },
  {
    description: "Seasonal HVAC tune-up",
    scope: "Inspect, clean, test, and document the residential HVAC system.",
    category: "Maintenance",
    status: "Completed",
    paymentStatus: "Paid in Full",
    estimatedCost: "223.00",
    laborCost: "189.00",
    amountPaid: "225.81",
    materials: [{ description: "MERV 11 filter", price: "34.00" }],
    dateBegin: "2026-07-08T09:00:00-05:00",
    dateEnd: "2026-07-08T11:00:00-05:00",
    notes: "System performance was documented in the fictional customer record.",
  },
  {
    description: "Water heater diagnostic",
    scope: "Diagnose temperature, ignition, pressure, and leak concerns before quoting repairs.",
    category: "Repair",
    status: "Unscheduled",
    paymentStatus: "Pending Payment",
    estimatedCost: "165.00",
    laborCost: "165.00",
    amountPaid: "0.00",
    materials: [],
    dateBegin: null,
    dateEnd: null,
    notes: "Awaiting scheduling confirmation from the fictional demo customer.",
  },
  {
    description: "Retail display lighting upgrade",
    scope: "Replace track fixtures, add dimmers, and verify the display lighting plan.",
    category: "Electrical",
    status: "On Hold",
    paymentStatus: "Partial Payment",
    estimatedCost: "1292.00",
    laborCost: "640.00",
    amountPaid: "300.00",
    materials: [
      { description: "LED track fixtures", price: "485.00" },
      { description: "Dimmers and connectors", price: "118.00" },
    ],
    dateBegin: "2026-07-14T08:30:00-05:00",
    dateEnd: "2026-07-14T15:30:00-05:00",
    notes: "Fictional job is on hold while the demo customer reviews fixture placement.",
  },
  {
    description: "Whole-home filter replacement",
    scope: "Replace the filtration cartridge, flush the system, and check pressure.",
    category: "Maintenance",
    status: "Scheduled",
    paymentStatus: "Pending Payment",
    estimatedCost: "237.00",
    laborCost: "145.00",
    amountPaid: "0.00",
    materials: [{ description: "Filter cartridge", price: "92.00" }],
    dateBegin: "2026-07-11T10:00:00-05:00",
    dateEnd: "2026-07-11T11:30:00-05:00",
    notes: "Load the replacement cartridge before leaving the warehouse.",
  },
  {
    description: "Kitchen faucet and supply-line refresh",
    scope: "Replace the faucet and braided supply lines, then test for leaks.",
    category: "Plumbing",
    status: "Completed",
    paymentStatus: "Partial Payment",
    estimatedCost: "565.00",
    laborCost: "285.00",
    amountPaid: "300.00",
    materials: [
      { description: "Pull-down faucet", price: "238.00" },
      { description: "Braided supply lines", price: "42.00" },
    ],
    dateBegin: "2026-07-07T13:00:00-05:00",
    dateEnd: "2026-07-07T16:00:00-05:00",
    notes: "Final balance remains visible for the fictional demo customer.",
  },
  {
    description: "Garage outlet troubleshooting",
    scope: "Trace the affected circuit, replace the GFCI outlet, and test protection.",
    category: "Electrical",
    status: "Scheduled",
    paymentStatus: "Pending Payment",
    estimatedCost: "256.00",
    laborCost: "210.00",
    amountPaid: "0.00",
    materials: [{ description: "Weatherproof GFCI outlet and cover", price: "46.00" }],
    dateBegin: "2026-07-12T09:30:00-05:00",
    dateEnd: "2026-07-12T11:30:00-05:00",
    notes: "Fictional demo record with no real customer information.",
  },
  {
    description: "Outdoor hose bib replacement",
    scope: "Replace the outdoor faucet, reconnect the supply, and test for leaks.",
    category: "Plumbing",
    status: "Completed",
    paymentStatus: "Paid in Full",
    estimatedCost: "309.00",
    laborCost: "195.00",
    amountPaid: "318.41",
    materials: [
      { description: "Frost-free hose bib", price: "86.00" },
      { description: "Copper fittings", price: "28.00" },
    ],
    dateBegin: "2026-07-03T08:00:00-05:00",
    dateEnd: "2026-07-03T10:00:00-05:00",
    notes: "Paid fictional job included for dashboard and reporting screenshots.",
  },
];

function calculateFinalCost(job: DemoJob) {
  const materialsSubtotal = job.materials.reduce((sum, item) => sum + Number(item.price), 0);
  return (Number(job.laborCost) + materialsSubtotal * 1.0825).toFixed(2);
}

async function main() {
  if (!ownerEmail) throw new Error("Set SEED_OWNER_EMAIL before seeding jobs.");
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error("No account matches SEED_OWNER_EMAIL.");

  const customers = await prisma.customer.findMany({
    where: { ownerId: owner.id },
    include: { addresses: true },
    orderBy: { joinedAt: "asc" },
  });
  if (!customers.length) throw new Error("Seed customers before seeding jobs.");

  for (const [index, job] of jobs.entries()) {
    const customer = customers[index % customers.length];
    const address = customer.addresses[0];
    const serviceLocation = address
      ? `${address.line1}, ${address.city}, ${address.state} ${address.postalCode}`
      : null;
    const existing = await prisma.job.findFirst({
      where: { ownerId: owner.id, description: job.description },
      select: { id: true },
    });
    const data = {
      customerId: customer.id,
      scope: job.scope,
      category: job.category,
      status: job.status,
      estimatedCost: job.estimatedCost,
      laborCost: job.laborCost,
      materialTaxRate: "8.25",
      materials: JSON.stringify(job.materials),
      paymentStatus: job.paymentStatus,
      amountPaid: job.amountPaid,
      finalCost: calculateFinalCost(job),
      serviceLocation,
      dateBegin: job.dateBegin ? new Date(job.dateBegin) : null,
      dateEnd: job.dateEnd ? new Date(job.dateEnd) : null,
      notes: job.notes,
    };

    if (existing) await prisma.job.update({ where: { id: existing.id }, data });
    else await prisma.job.create({ data: { ownerId: owner.id, description: job.description, ...data } });
  }

  console.info(`Seeded ${jobs.length} fictional jobs.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
