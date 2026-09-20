import { prisma } from "@/lib/prisma";

import { parseMaterials } from "../../jobs/_components/materials";
import { parsePricingItems } from "../../jobs/_components/pricing-items";
import type { ServiceTemplateRow } from "../types";

function formatMoney(value: { toString: () => string } | null) {
  return value ? value.toString() : "0";
}

function mapService(service: {
  id: string;
  title: string;
  description: string | null;
  category: string;
  notes: string | null;
  laborItems: string | null;
  materialTaxRate: { toString: () => string } | null;
  materials: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ServiceTemplateRow {
  return {
    id: service.id,
    title: service.title,
    description: service.description ?? undefined,
    category: service.category,
    notes: service.notes ?? undefined,
    laborItems: parsePricingItems(service.laborItems ?? ""),
    materialTaxRate: formatMoney(service.materialTaxRate),
    materials: parseMaterials(service.materials ?? ""),
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

export async function getServices(ownerId: string): Promise<ServiceTemplateRow[]> {
  const services = await prisma.serviceTemplate.findMany({
    where: {
      ownerId,
    },
    orderBy: {
      title: "asc",
    },
  });

  return services.map(mapService);
}

export async function getService(ownerId: string, serviceId: string): Promise<ServiceTemplateRow | null> {
  const service = await prisma.serviceTemplate.findUnique({
    where: {
      id_ownerId: {
        id: serviceId,
        ownerId,
      },
    },
  });

  return service ? mapService(service) : null;
}
