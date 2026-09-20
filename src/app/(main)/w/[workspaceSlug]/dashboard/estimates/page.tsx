import { NotebookText, Plus } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { PermissionDisabledButton } from "@/components/permission-disabled-button";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceLink as Link } from "@/components/workspace-path-provider";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";

import { EstimateRecordsTable } from "./_components/estimate-records-table";
import { getEstimateRecords } from "./_lib/estimate-record-data";

export default async function Page() {
  const authorization = await getPermittedDashboardAuthorization("estimates.view");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Sign in to view estimates"
        description="Estimate records are private to each signed-in account."
      />
    );
  }

  const estimates = await getEstimateRecords(authorization.workspaceId);
  const canCreate = can(authorization.membership, "estimates.create");
  const canEdit = can(authorization.membership, "estimates.update");
  const canExport = can(authorization.membership, "reports.export");

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 leading-none">
            <span className={"text-lg"}>Estimates</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <NotebookText className="size-4 text-muted-foreground" />
            </div>
          </CardTitle>
          <CardDescription>
            Work estimates from draft, to sending, to customer decision, to job conversion.
          </CardDescription>
          <CardAction className="flex items-center gap-2">
            {canCreate ? (
              <Button asChild size="sm">
                <Link prefetch={false} href="/dashboard/estimates/create">
                  <Plus />
                  Create
                </Link>
              </Button>
            ) : (
              <PermissionDisabledButton
                size="sm"
                reason="Your role can view estimates but cannot create them."
                aria-label="Create estimate unavailable"
              >
                <Plus />
                Create
              </PermissionDisabledButton>
            )}
            {canExport ? <div id="estimates-export-action" /> : null}
          </CardAction>
        </CardHeader>
        <CardContent className="pt-0">
          <EstimateRecordsTable
            canEdit={canEdit}
            canExport={canExport}
            data={estimates}
            exportSlotId={canExport ? "estimates-export-action" : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
