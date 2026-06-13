import { prisma } from "@/lib/prisma";

import { type LeadStatus, leadStatuses } from "../constants";

export type LeadRow = {
  id: string;
  customerId?: string;
  customerName?: string;
  estimateRecordId?: string;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  serviceType?: string;
  serviceLocation?: string;
  estimatedValue?: string;
  status: LeadStatus | string;
  priority: string;
  notes?: string;
  followUpAt?: string;
  lostReason?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
};

function formatMoney(value: { toString: () => string } | null) {
  return value ? Number(value.toString()).toFixed(2) : undefined;
}

function toLeadRow(
  lead: Awaited<ReturnType<typeof prisma.lead.findMany>>[number] & {
    customer?: { name: string } | null;
  },
): LeadRow {
  return {
    id: lead.id,
    customerId: lead.customerId ?? undefined,
    customerName: lead.customer?.name ?? undefined,
    estimateRecordId: lead.estimateRecordId ?? undefined,
    name: lead.name,
    email: lead.email ?? undefined,
    phone: lead.phone ?? undefined,
    source: lead.source ?? undefined,
    serviceType: lead.serviceType ?? undefined,
    serviceLocation: lead.serviceLocation ?? undefined,
    estimatedValue: formatMoney(lead.estimatedValue),
    status: lead.status,
    priority: lead.priority,
    notes: lead.notes ?? undefined,
    followUpAt: lead.followUpAt?.toISOString(),
    lostReason: lead.lostReason ?? undefined,
    convertedAt: lead.convertedAt?.toISOString(),
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

export async function getLeads(ownerId: string) {
  const leads = await prisma.lead.findMany({
    where: { ownerId },
    include: {
      customer: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ followUpAt: "asc" }, { createdAt: "desc" }],
  });

  return leads.map(toLeadRow);
}

export async function getLead(ownerId: string, leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: {
      id_ownerId: {
        id: leadId,
        ownerId,
      },
    },
    include: {
      customer: {
        select: {
          name: true,
        },
      },
    },
  });

  return lead ? toLeadRow(lead) : null;
}

export function summarizeLeads(leads: LeadRow[]) {
  const counts = new Map(leadStatuses.map((status) => [status, 0]));

  for (const lead of leads) {
    if (counts.has(lead.status as LeadStatus)) {
      counts.set(lead.status as LeadStatus, (counts.get(lead.status as LeadStatus) ?? 0) + 1);
    }
  }

  return {
    total: leads.length,
    open: leads.filter((lead) => lead.status !== "Won" && lead.status !== "Lost").length,
    needsFollowUp: leads.filter((lead) => lead.followUpAt && lead.status !== "Won" && lead.status !== "Lost").length,
    won: counts.get("Won") ?? 0,
    lost: counts.get("Lost") ?? 0,
    counts,
  };
}
