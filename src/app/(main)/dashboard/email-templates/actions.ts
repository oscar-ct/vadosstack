"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { plainTextToEmailHtml, sanitizeEmailHtml } from "@/lib/email-content";
import { prisma } from "@/lib/prisma";

export type EmailTemplateMutationState = {
  success: boolean;
  message: string;
  redirectTo?: string;
};

const emailTemplateScopes = ["estimate", "general", "invoice", "lead"] as const;

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

function revalidateEmailTemplatePaths(id?: string) {
  revalidatePath("/dashboard/email-templates");
  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/invoices");

  if (id) {
    revalidatePath(`/dashboard/email-templates/${id}/edit`);
  }
}

export async function createEmailTemplateAction(
  _previousState: EmailTemplateMutationState,
  formData: FormData,
): Promise<EmailTemplateMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to create email templates." };
  }

  const parsed = emailTemplateSchema.safeParse(getTemplatePayload(formData));

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the template and try again." };
  }

  let createdTemplateId = "";

  try {
    const template = await prisma.emailTemplate.create({
      data: {
        ownerId: currentUser.id,
        title: parsed.data.title,
        scope: parsed.data.scope,
        subject: parsed.data.subject,
        bodyText: parsed.data.bodyText,
        bodyHtml: getSafeBodyHtml(parsed.data.bodyText, parsed.data.bodyHtml),
      },
    });

    createdTemplateId = template.id;
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "A template with that name already exists for this document type."
        : error instanceof Error
          ? error.message
          : "Template could not be created.";

    return { success: false, message };
  }

  revalidateEmailTemplatePaths(createdTemplateId);

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
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to update email templates." };
  }

  const parsed = updateEmailTemplateSchema.safeParse({
    id: formData.get("id"),
    ...getTemplatePayload(formData),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the template and try again." };
  }

  const { id, ...template } = parsed.data;

  try {
    await prisma.emailTemplate.update({
      where: {
        id_ownerId: {
          id,
          ownerId: currentUser.id,
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
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "A template with that name already exists for this document type."
        : error instanceof Error
          ? error.message
          : "Template could not be updated.";

    return { success: false, message };
  }

  revalidateEmailTemplatePaths(id);

  return { success: true, message: "Email template updated." };
}

export async function deleteEmailTemplateAction(
  _previousState: EmailTemplateMutationState,
  formData: FormData,
): Promise<EmailTemplateMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to delete email templates." };
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return { success: false, message: "Template is required." };
  }

  await prisma.emailTemplate.delete({
    where: {
      id_ownerId: {
        id,
        ownerId: currentUser.id,
      },
    },
  });

  revalidateEmailTemplatePaths();

  redirect("/dashboard/email-templates");
}
