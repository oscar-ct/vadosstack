import type { EmailTemplateScope } from "@/lib/email-templates";

export type EmailTemplateRow = {
  id: string;
  title: string;
  scope: EmailTemplateScope;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};
