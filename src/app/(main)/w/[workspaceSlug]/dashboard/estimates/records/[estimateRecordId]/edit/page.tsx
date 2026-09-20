import { notFound } from "next/navigation";

import { PermissionRequiredState } from "@/components/permission-required-state";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";

import { EstimateRecordWorkspace } from "../../../_components/estimate-record-workspace";
import {
  getEstimateCustomers,
  getEstimateLeads,
  getEstimateRecord,
  getEstimateServices,
} from "../../../_lib/estimate-record-data";
import { deleteEstimateRecordAction, updateEstimateRecordAction } from "../../../records-actions";

export default async function Page({
  params,
}: {
  params: Promise<{
    estimateRecordId: string;
  }>;
}) {
  const authorization = await getPermittedDashboardAuthorization("estimates.update");

  if (!authorization) {
    return (
      <PermissionRequiredState
        title="Estimate editing unavailable"
        description="Your current role can view estimates but does not have permission to edit them."
        backHref="/dashboard/estimates"
        backLabel="Back to estimates"
      />
    );
  }

  const { estimateRecordId } = await params;
  const workspaceId = authorization.workspaceId;
  const [customers, estimate, leads, services] = await Promise.all([
    can(authorization.membership, "customers.view") ? getEstimateCustomers(workspaceId) : [],
    getEstimateRecord(workspaceId, estimateRecordId),
    can(authorization.membership, "leads.view") ? getEstimateLeads(workspaceId) : [],
    can(authorization.membership, "services.view") ? getEstimateServices(workspaceId) : [],
  ]);

  if (!estimate) {
    notFound();
  }

  return (
    <EstimateRecordWorkspace
      action={updateEstimateRecordAction}
      customers={customers}
      deleteAction={can(authorization.membership, "estimates.delete") ? deleteEstimateRecordAction : undefined}
      estimate={estimate}
      leads={leads}
      mode="edit"
      services={services}
    />
  );
}
