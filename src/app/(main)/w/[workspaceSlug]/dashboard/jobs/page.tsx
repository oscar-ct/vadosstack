import { AuthRequiredState } from "@/components/auth-required-state";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";

import { createInvoiceAction } from "../invoices/actions";
import { JobsOverview } from "./_components/jobs-overview";
import { getJobs } from "./_lib/job-data";

export default async function Page() {
  const authorization = await getPermittedDashboardAuthorization("jobs.view");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Job access required"
        description="You do not have permission to view jobs in this workspace."
      />
    );
  }

  const jobs = await getJobs(authorization.workspaceId);
  const canCreate = can(authorization.membership, "jobs.create");
  const canEdit = can(authorization.membership, "jobs.update");
  const canCreateInvoice = can(authorization.membership, "invoices.create");
  const canExport = can(authorization.membership, "reports.export");

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <JobsOverview
        canCreate={canCreate}
        canCreateInvoice={canCreateInvoice}
        canEdit={canEdit}
        canExport={canExport}
        createInvoiceAction={createInvoiceAction}
        data={jobs}
      />
    </div>
  );
}
