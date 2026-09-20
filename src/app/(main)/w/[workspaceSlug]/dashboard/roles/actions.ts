"use server";

import { z } from "zod";

import {
  getPermittedDashboardAuthorization,
  isPermissionAvailableForWorkspaceMode,
  isPermissionKey,
  type PermissionKey,
} from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { escapeHtml } from "@/lib/email-content";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, getRateLimitIp } from "@/lib/rate-limit";
import { resend } from "@/lib/resend";
import {
  createWorkspaceInvitationToken,
  createWorkspaceInvitationUrl,
  hashWorkspaceInvitationToken,
  WORKSPACE_INVITATION_LIFETIME_MS,
} from "@/lib/workspace-invitations";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

export type RoleActionState = { message: string; success: boolean };

const roleSchema = z.object({
  description: z.string().trim().max(300).optional(),
  name: z.string().trim().min(2, "Role name must be at least 2 characters.").max(60),
});

const roleIdSchema = z.string().trim().min(1);
const inviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  employeeId: z.string().trim().optional(),
  roleId: z.string().trim().min(1, "Choose a role."),
});

function parsePermissions(formData: FormData): PermissionKey[] {
  return [...new Set(formData.getAll("permissions").map(String).filter(isPermissionKey))];
}

function errorState(message: string): RoleActionState {
  return { message, success: false };
}

function refreshRoles(workspaceSlug: string) {
  revalidateWorkspacePath(workspaceSlug, "/dashboard/roles");
}

async function sendWorkspaceInvitationEmail({
  email,
  invitationUrl,
  roleName,
  workspaceName,
}: {
  email: string;
  invitationUrl: string;
  roleName: string;
  workspaceName: string;
}) {
  return resend.emails.send({
    from: "VadosStack <support@vadosstack.com>",
    to: email,
    subject: `You're invited to ${workspaceName}`,
    html: `<p>You have been invited to join <strong>${escapeHtml(workspaceName)}</strong> as ${escapeHtml(roleName)}.</p><p><a href="${escapeHtml(invitationUrl)}">Accept invitation</a></p><p>This secure link expires in 7 days.</p>`,
    text: `You have been invited to join ${workspaceName} as ${roleName}. Accept the invitation: ${invitationUrl}\n\nThis secure link expires in 7 days.`,
    tags: [{ name: "category", value: "workspace-invitation" }],
  });
}

export async function createRoleAction(_state: RoleActionState, formData: FormData): Promise<RoleActionState> {
  const authorization = await getPermittedDashboardAuthorization("roles.manage");
  if (!authorization) return errorState("You do not have permission to create roles.");

  const parsed = roleSchema.safeParse({
    description: formData.get("description") || undefined,
    name: formData.get("name"),
  });
  if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Check the role details.");

  const permissions = parsePermissions(formData).filter((permission) =>
    isPermissionAvailableForWorkspaceMode(
      permission,
      authorization.membership.workspaceMode as "both" | "commerce" | "service",
    ),
  );

  try {
    await prisma.$transaction(async (tx) => {
      const role = await tx.workspaceRole.create({
        data: {
          workspaceId: authorization.workspaceId,
          name: parsed.data.name,
          description: parsed.data.description || null,
          permissions: {
            create: permissions.map((permissionKey) => ({ permissionKey })),
          },
        },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId: authorization.workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "role.create",
          targetType: "WorkspaceRole",
          targetId: role.id,
          metadata: { permissions },
        },
        tx,
      );
    });
  } catch (error) {
    console.error("Role creation failed.", error);
    return errorState("Role could not be created. Its name may already be in use.");
  }

  refreshRoles(authorization.membership.workspaceSlug);
  return { message: "Role created.", success: true };
}

export async function updateRoleAction(_state: RoleActionState, formData: FormData): Promise<RoleActionState> {
  const authorization = await getPermittedDashboardAuthorization("roles.manage");
  if (!authorization) return errorState("You do not have permission to update roles.");

  const roleId = roleIdSchema.safeParse(formData.get("roleId"));
  const parsed = roleSchema.safeParse({
    description: formData.get("description") || undefined,
    name: formData.get("name"),
  });
  if (!roleId.success || !parsed.success) {
    return errorState(
      parsed.success ? "Select a role and try again." : (parsed.error.issues[0]?.message ?? "Check the role details."),
    );
  }

  const existing = await prisma.workspaceRole.findFirst({
    where: { id: roleId.data, workspaceId: authorization.workspaceId },
    include: {
      memberships: { select: { id: true, userId: true } },
      permissions: { select: { permissionKey: true } },
    },
  });
  if (!existing) return errorState("Role could not be found.");
  if (existing.systemKey === "OWNER" || existing.systemKey === "ADMIN") {
    const roleName = existing.systemKey === "OWNER" ? "Owner" : "Admin";
    return errorState(`The ${roleName} role always has full access and cannot be changed.`);
  }

  const submittedPermissions = parsePermissions(formData).filter((permission) =>
    isPermissionAvailableForWorkspaceMode(
      permission,
      authorization.membership.workspaceMode as "both" | "commerce" | "service",
    ),
  );
  const hiddenExistingPermissions = (existing.permissions ?? [])
    .map((permission) => permission.permissionKey)
    .filter(isPermissionKey)
    .filter(
      (permission) =>
        !isPermissionAvailableForWorkspaceMode(
          permission,
          authorization.membership.workspaceMode as "both" | "commerce" | "service",
        ),
    );
  const permissions = [...new Set([...submittedPermissions, ...hiddenExistingPermissions])];
  const actorUsesRole = existing.memberships.some(
    (membership) => membership.userId === authorization.principal.user.id,
  );
  if (actorUsesRole && !permissions.includes("roles.manage")) {
    return errorState("You cannot remove role management from the role assigned to your own account.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.workspaceRole.update({
        where: { id_workspaceId: { id: existing.id, workspaceId: authorization.workspaceId } },
        data: {
          description: parsed.data.description || null,
          ...(existing.isProtected ? {} : { name: parsed.data.name }),
          permissions: {
            deleteMany: {},
            create: permissions.map((permissionKey) => ({ permissionKey })),
          },
        },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId: authorization.workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "role.update",
          targetType: "WorkspaceRole",
          targetId: existing.id,
          metadata: { permissions },
        },
        tx,
      );
    });
  } catch (error) {
    console.error("Role update failed.", error);
    return errorState("Role could not be updated. Its name may already be in use.");
  }

  refreshRoles(authorization.membership.workspaceSlug);
  return { message: "Role updated.", success: true };
}

export async function deleteRoleAction(_state: RoleActionState, formData: FormData): Promise<RoleActionState> {
  const authorization = await getPermittedDashboardAuthorization("roles.manage");
  if (!authorization) return errorState("You do not have permission to delete roles.");
  const parsed = roleIdSchema.safeParse(formData.get("roleId"));
  if (!parsed.success) return errorState("Select a role and try again.");

  const role = await prisma.workspaceRole.findFirst({
    where: { id: parsed.data, workspaceId: authorization.workspaceId },
    select: { id: true, isProtected: true, _count: { select: { invitations: true, memberships: true } } },
  });
  if (!role) return errorState("Role could not be found.");
  if (role.isProtected) return errorState("System roles cannot be deleted.");
  if (role._count.memberships || role._count.invitations) {
    return errorState("Reassign its active or removed members and revoke its invitations before deleting this role.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceRole.delete({
      where: { id_workspaceId: { id: role.id, workspaceId: authorization.workspaceId } },
    });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: authorization.workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "role.delete",
        targetType: "WorkspaceRole",
        targetId: role.id,
      },
      tx,
    );
  });

  refreshRoles(authorization.membership.workspaceSlug);
  return { message: "Role deleted.", success: true };
}

export async function updateMemberRoleAction(_state: RoleActionState, formData: FormData): Promise<RoleActionState> {
  const authorization = await getPermittedDashboardAuthorization("roles.manage");
  if (!authorization) return errorState("You do not have permission to assign roles.");
  const membershipId = roleIdSchema.safeParse(formData.get("membershipId"));
  const roleId = roleIdSchema.safeParse(formData.get("roleId"));
  if (!membershipId.success || !roleId.success) return errorState("Choose a member and role.");

  const [membership, role] = await Promise.all([
    prisma.workspaceMembership.findFirst({
      where: { id: membershipId.data, workspaceId: authorization.workspaceId },
      select: { id: true, userId: true, role: { select: { systemKey: true } } },
    }),
    prisma.workspaceRole.findFirst({
      where: { id: roleId.data, workspaceId: authorization.workspaceId },
      include: { permissions: { select: { permissionKey: true } } },
    }),
  ]);
  if (!membership || !role) return errorState("Member or role could not be found.");
  if (membership.role.systemKey === "OWNER") return errorState("The workspace owner's role cannot be reassigned.");

  const targetCanManageRoles =
    role.systemKey === "OWNER" || role.permissions.some((item) => item.permissionKey === "roles.manage");
  if (membership.userId === authorization.principal.user.id && !targetCanManageRoles) {
    return errorState("You cannot assign yourself a role that removes role management access.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMembership.update({
      where: { id: membership.id },
      data: { roleId: role.id },
    });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: authorization.workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "membership.role.update",
        targetType: "WorkspaceMembership",
        targetId: membership.id,
        metadata: { roleId: role.id },
      },
      tx,
    );
  });

  refreshRoles(authorization.membership.workspaceSlug);
  return { message: "Member role updated.", success: true };
}

export async function inviteWorkspaceMemberAction(
  _state: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const authorization = await getPermittedDashboardAuthorization("roles.manage");
  if (!authorization) return errorState("You do not have permission to invite members.");
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    employeeId: formData.get("employeeId") || undefined,
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Check the invitation details.");

  const email = parsed.data.email.toLowerCase();
  const invitationIp = await getRateLimitIp();
  const withinInviteLimit = await consumeRateLimit("workspace-invitation", [
    authorization.workspaceId,
    authorization.principal.user.id,
    invitationIp,
  ]);
  if (!withinInviteLimit) {
    return errorState("Too many invitations have been sent. Please wait before trying again.");
  }
  const [role, employee, existingMembership] = await Promise.all([
    prisma.workspaceRole.findFirst({
      where: { id: parsed.data.roleId, workspaceId: authorization.workspaceId, systemKey: { not: "OWNER" } },
      select: { id: true, name: true },
    }),
    parsed.data.employeeId
      ? prisma.employee.findFirst({
          where: { id: parsed.data.employeeId, ownerId: authorization.workspaceId },
          select: { id: true },
        })
      : null,
    prisma.workspaceMembership.findFirst({
      where: { workspaceId: authorization.workspaceId, user: { email } },
      select: { id: true, status: true },
    }),
  ]);
  if (!role) return errorState("Choose an available non-owner role.");
  if (parsed.data.employeeId && !employee) return errorState("The selected employee could not be found.");
  if (existingMembership) {
    return errorState(
      existingMembership.status === "Active"
        ? "That account already has access to this workplace."
        : "That account was previously removed. Restore it from the Removed access section instead.",
    );
  }

  const token = createWorkspaceInvitationToken();
  const tokenHash = hashWorkspaceInvitationToken(token);
  const expiresAt = new Date(Date.now() + WORKSPACE_INVITATION_LIFETIME_MS);

  try {
    const invitation = await prisma.$transaction(async (tx) => {
      await tx.workspaceInvitation.updateMany({
        where: { workspaceId: authorization.workspaceId, email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const created = await tx.workspaceInvitation.create({
        data: {
          workspaceId: authorization.workspaceId,
          roleId: role.id,
          employeeId: employee?.id,
          email,
          tokenHash,
          expiresAt,
          invitedByUserId: authorization.principal.user.id,
        },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId: authorization.workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "invitation.create",
          targetType: "WorkspaceInvitation",
          targetId: created.id,
          metadata: { email, roleId: role.id },
        },
        tx,
      );
      return created;
    });
    const invitationUrl = createWorkspaceInvitationUrl(token);
    const result = await sendWorkspaceInvitationEmail({
      email,
      invitationUrl,
      roleName: role.name,
      workspaceName: authorization.membership.workspaceName,
    });
    if (result.error) {
      await prisma.workspaceInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
      console.error("Workspace invitation email failed.", result.error);
      return errorState("The invitation email could not be sent. Please try again.");
    }
  } catch (error) {
    console.error("Workspace invitation failed.", error);
    return errorState("The invitation could not be created. Please try again.");
  }

  refreshRoles(authorization.membership.workspaceSlug);
  return { message: "Invitation sent.", success: true };
}

export async function resendWorkspaceInvitationAction(
  _state: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const authorization = await getPermittedDashboardAuthorization("roles.manage");
  if (!authorization) return errorState("You do not have permission to resend invitations.");
  const invitationId = roleIdSchema.safeParse(formData.get("invitationId"));
  if (!invitationId.success) return errorState("Select an invitation and try again.");

  const invitation = await prisma.workspaceInvitation.findFirst({
    where: {
      id: invitationId.data,
      workspaceId: authorization.workspaceId,
      acceptedAt: null,
      revokedAt: null,
    },
    select: {
      email: true,
      employeeId: true,
      id: true,
      role: { select: { id: true, name: true } },
    },
  });
  if (!invitation) return errorState("That invitation is no longer active.");

  const invitationIp = await getRateLimitIp();
  const withinResendLimit = await consumeRateLimit("workspace-invitation-resend", [
    authorization.workspaceId,
    authorization.principal.user.id,
    invitation.email,
    invitationIp,
  ]);
  if (!withinResendLimit) {
    return errorState("This invitation has been resent too many times. Please wait before trying again.");
  }

  const token = createWorkspaceInvitationToken();
  const tokenHash = hashWorkspaceInvitationToken(token);
  const expiresAt = new Date(Date.now() + WORKSPACE_INVITATION_LIFETIME_MS);
  const replacement = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: authorization.workspaceId,
      roleId: invitation.role.id,
      employeeId: invitation.employeeId,
      email: invitation.email,
      tokenHash,
      expiresAt,
      invitedByUserId: authorization.principal.user.id,
    },
  });

  const result = await sendWorkspaceInvitationEmail({
    email: invitation.email,
    invitationUrl: createWorkspaceInvitationUrl(token),
    roleName: invitation.role.name,
    workspaceName: authorization.membership.workspaceName,
  });
  if (result.error) {
    await prisma.workspaceInvitation.update({ where: { id: replacement.id }, data: { revokedAt: new Date() } });
    console.error("Workspace invitation resend failed.", result.error);
    return errorState("The invitation email could not be resent. Please try again.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: authorization.workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "invitation.resend",
        targetType: "WorkspaceInvitation",
        targetId: replacement.id,
        metadata: { email: invitation.email, replacedInvitationId: invitation.id, roleId: invitation.role.id },
      },
      tx,
    );
  });

  refreshRoles(authorization.membership.workspaceSlug);
  return { message: "Invitation resent with a new secure link.", success: true };
}

export async function revokeWorkspaceInvitationAction(
  _state: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const authorization = await getPermittedDashboardAuthorization("roles.manage");
  if (!authorization) return errorState("You do not have permission to revoke invitations.");
  const invitationId = roleIdSchema.safeParse(formData.get("invitationId"));
  if (!invitationId.success) return errorState("Select an invitation and try again.");

  const invitation = await prisma.workspaceInvitation.findFirst({
    where: {
      id: invitationId.data,
      workspaceId: authorization.workspaceId,
      acceptedAt: null,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!invitation) return errorState("That invitation is no longer active.");

  await prisma.$transaction(async (tx) => {
    await tx.workspaceInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: authorization.workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "invitation.revoke",
        targetType: "WorkspaceInvitation",
        targetId: invitation.id,
      },
      tx,
    );
  });
  refreshRoles(authorization.membership.workspaceSlug);
  return { message: "Invitation revoked.", success: true };
}

export async function removeWorkspaceMemberAction(
  _state: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const authorization = await getPermittedDashboardAuthorization("roles.manage");
  if (!authorization) return errorState("You do not have permission to remove members.");
  const membershipId = roleIdSchema.safeParse(formData.get("membershipId"));
  if (!membershipId.success) return errorState("Select a member and try again.");

  const membership = await prisma.workspaceMembership.findFirst({
    where: { id: membershipId.data, workspaceId: authorization.workspaceId, status: { in: ["Active", "Suspended"] } },
    select: { id: true, userId: true, roleId: true, employeeId: true, role: { select: { systemKey: true } } },
  });
  if (!membership) return errorState("Member could not be found.");
  if (membership.role.systemKey === "OWNER") return errorState("The workspace owner cannot be removed.");
  if (membership.userId === authorization.principal.user.id) {
    return errorState("You cannot remove your own access from this screen.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMembership.update({ where: { id: membership.id }, data: { status: "Removed" } });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: authorization.workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "membership.remove",
        targetType: "WorkspaceMembership",
        targetId: membership.id,
        metadata: {
          employeeId: membership.employeeId,
          roleId: membership.roleId,
          userId: membership.userId,
        },
      },
      tx,
    );
  });
  refreshRoles(authorization.membership.workspaceSlug);
  return { message: "Workplace access removed.", success: true };
}

export async function suspendWorkspaceMemberAction(
  _state: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const authorization = await getPermittedDashboardAuthorization("roles.manage");
  if (!authorization) return errorState("You do not have permission to suspend members.");
  const membershipId = roleIdSchema.safeParse(formData.get("membershipId"));
  if (!membershipId.success) return errorState("Select a member and try again.");

  const membership = await prisma.workspaceMembership.findFirst({
    where: { id: membershipId.data, workspaceId: authorization.workspaceId, status: "Active" },
    select: { id: true, roleId: true, userId: true, role: { select: { systemKey: true } } },
  });
  if (!membership) return errorState("Active member could not be found.");
  if (membership.role.systemKey === "OWNER") return errorState("The workspace owner cannot be suspended.");
  if (membership.userId === authorization.principal.user.id) {
    return errorState("You cannot suspend your own access from this screen.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMembership.update({ where: { id: membership.id }, data: { status: "Suspended" } });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: authorization.workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "membership.suspend",
        targetType: "WorkspaceMembership",
        targetId: membership.id,
        metadata: { roleId: membership.roleId, userId: membership.userId },
      },
      tx,
    );
  });
  refreshRoles(authorization.membership.workspaceSlug);
  return { message: "Workplace access suspended.", success: true };
}

export async function reactivateWorkspaceMemberAction(
  _state: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const authorization = await getPermittedDashboardAuthorization("roles.manage");
  if (!authorization) return errorState("You do not have permission to reactivate members.");
  const membershipId = roleIdSchema.safeParse(formData.get("membershipId"));
  if (!membershipId.success) return errorState("Select a member and try again.");

  const membership = await prisma.workspaceMembership.findFirst({
    where: { id: membershipId.data, workspaceId: authorization.workspaceId, status: "Suspended" },
    select: { id: true, roleId: true, userId: true },
  });
  if (!membership) return errorState("Suspended access record could not be found.");

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMembership.update({ where: { id: membership.id }, data: { status: "Active" } });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: authorization.workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "membership.reactivate",
        targetType: "WorkspaceMembership",
        targetId: membership.id,
        metadata: { roleId: membership.roleId, userId: membership.userId },
      },
      tx,
    );
  });
  refreshRoles(authorization.membership.workspaceSlug);
  return { message: "Workplace access reactivated.", success: true };
}

export async function restoreWorkspaceMemberAction(
  _state: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const authorization = await getPermittedDashboardAuthorization("roles.manage");
  if (!authorization) return errorState("You do not have permission to restore members.");
  const membershipId = roleIdSchema.safeParse(formData.get("membershipId"));
  if (!membershipId.success) return errorState("Select a member and try again.");

  const membership = await prisma.workspaceMembership.findFirst({
    where: { id: membershipId.data, workspaceId: authorization.workspaceId, status: "Removed" },
    select: { id: true, roleId: true, userId: true },
  });
  if (!membership) return errorState("Removed access record could not be found.");

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMembership.update({ where: { id: membership.id }, data: { status: "Active" } });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: authorization.workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "membership.restore",
        targetType: "WorkspaceMembership",
        targetId: membership.id,
        metadata: { roleId: membership.roleId, userId: membership.userId },
      },
      tx,
    );
  });
  refreshRoles(authorization.membership.workspaceSlug);
  return { message: "Workplace access restored.", success: true };
}
