"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type CompanySettingsState = {
  success: boolean;
  message: string;
};

const companySettingsSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required.").max(120, "Company name is too long."),
  companyEmail: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success, "Enter a valid company email."),
  companyPhone: z.string().trim().max(40, "Company phone is too long.").optional(),
  deleteLogo: z.coerce.boolean().optional(),
});

const maxLogoSize = 500 * 1024;
const allowedLogoTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

async function getLogoDataUrl(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return undefined;

  if (file.size > maxLogoSize) {
    throw new Error("Logo must be 500 KB or smaller.");
  }

  if (!allowedLogoTypes.has(file.type)) {
    throw new Error("Logo must be a PNG, JPG, WebP, or SVG file.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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
    deleteLogo: formData.get("deleteLogo"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check your company settings and try again.",
    };
  }

  let companyLogoDataUrl: string | undefined;

  try {
    companyLogoDataUrl = await getLogoDataUrl(formData.get("companyLogo"));
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Logo could not be uploaded.",
    };
  }

  await prisma.user.update({
    where: {
      id: currentUser.id,
    },
    data: {
      companyName: parsed.data.companyName,
      companyEmail: emptyToNull(parsed.data.companyEmail),
      companyPhone: emptyToNull(parsed.data.companyPhone),
      ...(parsed.data.deleteLogo ? { companyLogoDataUrl: null } : companyLogoDataUrl ? { companyLogoDataUrl } : {}),
    },
  });

  revalidatePath("/dashboard");

  return {
    success: true,
    message: "Company settings updated.",
  };
}
