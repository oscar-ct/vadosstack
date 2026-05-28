"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";

export type CalendarTaskMutationState = {
  success: boolean;
  message: string;
};

const emptyToUndefined = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
};

const taskSchema = z.object({
  customerId: z.string().trim().optional(),
  location: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  scheduledFor: z
    .string()
    .trim()
    .min(1, "Scheduled date is required.")
    .transform((value) => parseDateInput(value))
    .refine((value) => !Number.isNaN(value.getTime()), "Enter a valid scheduled date."),
  title: z.string().trim().min(1, "Task title is required."),
});

export async function createCalendarTaskAction(
  _state: CalendarTaskMutationState,
  formData: FormData,
): Promise<CalendarTaskMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "Sign in to create tasks.",
    };
  }

  const parsed = taskSchema.safeParse({
    customerId: emptyToUndefined(formData.get("customerId")),
    location: emptyToUndefined(formData.get("location")),
    notes: emptyToUndefined(formData.get("notes")),
    scheduledFor: formData.get("scheduledFor"),
    title: formData.get("title"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the task details and try again.",
    };
  }

  const customerId = parsed.data.customerId;

  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        ownerId: currentUser.id,
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      return {
        success: false,
        message: "Choose a valid customer.",
      };
    }
  }

  await prisma.task.create({
    data: {
      customerId,
      location: parsed.data.location,
      notes: parsed.data.notes,
      ownerId: currentUser.id,
      scheduledFor: parsed.data.scheduledFor,
      title: parsed.data.title,
    },
  });

  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/overview");

  return {
    success: true,
    message: "Task created.",
  };
}

const deleteTaskSchema = z.object({
  id: z.string().trim().min(1, "Task is required."),
});

export async function deleteCalendarTaskAction(
  _state: CalendarTaskMutationState,
  formData: FormData,
): Promise<CalendarTaskMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "Sign in to delete tasks.",
    };
  }

  const parsed = deleteTaskSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Choose a valid task.",
    };
  }

  await prisma.task.deleteMany({
    where: {
      id: parsed.data.id,
      ownerId: currentUser.id,
    },
  });

  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/overview");

  return {
    success: true,
    message: "Task deleted.",
  };
}
