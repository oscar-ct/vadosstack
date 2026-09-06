"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { format, subDays } from "date-fns";
import { z } from "zod";

import { normalizePhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, getRateLimitIp } from "@/lib/rate-limit";

import { createHash, randomBytes } from "node:crypto";

export type EmployeePortalState = {
  success: boolean;
  message: string;
};

const employeeSessionCookie = "employee-time-session";
const employeeSessionPath = "/employee-portal";
const EMPLOYEE_SESSION_TTL_SECONDS = 60 * 60 * 12;
const EMPLOYEE_LOGIN_RATE_LIMIT_MESSAGE = "Too many attempts. Please wait 15 minutes and try again.";

const idSchema = z.string().trim().min(1).max(64);
const timeSchema = z
  .string()
  .trim()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time.");
const workDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid work date.")
  .refine((value) => {
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && format(date, "yyyy-MM-dd") === value;
  }, "Enter a valid work date.")
  .refine((value) => {
    const earliest = format(subDays(new Date(), 90), "yyyy-MM-dd");
    const latest = format(new Date(), "yyyy-MM-dd");
    return value >= earliest && value <= latest;
  }, "Work date must be within the last 90 days and cannot be in the future.");

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
const checkboxBoolean = z.preprocess((value) => value === "true" || value === true, z.boolean());

const timeEntrySchema = z.object({
  jobId: z.string().trim().max(64).optional(),
  workedOn: workDateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  deductLunch: checkboxBoolean,
  lunchMinutes: z.coerce.number().int("Lunch must be a whole number of minutes.").min(0).max(240),
  notes: z.string().trim().max(1000, "Notes must be 1,000 characters or fewer.").optional(),
});

const updateTimeEntrySchema = timeEntrySchema.omit({ workedOn: true }).extend({
  entryId: idSchema,
});

const deleteTimeEntrySchema = z.object({
  entryId: idSchema,
});

const updateTimeEntryRequestSchema = updateTimeEntrySchema.extend({
  requestId: idSchema,
});

const deleteTimeEntryRequestSchema = z.object({
  requestId: idSchema,
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

function parseWorkDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "none" ? trimmed : null;
}

function formString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : undefined;
}

function getMinutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function calculateHours(input: { deductLunch?: boolean; endTime: string; lunchMinutes: number; startTime: string }) {
  const startMinutes = getMinutesFromTime(input.startTime);
  const endMinutes = getMinutesFromTime(input.endTime);
  const lunchMinutes = input.deductLunch === false ? 0 : input.lunchMinutes;
  const workedMinutes = endMinutes - startMinutes - lunchMinutes;

  if (endMinutes <= startMinutes) {
    throw new Error("End time must be later than start time.");
  }

  if (workedMinutes <= 0) {
    throw new Error("Worked time must be greater than 0 after lunch is deducted.");
  }

  return {
    hours: (workedMinutes / 60).toFixed(2),
    lunchMinutes,
  };
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
    throw new Error("Select a job from your account.");
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

  let totals: ReturnType<typeof calculateHours>;
  let jobId: string | null;

  try {
    totals = calculateHours(parsed.data);
    jobId = await validateOptionalJob(employee.ownerId, parsed.data.jobId);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Check the time entry details.",
    };
  }

  const workedOn = parseWorkDate(parsed.data.workedOn);
  const duplicateRequest = await prisma.timeEntryRequest.findFirst({
    where: {
      action: "Create",
      employeeId: employee.id,
      ownerId: employee.ownerId,
      status: "Pending",
      workedOn,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
    },
    select: {
      id: true,
    },
  });

  if (duplicateRequest) {
    return {
      success: false,
      message: "An identical time request is already waiting for manager review.",
    };
  }

  try {
    await prisma.timeEntryRequest.create({
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
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        message: "An identical time request is already waiting for manager review.",
      };
    }
    throw error;
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

  let totals: ReturnType<typeof calculateHours>;
  let jobId: string | null;

  try {
    totals = calculateHours(parsed.data);
    jobId = await validateOptionalJob(employee.ownerId, parsed.data.jobId);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Check the time entry details.",
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

  const pendingRequest = await prisma.timeEntryRequest.findFirst({
    where: {
      timeEntryId: entry.id,
      employeeId: employee.id,
      ownerId: employee.ownerId,
      status: "Pending",
    },
    select: {
      id: true,
    },
  });

  if (pendingRequest) {
    return {
      success: false,
      message: "A change for this time entry is already waiting for manager review.",
    };
  }

  try {
    await prisma.timeEntryRequest.create({
      data: {
        ownerId: employee.ownerId,
        employeeId: employee.id,
        timeEntryId: parsed.data.entryId,
        jobId,
        action: "Update",
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
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        message: "A change for this time entry is already waiting for manager review.",
      };
    }
    throw error;
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

  const pendingRequest = await prisma.timeEntryRequest.findFirst({
    where: {
      timeEntryId: entry.id,
      employeeId: employee.id,
      ownerId: employee.ownerId,
      status: "Pending",
    },
    select: {
      id: true,
    },
  });

  if (pendingRequest) {
    return {
      success: false,
      message: "A change for this time entry is already waiting for manager review.",
    };
  }

  try {
    await prisma.timeEntryRequest.create({
      data: {
        ownerId: employee.ownerId,
        employeeId: employee.id,
        timeEntryId: parsed.data.entryId,
        jobId: entry.jobId,
        action: "Delete",
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
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        message: "A change for this time entry is already waiting for manager review.",
      };
    }
    throw error;
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

  let totals: ReturnType<typeof calculateHours>;
  let jobId: string | null;

  try {
    totals = calculateHours(parsed.data);
    jobId = await validateOptionalJob(employee.ownerId, parsed.data.jobId);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Check the time request details.",
    };
  }

  const updated = await prisma.timeEntryRequest.updateMany({
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

  if (updated.count !== 1) {
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

  await prisma.timeEntryRequest.deleteMany({
    where: {
      id: parsed.data.requestId,
      employeeId: employee.id,
      ownerId: employee.ownerId,
      status: "Pending",
    },
  });

  revalidatePath("/employee-portal/timesheet");
  revalidatePath("/dashboard/time-tracking");
  revalidatePath("/dashboard/overview");

  return {
    success: true,
    message: "Request canceled.",
  };
}
