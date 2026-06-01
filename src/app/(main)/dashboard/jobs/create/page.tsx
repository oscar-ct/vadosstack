import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";

import { JobRecordWorkspace } from "../_components/job-record-workspace";
import { getJobCustomers, getJobServices } from "../_lib/job-data";
import { createJobAction } from "../actions";

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to create jobs"
        description="Job records are private to each signed-in account."
      />
    );
  }

  const [customers, services] = await Promise.all([getJobCustomers(currentUser.id), getJobServices(currentUser.id)]);

  return <JobRecordWorkspace action={createJobAction} customers={customers} mode="create" services={services} />;
}
