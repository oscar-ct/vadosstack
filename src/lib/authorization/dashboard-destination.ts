import { prisma } from "@/lib/prisma";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";

import type { CurrentPrincipal, WorkspaceMembershipSummary } from "./authorize";
import { isPermissionKey } from "./permissions";
import { getMembershipLandingPath } from "./workspace-landing";

function selectDefaultMembership<
  T extends Pick<WorkspaceMembershipSummary, "roleSystemKey" | "workspaceId"> & { workspaceStatus?: string },
>(memberships: readonly T[], userId: string) {
  const activeMemberships = memberships.filter(
    (membership) => !membership.workspaceStatus || membership.workspaceStatus === "Active",
  );
  return (
    activeMemberships.find((membership) => membership.workspaceId === userId && membership.roleSystemKey === "OWNER") ??
    activeMemberships[0] ??
    memberships.find((membership) => membership.workspaceId === userId && membership.roleSystemKey === "OWNER") ??
    memberships[0]
  );
}

export function getPrincipalDashboardDestination(principal: CurrentPrincipal) {
  const membership = selectDefaultMembership(principal.memberships, principal.user.id);

  if (!membership) {
    return "/workplace-access";
  }

  return getWorkspaceDashboardPath(membership.workspaceSlug, getMembershipLandingPath(membership));
}

export async function getUserDashboardDestination(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      workspaceMode: true,
      workspaceMemberships: {
        where: { status: "Active" },
        orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
        select: {
          workspaceId: true,
          workspace: { select: { slug: true, workspaceMode: true, status: true } },
          role: {
            select: {
              permissions: { select: { permissionKey: true } },
              systemKey: true,
            },
          },
        },
      },
    },
  });

  if (!user) return "/login";

  const memberships = user.workspaceMemberships.map((membership) => ({
    workspaceId: membership.workspaceId,
    workspaceSlug: membership.workspace.slug,
    workspaceMode: membership.workspace.workspaceMode,
    workspaceStatus: membership.workspace.status,
    roleSystemKey: membership.role.systemKey,
    permissions: new Set(membership.role.permissions.map(({ permissionKey }) => permissionKey).filter(isPermissionKey)),
  }));
  const membership = selectDefaultMembership(memberships, userId);

  if (!membership) return "/workplace-access";

  return getWorkspaceDashboardPath(membership.workspaceSlug, getMembershipLandingPath(membership));
}
