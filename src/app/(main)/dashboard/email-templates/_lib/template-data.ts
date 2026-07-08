import { ensureDefaultDocumentEmailTemplates } from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";

import type { EmailTemplateRow } from "../types";

function mapEmailTemplate(template: {
  id: string;
  title: string;
  scope: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): EmailTemplateRow {
  return {
    id: template.id,
    title: template.title,
    scope:
      template.scope === "invoice"
        ? "invoice"
        : template.scope === "lead"
          ? "lead"
          : template.scope === "order"
            ? "order"
            : template.scope === "general"
              ? "general"
              : "estimate",
    subject: template.subject,
    bodyText: template.bodyText,
    bodyHtml: template.bodyHtml,
    isDefault: template.isDefault,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export async function getEmailTemplates(ownerId: string) {
  await ensureDefaultDocumentEmailTemplates(ownerId);

  const templates = await prisma.emailTemplate.findMany({
    where: {
      ownerId,
      scope: {
        in: ["estimate", "general", "invoice", "lead", "order"],
      },
    },
    orderBy: [{ scope: "asc" }, { isDefault: "desc" }, { title: "asc" }],
  });

  return templates.map(mapEmailTemplate);
}

export async function getEmailTemplate(ownerId: string, templateId: string) {
  await ensureDefaultDocumentEmailTemplates(ownerId);

  const template = await prisma.emailTemplate.findUnique({
    where: {
      id_ownerId: {
        id: templateId,
        ownerId,
      },
    },
  });

  return template ? mapEmailTemplate(template) : null;
}
