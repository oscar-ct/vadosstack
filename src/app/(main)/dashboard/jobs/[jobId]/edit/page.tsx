import { notFound } from "next/navigation";

import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";

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
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to edit jobs"
        description="Job records are private to each signed-in account."
      />
    );
  }

  const { jobId } = await params;
  const [customers, job, services] = await Promise.all([
    getJobCustomers(currentUser.id),
    getJob(currentUser.id, jobId),
    getJobServices(currentUser.id),
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
