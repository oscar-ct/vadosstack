"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { z } from "zod";

import { normalizePhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export type EmployeePortalState = {
  success: boolean;
  message: string;
};

const employeeSessionCookie = "employee-time-session";

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
  workedOn: z.string().trim().min(1, "Work date is required."),
  startTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Start time is required."),
  endTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "End time is required."),
  deductLunch: checkboxBoolean,
  lunchMinutes: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, "Lunch must be 0 minutes or more."),
  notes: z.string().trim().optional(),
});

const updateTimeEntrySchema = timeEntrySchema.omit({ workedOn: true }).extend({
  entryId: z.string().trim().min(1),
});

const deleteTimeEntrySchema = z.object({
  entryId: z.string().trim().min(1),
});

const updateTimeEntryRequestSchema = updateTimeEntrySchema.extend({
  requestId: z.string().trim().min(1),
});

const deleteTimeEntryRequestSchema = z.object({
  requestId: z.string().trim().min(1),
});

function encodeSession(value: { employeeId: string; ownerId: string }) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeSession(value?: string) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

    if (typeof parsed?.employeeId === "string" && typeof parsed?.ownerId === "string") {
      return parsed as { employeeId: string; ownerId: string };
    }
  } catch {
    return null;
  }

  return null;
}

function parseWorkDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : undefined;
}

function getMinutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function calculateHours(input: { deductLunch?: boolean; endTime: string; lunchMinutes: string; startTime: string }) {
  const startMinutes = getMinutesFromTime(input.startTime);
  const endMinutes = getMinutesFromTime(input.endTime);
  const lunchMinutes = input.deductLunch === false ? 0 : Number(input.lunchMinutes || 0);
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

export async function getEmployeePortalSession() {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(employeeSessionCookie)?.value);

  if (!session) return null;

  const employee = await prisma.employee.findUnique({
    where: {
      id_ownerId: {
        id: session.employeeId,
        ownerId: session.ownerId,
      },
    },
  });

  return employee?.active ? employee : null;
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
  const employee = employees.find((employee) => normalizePhoneNumber(employee.phone) === submittedPhone);

  if (!employee) {
    return {
      success: false,
      message: "We could not match that phone number and employee ID.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(employeeSessionCookie, encodeSession({ employeeId: employee.id, ownerId: employee.ownerId }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/employee-time-tracking",
    maxAge: 60 * 60 * 12,
  });

  redirect("/employee-time-tracking/time");
}

export async function employeeLogoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(employeeSessionCookie);

  redirect("/employee-time-tracking");
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

  try {
    totals = calculateHours(parsed.data);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Check the start and end times.",
    };
  }

  await prisma.timeEntryRequest.create({
    data: {
      ownerId: employee.ownerId,
      employeeId: employee.id,
      action: "Create",
      workedOn: parseWorkDate(parsed.data.workedOn),
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      deductLunch: parsed.data.deductLunch !== false,
      lunchMinutes: totals.lunchMinutes,
      hours: totals.hours,
      notes: emptyToNull(parsed.data.notes),
    },
  });

  revalidatePath("/employee-time-tracking/time");
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

  try {
    totals = calculateHours(parsed.data);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Check the start and end times.",
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

  await prisma.timeEntryRequest.create({
    data: {
      ownerId: employee.ownerId,
      employeeId: employee.id,
      timeEntryId: parsed.data.entryId,
      action: "Update",
      workedOn: entry.workedOn,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      deductLunch: parsed.data.deductLunch !== false,
      lunchMinutes: totals.lunchMinutes,
      hours: totals.hours,
      notes: emptyToNull(parsed.data.notes),
    },
  });

  revalidatePath("/employee-time-tracking/time");
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

  await prisma.timeEntryRequest.create({
    data: {
      ownerId: employee.ownerId,
      employeeId: employee.id,
      timeEntryId: parsed.data.entryId,
      action: "Delete",
      workedOn: entry.workedOn,
      startTime: entry.startTime,
      endTime: entry.endTime,
      deductLunch: entry.deductLunch,
      lunchMinutes: entry.lunchMinutes,
      hours: entry.hours,
      notes: entry.notes,
    },
  });

  revalidatePath("/employee-time-tracking/time");
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

  try {
    totals = calculateHours(parsed.data);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Check the start and end times.",
    };
  }

  await prisma.timeEntryRequest.update({
    where: {
      id: request.id,
    },
    data: {
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      deductLunch: parsed.data.deductLunch !== false,
      lunchMinutes: totals.lunchMinutes,
      hours: totals.hours,
      notes: emptyToNull(parsed.data.notes),
    },
  });

  revalidatePath("/employee-time-tracking/time");
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

  revalidatePath("/employee-time-tracking/time");
  revalidatePath("/dashboard/time-tracking");
  revalidatePath("/dashboard/overview");

  return {
    success: true,
    message: "Request canceled.",
  };
}
