import type { Prisma } from "@prisma/client";

import { DEFAULT_ROLE_TEMPLATES } from "./permissions";
import { createWorkspaceSlug } from "./workspace-slug";

type WorkspaceProvisioningUser = {
  id: string;
  companyName: string;
  companyAddress: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyLogoDataUrl: string | null;
  companyLogoKey: string | null;
  companyLogoType: string | null;
  estimateValidDays: number;
  estimateMessageEnabled: boolean;
  estimateMessageAlign: string;
  estimateMessageText: string;
  invoiceDueDays: number;
  invoiceMessageEnabled: boolean;
  invoiceMessageAlign: string;
  invoiceMessageText: string;
  orderMessageText: string;
  workspaceMode: string;
  createdAt: Date;
};

export async function createOwnerWorkspaceForUser(
  tx: Prisma.TransactionClient,
  user: WorkspaceProvisioningUser,
  options?: { auditSource?: string },
) {
  const workspaceSlug = await createWorkspaceSlug(tx, user.companyName);
  const workspace = await tx.workspace.create({
    data: {
      id: user.id,
      slug: workspaceSlug,
      name: user.companyName,
      companyAddress: user.companyAddress,
      companyEmail: user.companyEmail,
      companyPhone: user.companyPhone,
      companyLogoDataUrl: user.companyLogoDataUrl,
      companyLogoKey: user.companyLogoKey,
      companyLogoType: user.companyLogoType,
      estimateValidDays: user.estimateValidDays,
      estimateMessageEnabled: user.estimateMessageEnabled,
      estimateMessageAlign: user.estimateMessageAlign,
      estimateMessageText: user.estimateMessageText,
      invoiceDueDays: user.invoiceDueDays,
      invoiceMessageEnabled: user.invoiceMessageEnabled,
      invoiceMessageAlign: user.invoiceMessageAlign,
      invoiceMessageText: user.invoiceMessageText,
      orderMessageText: user.orderMessageText,
      workspaceMode: user.workspaceMode,
      legacyOwnerId: user.id,
      createdAt: user.createdAt,
    },
  });
  const roles = await Promise.all(
    DEFAULT_ROLE_TEMPLATES.map(async (template) =>
      tx.workspaceRole.create({
        data: {
          workspaceId: workspace.id,
          name: template.name,
          description: template.description,
          systemKey: template.systemKey,
          isProtected: true,
          permissions: {
            create: template.permissions.map((permissionKey) => ({ permissionKey })),
          },
        },
      }),
    ),
  );
  const role = roles.find((candidate) => candidate.systemKey === "OWNER");

  if (!role) {
    throw new Error("Owner role could not be provisioned.");
  }
  const membership = await tx.workspaceMembership.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      roleId: role.id,
      status: "Active",
      joinedAt: user.createdAt,
    },
  });

  await tx.authorizationAuditEvent.create({
    data: {
      workspaceId: workspace.id,
      actorUserId: user.id,
      membershipId: membership.id,
      action: "workspace.created",
      targetType: "workspace",
      targetId: workspace.id,
      metadata: {
        source: options?.auditSource ?? "account_creation",
      },
    },
  });

  return { workspace, role, membership };
}
