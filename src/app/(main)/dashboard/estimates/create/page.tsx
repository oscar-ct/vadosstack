import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { EstimateRecordWorkspace } from "../_components/estimate-record-workspace";
import { getEstimateCustomers, getEstimateServices } from "../_lib/estimate-record-data";
import { createEstimateRecordAction } from "../records-actions";

type PageProps = {
  searchParams?: Promise<{
    leadId?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to create estimates"
        description="Estimate records are private to each signed-in account."
      />
    );
  }

  const resolvedSearchParams = await searchParams;
  const leadId = resolvedSearchParams?.leadId;

  const [customers, services, lead] = await Promise.all([
    getEstimateCustomers(currentUser.id),
    getEstimateServices(currentUser.id),
    leadId
      ? prisma.lead.findUnique({
          where: {
            id_ownerId: {
              id: leadId,
              ownerId: currentUser.id,
            },
          },
        })
      : null,
  ]);
  const leadPrefill = lead
    ? {
        leadId: lead.id,
        customerId: lead.customerId ?? undefined,
        customerName: lead.name,
        customerEmail: lead.email ?? undefined,
        customerPhone: lead.phone ?? undefined,
        description: lead.serviceType ? `${lead.serviceType} estimate for ${lead.name}` : `Estimate for ${lead.name}`,
        serviceLocation: lead.serviceLocation ?? undefined,
        category: lead.serviceType ?? undefined,
        notes: lead.notes ?? undefined,
      }
    : undefined;

  return (
    <EstimateRecordWorkspace
      action={createEstimateRecordAction}
      customers={customers}
      leadPrefill={leadPrefill}
      mode="create"
      services={services}
    />
  );
}
