import { PermissionRequiredState } from "@/components/permission-required-state";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { formatServiceAddress } from "@/lib/service-address";

import { EstimateRecordWorkspace } from "../_components/estimate-record-workspace";
import { getEstimateCustomers, getEstimateLeads, getEstimateServices } from "../_lib/estimate-record-data";
import { createEstimateRecordAction } from "../records-actions";

type PageProps = {
  searchParams?: Promise<{
    leadId?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const authorization = await getPermittedDashboardAuthorization("estimates.create");

  if (!authorization) {
    return (
      <PermissionRequiredState
        title="Estimate creation unavailable"
        description="Your current role can view estimates but does not have permission to create them."
        backHref="/dashboard/estimates"
        backLabel="Back to estimates"
      />
    );
  }

  const resolvedSearchParams = await searchParams;
  const leadId = resolvedSearchParams?.leadId;
  const workspaceId = authorization.workspaceId;
  const canViewCustomers = can(authorization.membership, "customers.view");
  const canViewLeads = can(authorization.membership, "leads.view");
  const canViewServices = can(authorization.membership, "services.view");

  const [customers, leads, services, lead] = await Promise.all([
    canViewCustomers ? getEstimateCustomers(workspaceId) : [],
    canViewLeads ? getEstimateLeads(workspaceId) : [],
    canViewServices ? getEstimateServices(workspaceId) : [],
    leadId && canViewLeads
      ? prisma.lead.findUnique({
          where: {
            id_ownerId: {
              id: leadId,
              ownerId: workspaceId,
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
        serviceLocation: formatServiceAddress(lead) ?? undefined,
        serviceAddressLine1: lead.serviceAddressLine1 ?? undefined,
        serviceAddressLine2: lead.serviceAddressLine2 ?? undefined,
        serviceCity: lead.serviceCity ?? undefined,
        serviceState: lead.serviceState ?? undefined,
        servicePostalCode: lead.servicePostalCode ?? undefined,
        category: lead.serviceType ?? undefined,
        notes: lead.notes ?? undefined,
      }
    : undefined;

  return (
    <EstimateRecordWorkspace
      action={createEstimateRecordAction}
      customers={customers}
      leadPrefill={leadPrefill}
      leads={leads}
      mode="create"
      services={services}
    />
  );
}
