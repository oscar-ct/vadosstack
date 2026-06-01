import { calculateOutstandingBalance } from "@/lib/customer-billing";
import { prisma } from "@/lib/prisma";

import type { ServiceTemplateRow } from "../../services/types";
import type { JobCustomer, JobRow } from "../_components/jobs-table/schema";
import { parseMaterials } from "../_components/materials";
import { parsePricingItems } from "../_components/pricing-items";

type MeasurementRoomRow = JobRow["measurementRooms"][number];

function formatMoney(value: { toString: () => string } | null) {
  return value === null ? undefined : value.toString();
}

function normalizeJobStatus(status: string) {
  return status === "In Progress" ? "Scheduled" : status;
}

function normalizeJobType(jobType: string | null | undefined): "Residential" | "Commercial" {
  return jobType === "Commercial" ? "Commercial" : "Residential";
}

function parseMeasurementRooms(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map<MeasurementRoomRow | null>((room) => {
        if (!room || typeof room !== "object") return null;

        const current = room as Record<string, unknown>;
        return {
          id: typeof current.id === "string" ? current.id : undefined,
          name: typeof current.name === "string" ? current.name : "",
          length: typeof current.length === "string" ? current.length : "",
          width: typeof current.width === "string" ? current.width : "",
          area: typeof current.area === "string" ? current.area : undefined,
        };
      })
      .filter((room): room is MeasurementRoomRow => Boolean(room));
  } catch {
    return [];
  }
}

function toJobRow(
  job: Awaited<ReturnType<typeof prisma.job.findMany>>[number] & {
    customer?: { name: string } | null;
    estimate?: { id: string; issuedAt: Date } | null;
    invoice?: { id: string; issuedAt: Date } | null;
    payments?: Array<{
      id: string;
      paidOn: Date;
      amount: { toString: () => string };
      paymentType: string;
      method: string;
      referenceNumber: string | null;
      description: string;
      notes: string | null;
      createdAt: Date;
    }>;
  },
): JobRow {
  const status = normalizeJobStatus(job.status);

  return {
    id: job.id,
    customerId: job.customerId ?? undefined,
    customerName: job.customer?.name ?? undefined,
    description: job.description,
    serviceLocation: job.serviceLocation ?? undefined,
    dateBegin: job.dateBegin?.toISOString(),
    dateEnd: job.dateEnd?.toISOString(),
    estimatedCost: formatMoney(job.estimatedCost),
    laborCost: formatMoney(job.laborCost),
    jobType: normalizeJobType(job.jobType),
    measurementRooms: parseMeasurementRooms(job.measurementRooms),
    laborItems: parsePricingItems(job.laborItems),
    materialTaxRate: formatMoney(job.materialTaxRate),
    materials: parseMaterials(job.materials),
    paymentStatus: job.paymentStatus,
    depositPaid: formatMoney(job.depositPaid),
    amountPaid: formatMoney(job.amountPaid),
    outstandingBalance: formatMoney(
      calculateOutstandingBalance(status, job.finalCost?.toString(), job.amountPaid?.toString()),
    ),
    finalCost: formatMoney(job.finalCost),
    scope: job.scope ?? undefined,
    category: job.category,
    status,
    pictures: job.pictures,
    notes: job.notes ?? undefined,
    payments: (job.payments ?? []).map((payment) => ({
      id: payment.id,
      paidOn: payment.paidOn.toISOString(),
      amount: payment.amount.toString(),
      paymentType: payment.paymentType,
      method: payment.method,
      referenceNumber: payment.referenceNumber ?? undefined,
      description: payment.description,
      notes: payment.notes ?? undefined,
      createdAt: payment.createdAt.toISOString(),
    })),
    invoiceId: job.invoice?.id,
    invoiceIssuedAt: job.invoice?.issuedAt.toISOString(),
    estimateId: job.estimate?.id,
    estimateIssuedAt: job.estimate?.issuedAt.toISOString(),
    createdAt: job.createdAt.toISOString(),
  };
}

export async function getJobs(ownerId: string): Promise<JobRow[]> {
  const jobs = await prisma.job.findMany({
    where: {
      ownerId,
    },
    include: {
      customer: true,
      estimate: true,
      invoice: true,
      payments: {
        orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }, { dateBegin: "desc" }],
  });

  return jobs.map(toJobRow);
}

export async function getJob(ownerId: string, jobId: string): Promise<JobRow | null> {
  const job = await prisma.job.findUnique({
    where: {
      id_ownerId: {
        id: jobId,
        ownerId,
      },
    },
    include: {
      customer: true,
      estimate: true,
      invoice: true,
      payments: {
        orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  return job ? toJobRow(job) : null;
}

export async function getJobCustomers(ownerId: string): Promise<JobCustomer[]> {
  const customers = await prisma.customer.findMany({
    where: {
      ownerId,
    },
    include: {
      addresses: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    addresses: customer.addresses.map((address) => ({
      id: address.id,
      label: address.label ?? undefined,
      line1: address.line1,
      line2: address.line2 ?? undefined,
      city: address.city ?? undefined,
      state: address.state ?? undefined,
      postalCode: address.postalCode ?? undefined,
      country: address.country ?? undefined,
    })),
  }));
}

export async function getJobServices(ownerId: string): Promise<ServiceTemplateRow[]> {
  const services = await prisma.serviceTemplate.findMany({
    where: {
      ownerId,
    },
    orderBy: {
      title: "asc",
    },
  });

  return services.map((service) => ({
    id: service.id,
    title: service.title,
    description: service.description ?? undefined,
    category: service.category,
    notes: service.notes ?? undefined,
    laborItems: parsePricingItems(service.laborItems),
    materialTaxRate: service.materialTaxRate.toString(),
    materials: parseMaterials(service.materials),
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  }));
}
