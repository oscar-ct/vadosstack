"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { isValidOptionalPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

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
const checkboxBoolean = z.preprocess((value) => value === "true" || value === true, z.boolean());

const createTimeEntrySchema = z.object({
  employeeId: initialRequiredString,
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

const updateTimeEntrySchema = z.object({
  entryId: initialRequiredString,
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

const deleteTimeEntrySchema = z.object({
  entryId: initialRequiredString,
});

const reviewTimeEntryRequestSchema = z.object({
  requestId: initialRequiredString,
});

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

function phoneToNull(value?: string) {
  const phone = normalizePhoneNumber(value);
  return phone || null;
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

  throw new Error("Could not generate a unique employee number. Try again.");
}

export async function createEmployeeAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to add an employee.",
    };
  }

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
        ownerId: currentUser.id,
        employeeNumber: await generateEmployeeNumber(currentUser.id),
        name: parsed.data.name,
        email: emptyToNull(parsed.data.email),
        phone: phoneToNull(parsed.data.phone),
      },
    });
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Employee could not be added.",
    };
  }

  revalidatePath("/dashboard/time-tracking");

  return {
    success: true,
    message: "Employee added.",
  };
}

export async function updateEmployeeAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to update an employee.",
    };
  }

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
      ownerId: currentUser.id,
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
        ownerId: currentUser.id,
      },
    },
    data: {
      employeeNumber: parsed.data.employeeNumber,
      name: parsed.data.name,
      email: emptyToNull(parsed.data.email),
      phone: phoneToNull(parsed.data.phone),
    },
  });

  revalidatePath("/dashboard/time-tracking");

  return {
    success: true,
    message: "Employee updated.",
  };
}

export async function deleteEmployeeAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to delete an employee.",
    };
  }

  const parsed = deleteEmployeeSchema.safeParse({
    employeeId: formData.get("employeeId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select an employee and try again.",
    };
  }

  await prisma.employee.delete({
    where: {
      id_ownerId: {
        id: parsed.data.employeeId,
        ownerId: currentUser.id,
      },
    },
  });

  revalidatePath("/dashboard/time-tracking");

  return {
    success: true,
    message: "Employee deleted.",
  };
}

export async function createTimeEntryAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to log hours.",
    };
  }

  const parsed = createTimeEntrySchema.safeParse({
    employeeId: formData.get("employeeId"),
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

  const employee = await prisma.employee.findUnique({
    where: {
      id_ownerId: {
        id: parsed.data.employeeId,
        ownerId: currentUser.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (!employee) {
    return {
      success: false,
      message: "Select an employee from your account.",
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

  await prisma.timeEntry.create({
    data: {
      ownerId: currentUser.id,
      employeeId: parsed.data.employeeId,
      workedOn: parseWorkDate(parsed.data.workedOn),
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      deductLunch: parsed.data.deductLunch !== false,
      lunchMinutes: totals.lunchMinutes,
      hours: totals.hours,
      notes: emptyToNull(parsed.data.notes),
    },
  });

  revalidatePath("/dashboard/time-tracking");

  return {
    success: true,
    message: "Hours logged.",
  };
}

export async function updateTimeEntryAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to update hours.",
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

  await prisma.timeEntry.update({
    where: {
      id_ownerId: {
        id: parsed.data.entryId,
        ownerId: currentUser.id,
      },
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

  revalidatePath("/dashboard/time-tracking");

  return {
    success: true,
    message: "Hours updated.",
  };
}

export async function deleteTimeEntryAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to delete hours.",
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

  await prisma.timeEntry.delete({
    where: {
      id_ownerId: {
        id: parsed.data.entryId,
        ownerId: currentUser.id,
      },
    },
  });

  revalidatePath("/dashboard/time-tracking");

  return {
    success: true,
    message: "Hours deleted.",
  };
}

export async function approveTimeEntryRequestAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to approve time changes.",
    };
  }

  const parsed = reviewTimeEntryRequestSchema.safeParse({
    requestId: formData.get("requestId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select a request and try again.",
    };
  }

  const request = await prisma.timeEntryRequest.findUnique({
    where: {
      id: parsed.data.requestId,
    },
  });

  if (!request || request.ownerId !== currentUser.id || request.status !== "Pending") {
    return {
      success: false,
      message: "This request is no longer available.",
    };
  }

  if (request.action === "Create") {
    if (!request.workedOn || !request.startTime || !request.endTime || !request.hours) {
      return {
        success: false,
        message: "This request is missing time details.",
      };
    }

    await prisma.timeEntry.create({
      data: {
        ownerId: request.ownerId,
        employeeId: request.employeeId,
        workedOn: request.workedOn,
        startTime: request.startTime,
        endTime: request.endTime,
        deductLunch: request.deductLunch,
        lunchMinutes: request.lunchMinutes,
        hours: request.hours,
        notes: request.notes,
      },
    });
  }

  if (request.action === "Update") {
    if (!request.timeEntryId || !request.startTime || !request.endTime || !request.hours) {
      return {
        success: false,
        message: "This request is missing time details.",
      };
    }

    await prisma.timeEntry.updateMany({
      where: {
        id: request.timeEntryId,
        employeeId: request.employeeId,
        ownerId: request.ownerId,
      },
      data: {
        startTime: request.startTime,
        endTime: request.endTime,
        deductLunch: request.deductLunch,
        lunchMinutes: request.lunchMinutes,
        hours: request.hours,
        notes: request.notes,
      },
    });
  }

  if (request.action === "Delete") {
    if (!request.timeEntryId) {
      return {
        success: false,
        message: "This request is missing the time entry to delete.",
      };
    }

    await prisma.timeEntry.deleteMany({
      where: {
        id: request.timeEntryId,
        employeeId: request.employeeId,
        ownerId: request.ownerId,
      },
    });
  }

  await prisma.timeEntryRequest.update({
    where: {
      id: request.id,
    },
    data: {
      reviewedAt: new Date(),
      status: "Approved",
    },
  });

  revalidatePath("/dashboard/time-tracking");
  revalidatePath("/employee-time-tracking/time");
  revalidatePath("/dashboard/overview");

  return {
    success: true,
    message: "Request approved.",
  };
}

export async function rejectTimeEntryRequestAction(
  _previousState: TimeTrackingMutationState,
  formData: FormData,
): Promise<TimeTrackingMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to reject time changes.",
    };
  }

  const parsed = reviewTimeEntryRequestSchema.safeParse({
    requestId: formData.get("requestId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select a request and try again.",
    };
  }

  await prisma.timeEntryRequest.updateMany({
    where: {
      id: parsed.data.requestId,
      ownerId: currentUser.id,
      status: "Pending",
    },
    data: {
      reviewedAt: new Date(),
      status: "Rejected",
    },
  });

  revalidatePath("/dashboard/time-tracking");
  revalidatePath("/employee-time-tracking/time");
  revalidatePath("/dashboard/overview");

  return {
    success: true,
    message: "Request rejected.",
  };
}
