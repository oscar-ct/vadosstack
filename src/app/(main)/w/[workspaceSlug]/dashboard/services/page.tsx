import { PackageCheck, Plus } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { PermissionDisabledButton } from "@/components/permission-disabled-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceLink as Link } from "@/components/workspace-path-provider";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";

import { ServicesDashboard } from "./_components/services-dashboard";
import { getServices } from "./_lib/service-data";

export default async function Page() {
  const authorization = await getPermittedDashboardAuthorization("services.view");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Service access required"
        description="You do not have permission to view services in this workspace."
      />
    );
  }

  const services = await getServices(authorization.workspaceId);
  const canManage = can(authorization.membership, "services.manage");

  return (
    <div className="@container/main mx-auto grid w-full max-w-7xl gap-4 md:gap-6">
      <Card className="overflow-hidden rounded-lg">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid max-w-2xl gap-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                Services
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <PackageCheck className="size-4" />
                </span>
              </CardTitle>
              <CardDescription>
                Keep your repeatable work scopes easy to scan, price, and reuse in jobs or estimates.
              </CardDescription>
            </div>
            {canManage ? (
              <Button asChild size="sm">
                <Link prefetch={false} href="/dashboard/services/create">
                  <Plus />
                  Create service
                </Link>
              </Button>
            ) : (
              <PermissionDisabledButton size="sm" reason="Your role can view services but cannot create them.">
                <Plus />
                Create service
              </PermissionDisabledButton>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-5">
          <ServicesDashboard canManage={canManage} services={services} />
        </CardContent>
      </Card>
    </div>
  );
}
