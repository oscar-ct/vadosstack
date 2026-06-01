import { notFound } from "next/navigation";

import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";

import { EstimateRecordWorkspace } from "../../../_components/estimate-record-workspace";
import { getEstimateCustomers, getEstimateRecord, getEstimateServices } from "../../../_lib/estimate-record-data";
import { deleteEstimateRecordAction, updateEstimateRecordAction } from "../../../records-actions";

export default async function Page({
  params,
}: {
  params: Promise<{
    estimateRecordId: string;
  }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to edit estimates"
        description="Estimate records are private to each signed-in account."
      />
    );
  }

  const { estimateRecordId } = await params;
  const [customers, estimate, services] = await Promise.all([
    getEstimateCustomers(currentUser.id),
    getEstimateRecord(currentUser.id, estimateRecordId),
    getEstimateServices(currentUser.id),
  ]);

  if (!estimate) {
    notFound();
  }

  return (
    <EstimateRecordWorkspace
      action={updateEstimateRecordAction}
      customers={customers}
      deleteAction={deleteEstimateRecordAction}
      estimate={estimate}
      mode="edit"
      services={services}
    />
  );
}
