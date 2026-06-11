import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";

import { createInvoiceAction } from "../invoices/actions";
import { JobsOverview } from "./_components/jobs-overview";
import { getJobs } from "./_lib/job-data";

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view jobs"
        description="Job records are private to each signed-in account."
      />
    );
  }

  const jobs = await getJobs(currentUser.id);

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <JobsOverview createInvoiceAction={createInvoiceAction} data={jobs} />
    </div>
  );
}
