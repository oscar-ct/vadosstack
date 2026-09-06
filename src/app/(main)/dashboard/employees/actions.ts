"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { isValidOptionalPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export type EmployeeMutationState = {
  success: boolean;
  message: string;
};

const employmentTypes = ["Employee", "Contractor", "Seasonal", "Temporary"] as const;
const payTypes = ["Hourly", "Salary", "Day Rate", "Piece Rate"] as const;

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || z.string().email().safeParse(value).success, "Enter a valid email.");

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .refine(isValidOptionalPhoneNumber, "Phone number must be 10 digits.")
  .transform((value) => normalizePhoneNumber(value) || undefined);

const optionalMoney = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => !value || (Number.isFinite(Number(value)) && Number(value) >= 0),
    "Enter a valid non-negative pay amount.",
  )
  .transform((value) => (value ? Number(value).toFixed(2) : undefined));

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? new Date(`${value}T12:00:00`) : undefined))
  .refine((value) => !value || !Number.isNaN(value.getTime()), "Enter a valid date.");

const employeeFieldsSchema = z.object({
  name: z.string().trim().min(1, "Employee name is required."),
  employeeNumber: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Employee number must be exactly 4 digits.")
    .optional(),
  email: optionalEmail,
  phone: optionalPhone,
  jobTitle: optionalText,
  department: optionalText,
  employmentType: z.enum(employmentTypes),
  payType: z.enum(payTypes),
  payRate: optionalMoney,
  startDate: optionalDate,
  endDate: optionalDate,
  address: optionalText,
  emergencyName: optionalText,
  emergencyPhone: optionalPhone,
  emergencyRelation: optionalText,
  notes: optionalText,
  active: z.preprocess((value) => value === "true" || value === "on" || value === true, z.boolean()),
});

function validateEmployeeDates(employee: { endDate?: Date; startDate?: Date }, context: z.RefinementCtx) {
  if (employee.startDate && employee.endDate && employee.endDate < employee.startDate) {
    context.addIssue({
      code: "custom",
      message: "End date cannot be earlier than the start date.",
      path: ["endDate"],
    });
  }
}

const employeeSchema = employeeFieldsSchema.superRefine(validateEmployeeDates);

const updateEmployeeSchema = employeeFieldsSchema
  .extend({
    employeeId: z.string().trim().min(1, "Employee is required."),
    employeeNumber: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "Employee number must be exactly 4 digits."),
  })
  .superRefine(validateEmployeeDates);

const deleteEmployeeSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee is required."),
});

const updateEmployeeStatusSchema = deleteEmployeeSchema.extend({
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

function emptyToNull(value?: string) {
  const text = value?.trim();
  return text ? text : null;
}

function getEmployeePayload(formData: FormData) {
  return {
    name: formData.get("name"),
    employeeNumber: formData.get("employeeNumber") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    jobTitle: formData.get("jobTitle") || undefined,
    department: formData.get("department") || undefined,
    employmentType: formData.get("employmentType") || "Employee",
    payType: formData.get("payType") || "Hourly",
    payRate: formData.get("payRate") || undefined,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    address: formData.get("address") || undefined,
    emergencyName: formData.get("emergencyName") || undefined,
    emergencyPhone: formData.get("emergencyPhone") || undefined,
    emergencyRelation: formData.get("emergencyRelation") || undefined,
    notes: formData.get("notes") || undefined,
    active: formData.get("active") ?? "false",
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

async function employeeNumberExists(ownerId: string, employeeNumber: string, employeeId?: string) {
  return prisma.employee.findFirst({
    where: {
      ownerId,
      employeeNumber,
      ...(employeeId
        ? {
            NOT: {
              id: employeeId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });
}

function revalidateEmployeePaths() {
  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard/time-tracking");
}

export async function createEmployeeAction(
  _previousState: EmployeeMutationState,
  formData: FormData,
): Promise<EmployeeMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to add an employee." };
  }

  const parsed = employeeSchema.safeParse(getEmployeePayload(formData));

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the employee details and try again." };
  }

  const employeeNumber = parsed.data.employeeNumber ?? (await generateEmployeeNumber(currentUser.id));

  if (await employeeNumberExists(currentUser.id, employeeNumber)) {
    return { success: false, message: "That employee number is already in use." };
  }

  await prisma.employee.create({
    data: {
      ownerId: currentUser.id,
      employeeNumber,
      name: parsed.data.name,
      email: emptyToNull(parsed.data.email),
      phone: emptyToNull(parsed.data.phone),
      jobTitle: emptyToNull(parsed.data.jobTitle),
      department: emptyToNull(parsed.data.department),
      employmentType: parsed.data.employmentType,
      payType: parsed.data.payType,
      payRate: parsed.data.payRate ?? null,
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
      address: emptyToNull(parsed.data.address),
      emergencyName: emptyToNull(parsed.data.emergencyName),
      emergencyPhone: emptyToNull(parsed.data.emergencyPhone),
      emergencyRelation: emptyToNull(parsed.data.emergencyRelation),
      notes: emptyToNull(parsed.data.notes),
      active: parsed.data.active,
    },
  });

  revalidateEmployeePaths();

  return { success: true, message: "Employee added." };
}

export async function updateEmployeeAction(
  _previousState: EmployeeMutationState,
  formData: FormData,
): Promise<EmployeeMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to update an employee." };
  }

  const parsed = updateEmployeeSchema.safeParse({
    employeeId: formData.get("employeeId"),
    ...getEmployeePayload(formData),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the employee details and try again." };
  }

  if (await employeeNumberExists(currentUser.id, parsed.data.employeeNumber, parsed.data.employeeId)) {
    return { success: false, message: "That employee number is already in use." };
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
      phone: emptyToNull(parsed.data.phone),
      jobTitle: emptyToNull(parsed.data.jobTitle),
      department: emptyToNull(parsed.data.department),
      employmentType: parsed.data.employmentType,
      payType: parsed.data.payType,
      payRate: parsed.data.payRate ?? null,
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
      address: emptyToNull(parsed.data.address),
      emergencyName: emptyToNull(parsed.data.emergencyName),
      emergencyPhone: emptyToNull(parsed.data.emergencyPhone),
      emergencyRelation: emptyToNull(parsed.data.emergencyRelation),
      notes: emptyToNull(parsed.data.notes),
      active: parsed.data.active,
    },
  });

  revalidateEmployeePaths();

  return { success: true, message: "Employee updated." };
}

export async function updateEmployeeStatusAction(
  _previousState: EmployeeMutationState,
  formData: FormData,
): Promise<EmployeeMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to update an employee." };
  }

  const parsed = updateEmployeeStatusSchema.safeParse({
    employeeId: formData.get("employeeId"),
    active: formData.get("active"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Select an employee and try again." };
  }

  await prisma.employee.update({
    where: {
      id_ownerId: {
        id: parsed.data.employeeId,
        ownerId: currentUser.id,
      },
    },
    data: {
      active: parsed.data.active,
    },
  });

  revalidateEmployeePaths();

  return {
    success: true,
    message: parsed.data.active ? "Employee marked active." : "Employee marked inactive.",
  };
}

export async function deleteEmployeeAction(
  _previousState: EmployeeMutationState,
  formData: FormData,
): Promise<EmployeeMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to delete an employee." };
  }

  const parsed = deleteEmployeeSchema.safeParse({
    employeeId: formData.get("employeeId"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Select an employee and try again." };
  }

  const result = await prisma.employee.deleteMany({
    where: {
      id: parsed.data.employeeId,
      ownerId: currentUser.id,
      active: false,
    },
  });

  if (result.count === 0) {
    return { success: false, message: "Only inactive employees can be deleted." };
  }

  revalidateEmployeePaths();

  return { success: true, message: "Employee deleted." };
}
