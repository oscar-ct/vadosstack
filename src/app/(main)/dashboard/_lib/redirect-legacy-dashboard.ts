import { redirect } from "next/navigation";

import { getCurrentPrincipal, getMembershipLandingPath } from "@/lib/authorization";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";

type LegacySearchParams = Record<string, string | string[] | undefined>;

function serializeSearchParams(searchParams: LegacySearchParams) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function redirectLegacyDashboard(dashboardPath: string, searchParams: Promise<LegacySearchParams>) {
  const query = serializeSearchParams(await searchParams);
  const requestedDestination = `${dashboardPath}${query}`;
  const principal = await getCurrentPrincipal();

  if (!principal) {
    redirect(`/login?returnTo=${encodeURIComponent(requestedDestination)}`);
  }

  const membership =
    principal.memberships.find((candidate) => candidate.roleSystemKey === "OWNER") ?? principal.memberships[0];

  if (!membership) {
    redirect("/workplace-access");
  }

  const destinationPath = dashboardPath === "/dashboard" ? getMembershipLandingPath(membership) : dashboardPath;
  redirect(`${getWorkspaceDashboardPath(membership.workspaceSlug, destinationPath)}${query}`);
}
