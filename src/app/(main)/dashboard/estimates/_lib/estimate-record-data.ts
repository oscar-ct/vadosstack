import { prisma } from "@/lib/prisma";

import type { JobCustomer } from "../../jobs/_components/jobs-table/schema";
import { parseMaterials } from "../../jobs/_components/materials";
import { parsePricingItems } from "../../jobs/_components/pricing-items";
import type { ServiceTemplateRow } from "../../services/types";
import type { EstimateRecordRow } from "../_components/schema";

type MeasurementRoomRow = EstimateRecordRow["measurementRooms"][number];

function formatMoney(value: { toString: () => string } | null) {
  return value ? value.toString() : undefined;
}

function normalizeEstimateStatus(status: string) {
  return status === "Estimate Provided" ? "Waiting on Customer" : status;
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

function toEstimateRecordRow(
  estimate: Awaited<ReturnType<typeof prisma.estimateRecord.findMany>>[number] & {
    customer?: { name: string } | null;
    lead?: { id: string; name: string } | null;
    printableEstimate?: { id: string } | null;
  },
): EstimateRecordRow {
  return {
    id: estimate.id,
    convertedJobId: estimate.convertedJobId ?? undefined,
    printableEstimateId: estimate.printableEstimate?.id,
    customerId: estimate.customerId ?? undefined,
    customerName: estimate.customer?.name ?? undefined,
    leadId: estimate.lead?.id,
    leadName: estimate.lead?.name,
    description: estimate.description,
    serviceLocation: estimate.serviceLocation ?? undefined,
    dateBegin: estimate.dateBegin?.toISOString(),
    dateEnd: estimate.dateEnd?.toISOString(),
    laborCost: formatMoney(estimate.laborCost),
    jobType: normalizeJobType(estimate.jobType),
    measurementRooms: parseMeasurementRooms(estimate.measurementRooms),
    laborItems: parsePricingItems(estimate.laborItems),
    materialTaxRate: formatMoney(estimate.materialTaxRate),
    materials: parseMaterials(estimate.materials),
    estimatedTotal: formatMoney(estimate.estimatedTotal),
    scope: estimate.scope ?? undefined,
    category: estimate.category,
    status: normalizeEstimateStatus(estimate.status),
    notes: estimate.notes ?? undefined,
    createdAt: estimate.createdAt.toISOString(),
  };
}

export async function getEstimateCustomers(ownerId: string): Promise<JobCustomer[]> {
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

export type EstimateLeadOption = {
  id: string;
  customerId?: string;
  email?: string;
  name: string;
  phone?: string;
  serviceLocation?: string;
  serviceType?: string;
  status: string;
};

export async function getEstimateLeads(ownerId: string): Promise<EstimateLeadOption[]> {
  const leads = await prisma.lead.findMany({
    where: {
      ownerId,
      status: {
        notIn: ["Won", "Lost"],
      },
    },
    orderBy: [{ followUpAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      customerId: true,
      email: true,
      name: true,
      phone: true,
      serviceLocation: true,
      serviceType: true,
      status: true,
    },
  });

  return leads.map((lead) => ({
    id: lead.id,
    customerId: lead.customerId ?? undefined,
    email: lead.email ?? undefined,
    name: lead.name,
    phone: lead.phone ?? undefined,
    serviceLocation: lead.serviceLocation ?? undefined,
    serviceType: lead.serviceType ?? undefined,
    status: lead.status,
  }));
}

export async function getEstimateRecords(ownerId: string): Promise<EstimateRecordRow[]> {
  const estimates = await prisma.estimateRecord.findMany({
    where: {
      ownerId,
    },
    include: {
      customer: true,
      lead: true,
      printableEstimate: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return estimates.map(toEstimateRecordRow);
}

export async function getEstimateRecord(ownerId: string, estimateRecordId: string): Promise<EstimateRecordRow | null> {
  const estimate = await prisma.estimateRecord.findUnique({
    where: {
      id_ownerId: {
        id: estimateRecordId,
        ownerId,
      },
    },
    include: {
      customer: true,
      lead: true,
      printableEstimate: true,
    },
  });

  return estimate ? toEstimateRecordRow(estimate) : null;
}

export async function getEstimateServices(ownerId: string): Promise<ServiceTemplateRow[]> {
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
