"use server";

import { startOfWeek } from "date-fns";
import { z } from "zod";

import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { noWorkDayReasonValues } from "@/lib/no-work-days";
import { isValidOptionalPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getSafeTimeEntryErrorMessage, TimeEntryUserError } from "@/lib/time-entry-errors";
import {
  calculateShift,
  managerWorkDateSchema,
  parseWorkDate,
  timeEntryFieldsSchema,
  timeEntryIdSchema,
  workDateSchema,
} from "@/lib/time-entry-rules";
import {
  assertTimeEntryAvailable,
  assertTimesheetUnlocked,
  lockEmployeeTimeEntries,
  lockTimesheetWeek,
  timeEntrySnapshot,
} from "@/lib/time-entry-server";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

export type TimeTrackingMutationState = {
  success: boolean;
  message: string;
};

const initialRequiredString = z.string().trim().min(1);

const createEmployeeSchema = z.object({
  name: initialRequiredString,
  email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  phone: z.string().trim().optional().refine(isValidOptionalPhoneNumber, "Phone number must be 10 digits."),
});

const updateEmployeeSchema = createEmployeeSchema.extend({
  employeeId: initialRequiredString,
  employeeNumber: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Employee number must be exactly 4 digits."),
});

const deleteEmployeeSchema = z.object({
  employeeId: initialRequiredString,
});
const createTimeEntrySchema = timeEntryFieldsSchema.extend({
  employeeId: timeEntryIdSchema,
  workedOn: managerWorkDateSchema,
});

const updateTimeEntrySchema = timeEntryFieldsSchema.extend({
  entryId: timeEntryIdSchema,
});

const deleteTimeEntrySchema = z.object({
  entryId: initialRequiredString,
});

const createNoWorkDaySchema = z.object({
  employeeId: timeEntryIdSchema,
  jobId: z.string().trim().max(64).optional(),
  notes: z.string().trim().max(1000, "Notes must be 1,000 characters or fewer.").optional(),
  reason: z.enum(noWorkDayReasonValues),
  workedOn: managerWorkDateSchema,
});

const deleteNoWorkDaySchema = z.object({
  noWorkDayId: timeEntryIdSchema,
});

const updateNoWorkDaySchema = createNoWorkDaySchema.extend({
  noWorkDayId: timeEntryIdSchema,
});

const reviewTimeEntryRequestSchema = z.object({
  requestId: timeEntryIdSchema,
  reason: z.string().trim().max(500, "Review notes must be 500 characters or fewer.").optional(),
});
const lockWeekSchema = z.object({ weekStart: workDateSchema });

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "none" ? trimmed : null;
}

function formString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : undefined;
}

function phoneToNull(value?: string) {
  const phone = normalizePhoneNumber(value);
  return phone || null;
}

async function generateEmployeeNumber(ownerId: string) {
  const existingEmployees = await prisma.employee.findMany({
    where: {
      ownerId,
    },
    select: {
      employeeNumber: true,
    },
  });
  const usedNumbers = new Set(existingEmployees.map((employee) => employee.employeeNumber));

  for (let attempt = 0; attempt < 9000; attempt += 1) {
    const candidate = String(Math.floor(1000 + Math.random() * 9000));
    if (!usedNumbers.has(candidate)) return candidate;
  }

  throw new TimeEntryUserError("Could not generate a unique employee number. Try again.");
}

async function validateOptionalJob(ownerId: string, jobId?: string | null) {
  const normalizedJobId = emptyToNull(jobId ?? undefined);

  if (!normalizedJobId) return null;

  const job = await prisma.job.findUnique({
    where: {
      id_ownerId: {
        id: normalizedJobId,
        ownerId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!job) {
    throw new TimeEntryUserError("Select a job from your account.");
  }

  return job.id;
}

export async function createEmployeeAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const authorization = await getPermittedDashboardAuthorization("employees.manage");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to add an employee.",
    };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = createEmployeeSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the employee details and try again.",
    };
  }

  try {
    await prisma.employee.create({
      data: {
        ownerId: workspaceId,
        employeeNumber: await generateEmployeeNumber(workspaceId),
        name: parsed.data.name,
        email: emptyToNull(parsed.data.email),
        phone: phoneToNull(parsed.data.phone),
      },
    });
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(error, "Employee could not be added.", "create employee"),
    };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/time-tracking");

  return {
    success: true,
    message: "Employee added.",
  };
}

export async function updateEmployeeAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const authorization = await getPermittedDashboardAuthorization("employees.manage");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to update an employee.",
    };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = updateEmployeeSchema.safeParse({
    employeeId: formData.get("employeeId"),
    employeeNumber: formData.get("employeeNumber"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the employee details and try again.",
    };
  }

  const existingNumber = await prisma.employee.findFirst({
    where: {
      ownerId: workspaceId,
      employeeNumber: parsed.data.employeeNumber,
      NOT: {
        id: parsed.data.employeeId,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingNumber) {
    return {
      success: false,
      message: "That employee number is already in use.",
    };
  }

  await prisma.employee.update({
    where: {
      id_ownerId: {
        id: parsed.data.employeeId,
        ownerId: workspaceId,
      },
    },
    data: {
      employeeNumber: parsed.data.employeeNumber,
      name: parsed.data.name,
      email: emptyToNull(parsed.data.email),
      phone: phoneToNull(parsed.data.phone),
    },
  });

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/time-tracking");

  return {
    success: true,
    message: "Employee updated.",
  };
}

export async function deleteEmployeeAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const authorization = await getPermittedDashboardAuthorization("employees.manage");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to delete an employee.",
    };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = deleteEmployeeSchema.safeParse({
    employeeId: formData.get("employeeId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select an employee and try again.",
    };
  }

  const [entryCount, requestCount, auditCount] = await Promise.all([
    prisma.timeEntry.count({ where: { employeeId: parsed.data.employeeId, ownerId: workspaceId } }),
    prisma.timeEntryRequest.count({ where: { employeeId: parsed.data.employeeId, ownerId: workspaceId } }),
    prisma.timeEntryAudit.count({ where: { employeeId: parsed.data.employeeId, ownerId: workspaceId } }),
  ]);

  if (entryCount + requestCount + auditCount > 0) {
    return {
      success: false,
      message: "This employee has time history and must remain archived. Historical payroll records cannot be deleted.",
    };
  }

  await prisma.employee.delete({
    where: {
      id_ownerId: {
        id: parsed.data.employeeId,
        ownerId: workspaceId,
      },
    },
  });

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/time-tracking");

  return {
    success: true,
    message: "Employee deleted.",
  };
}

export async function createTimeEntryAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const authorization = await getPermittedDashboardAuthorization("time.manage");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to log hours.",
    };
  }
  const workspaceId = authorization.workspaceId;
  const actorId = authorization.principal.user.id;
  const canViewJobs = can(authorization.membership, "jobs.view");

  const parsed = createTimeEntrySchema.safeParse({
    employeeId: formData.get("employeeId"),
    jobId: formString(formData.get("jobId")),
    workedOn: formData.get("workedOn"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    deductLunch: formData.get("deductLunch"),
    lunchMinutes: formData.get("lunchMinutes") ?? "0",
    notes: formString(formData.get("notes")),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the time entry and try again.",
    };
  }

  if (emptyToNull(parsed.data.jobId) && !canViewJobs) {
    return {
      success: false,
      message: "You do not have permission to assign hours to a job.",
    };
  }

  const employee = await prisma.employee.findUnique({
    where: {
      id_ownerId: {
        id: parsed.data.employeeId,
        ownerId: workspaceId,
      },
    },
    select: {
      active: true,
      id: true,
    },
  });

  if (!employee?.active) {
    return {
      success: false,
      message: "Select an employee from your account.",
    };
  }

  let totals: ReturnType<typeof calculateShift>;
  let jobId: string | null;

  try {
    totals = calculateShift(parsed.data);
    jobId = await validateOptionalJob(workspaceId, parsed.data.jobId);
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(error, "Check the time entry details.", "validate manager time entry"),
    };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const workedOn = parseWorkDate(parsed.data.workedOn);
      await assertTimesheetUnlocked(transaction, workspaceId, workedOn);
      await assertTimeEntryAvailable(transaction, {
        employeeId: parsed.data.employeeId,
        endTime: parsed.data.endTime,
        hours: Number(totals.hours),
        ownerId: workspaceId,
        startTime: parsed.data.startTime,
        workedOn,
      });
      const entry = await transaction.timeEntry.create({
        data: {
          ownerId: workspaceId,
          employeeId: parsed.data.employeeId,
          jobId,
          workedOn,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          deductLunch: parsed.data.deductLunch !== false,
          lunchMinutes: totals.lunchMinutes,
          hours: totals.hours,
          notes: emptyToNull(parsed.data.notes),
        },
      });
      await transaction.timeEntryAudit.create({
        data: {
          action: "Create",
          actorId,
          afterSnapshot: timeEntrySnapshot(entry),
          employeeId: entry.employeeId,
          ownerId: workspaceId,
          source: "Manager",
          timeEntryId: entry.id,
        },
      });
    });
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(error, "Hours could not be logged. Please try again.", "create time entry"),
    };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/time-tracking");

  return {
    success: true,
    message: "Hours logged.",
  };
}

export async function createNoWorkDayAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const authorization = await getPermittedDashboardAuthorization("time.manage");
  if (!authorization) {
    return { success: false, message: "You do not have permission to record no-work days." };
  }

  const workspaceId = authorization.workspaceId;
  const actorId = authorization.principal.user.id;
  const canViewJobs = can(authorization.membership, "jobs.view");
  const parsed = createNoWorkDaySchema.safeParse({
    employeeId: formData.get("employeeId"),
    jobId: formString(formData.get("jobId")),
    notes: formString(formData.get("notes")),
    reason: formData.get("reason"),
    workedOn: formData.get("workedOn"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the no-work day details." };
  }
  if (emptyToNull(parsed.data.jobId) && !canViewJobs) {
    return { success: false, message: "You do not have permission to associate this record with a job." };
  }

  const employee = await prisma.employee.findUnique({
    where: { id_ownerId: { id: parsed.data.employeeId, ownerId: workspaceId } },
    select: { active: true, id: true },
  });
  if (!employee?.active) {
    return { success: false, message: "Select an active employee from your account." };
  }

  try {
    const jobId = await validateOptionalJob(workspaceId, parsed.data.jobId);
    const workedOn = parseWorkDate(parsed.data.workedOn);

    await prisma.$transaction(async (transaction) => {
      await assertTimesheetUnlocked(transaction, workspaceId, workedOn);
      await lockEmployeeTimeEntries(transaction, workspaceId, parsed.data.employeeId);

      const [existingHours, existingNoWorkDay] = await Promise.all([
        transaction.timeEntry.findFirst({
          where: { employeeId: parsed.data.employeeId, ownerId: workspaceId, workedOn },
          select: { id: true },
        }),
        transaction.noWorkDay.findUnique({
          where: {
            ownerId_employeeId_workedOn: {
              employeeId: parsed.data.employeeId,
              ownerId: workspaceId,
              workedOn,
            },
          },
          select: { id: true },
        }),
      ]);

      if (existingHours) {
        throw new TimeEntryUserError("This employee already has hours logged for the selected date.");
      }
      if (existingNoWorkDay) {
        throw new TimeEntryUserError("A no-work record already exists for this employee and date.");
      }

      const noWorkDay = await transaction.noWorkDay.create({
        data: {
          employeeId: parsed.data.employeeId,
          jobId,
          notes: emptyToNull(parsed.data.notes),
          ownerId: workspaceId,
          reason: parsed.data.reason,
          workedOn,
        },
      });
      await transaction.timeEntryAudit.create({
        data: {
          action: "No-work day added",
          actorId,
          afterSnapshot: {
            jobId: noWorkDay.jobId,
            notes: noWorkDay.notes,
            reason: noWorkDay.reason,
            workedOn: noWorkDay.workedOn.toISOString(),
          },
          employeeId: noWorkDay.employeeId,
          ownerId: workspaceId,
          source: "Manager",
        },
      });
    });
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(error, "The no-work day could not be saved.", "create no-work day"),
    };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/time-tracking");
  return { success: true, message: "No-work day recorded." };
}

export async function deleteNoWorkDayAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const authorization = await getPermittedDashboardAuthorization("time.manage");
  if (!authorization) {
    return { success: false, message: "You do not have permission to remove no-work days." };
  }

  const parsed = deleteNoWorkDaySchema.safeParse({ noWorkDayId: formData.get("noWorkDayId") });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Select a no-work day." };
  }

  const workspaceId = authorization.workspaceId;
  const actorId = authorization.principal.user.id;
  try {
    await prisma.$transaction(async (transaction) => {
      const noWorkDay = await transaction.noWorkDay.findUnique({
        where: { id_ownerId: { id: parsed.data.noWorkDayId, ownerId: workspaceId } },
      });
      if (!noWorkDay) throw new TimeEntryUserError("This no-work record is no longer available.");

      await assertTimesheetUnlocked(transaction, workspaceId, noWorkDay.workedOn);
      await lockEmployeeTimeEntries(transaction, workspaceId, noWorkDay.employeeId);
      await transaction.noWorkDay.delete({
        where: { id_ownerId: { id: noWorkDay.id, ownerId: workspaceId } },
      });
      await transaction.timeEntryAudit.create({
        data: {
          action: "No-work day removed",
          actorId,
          beforeSnapshot: {
            jobId: noWorkDay.jobId,
            notes: noWorkDay.notes,
            reason: noWorkDay.reason,
            workedOn: noWorkDay.workedOn.toISOString(),
          },
          employeeId: noWorkDay.employeeId,
          ownerId: workspaceId,
          source: "Manager",
        },
      });
    });
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(error, "The no-work day could not be removed.", "delete no-work day"),
    };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/time-tracking");
  return { success: true, message: "No-work day removed." };
}

export async function updateNoWorkDayAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const authorization = await getPermittedDashboardAuthorization("time.manage");
  if (!authorization) {
    return { success: false, message: "You do not have permission to update no-work days." };
  }

  const parsed = updateNoWorkDaySchema.safeParse({
    employeeId: formData.get("employeeId"),
    jobId: formString(formData.get("jobId")),
    notes: formString(formData.get("notes")),
    noWorkDayId: formData.get("noWorkDayId"),
    reason: formData.get("reason"),
    workedOn: formData.get("workedOn"),
  });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the no-work day details." };
  }

  const workspaceId = authorization.workspaceId;
  const actorId = authorization.principal.user.id;
  const canViewJobs = can(authorization.membership, "jobs.view");
  if (emptyToNull(parsed.data.jobId) && !canViewJobs) {
    return { success: false, message: "You do not have permission to associate this record with a job." };
  }

  const employee = await prisma.employee.findUnique({
    where: { id_ownerId: { id: parsed.data.employeeId, ownerId: workspaceId } },
    select: { active: true, id: true },
  });
  if (!employee?.active) {
    return { success: false, message: "Select an active employee from your account." };
  }

  try {
    const jobId = await validateOptionalJob(workspaceId, parsed.data.jobId);
    const workedOn = parseWorkDate(parsed.data.workedOn);

    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.noWorkDay.findUnique({
        where: { id_ownerId: { id: parsed.data.noWorkDayId, ownerId: workspaceId } },
      });
      if (!existing) throw new TimeEntryUserError("This no-work record is no longer available.");

      const datesToLock = Array.from(
        new Map([existing.workedOn, workedOn].map((date) => [date.getTime(), date])).values(),
      ).sort((left, right) => left.getTime() - right.getTime());
      for (const date of datesToLock) await assertTimesheetUnlocked(transaction, workspaceId, date);

      const employeesToLock = Array.from(new Set([existing.employeeId, parsed.data.employeeId])).sort();
      for (const employeeId of employeesToLock) {
        await lockEmployeeTimeEntries(transaction, workspaceId, employeeId);
      }

      const [existingHours, duplicate] = await Promise.all([
        transaction.timeEntry.findFirst({
          where: { employeeId: parsed.data.employeeId, ownerId: workspaceId, workedOn },
          select: { id: true },
        }),
        transaction.noWorkDay.findUnique({
          where: {
            ownerId_employeeId_workedOn: {
              employeeId: parsed.data.employeeId,
              ownerId: workspaceId,
              workedOn,
            },
          },
          select: { id: true },
        }),
      ]);
      if (existingHours) {
        throw new TimeEntryUserError("This employee already has hours logged for the selected date.");
      }
      if (duplicate && duplicate.id !== existing.id) {
        throw new TimeEntryUserError("A no-work record already exists for this employee and date.");
      }

      const updated = await transaction.noWorkDay.update({
        where: { id_ownerId: { id: existing.id, ownerId: workspaceId } },
        data: {
          employeeId: parsed.data.employeeId,
          jobId,
          notes: emptyToNull(parsed.data.notes),
          reason: parsed.data.reason,
          workedOn,
        },
      });
      await transaction.timeEntryAudit.create({
        data: {
          action: "No-work day updated",
          actorId,
          afterSnapshot: {
            jobId: updated.jobId,
            notes: updated.notes,
            reason: updated.reason,
            workedOn: updated.workedOn.toISOString(),
          },
          beforeSnapshot: {
            jobId: existing.jobId,
            notes: existing.notes,
            reason: existing.reason,
            workedOn: existing.workedOn.toISOString(),
          },
          employeeId: updated.employeeId,
          ownerId: workspaceId,
          source: "Manager",
        },
      });
    });
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(error, "The no-work day could not be updated.", "update no-work day"),
    };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/time-tracking");
  return { success: true, message: "No-work day updated." };
}

export async function updateTimeEntryAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const authorization = await getPermittedDashboardAuthorization("time.manage");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to update hours.",
    };
  }
  const workspaceId = authorization.workspaceId;
  const actorId = authorization.principal.user.id;
  const canViewJobs = can(authorization.membership, "jobs.view");
  const hasJobSelection = formData.has("jobId");

  const parsed = updateTimeEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    jobId: formString(formData.get("jobId")),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    deductLunch: formData.get("deductLunch"),
    lunchMinutes: formData.get("lunchMinutes") ?? "0",
    notes: formString(formData.get("notes")),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the time entry and try again.",
    };
  }

  if (hasJobSelection && emptyToNull(parsed.data.jobId) && !canViewJobs) {
    return {
      success: false,
      message: "You do not have permission to assign hours to a job.",
    };
  }

  let totals: ReturnType<typeof calculateShift>;
  let jobId: string | null | undefined;

  try {
    totals = calculateShift(parsed.data);
    jobId = hasJobSelection ? await validateOptionalJob(workspaceId, parsed.data.jobId) : undefined;
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(error, "Check the time entry details.", "validate time entry update"),
    };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.timeEntry.findUnique({
        where: { id_ownerId: { id: parsed.data.entryId, ownerId: workspaceId } },
      });
      if (!existing) throw new TimeEntryUserError("This time entry is no longer available.");
      await assertTimesheetUnlocked(transaction, workspaceId, existing.workedOn);
      await assertTimeEntryAvailable(transaction, {
        employeeId: existing.employeeId,
        endTime: parsed.data.endTime,
        excludeEntryId: existing.id,
        hours: Number(totals.hours),
        ownerId: workspaceId,
        startTime: parsed.data.startTime,
        workedOn: existing.workedOn,
      });
      const entry = await transaction.timeEntry.update({
        where: { id_ownerId: { id: existing.id, ownerId: workspaceId } },
        data: {
          startTime: parsed.data.startTime,
          ...(jobId === undefined ? {} : { jobId }),
          endTime: parsed.data.endTime,
          deductLunch: parsed.data.deductLunch !== false,
          lunchMinutes: totals.lunchMinutes,
          hours: totals.hours,
          notes: emptyToNull(parsed.data.notes),
        },
      });
      await transaction.timeEntryAudit.create({
        data: {
          action: "Update",
          actorId,
          afterSnapshot: timeEntrySnapshot(entry),
          beforeSnapshot: timeEntrySnapshot(existing),
          employeeId: entry.employeeId,
          ownerId: workspaceId,
          source: "Manager",
          timeEntryId: entry.id,
        },
      });
    });
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(
        error,
        "Hours could not be updated. Please try again.",
        "update time entry",
      ),
    };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/time-tracking");

  return {
    success: true,
    message: "Hours updated.",
  };
}

export async function deleteTimeEntryAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const authorization = await getPermittedDashboardAuthorization("time.manage");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to delete hours.",
    };
  }
  const workspaceId = authorization.workspaceId;
  const actorId = authorization.principal.user.id;

  const parsed = deleteTimeEntrySchema.safeParse({
    entryId: formData.get("entryId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select a time entry and try again.",
    };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.timeEntry.findUnique({
        where: { id_ownerId: { id: parsed.data.entryId, ownerId: workspaceId } },
      });
      if (!existing) throw new TimeEntryUserError("This time entry is no longer available.");
      await assertTimesheetUnlocked(transaction, workspaceId, existing.workedOn);
      await transaction.timeEntryAudit.create({
        data: {
          action: "Delete",
          actorId,
          beforeSnapshot: timeEntrySnapshot(existing),
          employeeId: existing.employeeId,
          ownerId: workspaceId,
          source: "Manager",
          timeEntryId: existing.id,
        },
      });
      await transaction.timeEntry.delete({ where: { id_ownerId: { id: existing.id, ownerId: workspaceId } } });
    });
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(
        error,
        "Hours could not be deleted. Please try again.",
        "delete time entry",
      ),
    };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/time-tracking");

  return {
    success: true,
    message: "Hours deleted.",
  };
}

export async function approveTimeEntryRequestAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const authorization = await getPermittedDashboardAuthorization("time.approve");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to approve time changes.",
    };
  }
  const workspaceId = authorization.workspaceId;
  const actorId = authorization.principal.user.id;

  const parsed = reviewTimeEntryRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    reason: formString(formData.get("reason")),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select a request and try again.",
    };
  }

  let approved = false;

  try {
    approved = await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.timeEntryRequest.updateMany({
        where: {
          id: parsed.data.requestId,
          ownerId: workspaceId,
          status: "Pending",
        },
        data: {
          status: "Processing",
        },
      });

      if (claimed.count !== 1) return false;

      const request = await transaction.timeEntryRequest.findUniqueOrThrow({
        where: {
          id: parsed.data.requestId,
        },
      });

      if (request.action === "Create") {
        if (!request.workedOn || !request.startTime || !request.endTime || !request.hours) {
          throw new TimeEntryUserError("This request is missing time details.");
        }

        const totals = calculateShift({
          deductLunch: request.deductLunch,
          endTime: request.endTime,
          lunchMinutes: request.lunchMinutes,
          startTime: request.startTime,
        });
        await assertTimesheetUnlocked(transaction, request.ownerId, request.workedOn);
        await assertTimeEntryAvailable(transaction, {
          employeeId: request.employeeId,
          endTime: request.endTime,
          hours: Number(totals.hours),
          ownerId: request.ownerId,
          startTime: request.startTime,
          workedOn: request.workedOn,
        });
        const entry = await transaction.timeEntry.create({
          data: {
            ownerId: request.ownerId,
            employeeId: request.employeeId,
            jobId: request.jobId,
            workedOn: request.workedOn,
            startTime: request.startTime,
            endTime: request.endTime,
            deductLunch: request.deductLunch,
            lunchMinutes: request.lunchMinutes,
            hours: totals.hours,
            notes: request.notes,
          },
        });
        await transaction.timeEntryAudit.create({
          data: {
            action: "Create",
            actorId,
            afterSnapshot: timeEntrySnapshot(entry),
            employeeId: entry.employeeId,
            ownerId: request.ownerId,
            requestId: request.id,
            source: "EmployeeRequest",
            timeEntryId: entry.id,
          },
        });
      } else if (request.action === "Update") {
        if (!request.timeEntryId || !request.startTime || !request.endTime || !request.hours) {
          throw new TimeEntryUserError("This request is missing time details.");
        }

        const existing = await transaction.timeEntry.findFirst({
          where: { id: request.timeEntryId, employeeId: request.employeeId, ownerId: request.ownerId },
        });
        if (!existing) throw new TimeEntryUserError("The original time entry is no longer available.");
        const totals = calculateShift({
          deductLunch: request.deductLunch,
          endTime: request.endTime,
          lunchMinutes: request.lunchMinutes,
          startTime: request.startTime,
        });
        await assertTimesheetUnlocked(transaction, request.ownerId, existing.workedOn);
        await assertTimeEntryAvailable(transaction, {
          employeeId: request.employeeId,
          endTime: request.endTime,
          excludeEntryId: existing.id,
          hours: Number(totals.hours),
          ownerId: request.ownerId,
          startTime: request.startTime,
          workedOn: existing.workedOn,
        });
        const latest = await transaction.timeEntry.findUniqueOrThrow({ where: { id: existing.id } });
        if (!request.baseEntryUpdatedAt || latest.updatedAt.getTime() !== request.baseEntryUpdatedAt.getTime()) {
          throw new TimeEntryUserError(
            "This entry changed after the employee submitted the request. Review the latest entry first.",
          );
        }
        const updated = await transaction.timeEntry.update({
          where: { id_ownerId: { id: existing.id, ownerId: request.ownerId } },
          data: {
            jobId: request.jobId,
            startTime: request.startTime,
            endTime: request.endTime,
            deductLunch: request.deductLunch,
            lunchMinutes: request.lunchMinutes,
            hours: totals.hours,
            notes: request.notes,
          },
        });
        await transaction.timeEntryAudit.create({
          data: {
            action: "Update",
            actorId,
            afterSnapshot: timeEntrySnapshot(updated),
            beforeSnapshot: timeEntrySnapshot(latest),
            employeeId: updated.employeeId,
            ownerId: request.ownerId,
            requestId: request.id,
            source: "EmployeeRequest",
            timeEntryId: updated.id,
          },
        });
      } else if (request.action === "Delete") {
        if (!request.timeEntryId || !request.workedOn) {
          throw new TimeEntryUserError("This request is missing the time entry to delete.");
        }

        await assertTimesheetUnlocked(transaction, request.ownerId, request.workedOn);
        await lockEmployeeTimeEntries(transaction, request.ownerId, request.employeeId);
        const existing = await transaction.timeEntry.findFirst({
          where: { id: request.timeEntryId, employeeId: request.employeeId, ownerId: request.ownerId },
        });
        if (!existing) throw new TimeEntryUserError("The original time entry is no longer available.");
        if (!request.baseEntryUpdatedAt || existing.updatedAt.getTime() !== request.baseEntryUpdatedAt.getTime()) {
          throw new TimeEntryUserError(
            "This entry changed after the employee requested deletion. Review the latest entry first.",
          );
        }
        await transaction.timeEntryAudit.create({
          data: {
            action: "Delete",
            actorId,
            beforeSnapshot: timeEntrySnapshot(existing),
            employeeId: existing.employeeId,
            ownerId: request.ownerId,
            requestId: request.id,
            source: "EmployeeRequest",
            timeEntryId: existing.id,
          },
        });
        await transaction.timeEntry.delete({
          where: { id_ownerId: { id: existing.id, ownerId: request.ownerId } },
        });
      } else {
        throw new TimeEntryUserError("This request has an unsupported action.");
      }

      await transaction.timeEntryRequest.update({
        where: {
          id: request.id,
        },
        data: {
          pendingKey: null,
          reviewReason: emptyToNull(parsed.data.reason),
          reviewedAt: new Date(),
          status: "Approved",
        },
      });

      return true;
    });
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(
        error,
        "The request could not be approved. Please try again.",
        "approve time entry request",
      ),
    };
  }

  if (!approved) {
    return {
      success: false,
      message: "This request is no longer available.",
    };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/time-tracking");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/employee-portal/timesheet");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/overview");

  return {
    success: true,
    message: "Request approved.",
  };
}

export async function rejectTimeEntryRequestAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const authorization = await getPermittedDashboardAuthorization("time.approve");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to reject time changes.",
    };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = reviewTimeEntryRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    reason: formString(formData.get("reason")),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select a request and try again.",
    };
  }

  let rejected = 0;
  try {
    const result = await prisma.timeEntryRequest.updateMany({
      where: {
        id: parsed.data.requestId,
        ownerId: workspaceId,
        status: "Pending",
      },
      data: {
        pendingKey: null,
        reviewReason: emptyToNull(parsed.data.reason),
        reviewedAt: new Date(),
        status: "Rejected",
      },
    });
    rejected = result.count;
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(
        error,
        "The request could not be rejected. Please try again.",
        "reject time entry request",
      ),
    };
  }

  if (rejected !== 1) {
    return { success: false, message: "This request is no longer available." };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/time-tracking");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/employee-portal/timesheet");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/overview");

  return {
    success: true,
    message: "Request rejected.",
  };
}

export async function lockTimesheetWeekAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const authorization = await getPermittedDashboardAuthorization("time.lock");
  if (!authorization) return { success: false, message: "You do not have permission to lock timesheets." };
  const workspaceId = authorization.workspaceId;
  const actorId = authorization.principal.user.id;
  const parsed = lockWeekSchema.safeParse({ weekStart: formData.get("weekStart") });
  if (!parsed.success) return { success: false, message: "Select a valid week." };
  const requestedWeek = startOfWeek(parseWorkDate(parsed.data.weekStart), { weekStartsOn: 1 });
  try {
    await prisma.$transaction(async (transaction) => {
      const weekStart = await lockTimesheetWeek(transaction, workspaceId, requestedWeek);
      await transaction.timesheetLock.upsert({
        where: { ownerId_weekStart: { ownerId: workspaceId, weekStart } },
        create: { lockedById: actorId, ownerId: workspaceId, weekStart },
        update: { lockedAt: new Date(), lockedById: actorId },
      });
    });
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(error, "The week could not be locked. Please try again.", "lock week"),
    };
  }
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/time-tracking");
  return { success: true, message: "Week locked for payroll." };
}

export async function unlockTimesheetWeekAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const authorization = await getPermittedDashboardAuthorization("time.lock");
  if (!authorization) return { success: false, message: "You do not have permission to unlock timesheets." };
  const workspaceId = authorization.workspaceId;
  const parsed = lockWeekSchema.safeParse({ weekStart: formData.get("weekStart") });
  if (!parsed.success) return { success: false, message: "Select a valid week." };
  const requestedWeek = startOfWeek(parseWorkDate(parsed.data.weekStart), { weekStartsOn: 1 });
  let unlocked = 0;
  try {
    unlocked = await prisma.$transaction(async (transaction) => {
      const weekStart = await lockTimesheetWeek(transaction, workspaceId, requestedWeek);
      const result = await transaction.timesheetLock.deleteMany({ where: { ownerId: workspaceId, weekStart } });
      return result.count;
    });
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(error, "The week could not be unlocked. Please try again.", "unlock week"),
    };
  }
  if (unlocked !== 1) return { success: false, message: "This week is not locked." };
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/time-tracking");
  return { success: true, message: "Week unlocked. Changes are allowed again." };
}
