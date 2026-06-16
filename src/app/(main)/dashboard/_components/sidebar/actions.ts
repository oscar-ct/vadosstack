"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { escapeHtml } from "@/lib/email-content";
import { logEmailRecord } from "@/lib/email-records";
import {
  decryptGoogleToken,
  GMAIL_REFRESH_ERROR_MESSAGE,
  refreshGoogleAccessToken,
  sendGmailMessage,
} from "@/lib/google-mail";
import { isValidOptionalPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { deleteR2Object, uploadR2Object } from "@/lib/r2";

import { randomUUID } from "node:crypto";

export type CompanySettingsState = {
  success: boolean;
  message: string;
};

export type AccountProfileState = {
  success: boolean;
  message: string;
};

export type GeneralEmailState = {
  success: boolean;
  message: string;
  reconnectRequired?: boolean;
  submittedAt?: number;
};

const accountProfileSchema = z.object({
  name: z.string().trim().min(1, "Account name is required.").max(120, "Account name is too long."),
});

const emailRecipientSchema = z
  .string()
  .trim()
  .min(1, "Add at least one recipient.")
  .refine(
    (value) => value.split(",").every((email) => z.string().email().safeParse(email.trim()).success),
    "Enter valid recipient emails separated by commas.",
  )
  .transform((value) =>
    value
      .split(",")
      .map((email) => email.trim())
      .join(", "),
  );

const generalEmailSchema = z.object({
  to: emailRecipientSchema,
  subject: z.string().trim().min(1, "Subject is required.").max(180, "Subject is too long."),
  text: z.string().trim().min(1, "Message is required.").max(15000, "Message is too long."),
  html: z.string().trim().optional(),
});

const companySettingsSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required.").max(120, "Company name is too long."),
  companyEmail: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success, "Enter a valid company email."),
  companyPhone: z
    .string()
    .trim()
    .optional()
    .refine(isValidOptionalPhoneNumber, "Enter a 10-digit company phone number.")
    .transform((value) => normalizePhoneNumber(value)),
  estimateValidDays: z.coerce
    .number()
    .int("Estimate valid days must be a whole number.")
    .min(1, "Estimate valid days must be at least 1.")
    .max(365, "Estimate valid days must be 365 or less."),
  invoiceDueDays: z.coerce
    .number()
    .int("Invoice due days must be a whole number.")
    .min(1, "Invoice due days must be at least 1.")
    .max(365, "Invoice due days must be 365 or less."),
  deleteLogo: z.coerce.boolean().optional(),
});

const maxLogoSize = 2 * 1024 * 1024;
const maxFallbackLogoSize = 500 * 1024;
const allowedLogoTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const maxEmailAttachmentSize = 10 * 1024 * 1024;
const maxEmailAttachmentTotalSize = 20 * 1024 * 1024;
const maxEmailAttachments = 8;

function getFileExtension(file: File) {
  const extension = file.name
    .split(".")
    .pop()
    ?.replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

  if (extension) {
    return extension;
  }

  if (file.type === "image/svg+xml") return "svg";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";

  return "png";
}

async function getLogoUpload(file: FormDataEntryValue | null, userId: string) {
  if (!(file instanceof File) || file.size === 0) return undefined;

  if (file.size > maxLogoSize) {
    throw new Error("Logo must be 2 MB or smaller.");
  }

  if (!allowedLogoTypes.has(file.type)) {
    throw new Error("Logo must be a PNG, JPG, WebP, or SVG file.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const key = `company-logos/${userId}/${randomUUID()}.${getFileExtension(file)}`;

  return {
    bytes,
    contentType: file.type,
    key,
  };
}

function getFallbackLogoDataUrl(logoUpload: NonNullable<Awaited<ReturnType<typeof getLogoUpload>>>) {
  if (logoUpload.bytes.byteLength > maxFallbackLogoSize) {
    throw new Error("R2 upload failed. Try a logo under 500 KB or try again later.");
  }

  return `data:${logoUpload.contentType};base64,${logoUpload.bytes.toString("base64")}`;
}

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function createGeneralEmailState(success: boolean, message: string, reconnectRequired = false): GeneralEmailState {
  return {
    success,
    message,
    reconnectRequired,
    submittedAt: Date.now(),
  };
}

function getHtmlAttributes(value: string) {
  const attributes = new Map<string, string>();
  const attributePattern = /([a-z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match = attributePattern.exec(value);

  while (match) {
    attributes.set(match[1]?.toLowerCase() ?? "", match[2] ?? match[3] ?? match[4] ?? "");
    match = attributePattern.exec(value);
  }

  return attributes;
}

function isSafeEmailUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function isSafeEmailColor(value: string) {
  return /^#[0-9a-f]{3,8}$/i.test(value) || /^rgba?\(\s*[\d\s,.%]+\)$/i.test(value);
}

function isSafeEmailFontSize(value: string) {
  const match = /^(\d+(?:\.\d+)?)px$/i.exec(value);
  if (!match) return false;

  const size = Number(match[1]);
  return size >= 10 && size <= 28;
}

function sanitizeEmailStyle(value: string) {
  const declarations = value
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean);
  const safeDeclarations: string[] = [];

  for (const declaration of declarations) {
    const [property, ...rawValue] = declaration.split(":");
    const normalizedProperty = property?.trim().toLowerCase();
    const normalizedValue = rawValue.join(":").trim();

    if (!normalizedProperty || !normalizedValue) continue;

    if (normalizedProperty === "text-align" && ["center", "left", "right"].includes(normalizedValue)) {
      safeDeclarations.push(`text-align:${normalizedValue}`);
    }

    if (["background-color", "color"].includes(normalizedProperty) && isSafeEmailColor(normalizedValue)) {
      safeDeclarations.push(`${normalizedProperty}:${normalizedValue}`);
    }

    if (normalizedProperty === "font-size" && isSafeEmailFontSize(normalizedValue)) {
      safeDeclarations.push(`font-size:${normalizedValue}`);
    }
  }

  return safeDeclarations.join(";");
}

function sanitizeEmailHtml(value?: string) {
  if (!value) return undefined;

  const allowedTags = new Set([
    "a",
    "b",
    "blockquote",
    "br",
    "div",
    "em",
    "i",
    "li",
    "mark",
    "ol",
    "p",
    "s",
    "span",
    "strong",
    "u",
    "ul",
  ]);
  const styleTags = new Set(["blockquote", "div", "mark", "p", "span"]);
  const withoutScripts = value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");

  return withoutScripts.replace(/<\/?([a-z0-9]+)([^>]*)?>/gi, (tag, tagName: string, rawAttributes: string) => {
    const normalized = tagName.toLowerCase();

    if (!allowedTags.has(normalized)) {
      return escapeHtml(tag);
    }

    if (tag.startsWith("</")) return `</${normalized}>`;

    if (normalized === "br") return "<br>";

    const attributes = getHtmlAttributes(rawAttributes ?? "");
    const safeAttributes: string[] = [];

    if (normalized === "a") {
      const href = attributes.get("href");

      if (href && isSafeEmailUrl(href)) {
        safeAttributes.push(`href="${escapeHtml(href)}"`, 'rel="noopener noreferrer"', 'target="_blank"');
      }
    }

    if (styleTags.has(normalized)) {
      const safeStyle = sanitizeEmailStyle(attributes.get("style") ?? "");

      if (safeStyle) {
        safeAttributes.push(`style="${escapeHtml(safeStyle)}"`);
      }
    }

    return safeAttributes.length ? `<${normalized} ${safeAttributes.join(" ")}>` : `<${normalized}>`;
  });
}

async function getEmailAttachments(formData: FormData) {
  const files = formData.getAll("attachments").filter((file): file is File => file instanceof File && file.size > 0);

  if (files.length > maxEmailAttachments) {
    throw new Error(`Attach ${maxEmailAttachments} files or fewer.`);
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  if (totalSize > maxEmailAttachmentTotalSize) {
    throw new Error("Attachments must be 20 MB or smaller in total.");
  }

  return Promise.all(
    files.map(async (file) => {
      if (file.size > maxEmailAttachmentSize) {
        throw new Error(`${file.name} must be 10 MB or smaller.`);
      }

      return {
        content: Buffer.from(await file.arrayBuffer()),
        contentType: file.type || "application/octet-stream",
        filename: file.name.replace(/[\r\n"]/g, " ").trim() || "attachment",
      };
    }),
  );
}

export async function sendGeneralEmailAction(
  _previousState: GeneralEmailState,
  formData: FormData,
): Promise<GeneralEmailState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return createGeneralEmailState(false, "You must be signed in to send email.");
  }

  const parsed = generalEmailSchema.safeParse({
    to: formData.get("to"),
    subject: formData.get("subject"),
    text: formData.get("text"),
    html: formData.get("html"),
  });

  if (!parsed.success) {
    return createGeneralEmailState(false, parsed.error.issues[0]?.message ?? "Check the email and try again.");
  }

  const googleMailAccount = await prisma.googleMailAccount.findUnique({
    where: {
      userId: currentUser.id,
    },
  });

  const emailRecordBase = {
    ownerId: currentUser.id,
    documentType: "general" as const,
    documentId: null,
    documentNumber: "Compose",
    documentTotal: null,
    recipientName: null,
    recipientEmail: parsed.data.to,
    senderEmail: googleMailAccount?.email,
    subject: parsed.data.subject,
  };

  if (!googleMailAccount) {
    await logEmailRecord({
      ...emailRecordBase,
      status: "error",
      errorMessage: "Connect Gmail before sending email.",
    });

    return createGeneralEmailState(false, "Connect Gmail before sending email.", true);
  }

  let attachments: Awaited<ReturnType<typeof getEmailAttachments>>;

  try {
    attachments = await getEmailAttachments(formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Attachments could not be prepared.";

    await logEmailRecord({
      ...emailRecordBase,
      senderEmail: googleMailAccount.email,
      status: "error",
      errorMessage: message,
    });

    return createGeneralEmailState(false, message);
  }

  try {
    const refreshToken = decryptGoogleToken(googleMailAccount.refreshTokenCipher);
    const accessToken = await refreshGoogleAccessToken(refreshToken);

    await sendGmailMessage(accessToken, {
      attachments,
      from: googleMailAccount.email,
      html: sanitizeEmailHtml(parsed.data.html) ?? escapeHtml(parsed.data.text).replace(/\n/g, "<br />"),
      subject: parsed.data.subject,
      text: parsed.data.text,
      to: parsed.data.to,
    });

    await logEmailRecord({
      ...emailRecordBase,
      senderEmail: googleMailAccount.email,
      status: "success",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email could not be sent. Please try again.";
    const reconnectRequired = message === GMAIL_REFRESH_ERROR_MESSAGE;
    const responseMessage = reconnectRequired ? `${message} Please reconnect to continue.` : message;

    if (reconnectRequired) {
      await prisma.googleMailAccount.deleteMany({
        where: {
          userId: currentUser.id,
        },
      });
    }

    await logEmailRecord({
      ...emailRecordBase,
      senderEmail: googleMailAccount.email,
      status: "error",
      errorMessage: message,
    });

    return createGeneralEmailState(false, responseMessage, reconnectRequired);
  }

  revalidatePath("/dashboard/email-history");

  return createGeneralEmailState(true, `Email sent to ${parsed.data.to}.`);
}

export async function updateCompanySettingsAction(
  _previousState: CompanySettingsState,
  formData: FormData,
): Promise<CompanySettingsState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to update your company settings.",
    };
  }

  const parsed = companySettingsSchema.safeParse({
    companyName: formData.get("companyName"),
    companyEmail: formData.get("companyEmail"),
    companyPhone: formData.get("companyPhone"),
    estimateValidDays: formData.get("estimateValidDays"),
    invoiceDueDays: formData.get("invoiceDueDays"),
    deleteLogo: formData.get("deleteLogo"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check your company settings and try again.",
    };
  }

  let logoUpload: Awaited<ReturnType<typeof getLogoUpload>>;

  try {
    logoUpload = await getLogoUpload(formData.get("companyLogo"), currentUser.id);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Logo could not be uploaded.",
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      id: currentUser.id,
    },
    select: {
      companyLogoKey: true,
    },
  });

  try {
    let logoFallbackDataUrl: string | undefined;

    if (logoUpload) {
      try {
        await uploadR2Object({
          body: logoUpload.bytes,
          contentType: logoUpload.contentType,
          key: logoUpload.key,
        });
      } catch {
        logoFallbackDataUrl = getFallbackLogoDataUrl(logoUpload);
      }
    }

    await prisma.user.update({
      where: {
        id: currentUser.id,
      },
      data: {
        companyName: parsed.data.companyName,
        companyEmail: emptyToNull(parsed.data.companyEmail),
        companyPhone: emptyToNull(parsed.data.companyPhone),
        estimateValidDays: parsed.data.estimateValidDays,
        invoiceDueDays: parsed.data.invoiceDueDays,
        ...(parsed.data.deleteLogo
          ? { companyLogoDataUrl: null, companyLogoKey: null, companyLogoType: null }
          : logoUpload
            ? logoFallbackDataUrl
              ? { companyLogoDataUrl: logoFallbackDataUrl, companyLogoKey: null, companyLogoType: null }
              : { companyLogoDataUrl: null, companyLogoKey: logoUpload.key, companyLogoType: logoUpload.contentType }
            : {}),
      },
    });

    if ((parsed.data.deleteLogo || logoUpload) && existingUser?.companyLogoKey) {
      await deleteR2Object(existingUser.companyLogoKey).catch(() => undefined);
    }
  } catch (error) {
    if (logoUpload) {
      await deleteR2Object(logoUpload.key).catch(() => undefined);
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : "Company settings could not be updated.",
    };
  }

  revalidatePath("/dashboard");

  return {
    success: true,
    message: "Company settings updated.",
  };
}

export async function updateAccountProfileAction(
  _previousState: AccountProfileState,
  formData: FormData,
): Promise<AccountProfileState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to update your profile.",
    };
  }

  const parsed = accountProfileSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check your profile details and try again.",
    };
  }

  await prisma.user.update({
    where: {
      id: currentUser.id,
    },
    data: {
      name: parsed.data.name,
    },
  });

  revalidatePath("/dashboard");

  return {
    success: true,
    message: "Account profile updated.",
  };
}
