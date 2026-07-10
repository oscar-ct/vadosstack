import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";

const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
const money = (value: number) => new Prisma.Decimal(value.toFixed(2));
const demoEmployeeNumbers = ["4101", "4102", "4103"] as const;

const leads = [
  ["Skyler Monroe", "skyler.monroe@example.com", "New", "Google", "HVAC", 3200, "2026-07-10T15:30:00-05:00"],
  ["Dakota Lane", "dakota.lane@example.com", "Contacted", "Referral", "Plumbing", 1450, "2026-07-11T10:00:00-05:00"],
  [
    "Finley Harper",
    "finley.harper@example.com",
    "Estimate Needed",
    "Website",
    "Electrical",
    4800,
    "2026-07-10T13:00:00-05:00",
  ],
  [
    "Sage Bennett",
    "sage.bennett@example.com",
    "Estimate Sent",
    "Repeat Customer",
    "Maintenance",
    890,
    "2026-07-12T09:00:00-05:00",
  ],
  ["Arden Wells", "arden.wells@example.com", "Won", "Local Event", "Installation", 7200, null],
] as const;

const estimateRecords = [
  ["Whole-home surge protection proposal", "Waiting on Customer", "Electrical", 4280, "2026-07-15T10:00:00-05:00"],
  ["Tankless water heater upgrade", "Estimate Provided", "Plumbing", 6150, "2026-07-16T13:30:00-05:00"],
  ["Quarterly maintenance agreement", "Won", "Maintenance", 2400, "2026-07-18T09:00:00-05:00"],
] as const;

const employees = [
  ["4101", "Maya Rivera", "maya.rivera@example.com", "Field Technician"],
  ["4102", "Theo Collins", "theo.collins@example.com", "Service Lead"],
  ["4103", "Iris Park", "iris.park@example.com", "Dispatcher"],
] as const;

const timeEntries = [
  ["4101", "2026-07-07", "08:00", "15:30", 7, "Completed maintenance and customer walkthrough."],
  ["4102", "2026-07-08", "09:00", "16:00", 6.5, "Electrical install and closeout notes."],
  ["4101", "2026-07-09", "08:30", "14:30", 5.5, "Water heater diagnostic and parts review."],
  ["4103", "2026-07-10", "07:30", "12:00", 4.5, "Route coordination and follow-up queue."],
] as const;

async function main() {
  if (!ownerEmail) throw new Error("Set SEED_OWNER_EMAIL before seeding demo extras.");
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error("No account matches SEED_OWNER_EMAIL.");

  await prisma.task.deleteMany({ where: { ownerId: owner.id, lead: { email: { endsWith: "@example.com" } } } });
  await prisma.lead.deleteMany({ where: { ownerId: owner.id, email: { endsWith: "@example.com" } } });

  const rows = [];
  for (const [index, fixture] of leads.entries()) {
    const [name, email, status, source, serviceType, estimatedValue, followUpAt] = fixture;
    rows.push(
      await prisma.lead.create({
        data: {
          ownerId: owner.id,
          name,
          email,
          phone: `(512) 555-${String(120 + index).padStart(4, "0")}`,
          source,
          serviceType,
          serviceLocation: `${100 + index} Demo Lead Way, Austin, TX 78701`,
          estimatedValue: money(estimatedValue),
          status,
          priority: index < 2 ? "High" : "Normal",
          notes: "Fictional lead created for VadosStack product screenshots.",
          followUpAt: followUpAt ? new Date(followUpAt) : null,
          convertedAt: status === "Won" ? new Date("2026-07-08T11:00:00-05:00") : null,
        },
      }),
    );
  }

  await prisma.task.createMany({
    data: [
      {
        ownerId: owner.id,
        leadId: rows[0].id,
        title: "Call new HVAC lead",
        location: rows[0].serviceLocation,
        scheduledFor: new Date("2026-07-10T15:30:00-05:00"),
        priority: "High",
      },
      {
        ownerId: owner.id,
        leadId: rows[2].id,
        title: "Prepare electrical estimate",
        location: rows[2].serviceLocation,
        scheduledFor: new Date("2026-07-10T13:00:00-05:00"),
        priority: "High",
      },
      {
        ownerId: owner.id,
        leadId: rows[1].id,
        title: "Confirm plumbing walkthrough",
        location: rows[1].serviceLocation,
        scheduledFor: new Date("2026-07-11T10:00:00-05:00"),
      },
    ],
  });

  await prisma.estimateRecord.deleteMany({
    where: {
      ownerId: owner.id,
      notes: "Fictional estimate created for VadosStack product screenshots.",
    },
  });

  const customers = await prisma.customer.findMany({
    where: { ownerId: owner.id },
    orderBy: { joinedAt: "asc" },
    take: 6,
  });

  for (const [index, fixture] of estimateRecords.entries()) {
    const [description, status, category, total, dateBegin] = fixture;
    const customer = customers[index % customers.length];

    await prisma.estimateRecord.create({
      data: {
        ownerId: owner.id,
        customerId: customer?.id,
        description,
        serviceLocation: customer ? `${100 + index} Demo Service Rd, Austin, TX 78701` : null,
        dateBegin: new Date(dateBegin),
        dateEnd: new Date(new Date(dateBegin).getTime() + 2 * 60 * 60 * 1000),
        laborCost: money(total * 0.42),
        materialTaxRate: money(8.25),
        estimatedTotal: money(total),
        category,
        status,
        scope: "Fictional scope used for service-business marketing screenshots.",
        notes: "Fictional estimate created for VadosStack product screenshots.",
      },
    });
  }

  const existingEmployees = await prisma.employee.findMany({
    where: { ownerId: owner.id, employeeNumber: { in: [...demoEmployeeNumbers] } },
    select: { id: true },
  });
  const existingEmployeeIds = existingEmployees.map((employee) => employee.id);

  await prisma.timeEntryRequest.deleteMany({ where: { ownerId: owner.id, employeeId: { in: existingEmployeeIds } } });
  await prisma.timeEntry.deleteMany({ where: { ownerId: owner.id, employeeId: { in: existingEmployeeIds } } });
  await prisma.employee.deleteMany({ where: { ownerId: owner.id, employeeNumber: { in: [...demoEmployeeNumbers] } } });

  const employeeRows = new Map<string, { id: string }>();
  for (const [employeeNumber, name, email, jobTitle] of employees) {
    const employee = await prisma.employee.create({
      data: {
        ownerId: owner.id,
        employeeNumber,
        name,
        email,
        jobTitle,
        department: "Field Operations",
        payRate: money(employeeNumber === "4103" ? 28 : 36),
        startDate: new Date("2026-01-08T12:00:00-06:00"),
      },
      select: { id: true },
    });
    employeeRows.set(employeeNumber, employee);
  }

  const jobs = await prisma.job.findMany({
    where: { ownerId: owner.id },
    orderBy: { dateBegin: "asc" },
    take: 8,
  });

  for (const [index, entry] of timeEntries.entries()) {
    const [employeeNumber, workedOn, startTime, endTime, hours, notes] = entry;
    const employee = employeeRows.get(employeeNumber);
    if (!employee) continue;

    await prisma.timeEntry.create({
      data: {
        ownerId: owner.id,
        employeeId: employee.id,
        jobId: jobs[index % jobs.length]?.id,
        workedOn: new Date(`${workedOn}T12:00:00-05:00`),
        startTime,
        endTime,
        hours: money(hours),
        deductLunch: true,
        lunchMinutes: 30,
        notes,
      },
    });
  }

  const reviewEmployee = employeeRows.get("4102");
  if (reviewEmployee) {
    await prisma.timeEntryRequest.create({
      data: {
        ownerId: owner.id,
        employeeId: reviewEmployee.id,
        jobId: jobs[0]?.id,
        action: "Create",
        status: "Pending",
        workedOn: new Date("2026-07-10T12:00:00-05:00"),
        startTime: "08:00",
        endTime: "12:30",
        hours: money(4.5),
        lunchMinutes: 0,
        notes: "Fictional pending review for Command Center screenshots.",
      },
    });
  }

  await prisma.invoice.deleteMany({
    where: {
      ownerId: owner.id,
      invoiceNumber: { startsWith: "DEMO-INV-" },
    },
  });

  const invoiceJobs = await prisma.job.findMany({
    where: {
      ownerId: owner.id,
      status: { in: ["Completed", "On Hold"] },
    },
    include: {
      customer: { include: { phoneNumbers: true } },
    },
    orderBy: { dateBegin: "asc" },
    take: 4,
  });

  for (const [index, job] of invoiceJobs.entries()) {
    const finalCost = Number(job.finalCost ?? job.estimatedCost ?? 0);
    const amountPaid = index === 0 ? finalCost : Math.round(finalCost * 0.48 * 100) / 100;
    const balanceDue = Math.max(0, finalCost - amountPaid);

    await prisma.invoice.create({
      data: {
        ownerId: owner.id,
        invoiceNumber: `DEMO-INV-${String(index + 1).padStart(3, "0")}`,
        jobId: job.id,
        customerId: job.customerId,
        customerName: job.customer?.name,
        customerEmail: job.customer?.email,
        customerPhone: job.customer?.phoneNumbers[0]?.value,
        jobTitle: job.description,
        jobDescription: job.scope,
        serviceLocation: job.serviceLocation,
        dateBegin: job.dateBegin,
        dateEnd: job.dateEnd,
        laborCost: money(Number(job.laborCost ?? 0)),
        materialTaxRate: money(Number(job.materialTaxRate ?? 0)),
        materials: job.materials,
        materialsSubtotal: money(Math.max(0, finalCost - Number(job.laborCost ?? 0))),
        materialTaxAmount: money(0),
        finalCost: money(finalCost),
        amountPaid: money(amountPaid),
        balanceDue: money(balanceDue),
        paymentStatus: balanceDue > 0 ? "Partial Payment" : "Paid in Full",
        jobStatus: job.status,
        issuedAt: new Date(`2026-07-0${Math.min(index + 4, 9)}T10:00:00-05:00`),
      },
    });
  }

  console.info(
    `Seeded ${rows.length} fictional leads, 3 tasks, ${estimateRecords.length} estimates, ${employees.length} employees, ${timeEntries.length} time entries, and ${invoiceJobs.length} invoices.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
