import { cache } from "react";

import { type CurrentUser, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { isPermissionKey, PERMISSION_KEYS, type PermissionKey } from "./permissions";
import { getDashboardRequestContext } from "./request-context";
import { createHash } from "node:crypto";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("You must be signed in to continue.");
    this.name = "AuthenticationRequiredError";
  }
}

export class WorkspaceAccessDeniedError extends Error {
  constructor() {
    super("You do not have permission to perform this action.");
    this.name = "WorkspaceAccessDeniedError";
  }
}

export type WorkspaceMembershipSummary = {
  id: string;
  membershipStatus: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  workspaceMode: string;
  workspaceStatus: string;
  workspaceSuspendedAt: Date | null;
  workspaceSuspensionReasonCode: string | null;
  workspaceSuspendedUntil: Date | null;
  roleId: string;
  roleName: string;
  roleSystemKey: string | null;
  employeeId: string | null;
  permissions: ReadonlySet<PermissionKey>;
};

export type CurrentPrincipal = {
  authorizationVersion: string;
  user: CurrentUser;
  memberships: readonly WorkspaceMembershipSummary[];
};

export type AuthorizedWorkspace = {
  principal: CurrentPrincipal;
  membership: WorkspaceMembershipSummary;
  workspaceId: string;
};

export type CurrentDashboardAuthorization = AuthorizedWorkspace & {
  isLegacyOwnerCompatibility: boolean;
};

const toPermissionSet = (systemKey: string | null, permissionKeys: string[]) => {
  if (systemKey === "OWNER" || systemKey === "ADMIN") {
    return new Set<PermissionKey>(PERMISSION_KEYS);
  }

  return new Set(permissionKeys.filter(isPermissionKey));
};

type AuthorizationVersionRecord = {
  id: string;
  status: string;
  updatedAt: Date;
  workspaceId: string;
  role: { id: string; updatedAt: Date; workspaceId: string };
  workspace: { id: string; status: string; updatedAt: Date };
};

function createAuthorizationVersion(records: readonly AuthorizationVersionRecord[]) {
  const value = records
    .map((record) => [
      record.id,
      record.status,
      record.updatedAt.toISOString(),
      record.workspaceId,
      record.role.id,
      record.role.updatedAt.toISOString(),
      record.workspace.id,
      record.workspace.status,
      record.workspace.updatedAt.toISOString(),
    ])
    .sort(([left], [right]) => left.localeCompare(right));

  return createHash("sha256").update(JSON.stringify(value)).digest("base64url");
}

export async function getUserAuthorizationVersion(userId: string) {
  const memberships = await prisma.workspaceMembership.findMany({
    where: {
      userId,
      status: { in: ["Active", "Suspended"] },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      workspaceId: true,
      role: { select: { id: true, updatedAt: true, workspaceId: true } },
      workspace: { select: { id: true, status: true, updatedAt: true } },
    },
  });

  return createAuthorizationVersion(
    memberships.filter(
      (membership) =>
        membership.workspace.id === membership.workspaceId && membership.role.workspaceId === membership.workspaceId,
    ),
  );
}

export const getCurrentPrincipal = cache(async (): Promise<CurrentPrincipal | null> => {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const memberships = await prisma.workspaceMembership.findMany({
    where: {
      userId: user.id,
      status: { in: ["Active", "Suspended"] },
    },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      updatedAt: true,
      workspaceId: true,
      employeeId: true,
      workspace: {
        select: {
          id: true,
          slug: true,
          name: true,
          workspaceMode: true,
          status: true,
          updatedAt: true,
          suspendedAt: true,
          suspensionReasonCode: true,
          suspendedUntil: true,
        },
      },
      role: {
        select: {
          id: true,
          workspaceId: true,
          name: true,
          systemKey: true,
          updatedAt: true,
          permissions: {
            select: {
              permissionKey: true,
            },
          },
        },
      },
    },
  });

  const validMemberships = memberships.filter(
    (membership) =>
      membership.workspace.id === membership.workspaceId && membership.role.workspaceId === membership.workspaceId,
  );

  return {
    authorizationVersion: createAuthorizationVersion(validMemberships),
    user,
    memberships: validMemberships.map((membership) => ({
      id: membership.id,
      membershipStatus: membership.status,
      workspaceId: membership.workspaceId,
      workspaceSlug: membership.workspace.slug,
      workspaceName: membership.workspace.name,
      workspaceMode: membership.workspace.workspaceMode,
      workspaceStatus: membership.workspace.status,
      workspaceSuspendedAt: membership.workspace.suspendedAt,
      workspaceSuspensionReasonCode: membership.workspace.suspensionReasonCode,
      workspaceSuspendedUntil: membership.workspace.suspendedUntil,
      roleId: membership.role.id,
      roleName: membership.role.name,
      roleSystemKey: membership.role.systemKey,
      employeeId: membership.employeeId,
      permissions: toPermissionSet(
        membership.role.systemKey,
        membership.role.permissions.map((permission) => permission.permissionKey),
      ),
    })),
  };
});

export async function requireCurrentPrincipal() {
  const principal = await getCurrentPrincipal();

  if (!principal) {
    throw new AuthenticationRequiredError();
  }

  return principal;
}

export function can(
  membership: Pick<WorkspaceMembershipSummary, "permissions" | "roleSystemKey"> & {
    membershipStatus?: string;
    workspaceStatus?: string;
  },
  permission: PermissionKey,
) {
  if (membership.membershipStatus && membership.membershipStatus !== "Active") {
    return false;
  }

  if (membership.workspaceStatus && membership.workspaceStatus !== "Active") {
    return false;
  }

  return (
    membership.roleSystemKey === "OWNER" ||
    membership.roleSystemKey === "ADMIN" ||
    membership.permissions.has(permission)
  );
}

export async function authorizeWorkspace(workspaceId: string, permission: PermissionKey): Promise<AuthorizedWorkspace> {
  const principal = await requireCurrentPrincipal();
  const membership = principal.memberships.find((candidate) => candidate.workspaceId === workspaceId);

  if (!membership || !can(membership, permission)) {
    throw new WorkspaceAccessDeniedError();
  }

  return {
    principal,
    membership,
    workspaceId,
  };
}

export async function authorizeWorkspaceSlug(
  workspaceSlug: string,
  permission: PermissionKey,
): Promise<AuthorizedWorkspace> {
  const principal = await requireCurrentPrincipal();
  const membership = principal.memberships.find((candidate) => candidate.workspaceSlug === workspaceSlug);

  if (!membership || !can(membership, permission)) {
    throw new WorkspaceAccessDeniedError();
  }

  return {
    principal,
    membership,
    workspaceId: membership.workspaceId,
  };
}

export async function authorizeLegacyOwnerWorkspace(permission: PermissionKey): Promise<AuthorizedWorkspace> {
  const principal = await requireCurrentPrincipal();
  const membership = principal.memberships.find((candidate) => candidate.roleSystemKey === "OWNER");

  if (!membership || !can(membership, permission)) {
    throw new WorkspaceAccessDeniedError();
  }

  return {
    principal,
    membership,
    workspaceId: membership.workspaceId,
  };
}

export const getCurrentDashboardAuthorization = cache(async (): Promise<CurrentDashboardAuthorization | null> => {
  const principal = await getCurrentPrincipal();

  if (!principal) {
    return null;
  }

  const requestContext = await getDashboardRequestContext();
  let membership = requestContext.workspaceSlug
    ? principal.memberships.find((candidate) => candidate.workspaceSlug === requestContext.workspaceSlug)
    : (principal.memberships.find((candidate) => candidate.roleSystemKey === "OWNER") ?? principal.memberships[0]);

  if (!membership && requestContext.workspaceSlug) {
    const alias = await prisma.workspaceSlugAlias.findUnique({
      where: { slug: requestContext.workspaceSlug },
      select: { workspaceId: true },
    });
    membership = alias
      ? principal.memberships.find((candidate) => candidate.workspaceId === alias.workspaceId)
      : undefined;
  }

  if (!membership) {
    throw new WorkspaceAccessDeniedError();
  }

  return {
    principal,
    membership,
    workspaceId: membership.workspaceId,
    isLegacyOwnerCompatibility: membership.roleSystemKey === "OWNER" && membership.workspaceId === principal.user.id,
  };
});

export async function authorizeCurrentDashboard(permission: PermissionKey): Promise<CurrentDashboardAuthorization> {
  const authorization = await getCurrentDashboardAuthorization();

  if (!authorization) {
    throw new AuthenticationRequiredError();
  }

  if (!can(authorization.membership, permission)) {
    throw new WorkspaceAccessDeniedError();
  }

  return authorization;
}

export async function getPermittedDashboardAuthorization(
  permission: PermissionKey,
): Promise<CurrentDashboardAuthorization | null> {
  try {
    const authorization = await getCurrentDashboardAuthorization();
    return authorization && can(authorization.membership, permission) ? authorization : null;
  } catch (error) {
    if (error instanceof WorkspaceAccessDeniedError) {
      return null;
    }

    throw error;
  }
}
