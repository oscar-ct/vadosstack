"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import type { EstimateMutationState } from "./types";

const deleteEstimateSchema = z.object({
  id: z.string().trim().min(1, "Estimate is required."),
  redirectTo: z.string().trim().optional(),
});

export async function deleteEstimateAction(
  _previousState: EstimateMutationState,
  formData: FormData,
): Promise<EstimateMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to delete an estimate.",
    };
  }

  const parsed = deleteEstimateSchema.safeParse({
    id: formData.get("id"),
    redirectTo: formData.get("redirectTo"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select an estimate and try again.",
    };
  }

  try {
    await prisma.estimate.delete({
      where: {
        id_ownerId: {
          id: parsed.data.id,
          ownerId: currentUser.id,
        },
      },
    });
  } catch {
    return {
      success: false,
      message: "Estimate could not be deleted. Please try again.",
    };
  }

  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/estimates");

  if (parsed.data.redirectTo?.startsWith("/dashboard/")) {
    redirect(parsed.data.redirectTo);
  }

  return {
    success: true,
    message: "Estimate deleted.",
  };
}
