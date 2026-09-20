"use server";

import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { parseDateInput } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

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
  leadId: z.string().trim().optional(),
  location: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  priority: z.enum(["Low", "Normal", "High"]),
  scheduledFor: z
    .string()
    .trim()
    .min(1, "Scheduled date is required.")
    .transform((value) => parseDateInput(value))
    .refine((value) => !Number.isNaN(value.getTime()), "Enter a valid scheduled date."),
  title: z.string().trim().min(1, "Task title is required."),
});

const updateTaskSchema = taskSchema.extend({
  id: z.string().trim().min(1, "Task is required."),
});

async function validateTaskAssociation({
  customerId,
  leadId,
  ownerId,
}: {
  customerId?: string;
  leadId?: string;
  ownerId: string;
}) {
  if (customerId && leadId) {
    return "Choose either a customer or a lead, not both.";
  }

  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        ownerId,
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      return "Choose a valid customer.";
    }
  }

  if (leadId) {
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        ownerId,
      },
      select: {
        id: true,
      },
    });

    if (!lead) {
      return "Choose a valid lead.";
    }
  }

  return null;
}

export async function createCalendarTaskAction(
  _state: CalendarTaskMutationState,
  formData: FormData,
): Promise<CalendarTaskMutationState> {
  const authorization = await getPermittedDashboardAuthorization("calendar.manage");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to create calendar tasks.",
    };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = taskSchema.safeParse({
    customerId: emptyToUndefined(formData.get("customerId")),
    leadId: emptyToUndefined(formData.get("leadId")),
    location: emptyToUndefined(formData.get("location")),
    notes: emptyToUndefined(formData.get("notes")),
    priority: formData.get("priority"),
    scheduledFor: formData.get("scheduledFor"),
    title: formData.get("title"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the task details and try again.",
    };
  }

  const associationError = await validateTaskAssociation({
    customerId: parsed.data.customerId,
    leadId: parsed.data.leadId,
    ownerId: workspaceId,
  });

  if (associationError) {
    return {
      success: false,
      message: associationError,
    };
  }

  await prisma.$transaction(async (transaction) => {
    const task = await transaction.task.create({
      data: {
        customerId: parsed.data.customerId,
        leadId: parsed.data.leadId,
        location: parsed.data.location,
        notes: parsed.data.notes,
        ownerId: workspaceId,
        priority: parsed.data.priority,
        scheduledFor: parsed.data.scheduledFor,
        title: parsed.data.title,
      },
    });
    await recordAuthorizationAuditEvent(
      {
        workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "calendar.task.create",
        targetType: "Task",
        targetId: task.id,
      },
      transaction,
    );
  });

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/calendar");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/overview");

  return {
    success: true,
    message: "Task created.",
  };
}

export async function updateCalendarTaskAction(
  _state: CalendarTaskMutationState,
  formData: FormData,
): Promise<CalendarTaskMutationState> {
  const authorization = await getPermittedDashboardAuthorization("calendar.manage");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to update calendar tasks.",
    };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = updateTaskSchema.safeParse({
    id: formData.get("id"),
    customerId: emptyToUndefined(formData.get("customerId")),
    leadId: emptyToUndefined(formData.get("leadId")),
    location: emptyToUndefined(formData.get("location")),
    notes: emptyToUndefined(formData.get("notes")),
    priority: formData.get("priority"),
    scheduledFor: formData.get("scheduledFor"),
    title: formData.get("title"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the task details and try again.",
    };
  }

  const associationError = await validateTaskAssociation({
    customerId: parsed.data.customerId,
    leadId: parsed.data.leadId,
    ownerId: workspaceId,
  });

  if (associationError) {
    return {
      success: false,
      message: associationError,
    };
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const result = await transaction.task.updateMany({
      where: {
        id: parsed.data.id,
        ownerId: workspaceId,
      },
      data: {
        customerId: parsed.data.customerId ?? null,
        leadId: parsed.data.leadId ?? null,
        location: parsed.data.location ?? null,
        notes: parsed.data.notes ?? null,
        priority: parsed.data.priority,
        scheduledFor: parsed.data.scheduledFor,
        title: parsed.data.title,
      },
    });
    if (result.count === 0) return false;
    await recordAuthorizationAuditEvent(
      {
        workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "calendar.task.update",
        targetType: "Task",
        targetId: parsed.data.id,
      },
      transaction,
    );
    return true;
  });

  if (!updated) return { success: false, message: "That calendar task is no longer available." };

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/calendar");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/overview");

  return {
    success: true,
    message: "Task updated.",
  };
}

const deleteTaskSchema = z.object({
  id: z.string().trim().min(1, "Task is required."),
});

export async function deleteCalendarTaskAction(
  _state: CalendarTaskMutationState,
  formData: FormData,
): Promise<CalendarTaskMutationState> {
  const authorization = await getPermittedDashboardAuthorization("calendar.manage");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to delete calendar tasks.",
    };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = deleteTaskSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Choose a valid task.",
    };
  }

  const deleted = await prisma.$transaction(async (transaction) => {
    const result = await transaction.task.deleteMany({
      where: {
        id: parsed.data.id,
        ownerId: workspaceId,
      },
    });
    if (result.count === 0) return false;
    await recordAuthorizationAuditEvent(
      {
        workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "calendar.task.delete",
        targetType: "Task",
        targetId: parsed.data.id,
      },
      transaction,
    );
    return true;
  });

  if (!deleted) return { success: false, message: "That calendar task is no longer available." };

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/calendar");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/overview");

  return {
    success: true,
    message: "Task deleted.",
  };
}
