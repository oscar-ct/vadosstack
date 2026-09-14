"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { z } from "zod";

import { normalizePhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, getRateLimitIp } from "@/lib/rate-limit";
import { getSafeTimeEntryErrorMessage, TimeEntryUserError } from "@/lib/time-entry-errors";
import {
  calculateShift,
  employeeWorkDateSchema,
  parseWorkDate,
  timeEntryFieldsSchema,
  timeEntryIdSchema,
} from "@/lib/time-entry-rules";
import { assertTimeEntryAvailable, assertTimesheetUnlocked } from "@/lib/time-entry-server";

import { createHash, randomBytes } from "node:crypto";

export type EmployeePortalState = {
  success: boolean;
  message: string;
};

const employeeSessionCookie = "employee-time-session";
const employeeSessionPath = "/employee-portal";
const EMPLOYEE_SESSION_TTL_SECONDS = 60 * 60 * 12;
const EMPLOYEE_LOGIN_RATE_LIMIT_MESSAGE = "Too many attempts. Please wait 15 minutes and try again.";

const loginSchema = z.object({
  employeeNumber: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Enter your 4-digit employee ID."),
  phone: z
    .string()
    .trim()
    .refine((value) => normalizePhoneNumber(value).length === 10, "Enter a 10-digit phone number."),
});
const timeEntrySchema = timeEntryFieldsSchema.extend({ workedOn: employeeWorkDateSchema });

const updateTimeEntrySchema = timeEntrySchema.omit({ workedOn: true }).extend({
  entryId: timeEntryIdSchema,
});

const deleteTimeEntrySchema = z.object({
  entryId: timeEntryIdSchema,
});

const updateTimeEntryRequestSchema = updateTimeEntrySchema.extend({
  requestId: timeEntryIdSchema,
});

const deleteTimeEntryRequestSchema = z.object({
  requestId: timeEntryIdSchema,
});

function hashEmployeeSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createPendingRequestKey(parts: string[]) {
  return createHash("sha256").update(parts.join(":"), "utf8").digest("hex");
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "none" ? trimmed : null;
}

function formString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : undefined;
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

export async function getEmployeePortalSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(employeeSessionCookie)?.value;

  if (!sessionToken) return null;

  const session = await prisma.employeeSession.findUnique({
    where: {
      tokenHash: hashEmployeeSessionToken(sessionToken),
    },
    include: {
      employee: true,
    },
  });

  if (
    !session ||
    session.expiresAt <= new Date() ||
    !session.employee.active ||
    session.employee.ownerId !== session.ownerId
  ) {
    return null;
  }

  return session.employee;
}

export async function employeeLoginAction(
  _previousState: EmployeePortalState,
  formData: FormData,
): Promise<EmployeePortalState> {
  const parsed = loginSchema.safeParse({
    employeeNumber: formData.get("employeeNumber"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check your phone and employee ID.",
    };
  }

  const submittedPhone = normalizePhoneNumber(parsed.data.phone);
  const ip = await getRateLimitIp();
  const [ipAllowed, phoneAllowed] = await Promise.all([
    consumeRateLimit("employee-login", ["ip", ip]),
    consumeRateLimit("employee-login", ["phone", submittedPhone]),
  ]);

  if (!ipAllowed || !phoneAllowed) {
    return {
      success: false,
      message: EMPLOYEE_LOGIN_RATE_LIMIT_MESSAGE,
    };
  }

  const employees = await prisma.employee.findMany({
    where: {
      active: true,
      employeeNumber: parsed.data.employeeNumber,
    },
    select: {
      id: true,
      ownerId: true,
      phone: true,
    },
  });
  const matchingEmployees = employees.filter((employee) => normalizePhoneNumber(employee.phone) === submittedPhone);
  const employee = matchingEmployees.length === 1 ? matchingEmployees[0] : null;

  if (!employee) {
    return {
      success: false,
      message: "We could not match that phone number and employee ID.",
    };
  }

  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EMPLOYEE_SESSION_TTL_SECONDS * 1000);

  await prisma.$transaction([
    prisma.employeeSession.deleteMany({
      where: {
        employeeId: employee.id,
        expiresAt: {
          lt: new Date(),
        },
      },
    }),
    prisma.employeeSession.create({
      data: {
        tokenHash: hashEmployeeSessionToken(sessionToken),
        employeeId: employee.id,
        ownerId: employee.ownerId,
        expiresAt,
      },
    }),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(employeeSessionCookie, sessionToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: employeeSessionPath,
    maxAge: EMPLOYEE_SESSION_TTL_SECONDS,
  });

  redirect("/employee-portal/timesheet");
}

export async function employeeLogoutAction() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(employeeSessionCookie)?.value;

  if (sessionToken) {
    await prisma.employeeSession.deleteMany({
      where: {
        tokenHash: hashEmployeeSessionToken(sessionToken),
      },
    });
  }

  cookieStore.delete({
    name: employeeSessionCookie,
    path: employeeSessionPath,
  });

  redirect("/employee-portal");
}

export async function disabledEmployeePortalAction(): Promise<EmployeePortalState> {
  return {
    success: false,
    message: "Employee management is only available from the dashboard.",
  };
}

export async function employeeCreateTimeEntryAction(
  _previousState: EmployeePortalState,
  formData: FormData,
): Promise<EmployeePortalState> {
  const employee = await getEmployeePortalSession();

  if (!employee) {
    return {
      success: false,
      message: "Sign in with your employee phone and ID first.",
    };
  }

  const parsed = timeEntrySchema.safeParse({
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

  let totals: ReturnType<typeof calculateShift>;
  let jobId: string | null;

  try {
    totals = calculateShift(parsed.data);
    jobId = await validateOptionalJob(employee.ownerId, parsed.data.jobId);
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(error, "Check the time entry details.", "validate employee time entry"),
    };
  }

  const workedOn = parseWorkDate(parsed.data.workedOn);
  try {
    await prisma.$transaction(async (transaction) => {
      await assertTimesheetUnlocked(transaction, employee.ownerId, workedOn);
      await assertTimeEntryAvailable(transaction, {
        employeeId: employee.id,
        endTime: parsed.data.endTime,
        hours: Number(totals.hours),
        ownerId: employee.ownerId,
        startTime: parsed.data.startTime,
        workedOn,
      });
      const duplicateRequest = await transaction.timeEntryRequest.findFirst({
        where: {
          action: "Create",
          employeeId: employee.id,
          ownerId: employee.ownerId,
          status: "Pending",
          workedOn,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
        },
        select: { id: true },
      });
      if (duplicateRequest) {
        throw new TimeEntryUserError("An identical time request is already waiting for manager review.");
      }
      await transaction.timeEntryRequest.create({
        data: {
          ownerId: employee.ownerId,
          employeeId: employee.id,
          jobId,
          action: "Create",
          pendingKey: createPendingRequestKey([
            "create",
            employee.id,
            parsed.data.workedOn,
            parsed.data.startTime,
            parsed.data.endTime,
          ]),
          workedOn,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          deductLunch: parsed.data.deductLunch !== false,
          lunchMinutes: totals.lunchMinutes,
          hours: totals.hours,
          notes: emptyToNull(parsed.data.notes),
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        message: "An identical time request is already waiting for manager review.",
      };
    }
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(error, "This shift cannot be submitted. Please try again.", "submit shift"),
    };
  }

  revalidatePath("/employee-portal/timesheet");
  revalidatePath("/dashboard/time-tracking");
  revalidatePath("/dashboard/overview");

  return {
    success: true,
    message: "Hours submitted for manager review.",
  };
}

export async function employeeUpdateTimeEntryAction(
  _previousState: EmployeePortalState,
  formData: FormData,
): Promise<EmployeePortalState> {
  const employee = await getEmployeePortalSession();

  if (!employee) {
    return {
      success: false,
      message: "Sign in with your employee phone and ID first.",
    };
  }

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

  let totals: ReturnType<typeof calculateShift>;
  let jobId: string | null;

  try {
    totals = calculateShift(parsed.data);
    jobId = await validateOptionalJob(employee.ownerId, parsed.data.jobId);
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(error, "Check the time entry details.", "validate employee shift update"),
    };
  }

  const entry = await prisma.timeEntry.findUnique({
    where: {
      id_ownerId: {
        id: parsed.data.entryId,
        ownerId: employee.ownerId,
      },
    },
  });

  if (!entry || entry.employeeId !== employee.id) {
    return {
      success: false,
      message: "This time entry is no longer available.",
    };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await assertTimesheetUnlocked(transaction, employee.ownerId, entry.workedOn);
      await assertTimeEntryAvailable(transaction, {
        employeeId: employee.id,
        endTime: parsed.data.endTime,
        excludeEntryId: entry.id,
        hours: Number(totals.hours),
        ownerId: employee.ownerId,
        startTime: parsed.data.startTime,
        workedOn: entry.workedOn,
      });
      const pendingRequest = await transaction.timeEntryRequest.findFirst({
        where: {
          timeEntryId: entry.id,
          employeeId: employee.id,
          ownerId: employee.ownerId,
          status: "Pending",
        },
        select: { id: true },
      });
      if (pendingRequest) {
        throw new TimeEntryUserError("A change for this time entry is already waiting for manager review.");
      }
      await transaction.timeEntryRequest.create({
        data: {
          ownerId: employee.ownerId,
          employeeId: employee.id,
          timeEntryId: parsed.data.entryId,
          jobId,
          action: "Update",
          baseEntryUpdatedAt: entry.updatedAt,
          pendingKey: createPendingRequestKey(["entry", entry.id]),
          workedOn: entry.workedOn,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          deductLunch: parsed.data.deductLunch !== false,
          lunchMinutes: totals.lunchMinutes,
          hours: totals.hours,
          notes: emptyToNull(parsed.data.notes),
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        message: "A change for this time entry is already waiting for manager review.",
      };
    }
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(
        error,
        "This shift cannot be submitted. Please try again.",
        "submit shift update",
      ),
    };
  }

  revalidatePath("/employee-portal/timesheet");
  revalidatePath("/dashboard/time-tracking");
  revalidatePath("/dashboard/overview");

  return {
    success: true,
    message: "Update submitted for manager review.",
  };
}

export async function employeeDeleteTimeEntryAction(
  _previousState: EmployeePortalState,
  formData: FormData,
): Promise<EmployeePortalState> {
  const employee = await getEmployeePortalSession();

  if (!employee) {
    return {
      success: false,
      message: "Sign in with your employee phone and ID first.",
    };
  }

  const parsed = deleteTimeEntrySchema.safeParse({
    entryId: formData.get("entryId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select a time entry and try again.",
    };
  }

  const entry = await prisma.timeEntry.findUnique({
    where: {
      id_ownerId: {
        id: parsed.data.entryId,
        ownerId: employee.ownerId,
      },
    },
  });

  if (!entry || entry.employeeId !== employee.id) {
    return {
      success: false,
      message: "This time entry is no longer available.",
    };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await assertTimesheetUnlocked(transaction, employee.ownerId, entry.workedOn);
      const pendingRequest = await transaction.timeEntryRequest.findFirst({
        where: {
          timeEntryId: entry.id,
          employeeId: employee.id,
          ownerId: employee.ownerId,
          status: "Pending",
        },
        select: { id: true },
      });
      if (pendingRequest) {
        throw new TimeEntryUserError("A change for this time entry is already waiting for manager review.");
      }
      await transaction.timeEntryRequest.create({
        data: {
          ownerId: employee.ownerId,
          employeeId: employee.id,
          timeEntryId: parsed.data.entryId,
          jobId: entry.jobId,
          action: "Delete",
          baseEntryUpdatedAt: entry.updatedAt,
          pendingKey: createPendingRequestKey(["entry", entry.id]),
          workedOn: entry.workedOn,
          startTime: entry.startTime,
          endTime: entry.endTime,
          deductLunch: entry.deductLunch,
          lunchMinutes: entry.lunchMinutes,
          hours: entry.hours,
          notes: entry.notes,
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        message: "A change for this time entry is already waiting for manager review.",
      };
    }
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(
        error,
        "This shift cannot be deleted. Please try again.",
        "request deletion",
      ),
    };
  }

  revalidatePath("/employee-portal/timesheet");
  revalidatePath("/dashboard/time-tracking");
  revalidatePath("/dashboard/overview");

  return {
    success: true,
    message: "Delete request submitted for manager review.",
  };
}

export async function employeeUpdateTimeEntryRequestAction(
  _previousState: EmployeePortalState,
  formData: FormData,
): Promise<EmployeePortalState> {
  const employee = await getEmployeePortalSession();

  if (!employee) {
    return {
      success: false,
      message: "Sign in with your employee phone and ID first.",
    };
  }

  const parsed = updateTimeEntryRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    entryId: formData.get("entryId") ?? "pending-request",
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
      message: parsed.error.issues[0]?.message ?? "Check the time request and try again.",
    };
  }

  const request = await prisma.timeEntryRequest.findFirst({
    where: {
      id: parsed.data.requestId,
      employeeId: employee.id,
      ownerId: employee.ownerId,
      status: "Pending",
    },
  });

  if (!request || request.action === "Delete") {
    return {
      success: false,
      message: "This request can no longer be edited.",
    };
  }
  if (!request.workedOn) {
    return { success: false, message: "This request is missing its work date." };
  }
  const requestWorkedOn = request.workedOn;

  let totals: ReturnType<typeof calculateShift>;
  let jobId: string | null;

  try {
    totals = calculateShift(parsed.data);
    jobId = await validateOptionalJob(employee.ownerId, parsed.data.jobId);
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(error, "Check the time request details.", "validate time request update"),
    };
  }

  let updated = 0;
  try {
    updated = await prisma.$transaction(async (transaction) => {
      await assertTimesheetUnlocked(transaction, employee.ownerId, requestWorkedOn);
      await assertTimeEntryAvailable(transaction, {
        employeeId: employee.id,
        endTime: parsed.data.endTime,
        excludeEntryId: request.action === "Update" ? (request.timeEntryId ?? undefined) : undefined,
        hours: Number(totals.hours),
        ownerId: employee.ownerId,
        startTime: parsed.data.startTime,
        workedOn: requestWorkedOn,
      });
      const result = await transaction.timeEntryRequest.updateMany({
        where: {
          id: request.id,
          employeeId: employee.id,
          ownerId: employee.ownerId,
          status: "Pending",
        },
        data: {
          startTime: parsed.data.startTime,
          jobId,
          endTime: parsed.data.endTime,
          deductLunch: parsed.data.deductLunch !== false,
          lunchMinutes: totals.lunchMinutes,
          hours: totals.hours,
          notes: emptyToNull(parsed.data.notes),
        },
      });
      return result.count;
    });
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(
        error,
        "Request could not be updated. Please try again.",
        "update time request",
      ),
    };
  }

  if (updated !== 1) {
    return {
      success: false,
      message: "This request can no longer be edited.",
    };
  }

  revalidatePath("/employee-portal/timesheet");
  revalidatePath("/dashboard/time-tracking");
  revalidatePath("/dashboard/overview");

  return {
    success: true,
    message: "Request updated.",
  };
}

export async function employeeDeleteTimeEntryRequestAction(
  _previousState: EmployeePortalState,
  formData: FormData,
): Promise<EmployeePortalState> {
  const employee = await getEmployeePortalSession();

  if (!employee) {
    return {
      success: false,
      message: "Sign in with your employee phone and ID first.",
    };
  }

  const parsed = deleteTimeEntryRequestSchema.safeParse({
    requestId: formData.get("requestId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select a request and try again.",
    };
  }

  try {
    await prisma.timeEntryRequest.deleteMany({
      where: {
        id: parsed.data.requestId,
        employeeId: employee.id,
        ownerId: employee.ownerId,
        status: "Pending",
      },
    });
  } catch (error) {
    return {
      success: false,
      message: getSafeTimeEntryErrorMessage(
        error,
        "The request could not be canceled. Please try again.",
        "cancel request",
      ),
    };
  }

  revalidatePath("/employee-portal/timesheet");
  revalidatePath("/dashboard/time-tracking");
  revalidatePath("/dashboard/overview");

  return {
    success: true,
    message: "Request canceled.",
  };
}
