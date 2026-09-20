"use server";

import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { prisma } from "@/lib/prisma";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

export type DocumentMessageMutationState = {
  success: boolean;
  message: string;
  submittedAt?: number;
};

const documentMessageSchema = z.object({
  align: z.enum(["left", "center", "right"]),
  documentType: z.enum(["estimate", "invoice"]),
  enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
  messageText: z.string().trim().max(5000, "Message is too long."),
  returnTo: z.string().trim().optional(),
});

export async function updateDocumentMessageAction(
  _previousState: DocumentMessageMutationState,
  formData: FormData,
): Promise<DocumentMessageMutationState> {
  const authorization = await getPermittedDashboardAuthorization("settings.manage");

  if (!authorization) {
    return { success: false, message: "You do not have permission to update document messages." };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = documentMessageSchema.safeParse({
    align: formData.get("align"),
    documentType: formData.get("documentType"),
    enabled: formData.get("enabled"),
    messageText: formData.get("messageText"),
    returnTo: formData.get("returnTo"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the message and try again." };
  }

  if (parsed.data.enabled && !parsed.data.messageText) {
    return { success: false, message: "Message is required when enabled." };
  }

  const data =
    parsed.data.documentType === "estimate"
      ? {
          estimateMessageAlign: parsed.data.align,
          estimateMessageEnabled: parsed.data.enabled,
          estimateMessageText: parsed.data.messageText,
        }
      : {
          invoiceMessageAlign: parsed.data.align,
          invoiceMessageEnabled: parsed.data.enabled,
          invoiceMessageText: parsed.data.messageText,
        };

  await prisma.$transaction(async (transaction) => {
    await transaction.workspace.update({
      where: {
        id: workspaceId,
      },
      data,
    });
    await recordAuthorizationAuditEvent(
      {
        workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "settings.document_message.update",
        targetType: "Workspace",
        targetId: workspaceId,
        metadata: { documentType: parsed.data.documentType, enabled: parsed.data.enabled },
      },
      transaction,
    );
  });

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/estimates");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/invoices");

  if (parsed.data.returnTo?.startsWith("/dashboard/")) {
    revalidateWorkspacePath(
      authorization.membership.workspaceSlug,
      parsed.data.returnTo.split("?")[0] ?? parsed.data.returnTo,
    );
  }

  return { success: true, message: "Custom message saved.", submittedAt: Date.now() };
}
