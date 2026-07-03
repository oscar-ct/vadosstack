"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to update document messages." };
  }

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

  await prisma.user.update({
    where: {
      id: currentUser.id,
    },
    data,
  });

  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/invoices");

  if (parsed.data.returnTo?.startsWith("/dashboard/")) {
    revalidatePath(parsed.data.returnTo.split("?")[0] ?? parsed.data.returnTo);
  }

  return { success: true, message: "Custom message saved.", submittedAt: Date.now() };
}
