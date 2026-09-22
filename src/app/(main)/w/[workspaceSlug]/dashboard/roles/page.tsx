import { AuthRequiredState } from "@/components/auth-required-state";
import { getPermissionGroupsForWorkspaceMode, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { parseWorkspaceMode } from "@/lib/workspace-mode";

import { RolesManager } from "./_components/roles-manager";
import {
  createRoleAction,
  deleteRoleAction,
  inviteWorkspaceMemberAction,
  reactivateWorkspaceMemberAction,
  removeWorkspaceMemberAction,
  resendWorkspaceInvitationAction,
  restoreWorkspaceMemberAction,
  revokeWorkspaceInvitationAction,
  suspendWorkspaceMemberAction,
  updateMemberRoleAction,
  updateRoleAction,
} from "./actions";

export default async function Page() {
  const authorization = await getPermittedDashboardAuthorization("roles.manage");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Roles access required"
        description="You do not have permission to manage roles and workplace access."
      />
    );
  }

  const [roles, memberships, invitations, employees, auditEvents, workspace] = await Promise.all([
    prisma.workspaceRole.findMany({
      where: { workspaceId: authorization.workspaceId },
      orderBy: [{ systemKey: "asc" }, { name: "asc" }],
      include: {
        permissions: { select: { permissionKey: true } },
        _count: {
          select: {
            invitations: true,
            memberships: { where: { status: "Active" } },
          },
        },
      },
    }),
    prisma.workspaceMembership.findMany({
      where: { workspaceId: authorization.workspaceId, status: { in: ["Active", "Removed", "Suspended"] } },
      orderBy: [{ joinedAt: "asc" }],
      select: {
        id: true,
        joinedAt: true,
        roleId: true,
        status: true,
        updatedAt: true,
        user: { select: { email: true, id: true, name: true } },
      },
    }),
    prisma.workspaceInvitation.findMany({
      where: {
        workspaceId: authorization.workspaceId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { email: true, expiresAt: true, id: true, role: { select: { name: true } } },
    }),
    prisma.employee.findMany({
      where: {
        ownerId: authorization.workspaceId,
        active: true,
        workspaceMembership: null,
      },
      orderBy: { name: "asc" },
      select: { email: true, id: true, name: true },
    }),
    prisma.authorizationAuditEvent.findMany({
      where: { workspaceId: authorization.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        action: true,
        actor: { select: { email: true, name: true } },
        createdAt: true,
        id: true,
        metadata: true,
        targetId: true,
        targetType: true,
      },
    }),
    prisma.workspace.findUniqueOrThrow({
      where: { id: authorization.workspaceId },
      select: { id: true, legacyOwnerId: true },
    }),
  ]);

  const workspaceOwnerId = workspace.legacyOwnerId ?? workspace.id;

  return (
    <RolesManager
      actions={{
        createRoleAction,
        deleteRoleAction,
        inviteWorkspaceMemberAction,
        reactivateWorkspaceMemberAction,
        removeWorkspaceMemberAction,
        resendWorkspaceInvitationAction,
        restoreWorkspaceMemberAction,
        revokeWorkspaceInvitationAction,
        suspendWorkspaceMemberAction,
        updateMemberRoleAction,
        updateRoleAction,
      }}
      auditEvents={auditEvents.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
        metadata: event.metadata && typeof event.metadata === "object" ? event.metadata : null,
      }))}
      employees={employees}
      invitations={invitations.map((invitation) => ({
        ...invitation,
        expiresAt: invitation.expiresAt.toISOString(),
      }))}
      members={memberships
        .filter((membership) => membership.status === "Active")
        .map((membership) => ({
          id: membership.id,
          isWorkspaceOwner: membership.user.id === workspaceOwnerId,
          joinedAt: membership.joinedAt.toISOString(),
          roleId: membership.roleId,
          user: membership.user,
        }))}
      permissionGroups={getPermissionGroupsForWorkspaceMode(parseWorkspaceMode(authorization.membership.workspaceMode))}
      roles={roles.map((role) => ({
        description: role.description,
        id: role.id,
        invitationCount: role._count.invitations,
        isProtected: role.isProtected,
        memberCount: role._count.memberships,
        name: role.name,
        permissions: role.permissions.map((permission) => permission.permissionKey),
        systemKey: role.systemKey,
        updatedAt: role.updatedAt.toISOString(),
      }))}
      removedMembers={memberships
        .filter((membership) => membership.status === "Removed")
        .map((membership) => ({
          id: membership.id,
          isWorkspaceOwner: membership.user.id === workspaceOwnerId,
          joinedAt: membership.joinedAt.toISOString(),
          removedAt: membership.updatedAt.toISOString(),
          roleId: membership.roleId,
          user: membership.user,
        }))}
      suspendedMembers={memberships
        .filter((membership) => membership.status === "Suspended")
        .map((membership) => ({
          changedAt: membership.updatedAt.toISOString(),
          id: membership.id,
          isWorkspaceOwner: membership.user.id === workspaceOwnerId,
          joinedAt: membership.joinedAt.toISOString(),
          roleId: membership.roleId,
          user: membership.user,
        }))}
      workspaceName={authorization.membership.workspaceName}
    />
  );
}
