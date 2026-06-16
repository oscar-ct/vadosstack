import { prisma } from "@/lib/prisma";

export type EmailTemplateScope = "estimate" | "general" | "invoice" | "lead";

export type DocumentEmailTemplate = {
  bodyHtml: string;
  bodyText: string;
  subject: string;
  title: string;
};

type EmailTemplateContext = Record<string, string | null | undefined>;

const defaultDocumentEmailTemplates: Record<
  EmailTemplateScope,
  Array<{
    bodyHtml: string;
    bodyText: string;
    subject: string;
    title: string;
  }>
> = {
  general: [
    {
      title: "Follow-up",
      subject: "Following up from {{companyName}}",
      bodyText: [
        "Hi there,",
        "",
        "I wanted to follow up and see if you had any questions. Reply here whenever it is convenient and I will be happy to help.",
        "",
        "Thank you.",
      ].join("\n"),
      bodyHtml: [
        "<p>Hi there,</p>",
        "<p>I wanted to follow up and see if you had any questions. Reply here whenever it is convenient and I will be happy to help.</p>",
        "<p>Thank you.</p>",
      ].join(""),
    },
    {
      title: "Appointment reminder",
      subject: "Appointment reminder",
      bodyText: [
        "Hi there,",
        "",
        "This is a quick reminder about your upcoming appointment. Please reply if anything needs to change.",
        "",
        "Thank you.",
      ].join("\n"),
      bodyHtml: [
        "<p>Hi there,</p>",
        "<p>This is a quick reminder about your upcoming appointment. Please reply if anything needs to change.</p>",
        "<p>Thank you.</p>",
      ].join(""),
    },
    {
      title: "Thank you",
      subject: "Thank you",
      bodyText: [
        "Hi there,",
        "",
        "Thank you for choosing us. We appreciate the opportunity to help and are here if you need anything else.",
        "",
        "Best.",
      ].join("\n"),
      bodyHtml: [
        "<p>Hi there,</p>",
        "<p>Thank you for choosing us. We appreciate the opportunity to help and are here if you need anything else.</p>",
        "<p>Best.</p>",
      ].join(""),
    },
    {
      title: "Payment note",
      subject: "Payment reminder",
      bodyText: [
        "Hi there,",
        "",
        "This is a friendly reminder that a payment is still pending. Please reply if you have questions or need another copy of the invoice.",
        "",
        "Thank you.",
      ].join("\n"),
      bodyHtml: [
        "<p>Hi there,</p>",
        "<p>This is a friendly reminder that a payment is still pending. Please reply if you have questions or need another copy of the invoice.</p>",
        "<p>Thank you.</p>",
      ].join(""),
    },
  ],
  estimate: [
    {
      title: "Default estimate",
      subject: "Estimate {{estimateNumber}} from {{companyName}}",
      bodyText: [
        "Hi {{customerName}},",
        "",
        "Your estimate {{estimateNumber}} from {{companyName}} is attached as a PDF.",
        "Estimated total: {{estimatedTotal}}",
        "Valid through: {{validThrough}}",
        "",
        "Please review the attached estimate at your convenience. If you have any questions, reply to this email and we will be happy to help.",
        "",
        "Thank you,",
        "{{companyName}}",
      ].join("\n"),
      bodyHtml: [
        "<p>Hi {{customerName}},</p>",
        "<p>Your estimate <strong>{{estimateNumber}}</strong> from {{companyName}} is attached as a PDF.</p>",
        '<p><span style="color:#0369a1;font-size:22px"><strong>{{estimatedTotal}}</strong></span><br><span style="color:#52525b">Estimated total</span></p>',
        "<p><strong>Valid through:</strong> {{validThrough}}</p>",
        "<p>Please review the attached estimate at your convenience. If you have any questions, reply to this email and we will be happy to help.</p>",
        "<p>Thank you,<br><strong>{{companyName}}</strong></p>",
      ].join(""),
    },
  ],
  invoice: [
    {
      title: "Default invoice",
      subject: "Invoice {{invoiceNumber}} from {{companyName}}",
      bodyText: [
        "Hi {{customerName}},",
        "",
        "Your invoice {{invoiceNumber}} from {{companyName}} is attached as a PDF.",
        "Balance due: {{balanceDue}}",
        "Due: {{dueDate}}",
        "",
        "Please review the attached invoice at your convenience. If you have any questions, reply to this email and we will be happy to help.",
        "",
        "Thank you,",
        "{{companyName}}",
      ].join("\n"),
      bodyHtml: [
        "<p>Hi {{customerName}},</p>",
        "<p>Your invoice <strong>{{invoiceNumber}}</strong> from {{companyName}} is attached as a PDF.</p>",
        '<p><span style="color:#be123c;font-size:22px"><strong>{{balanceDue}}</strong></span><br><span style="color:#52525b">Balance due</span></p>',
        "<p><strong>Due:</strong> {{dueDate}}</p>",
        "<p>Please review the attached invoice at your convenience. If you have any questions, reply to this email and we will be happy to help.</p>",
        "<p>Thank you,<br><strong>{{companyName}}</strong></p>",
      ].join(""),
    },
  ],
  lead: [
    {
      title: "New inquiry reply",
      subject: "Thanks for reaching out about your {{serviceType}}",
      bodyText: [
        "Hi {{leadFirstName}},",
        "",
        "Thanks for reaching out. I can help with your {{serviceType}}{{serviceLocationPhrase}}. What day and time works best for a quick call or visit so I can understand the scope and next steps?",
        "",
        "Thank you,",
        "{{companyName}}",
      ].join("\n"),
      bodyHtml: [
        "<p>Hi {{leadFirstName}},</p>",
        "<p>Thanks for reaching out. I can help with your {{serviceType}}{{serviceLocationPhrase}}. What day and time works best for a quick call or visit so I can understand the scope and next steps?</p>",
        "<p>Thank you,<br><strong>{{companyName}}</strong></p>",
      ].join(""),
    },
    {
      title: "Estimate scheduling",
      subject: "Scheduling your {{serviceType}} estimate",
      bodyText: [
        "Hi {{leadFirstName}},",
        "",
        "I have your request noted and would like to schedule the estimate. Please send a couple of times that work for you, and I will confirm the best slot.",
        "",
        "Thank you,",
        "{{companyName}}",
      ].join("\n"),
      bodyHtml: [
        "<p>Hi {{leadFirstName}},</p>",
        "<p>I have your request noted and would like to schedule the estimate. Please send a couple of times that work for you, and I will confirm the best slot.</p>",
        "<p>Thank you,<br><strong>{{companyName}}</strong></p>",
      ].join(""),
    },
    {
      title: "Estimate follow-up",
      subject: "Following up on your estimate",
      bodyText: [
        "Hi {{leadFirstName}},",
        "",
        "I wanted to follow up and see if you had any questions about the estimate. I am happy to clarify scope, timing, or options before you decide.",
        "",
        "Thank you,",
        "{{companyName}}",
      ].join("\n"),
      bodyHtml: [
        "<p>Hi {{leadFirstName}},</p>",
        "<p>I wanted to follow up and see if you had any questions about the estimate. I am happy to clarify scope, timing, or options before you decide.</p>",
        "<p>Thank you,<br><strong>{{companyName}}</strong></p>",
      ].join(""),
    },
    {
      title: "Second follow-up",
      subject: "Checking in one more time",
      bodyText: [
        "Hi {{leadFirstName}},",
        "",
        "Checking in one more time on your {{serviceType}} request. If the timing changed or you went another direction, no problem. If you still need help, I can help with next steps.",
        "",
        "Thank you,",
        "{{companyName}}",
      ].join("\n"),
      bodyHtml: [
        "<p>Hi {{leadFirstName}},</p>",
        "<p>Checking in one more time on your {{serviceType}} request. If the timing changed or you went another direction, no problem. If you still need help, I can help with next steps.</p>",
        "<p>Thank you,<br><strong>{{companyName}}</strong></p>",
      ].join(""),
    },
    {
      title: "Polite closeout",
      subject: "Closing the loop",
      bodyText: [
        "Hi {{leadFirstName}},",
        "",
        "I am going to close the loop on this request for now. You are welcome to reach back out if the project becomes active again.",
        "",
        "Thank you,",
        "{{companyName}}",
      ].join("\n"),
      bodyHtml: [
        "<p>Hi {{leadFirstName}},</p>",
        "<p>I am going to close the loop on this request for now. You are welcome to reach back out if the project becomes active again.</p>",
        "<p>Thank you,<br><strong>{{companyName}}</strong></p>",
      ].join(""),
    },
  ],
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTemplateValue(context: EmailTemplateContext, key: string) {
  const value = context[key]?.trim();

  if (value) return value;
  if (key === "customerName") return "there";

  return "";
}

function renderTextTemplate(value: string, context: EmailTemplateContext) {
  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_token, key: string) => getTemplateValue(context, key));
}

function renderHtmlTemplate(value: string, context: EmailTemplateContext) {
  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_token, key: string) =>
    escapeHtml(getTemplateValue(context, key)),
  );
}

export function renderDocumentEmailTemplate(
  template: {
    bodyHtml: string;
    bodyText: string;
    subject: string;
    title: string;
  },
  context: EmailTemplateContext,
): DocumentEmailTemplate {
  return {
    bodyHtml: renderHtmlTemplate(template.bodyHtml, context),
    bodyText: renderTextTemplate(template.bodyText, context),
    subject: renderTextTemplate(template.subject, context),
    title: template.title,
  };
}

function getDefaultTemplateEntries(scopes?: EmailTemplateScope | EmailTemplateScope[]) {
  const selectedScopes =
    scopes === undefined
      ? (Object.keys(defaultDocumentEmailTemplates) as EmailTemplateScope[])
      : Array.isArray(scopes)
        ? scopes
        : [scopes];

  return selectedScopes.flatMap((scope) =>
    defaultDocumentEmailTemplates[scope].map((template) => ({
      ...template,
      scope,
    })),
  );
}

export async function ensureDefaultDocumentEmailTemplates(
  ownerId: string,
  scopes?: EmailTemplateScope | EmailTemplateScope[],
) {
  const templates = getDefaultTemplateEntries(scopes);

  if (!templates.length) return;

  await prisma.emailTemplate.createMany({
    data: templates.map((template) => ({
      ownerId,
      scope: template.scope,
      title: template.title,
      subject: template.subject,
      bodyText: template.bodyText,
      bodyHtml: template.bodyHtml,
      isDefault: true,
    })),
    skipDuplicates: true,
  });
}

export async function getRenderedDocumentEmailTemplates({
  context,
  ownerId,
  scope,
}: {
  context: EmailTemplateContext;
  ownerId: string;
  scope: EmailTemplateScope;
}) {
  let templates = await prisma.emailTemplate.findMany({
    where: {
      ownerId,
      scope,
    },
    orderBy: [{ isDefault: "desc" }, { title: "asc" }],
  });

  if (!templates.length) {
    await ensureDefaultDocumentEmailTemplates(ownerId, scope);
    templates = await prisma.emailTemplate.findMany({
      where: {
        ownerId,
        scope,
      },
      orderBy: [{ isDefault: "desc" }, { title: "asc" }],
    });
  }

  return templates.map((template) => renderDocumentEmailTemplate(template, context));
}
