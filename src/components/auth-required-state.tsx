import Link from "next/link";

import { LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  getCurrentDashboardAuthorization,
  getDashboardRequestContext,
  getDashboardRouteLabel,
  getMembershipLandingPath,
  WorkspaceAccessDeniedError,
} from "@/lib/authorization";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";

export async function AuthRequiredState({ title, description }: { title: string; description: string }) {
  let authorization = null;

  try {
    authorization = await getCurrentDashboardAuthorization();
  } catch (error) {
    if (!(error instanceof WorkspaceAccessDeniedError)) throw error;
  }

  if (authorization) {
    const requestContext = await getDashboardRequestContext();
    const routeLabel = getDashboardRouteLabel(requestContext.dashboardPath);
    const landingPath = getMembershipLandingPath(authorization.membership);
    const landingLabel = getDashboardRouteLabel(landingPath);

    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LockKeyhole />
          </EmptyMedia>
          <EmptyTitle>{routeLabel} access unavailable</EmptyTitle>
          <EmptyDescription>
            Your current role does not include permission to access {routeLabel}. Contact a workspace administrator if
            you need access.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link
              prefetch={false}
              href={getWorkspaceDashboardPath(authorization.membership.workspaceSlug, landingPath)}
            >
              Return to {landingLabel}
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockKeyhole />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link prefetch={false} href="/login">
            Sign in
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
