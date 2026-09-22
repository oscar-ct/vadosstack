import { isDashboardPathEnabled, parseWorkspaceMode } from "@/lib/workspace-mode";

import { can, type WorkspaceMembershipSummary } from "./authorize";
import { getDashboardViewPermission } from "./route-permissions";

const dashboardLandingCandidates = [
  "/dashboard/overview",
  "/dashboard/commerce-pulse",
  "/dashboard/time-tracking",
  "/dashboard/calendar",
  "/dashboard/jobs",
  "/dashboard/orders",
  "/dashboard/customers",
  "/dashboard/employees",
  "/dashboard/estimates",
  "/dashboard/invoices",
  "/dashboard/services",
  "/dashboard/leads",
  "/dashboard/email-history",
  "/dashboard/email-templates",
  "/dashboard/roles",
] as const;

export function getMembershipLandingPath(
  membership: Pick<WorkspaceMembershipSummary, "permissions" | "roleSystemKey" | "workspaceMode"> & {
    membershipStatus?: string;
    workspaceStatus?: string;
  },
) {
  const mode = parseWorkspaceMode(membership.workspaceMode);

  // Suspended workspaces still need a stable route so their layout can render the
  // suspension notice. Authorization remains denied by `can`; no page data loads.
  if (membership.membershipStatus === "Suspended" || membership.workspaceStatus === "Suspended") {
    return "/dashboard/overview";
  }

  return (
    dashboardLandingCandidates.find((path) => {
      const permission = getDashboardViewPermission(path);
      return isDashboardPathEnabled(path, mode) && (!permission || can(membership, permission));
    }) ?? "/dashboard"
  );
}
