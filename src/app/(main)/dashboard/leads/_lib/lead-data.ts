import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { formatServiceAddress } from "@/lib/service-address";

import { type LeadStatus, leadStatuses, normalizeStandaloneLeadStatus } from "../constants";

export type LeadRow = {
  id: string;
  customerId?: string;
  customerName?: string;
  estimateRecordId?: string;
  estimateNumber?: string;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  serviceType?: string;
  serviceLocation?: string;
  serviceAddressLine1?: string;
  serviceAddressLine2?: string;
  serviceCity?: string;
  serviceState?: string;
  servicePostalCode?: string;
  status: LeadStatus;
  priority: string;
  notes?: string;
  followUpAt?: string;
  lostReason?: string;
  createdAt: string;
  updatedAt: string;
};

type LeadWithRelations = Prisma.LeadGetPayload<{
  include: {
    customer: { select: { name: true } };
    estimateRecord: {
      select: {
        printableEstimate: { select: { estimateNumber: true } };
      };
    };
  };
}>;

function toLeadRow(lead: LeadWithRelations): LeadRow {
  return {
    id: lead.id,
    customerId: lead.customerId ?? undefined,
    customerName: lead.customer?.name ?? undefined,
    estimateRecordId: lead.estimateRecordId ?? undefined,
    estimateNumber: lead.estimateRecord?.printableEstimate?.estimateNumber ?? undefined,
    name: lead.name,
    email: lead.email ?? undefined,
    phone: lead.phone ?? undefined,
    source: lead.source ?? undefined,
    serviceType: lead.serviceType ?? undefined,
    serviceLocation: formatServiceAddress(lead) ?? undefined,
    serviceAddressLine1: lead.serviceAddressLine1 ?? undefined,
    serviceAddressLine2: lead.serviceAddressLine2 ?? undefined,
    serviceCity: lead.serviceCity ?? undefined,
    serviceState: lead.serviceState ?? undefined,
    servicePostalCode: lead.servicePostalCode ?? undefined,
    status: normalizeStandaloneLeadStatus(lead.status),
    priority: lead.priority === "High" ? "High" : "Normal",
    notes: lead.notes ?? undefined,
    followUpAt: lead.followUpAt?.toISOString(),
    lostReason: lead.lostReason ?? undefined,
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
      estimateRecord: {
        select: {
          printableEstimate: {
            select: {
              estimateNumber: true,
            },
          },
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
      estimateRecord: {
        select: {
          printableEstimate: {
            select: {
              estimateNumber: true,
            },
          },
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
