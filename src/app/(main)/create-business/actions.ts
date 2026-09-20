"use server";

import { redirect } from "next/navigation";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createOwnerWorkspaceForUser } from "@/lib/authorization/provision-workspace";
import { prisma } from "@/lib/prisma";
import { getWorkspaceHomePath, workspaceModes } from "@/lib/workspace-mode";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";

export type CreateBusinessState = {
  message: string;
  success: boolean;
};

const createBusinessSchema = z.object({
  companyAddress: z.string().trim().max(300, "Company address is too long.").optional(),
  companyName: z.string().trim().min(1, "Company name is required.").max(120, "Company name is too long."),
  workspaceMode: z.enum(workspaceModes),
});

export async function createBusinessAction(
  _previousState: CreateBusinessState,
  formData: FormData,
): Promise<CreateBusinessState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login?returnTo=%2Fcreate-business");
  }

  const parsed = createBusinessSchema.safeParse({
    companyAddress: formData.get("companyAddress") || undefined,
    companyName: formData.get("companyName"),
    workspaceMode: formData.get("workspaceMode"),
  });

  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Check your business details and try again.",
      success: false,
    };
  }

  let createdWorkspace: { slug: string };

  try {
    createdWorkspace = await prisma.$transaction(
      async (tx) => {
        const existingOwnedWorkspace = await tx.workspaceMembership.findFirst({
          where: {
            userId: currentUser.id,
            status: "Active",
            role: {
              systemKey: "OWNER",
            },
          },
          select: { id: true },
        });

        if (existingOwnedWorkspace) {
          throw new Error("BUSINESS_ALREADY_EXISTS");
        }

        const user = await tx.user.update({
          where: { id: currentUser.id },
          data: {
            companyAddress: parsed.data.companyAddress || null,
            companyName: parsed.data.companyName,
            workspaceMode: parsed.data.workspaceMode,
          },
          select: {
            id: true,
            companyName: true,
            companyAddress: true,
            companyEmail: true,
            companyPhone: true,
            companyLogoDataUrl: true,
            companyLogoKey: true,
            companyLogoType: true,
            estimateValidDays: true,
            estimateMessageEnabled: true,
            estimateMessageAlign: true,
            estimateMessageText: true,
            invoiceDueDays: true,
            invoiceMessageEnabled: true,
            invoiceMessageAlign: true,
            invoiceMessageText: true,
            orderMessageText: true,
            workspaceMode: true,
            createdAt: true,
          },
        });
        const provisioned = await createOwnerWorkspaceForUser(
          tx,
          { ...user, createdAt: new Date() },
          { auditSource: "authenticated_business_creation" },
        );

        return { slug: provisioned.workspace.slug };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "BUSINESS_ALREADY_EXISTS") {
      return { message: "This account already owns a business.", success: false };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { message: "This account already owns a business. Refresh the page to continue.", success: false };
    }

    console.error("Business creation failed.", error);
    return { message: "Your business could not be created. Please try again.", success: false };
  }

  redirect(getWorkspaceDashboardPath(createdWorkspace.slug, getWorkspaceHomePath(parsed.data.workspaceMode)));
}
