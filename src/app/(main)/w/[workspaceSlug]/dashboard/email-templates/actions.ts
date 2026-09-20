"use server";

import { redirect } from "next/navigation";

import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { plainTextToEmailHtml, sanitizeEmailHtml } from "@/lib/email-content";
import { prisma } from "@/lib/prisma";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

export type EmailTemplateMutationState = {
  success: boolean;
  message: string;
  redirectTo?: string;
};

const emailTemplateScopes = ["estimate", "general", "invoice", "lead", "order", "return-receipt"] as const;

const emailTemplateSchema = z.object({
  title: z.string().trim().min(1, "Template name is required.").max(120, "Template name is too long."),
  scope: z.enum(emailTemplateScopes),
  subject: z.string().trim().min(1, "Subject is required.").max(180, "Subject is too long."),
  bodyText: z.string().trim().min(1, "Message is required.").max(15000, "Message is too long."),
  bodyHtml: z.string().trim().optional(),
});

const updateEmailTemplateSchema = emailTemplateSchema.extend({
  id: z.string().trim().min(1, "Template is required."),
});

function getTemplatePayload(formData: FormData) {
  return {
    title: formData.get("title"),
    scope: formData.get("scope"),
    subject: formData.get("subject"),
    bodyText: formData.get("bodyText"),
    bodyHtml: formData.get("bodyHtml"),
  };
}

function getSafeBodyHtml(bodyText: string, bodyHtml?: string) {
  return sanitizeEmailHtml(bodyHtml) ?? plainTextToEmailHtml(bodyText);
}

function revalidateEmailTemplatePaths(workspaceSlug: string, id?: string) {
  revalidateWorkspacePath(workspaceSlug, "/dashboard/email-templates");
  revalidateWorkspacePath(workspaceSlug, "/dashboard/estimates");
  revalidateWorkspacePath(workspaceSlug, "/dashboard/invoices");
  revalidateWorkspacePath(workspaceSlug, "/dashboard/orders");

  if (id) {
    revalidateWorkspacePath(workspaceSlug, `/dashboard/email-templates/${id}/edit`);
  }
}

export async function createEmailTemplateAction(
  _previousState: EmailTemplateMutationState,
  formData: FormData,
): Promise<EmailTemplateMutationState> {
  const authorization = await getPermittedDashboardAuthorization("email.templates.manage");

  if (!authorization) {
    return { success: false, message: "You do not have permission to create email templates." };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = emailTemplateSchema.safeParse(getTemplatePayload(formData));

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the template and try again." };
  }

  let createdTemplateId = "";

  try {
    const template = await prisma.$transaction(async (tx) => {
      const createdTemplate = await tx.emailTemplate.create({
        data: {
          ownerId: workspaceId,
          title: parsed.data.title,
          scope: parsed.data.scope,
          subject: parsed.data.subject,
          bodyText: parsed.data.bodyText,
          bodyHtml: getSafeBodyHtml(parsed.data.bodyText, parsed.data.bodyHtml),
        },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "email_template.create",
          targetType: "EmailTemplate",
          targetId: createdTemplate.id,
        },
        tx,
      );
      return createdTemplate;
    });

    createdTemplateId = template.id;
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "A template with that name already exists for this document type."
        : "Template could not be created.";
    console.error("Email template creation failed.", error);

    return { success: false, message };
  }

  revalidateEmailTemplatePaths(authorization.membership.workspaceSlug, createdTemplateId);

  return {
    success: true,
    message: "Email template created.",
    redirectTo: `/dashboard/email-templates/${createdTemplateId}/edit`,
  };
}

export async function updateEmailTemplateAction(
  _previousState: EmailTemplateMutationState,
  formData: FormData,
): Promise<EmailTemplateMutationState> {
  const authorization = await getPermittedDashboardAuthorization("email.templates.manage");

  if (!authorization) {
    return { success: false, message: "You do not have permission to update email templates." };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = updateEmailTemplateSchema.safeParse({
    id: formData.get("id"),
    ...getTemplatePayload(formData),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the template and try again." };
  }

  const { id, ...template } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.emailTemplate.update({
        where: {
          id_ownerId: {
            id,
            ownerId: workspaceId,
          },
        },
        data: {
          title: template.title,
          scope: template.scope,
          subject: template.subject,
          bodyText: template.bodyText,
          bodyHtml: getSafeBodyHtml(template.bodyText, template.bodyHtml),
        },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "email_template.update",
          targetType: "EmailTemplate",
          targetId: id,
        },
        tx,
      );
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "A template with that name already exists for this document type."
        : "Template could not be updated.";
    console.error("Email template update failed.", error);

    return { success: false, message };
  }

  revalidateEmailTemplatePaths(authorization.membership.workspaceSlug, id);

  return { success: true, message: "Email template updated." };
}

export async function deleteEmailTemplateAction(
  _previousState: EmailTemplateMutationState,
  formData: FormData,
): Promise<EmailTemplateMutationState> {
  const authorization = await getPermittedDashboardAuthorization("email.templates.manage");

  if (!authorization) {
    return { success: false, message: "You do not have permission to delete email templates." };
  }
  const workspaceId = authorization.workspaceId;

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return { success: false, message: "Template is required." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.emailTemplate.delete({
        where: {
          id_ownerId: {
            id,
            ownerId: workspaceId,
          },
        },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "email_template.delete",
          targetType: "EmailTemplate",
          targetId: id,
        },
        tx,
      );
    });
  } catch (error) {
    console.error("Email template deletion failed.", error);
    return { success: false, message: "Template could not be deleted." };
  }

  revalidateEmailTemplatePaths(authorization.membership.workspaceSlug);

  redirect(getWorkspaceDashboardPath(authorization.membership.workspaceSlug, "/dashboard/email-templates"));
}
