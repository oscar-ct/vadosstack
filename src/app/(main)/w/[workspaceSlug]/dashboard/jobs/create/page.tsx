import { AuthRequiredState } from "@/components/auth-required-state";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";

import { JobRecordWorkspace } from "../_components/job-record-workspace";
import { getJobCustomers, getJobServices } from "../_lib/job-data";
import { createJobAction } from "../actions";

export default async function Page() {
  const authorization = await getPermittedDashboardAuthorization("jobs.create");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Job creation access required"
        description="You do not have permission to create jobs in this workspace."
      />
    );
  }

  const [customers, services] = await Promise.all([
    can(authorization.membership, "customers.view") ? getJobCustomers(authorization.workspaceId) : Promise.resolve([]),
    can(authorization.membership, "services.view") ? getJobServices(authorization.workspaceId) : Promise.resolve([]),
  ]);

  return <JobRecordWorkspace action={createJobAction} customers={customers} mode="create" services={services} />;
}
