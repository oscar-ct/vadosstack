import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";

import { EstimateRecordWorkspace } from "../_components/estimate-record-workspace";
import { getEstimateCustomers, getEstimateServices } from "../_lib/estimate-record-data";
import { createEstimateRecordAction } from "../records-actions";

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to create estimates"
        description="Estimate records are private to each signed-in account."
      />
    );
  }

  const [customers, services] = await Promise.all([
    getEstimateCustomers(currentUser.id),
    getEstimateServices(currentUser.id),
  ]);

  return (
    <EstimateRecordWorkspace
      action={createEstimateRecordAction}
      customers={customers}
      mode="create"
      services={services}
    />
  );
}
