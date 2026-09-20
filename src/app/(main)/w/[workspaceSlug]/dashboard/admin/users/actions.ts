"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentDashboardAuthorization } from "@/lib/authorization";
import { isMainPlatformAdministrator } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";

export type WorkspaceEnforcementActionState = {
  message: string;
  success: boolean;
  submittedAt: number;
};

const workspaceIdSchema = z.string().trim().min(1);
const workspaceSlugSchema = z.string().trim().min(1);
const suspensionSchema = z.object({
  workspaceId: workspaceIdSchema,
  workspaceSlug: workspaceSlugSchema,
  reasonCode: z.enum(["terms_violation", "abuse_or_spam", "fraud_or_security", "prohibited_content", "other"]),
  note: z.string().trim().min(10, "Add a short internal note explaining the suspension.").max(2000),
});
const reactivationSchema = z.object({
  workspaceId: workspaceIdSchema,
  workspaceSlug: workspaceSlugSchema,
  note: z.string().trim().max(2000).optional(),
});

async function requirePlatformAdministrator() {
  const authorization = await getCurrentDashboardAuthorization();
  const user = authorization?.principal.user;
  if (!user || !isMainPlatformAdministrator(user.admin, user.email)) {
    throw new Error("PLATFORM_ADMIN_REQUIRED");
  }
  return user;
}

function refreshUsersConsole(workspaceSlug: string) {
  revalidatePath(getWorkspaceDashboardPath(workspaceSlug, "/dashboard/admin/users"));
}

export async function suspendWorkspaceAction(
  _state: WorkspaceEnforcementActionState,
  formData: FormData,
): Promise<WorkspaceEnforcementActionState> {
  const parsed = suspensionSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    workspaceSlug: formData.get("workspaceSlug"),
    reasonCode: formData.get("reasonCode"),
    note: formData.get("note"),
  });
  const submittedAt = Date.now();
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Check the suspension details.", success: false, submittedAt };
  }

  try {
    const actor = await requirePlatformAdministrator();
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUnique({
        where: { id: parsed.data.workspaceId },
        select: { id: true, name: true, status: true },
      });
      if (!workspace) throw new Error("WORKSPACE_NOT_FOUND");
      if (workspace.status === "Suspended") throw new Error("WORKSPACE_ALREADY_SUSPENDED");

      await tx.workspace.update({
        where: { id: workspace.id },
        data: {
          status: "Suspended",
          suspendedAt: now,
          suspendedByUserId: actor.id,
          suspensionReasonCode: parsed.data.reasonCode,
          suspensionNote: parsed.data.note,
          suspendedUntil: null,
        },
      });
      await tx.workspaceEnforcementEvent.create({
        data: {
          workspaceId: workspace.id,
          actorUserId: actor.id,
          action: "workspace.suspend",
          reasonCode: parsed.data.reasonCode,
          note: parsed.data.note,
          metadata: { previousStatus: workspace.status },
        },
      });
    });
    refreshUsersConsole(parsed.data.workspaceSlug);
    return { message: "Workspace suspended. Access is blocked for every member.", success: true, submittedAt };
  } catch (error) {
    console.error("Workspace suspension failed.", error);
    const message =
      error instanceof Error && error.message === "WORKSPACE_ALREADY_SUSPENDED"
        ? "This workspace is already suspended."
        : "The workspace could not be suspended. Please try again.";
    return { message, success: false, submittedAt };
  }
}

export async function reactivateWorkspaceAction(
  _state: WorkspaceEnforcementActionState,
  formData: FormData,
): Promise<WorkspaceEnforcementActionState> {
  const parsed = reactivationSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    workspaceSlug: formData.get("workspaceSlug"),
    note: formData.get("note") || undefined,
  });
  const submittedAt = Date.now();
  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Check the reactivation details.",
      success: false,
      submittedAt,
    };
  }

  try {
    const actor = await requirePlatformAdministrator();
    await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUnique({
        where: { id: parsed.data.workspaceId },
        select: {
          id: true,
          status: true,
          suspendedAt: true,
          suspendedByUserId: true,
          suspensionReasonCode: true,
          suspensionNote: true,
        },
      });
      if (!workspace) throw new Error("WORKSPACE_NOT_FOUND");
      if (workspace.status !== "Suspended") throw new Error("WORKSPACE_NOT_SUSPENDED");

      await tx.workspace.update({
        where: { id: workspace.id },
        data: {
          status: "Active",
          suspendedAt: null,
          suspendedByUserId: null,
          suspensionReasonCode: null,
          suspensionNote: null,
          suspendedUntil: null,
        },
      });
      await tx.workspaceEnforcementEvent.create({
        data: {
          workspaceId: workspace.id,
          actorUserId: actor.id,
          action: "workspace.reactivate",
          note: parsed.data.note || null,
          metadata: {
            previousStatus: workspace.status,
            previousSuspendedAt: workspace.suspendedAt?.toISOString() ?? null,
            previousSuspendedByUserId: workspace.suspendedByUserId,
            previousSuspensionReasonCode: workspace.suspensionReasonCode,
            previousSuspensionNote: workspace.suspensionNote,
          },
        },
      });
    });
    refreshUsersConsole(parsed.data.workspaceSlug);
    return { message: "Workspace reactivated. Member access has been restored.", success: true, submittedAt };
  } catch (error) {
    console.error("Workspace reactivation failed.", error);
    const message =
      error instanceof Error && error.message === "WORKSPACE_NOT_SUSPENDED"
        ? "This workspace is already active."
        : "The workspace could not be reactivated. Please try again.";
    return { message, success: false, submittedAt };
  }
}
