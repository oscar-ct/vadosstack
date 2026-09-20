import { notFound } from "next/navigation";

import { AuthRequiredState } from "@/components/auth-required-state";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";

import { JobRecordWorkspace } from "../../_components/job-record-workspace";
import { getJob, getJobCustomers, getJobServices } from "../../_lib/job-data";
import { deleteJobAction, updateJobAction } from "../../actions";

export default async function Page({
  params,
}: {
  params: Promise<{
    jobId: string;
  }>;
}) {
  const authorization = await getPermittedDashboardAuthorization("jobs.update");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Job editing access required"
        description="You do not have permission to edit jobs in this workspace."
      />
    );
  }

  const { jobId } = await params;
  const [customers, job, services] = await Promise.all([
    can(authorization.membership, "customers.view") ? getJobCustomers(authorization.workspaceId) : Promise.resolve([]),
    getJob(authorization.workspaceId, jobId),
    can(authorization.membership, "services.view") ? getJobServices(authorization.workspaceId) : Promise.resolve([]),
  ]);

  if (!job) {
    notFound();
  }

  return (
    <JobRecordWorkspace
      action={updateJobAction}
      customers={customers}
      deleteAction={deleteJobAction}
      job={job}
      mode="edit"
      services={services}
    />
  );
}
