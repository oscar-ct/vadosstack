"use server";

import { redirect } from "next/navigation";

import { z } from "zod";

import { clearCurrentSession, createUserSession, getCurrentUser } from "@/lib/auth";
import { getMembershipLandingPath, isPermissionKey } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { hashWorkspaceInvitationToken } from "@/lib/workspace-invitations";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";

export type InvitationActionState = { message: string; success: boolean };

const tokenSchema = z.string().trim().min(1);
const registrationSchema = z
  .object({
    confirmPassword: z.string().min(8, "Confirm your password."),
    name: z.string().trim().min(1, "Your name is required.").max(120),
    password: z.string().min(8, "Password must be at least 8 characters."),
    token: tokenSchema,
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

async function getUsableInvitation(token: string) {
  return prisma.workspaceInvitation.findFirst({
    where: {
      tokenHash: hashWorkspaceInvitationToken(token),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      workspace: { status: "Active" },
    },
    include: { workspace: { select: { id: true, name: true, slug: true, workspaceMode: true } } },
  });
}

async function acceptInvitationForUser(invitationId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.workspaceInvitation.findFirst({
      where: {
        id: invitationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        workspace: { status: "Active" },
      },
      include: {
        role: { select: { permissions: { select: { permissionKey: true } }, systemKey: true } },
        workspace: { select: { id: true, slug: true, workspaceMode: true } },
      },
    });
    if (!invitation) throw new Error("INVITATION_UNAVAILABLE");

    const membership = await tx.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
      create: {
        workspaceId: invitation.workspaceId,
        userId,
        roleId: invitation.roleId,
        employeeId: invitation.employeeId,
        invitedAt: invitation.createdAt,
      },
      update: {
        roleId: invitation.roleId,
        employeeId: invitation.employeeId,
        invitedAt: invitation.createdAt,
        status: "Active",
      },
    });
    await tx.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date(), acceptedByUserId: userId },
    });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: invitation.workspaceId,
        actorUserId: userId,
        membershipId: membership.id,
        action: "invitation.accept",
        targetType: "WorkspaceInvitation",
        targetId: invitation.id,
      },
      tx,
    );
    return { role: invitation.role, workspace: invitation.workspace };
  });
}

function getInvitationLandingPath(access: {
  role: { permissions: Array<{ permissionKey: string }>; systemKey: string | null };
  workspace: { workspaceMode: string };
}) {
  return getMembershipLandingPath({
    workspaceMode: access.workspace.workspaceMode,
    roleSystemKey: access.role.systemKey,
    permissions: new Set(access.role.permissions.map(({ permissionKey }) => permissionKey).filter(isPermissionKey)),
  });
}

export async function acceptInvitationAction(
  _state: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  const parsed = tokenSchema.safeParse(formData.get("token"));
  if (!parsed.success) return { message: "This invitation link is invalid.", success: false };
  const currentUser = await getCurrentUser();
  if (!currentUser) return { message: "Sign in or create your account to accept this invitation.", success: false };
  const invitation = await getUsableInvitation(parsed.data);
  if (!invitation) return { message: "This invitation is invalid, expired, or already used.", success: false };
  if (invitation.email.toLowerCase() !== currentUser.email.toLowerCase()) {
    return {
      message: `This invitation was sent to ${invitation.email}. Sign in with that account to accept it.`,
      success: false,
    };
  }

  let workspace: Awaited<ReturnType<typeof acceptInvitationForUser>>;
  try {
    workspace = await acceptInvitationForUser(invitation.id, currentUser.id);
  } catch (error) {
    console.error("Invitation acceptance failed.", error);
    return { message: "The invitation could not be accepted. Please try again.", success: false };
  }
  redirect(getWorkspaceDashboardPath(workspace.workspace.slug, getInvitationLandingPath(workspace)));
}

export async function registerFromInvitationAction(
  _state: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  const parsed = registrationSchema.safeParse({
    confirmPassword: formData.get("confirmPassword"),
    name: formData.get("name"),
    password: formData.get("password"),
    token: formData.get("token"),
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check your details.", success: false };
  const invitation = await getUsableInvitation(parsed.data.token);
  if (!invitation) return { message: "This invitation is invalid, expired, or already used.", success: false };
  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
  if (existingUser)
    return { message: "An account already exists for this email. Sign in to accept the invitation.", success: false };

  let accepted: {
    role: { permissions: Array<{ permissionKey: string }>; systemKey: string | null };
    userId: string;
    workspace: { slug: string; workspaceMode: string };
  };
  try {
    accepted = await prisma.$transaction(async (tx) => {
      const currentInvitation = await tx.workspaceInvitation.findFirst({
        where: {
          id: invitation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          workspace: { status: "Active" },
        },
        include: {
          role: { select: { permissions: { select: { permissionKey: true } }, systemKey: true } },
          workspace: { select: { slug: true, workspaceMode: true } },
        },
      });
      if (!currentInvitation) throw new Error("INVITATION_UNAVAILABLE");
      const user = await tx.user.create({
        data: {
          companyName: `${parsed.data.name}'s account`,
          email: currentInvitation.email,
          name: parsed.data.name,
          passwordHash: hashPassword(parsed.data.password),
        },
        select: { id: true },
      });
      const membership = await tx.workspaceMembership.create({
        data: {
          workspaceId: currentInvitation.workspaceId,
          userId: user.id,
          roleId: currentInvitation.roleId,
          employeeId: currentInvitation.employeeId,
          invitedAt: currentInvitation.createdAt,
        },
      });
      await tx.workspaceInvitation.update({
        where: { id: currentInvitation.id },
        data: { acceptedAt: new Date(), acceptedByUserId: user.id },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId: currentInvitation.workspaceId,
          actorUserId: user.id,
          membershipId: membership.id,
          action: "invitation.accept",
          targetType: "WorkspaceInvitation",
          targetId: currentInvitation.id,
        },
        tx,
      );
      return { role: currentInvitation.role, userId: user.id, workspace: currentInvitation.workspace };
    });
    await createUserSession(accepted.userId, true);
  } catch (error) {
    console.error("Invitation account creation failed.", error);
    return { message: "Your account could not be created. Please try again.", success: false };
  }
  redirect(getWorkspaceDashboardPath(accepted.workspace.slug, getInvitationLandingPath(accepted)));
}

export async function switchInvitationAccountAction(formData: FormData) {
  const token = tokenSchema.safeParse(formData.get("token"));
  await clearCurrentSession();
  const returnTo = token.success ? `/accept-invitation?token=${encodeURIComponent(token.data)}` : "/";
  redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
}
