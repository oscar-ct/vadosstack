"use server";

import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import {
  calculateOutstandingBalance,
  deriveCustomerBillingStatus,
  deriveJobPaymentStatus,
} from "@/lib/customer-billing";
import { parseDateInput } from "@/lib/date-only";
import { normalizePhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { formatServiceAddress, getServiceAddressPayload, type ServiceAddressFields } from "@/lib/service-address";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

import { calculateSignedMaterialTotal, parseMaterials } from "./_components/materials";
import { parsePricingItems } from "./_components/pricing-items";

const jobStatuses = ["Unscheduled", "Scheduled", "Completed", "On Hold", "Cancelled"] as const;
const jobTypes = ["Residential", "Commercial"] as const;

export type JobMutationState = {
  success: boolean;
  message: string;
  redirectTo?: string;
};

const completeJobSchema = z.object({
  jobId: z.string().trim().min(1, "Job is required."),
});

const emptyToUndefined = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
};

export async function completeJobAction(
  _previousState: JobMutationState,
  formData: FormData,
): Promise<JobMutationState> {
  const authorization = await getPermittedDashboardAuthorization("jobs.complete");

  if (!authorization) {
    return { success: false, message: "You do not have permission to complete jobs." };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = completeJobSchema.safeParse({
    jobId: formData.get("jobId"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Select a job and try again." };
  }

  try {
    const job = await prisma.job.findUnique({
      where: {
        id_ownerId: {
          id: parsed.data.jobId,
          ownerId: workspaceId,
        },
      },
      select: {
        status: true,
      },
    });

    if (!job) {
      return { success: false, message: "Job could not be found." };
    }

    if (job.status === "Cancelled") {
      return { success: false, message: "A cancelled job cannot be marked complete." };
    }

    if (job.status === "Completed") {
      return { success: true, message: "Job is already complete." };
    }

    await prisma.job.update({
      where: {
        id_ownerId: {
          id: parsed.data.jobId,
          ownerId: workspaceId,
        },
      },
      data: {
        status: "Completed",
      },
    });
  } catch (error) {
    console.error("Job completion failed.", error);
    return {
      success: false,
      message: "Job could not be marked complete. Please try again.",
    };
  }

  await recordAuthorizationAuditEvent({
    workspaceId,
    actorUserId: authorization.principal.user.id,
    membershipId: authorization.membership.id,
    action: "job.complete",
    targetType: "Job",
    targetId: parsed.data.jobId,
  }).catch((error) => console.error("Job completion audit could not be saved.", error));

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/jobs");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, `/dashboard/jobs/${parsed.data.jobId}`);
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/overview");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/calendar");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/command-center");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/customers");

  return { success: true, message: "Job marked complete." };
}

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? new Date(value) : undefined))
  .refine((value) => !value || !Number.isNaN(value.getTime()), "Enter a valid job date.");

const optionalMoney = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid cost.")
  .transform((value) => (value ? value : undefined));

function normalizeMoney(value: string | undefined, fallback = "0.00") {
  const text = value?.trim() ?? "";
  if (!text) return fallback;

  const amount = Number(text);
  return Number.isFinite(amount) ? amount.toFixed(2) : fallback;
}

const materialsSchema = z.array(
  z.object({
    type: z.enum(["purchase", "return"]).optional(),
    description: z.string().trim().optional(),
    vendor: z.string().trim().optional(),
    purchaseDate: z.string().trim().optional(),
    quantity: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || (!Number.isNaN(Number(value)) && Number(value) > 0),
        "Enter a valid material quantity.",
      ),
    unit: z.string().trim().optional(),
    unitPrice: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid material unit price."),
    price: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid material amount."),
  }),
);

const laborItemsSchema = z.array(
  z.object({
    description: z.string().trim().optional(),
    quantity: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || (!Number.isNaN(Number(value)) && Number(value) > 0),
        "Enter a valid labor quantity.",
      ),
    unit: z.string().trim().optional(),
    unitPrice: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid labor unit price."),
    price: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid labor price."),
  }),
);

const measurementRoomsSchema = z.array(
  z.object({
    id: z.string().trim().optional(),
    name: z.string().trim().optional(),
    length: z.string().trim().optional(),
    width: z.string().trim().optional(),
    area: z.string().trim().optional(),
  }),
);

const jobSchema = z.object({
  customerId: z.string().trim().optional(),
  newCustomerName: z.string().trim().optional(),
  newCustomerEmail: z.string().trim().optional(),
  newCustomerPhone: z.string().trim().optional(),
  description: z.string().trim().min(1, "Job title is required."),
  serviceLocation: z.string().trim().optional(),
  serviceAddressLine1: z.string().trim().optional(),
  serviceAddressLine2: z.string().trim().optional(),
  serviceCity: z.string().trim().optional(),
  serviceState: z.string().trim().optional(),
  servicePostalCode: z.string().trim().optional(),
  dateBegin: optionalDate,
  dateEnd: optionalDate,
  estimatedCost: optionalMoney,
  laborItems: laborItemsSchema,
  jobType: z.enum(jobTypes).default("Residential"),
  measurementRooms: measurementRoomsSchema,
  materialTaxRate: optionalMoney,
  materials: materialsSchema,
  scope: z.string().trim().optional(),
  category: z.string().trim().min(1, "Job category is required."),
  status: z.enum(jobStatuses),
  pictures: z.array(z.string().trim().url("Enter valid picture URLs.")).max(20).optional(),
  notes: z.string().trim().optional(),
});

const createJobSchema = jobSchema.refine(
  (job) => !job.dateBegin || !job.dateEnd || job.dateEnd >= job.dateBegin,
  "Job date end must be after job date begin.",
);

const updateJobSchema = createJobSchema.and(
  z.object({
    id: z.string().trim().min(1, "Job is required."),
  }),
);

function getJobPayload(formData: FormData) {
  const serviceAddress = getServiceAddressPayload(formData);

  return {
    customerId: emptyToUndefined(formData.get("customerId")),
    newCustomerName: emptyToUndefined(formData.get("newCustomerName")),
    newCustomerEmail: emptyToUndefined(formData.get("newCustomerEmail")),
    newCustomerPhone: emptyToUndefined(formData.get("newCustomerPhone")),
    description: formData.get("description"),
    ...serviceAddress,
    dateBegin: emptyToUndefined(formData.get("dateBegin")),
    dateEnd: emptyToUndefined(formData.get("dateEnd")),
    estimatedCost: emptyToUndefined(formData.get("estimatedCost")),
    laborItems: parsePricingItems(String(formData.get("laborItems") ?? "")),
    jobType: formData.get("jobType") === "Commercial" ? "Commercial" : "Residential",
    measurementRooms: parseMeasurementRooms(String(formData.get("measurementRooms") ?? "")),
    materialTaxRate: emptyToUndefined(formData.get("materialTaxRate")),
    materials: parseMaterials(String(formData.get("materials") ?? "")),
    scope: emptyToUndefined(formData.get("scope")),
    category: formData.get("category"),
    status: formData.get("status"),
    pictures: String(formData.get("pictures") ?? "")
      .split(/\r?\n/)
      .map((picture) => picture.trim())
      .filter(Boolean),
    notes: emptyToUndefined(formData.get("notes")),
  };
}

function parseMeasurementRooms(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) return [];

    return parsed.map((room) => {
      const current = room && typeof room === "object" ? (room as Record<string, unknown>) : {};
      return {
        id: typeof current.id === "string" ? current.id : undefined,
        name: typeof current.name === "string" ? current.name : "",
        length: typeof current.length === "string" ? current.length : "",
        width: typeof current.width === "string" ? current.width : "",
        area: typeof current.area === "string" ? current.area : "",
      };
    });
  } catch {
    return [];
  }
}

function normalizeMeasurementRooms(
  rooms: Array<{ id?: string; name?: string; length?: string; width?: string; area?: string }>,
) {
  return rooms
    .map((room) => {
      const length = room.length?.trim() ?? "";
      const width = room.width?.trim() ?? "";
      const area = Number(length) * Number(width);

      return {
        id: room.id?.trim() || undefined,
        name: room.name?.trim() ?? "",
        length,
        width,
        area: Number.isFinite(area) && area > 0 ? area.toFixed(2) : (room.area?.trim() ?? ""),
      };
    })
    .filter((room) => room.name || room.length || room.width || room.area);
}

async function createCustomerForJob({
  email,
  name,
  ownerId,
  phone,
  serviceAddress,
  serviceLocation,
}: {
  email?: string;
  name?: string;
  ownerId: string;
  phone?: string;
  serviceAddress?: ServiceAddressFields;
  serviceLocation?: string;
}) {
  if (!name || !phone) {
    throw new Error("Enter a customer name and phone number before creating the job.");
  }

  const normalizedPhone = normalizePhoneNumber(phone);

  if (normalizedPhone.length !== 10) {
    throw new Error("Enter a valid 10-digit phone number before creating the job.");
  }

  const parsedEmail = email ? z.string().trim().email("Enter a valid customer email.").safeParse(email) : null;

  if (parsedEmail && !parsedEmail.success) {
    throw new Error(parsedEmail.error.issues[0]?.message ?? "Enter a valid customer email.");
  }

  const customerEmail = parsedEmail?.success ? parsedEmail.data : undefined;

  try {
    const existingCustomer = customerEmail
      ? await prisma.customer.findFirst({
          where: {
            email: customerEmail,
            ownerId,
          },
          select: {
            id: true,
          },
        })
      : null;

    if (existingCustomer) {
      throw new Error("A customer with that email already exists in your account. Select them from the customer list.");
    }

    const displayLocation = formatServiceAddress({ ...serviceAddress, serviceLocation });
    const address = displayLocation
      ? {
          label: "Service Location",
          line1: serviceAddress?.serviceAddressLine1 || displayLocation,
          line2: serviceAddress?.serviceAddressLine2 || null,
          city: serviceAddress?.serviceCity || null,
          state: serviceAddress?.serviceState || null,
          postalCode: serviceAddress?.servicePostalCode || null,
        }
      : undefined;

    return await prisma.customer.create({
      data: {
        ownerId,
        name,
        email: customerEmail,
        billingStatus: "No Balance",
        addresses: address
          ? {
              create: address,
            }
          : undefined,
        phoneNumbers: {
          create: {
            label: "Primary",
            value: normalizedPhone,
          },
        },
      },
      select: {
        id: true,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint failed")) {
      throw new Error("A customer with that email already exists in your account. Select them from the customer list.");
    }

    throw error;
  }
}

function normalizeMaterials(
  materials: Array<{
    description?: string;
    type?: "purchase" | "return";
    vendor?: string;
    purchaseDate?: string;
    quantity?: string;
    unit?: string;
    unitPrice?: string;
    price?: string;
  }>,
) {
  return materials
    .map((material) => ({
      description: material.description ?? "",
      type: material.type ?? "purchase",
      vendor: material.vendor ?? "",
      purchaseDate: material.purchaseDate ?? "",
      quantity: material.quantity ?? "",
      unit: material.unit ?? "",
      unitPrice: normalizeMoney(material.unitPrice, ""),
      price: normalizeMoney(material.price),
    }))
    .filter(
      (material) =>
        material.description.trim() ||
        material.type === "return" ||
        material.vendor.trim() ||
        material.purchaseDate.trim() ||
        material.quantity.trim() ||
        material.unit.trim() ||
        material.unitPrice.trim() ||
        (material.price.trim() && Number(material.price) !== 0),
    )
    .filter(
      (material) =>
        material.description.trim() ||
        material.type === "return" ||
        material.vendor.trim() ||
        material.purchaseDate.trim() ||
        material.quantity.trim() ||
        material.unit.trim() ||
        material.unitPrice.trim() ||
        Number(material.price) !== 0,
    );
}

function normalizeLaborItems(
  laborItems: Array<{ description?: string; quantity?: string; unit?: string; unitPrice?: string; price?: string }>,
) {
  return laborItems
    .map((item) => ({
      description: item.description?.trim() ?? "",
      quantity: item.quantity?.trim() ?? "",
      unit: item.unit?.trim() ?? "",
      unitPrice: normalizeMoney(item.unitPrice, ""),
      price: normalizeMoney(item.price),
    }))
    .filter((item) => item.description || item.quantity || item.unit || item.unitPrice || Number(item.price) !== 0);
}

function calculateFinalCost(job: {
  jobType?: "Residential" | "Commercial";
  laborItems: Array<{ price: string }>;
  materialTaxRate?: string;
  materials: Array<{ quantity: string; unitPrice: string; price: string; type?: "purchase" | "return" }>;
}) {
  const laborCost = job.laborItems.reduce((total, item) => total + Number(item.price), 0);
  const materialTaxRate = Number(job.materialTaxRate ?? 0);
  const materialsSubtotal = job.materials.reduce(
    (total, material) => total + Number(calculateSignedMaterialTotal(material)),
    0,
  );
  const taxableSubtotal = materialsSubtotal + (job.jobType === "Commercial" ? laborCost : 0);
  const tax = taxableSubtotal * (materialTaxRate / 100);

  return (laborCost + materialsSubtotal + tax).toFixed(2);
}

function normalizeJobStatus(status: (typeof jobStatuses)[number], dateBegin?: Date, dateEnd?: Date) {
  const hasJobDates = Boolean(dateBegin ?? dateEnd);

  if (!hasJobDates && status === "Scheduled") {
    return "Unscheduled";
  }

  if (hasJobDates && status === "Unscheduled") {
    return "Scheduled";
  }

  return status;
}

async function syncCustomerBillingStatus(customerId: string | null | undefined, ownerId: string) {
  if (!customerId) {
    return;
  }

  const jobs = await prisma.job.findMany({
    where: {
      ownerId,
      customerId,
    },
    select: {
      status: true,
      paymentStatus: true,
      finalCost: true,
      amountPaid: true,
    },
  });

  await prisma.customer.update({
    where: {
      id_ownerId: {
        id: customerId,
        ownerId,
      },
    },
    data: {
      billingStatus: deriveCustomerBillingStatus(
        jobs.map((job) => ({
          ...job,
          finalCost: job.finalCost?.toString(),
          amountPaid: job.amountPaid?.toString(),
        })),
      ),
    },
  });
}

async function getJobPaidTotal(jobId: string) {
  const paymentTotals = await prisma.jobPayment.aggregate({
    where: {
      jobId,
    },
    _sum: {
      amount: true,
    },
  });

  return Number(paymentTotals._sum.amount ?? 0).toFixed(2);
}

async function getJobDepositTotal(jobId: string) {
  const paymentTotals = await prisma.jobPayment.aggregate({
    where: {
      jobId,
      paymentType: "deposit",
    },
    _sum: {
      amount: true,
    },
  });

  return Number(paymentTotals._sum.amount ?? 0).toFixed(2);
}

async function syncJobPaymentSummary(jobId: string, ownerId: string) {
  const job = await prisma.job.findUnique({
    where: {
      id_ownerId: {
        id: jobId,
        ownerId,
      },
    },
    select: {
      id: true,
      customerId: true,
      finalCost: true,
      status: true,
      invoice: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!job) {
    throw new Error("Job could not be found.");
  }

  const amountPaid = await getJobPaidTotal(job.id);
  const depositPaid = await getJobDepositTotal(job.id);
  const paymentStatus = deriveJobPaymentStatus(job.status, job.finalCost?.toString(), amountPaid);

  await prisma.job.update({
    where: {
      id_ownerId: {
        id: job.id,
        ownerId,
      },
    },
    data: {
      amountPaid,
      depositPaid,
      paymentStatus,
    },
  });

  if (job.invoice) {
    const finalCost = Number(job.finalCost ?? 0);
    await prisma.invoice.update({
      where: {
        id_ownerId: {
          id: job.invoice.id,
          ownerId,
        },
      },
      data: {
        amountPaid,
        depositPaid,
        balanceDue: Math.max(0, finalCost - Number(amountPaid)).toFixed(2),
        paymentStatus,
      },
    });
  }

  await syncCustomerBillingStatus(job.customerId, ownerId);
}

async function syncExistingInvoiceSnapshotFromJob(jobId: string, ownerId: string) {
  const job = await prisma.job.findUnique({
    where: {
      id_ownerId: {
        id: jobId,
        ownerId,
      },
    },
    include: {
      customer: {
        include: {
          phoneNumbers: true,
        },
      },
      invoice: true,
    },
  });

  if (!job?.invoice) {
    return;
  }

  const materials = parseMaterials(job.materials);
  const materialsSubtotal = materials.reduce(
    (total, material) => total + Number(calculateSignedMaterialTotal(material)),
    0,
  );
  const laborCost = Number(job.laborCost ?? 0);
  const materialTaxRate = Number(job.materialTaxRate ?? 0);
  const taxableSubtotal = materialsSubtotal + (job.jobType === "Commercial" ? laborCost : 0);
  const materialTaxAmount = taxableSubtotal * (materialTaxRate / 100);
  const amountPaid = await getJobPaidTotal(job.id);
  const depositPaid = await getJobDepositTotal(job.id);
  const paymentStatus = deriveJobPaymentStatus(job.status, job.finalCost?.toString(), amountPaid);
  const balanceDue = calculateOutstandingBalance(job.status, job.finalCost?.toString(), amountPaid);

  await prisma.invoice.update({
    where: {
      id_ownerId: {
        id: job.invoice.id,
        ownerId,
      },
    },
    data: {
      customerId: job.customerId,
      customerName: job.customer?.name ?? null,
      customerEmail: job.customer?.email ?? null,
      customerPhone: job.customer?.phoneNumbers[0]?.value ?? null,
      jobTitle: job.description,
      jobDescription: job.scope,
      serviceLocation: formatServiceAddress(job),
      serviceAddressLine1: job.serviceAddressLine1,
      serviceAddressLine2: job.serviceAddressLine2,
      serviceCity: job.serviceCity,
      serviceState: job.serviceState,
      servicePostalCode: job.servicePostalCode,
      dateBegin: job.dateBegin,
      dateEnd: job.dateEnd,
      laborCost: laborCost.toFixed(2),
      materialTaxRate: materialTaxRate.toFixed(2),
      materials: JSON.stringify(materials),
      materialsSubtotal: materialsSubtotal.toFixed(2),
      materialTaxAmount: materialTaxAmount.toFixed(2),
      finalCost: (Number(job.finalCost ?? 0) || 0).toFixed(2),
      depositPaid,
      amountPaid,
      balanceDue: balanceDue.toFixed(2),
      paymentStatus,
      jobStatus: job.status,
    },
  });
}

export async function createJobAction(_previousState: JobMutationState, formData: FormData): Promise<JobMutationState> {
  const authorization = await getPermittedDashboardAuthorization("jobs.create");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to create jobs.",
    };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = createJobSchema.safeParse(getJobPayload(formData));

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the job details and try again.",
    };
  }

  if (parsed.data.newCustomerName && !(await getPermittedDashboardAuthorization("customers.create"))) {
    return { success: false, message: "You do not have permission to create a customer for this job." };
  }

  try {
    const { newCustomerEmail, newCustomerName, newCustomerPhone, ...job } = parsed.data;
    const materials = normalizeMaterials(job.materials);
    const laborItems = normalizeLaborItems(job.laborItems);
    const measurementRooms = normalizeMeasurementRooms(job.measurementRooms);
    const laborCost = laborItems.reduce((total, item) => total + Number(item.price), 0).toFixed(2);
    const calculatedFinalCost = calculateFinalCost({ ...job, laborItems, materials });
    const normalizedStatus = normalizeJobStatus(job.status, job.dateBegin, job.dateEnd);
    const serviceAddress = {
      serviceAddressLine1: job.serviceAddressLine1,
      serviceAddressLine2: job.serviceAddressLine2,
      serviceCity: job.serviceCity,
      servicePostalCode: job.servicePostalCode,
      serviceState: job.serviceState,
    };

    let customerId = job.customerId;

    if (!customerId && newCustomerName) {
      const customer = await createCustomerForJob({
        email: newCustomerEmail,
        name: newCustomerName,
        ownerId: workspaceId,
        phone: newCustomerPhone,
        serviceAddress,
        serviceLocation: formatServiceAddress(job) ?? undefined,
      });
      customerId = customer.id;
    }

    if (!customerId) {
      return {
        success: false,
        message: "Select an existing customer or create a new customer before saving the job.",
      };
    }

    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: {
          id_ownerId: {
            id: customerId,
            ownerId: workspaceId,
          },
        },
        select: {
          id: true,
        },
      });

      if (!customer) {
        return {
          success: false,
          message: "Select a customer from your account.",
        };
      }
    }

    const createdJob = await prisma.job.create({
      data: {
        ...job,
        ownerId: workspaceId,
        customerId: customerId || null,
        dateBegin: job.dateBegin ?? null,
        dateEnd: job.dateEnd ?? null,
        serviceLocation: formatServiceAddress(job) ?? null,
        serviceAddressLine1: job.serviceAddressLine1 || null,
        serviceAddressLine2: job.serviceAddressLine2 || null,
        serviceCity: job.serviceCity || null,
        serviceState: job.serviceState || null,
        servicePostalCode: job.servicePostalCode || null,
        estimatedCost: "0",
        laborCost,
        laborItems: JSON.stringify(laborItems),
        jobType: job.jobType,
        measurementRooms: JSON.stringify(measurementRooms),
        materialTaxRate: job.materialTaxRate ?? "0",
        materials: JSON.stringify(materials),
        paymentStatus: deriveJobPaymentStatus(normalizedStatus, calculatedFinalCost, "0"),
        depositPaid: "0.00",
        amountPaid: "0.00",
        finalCost: calculatedFinalCost,
        status: normalizedStatus,
        scope: job.scope || null,
        notes: job.notes || null,
      },
    });

    await syncCustomerBillingStatus(createdJob.customerId, workspaceId);
    await recordAuthorizationAuditEvent({
      workspaceId,
      actorUserId: authorization.principal.user.id,
      membershipId: authorization.membership.id,
      action: "job.create",
      targetType: "Job",
      targetId: createdJob.id,
    }).catch((error) => console.error("Job creation audit could not be saved.", error));

    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/jobs");
    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/customers");

    return {
      success: true,
      message: "Job created.",
      redirectTo: `/dashboard/jobs/${createdJob.id}`,
    };
  } catch (error) {
    console.error("Job creation failed.", error);
    return {
      success: false,
      message: "Job could not be created. Please try again.",
    };
  }
}

export async function updateJobAction(_previousState: JobMutationState, formData: FormData): Promise<JobMutationState> {
  const authorization = await getPermittedDashboardAuthorization("jobs.update");
  const syncExistingInvoice = formData.get("syncExistingInvoice") === "true";

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to update jobs.",
    };
  }
  const workspaceId = authorization.workspaceId;

  if (syncExistingInvoice && !(await getPermittedDashboardAuthorization("invoices.update"))) {
    return { success: false, message: "You do not have permission to update the linked invoice." };
  }

  const parsed = updateJobSchema.safeParse({
    id: formData.get("id"),
    ...getJobPayload(formData),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the job details and try again.",
    };
  }

  if (parsed.data.newCustomerName && !(await getPermittedDashboardAuthorization("customers.create"))) {
    return { success: false, message: "You do not have permission to create a customer for this job." };
  }

  const { id, newCustomerEmail, newCustomerName, newCustomerPhone, ...job } = parsed.data;
  let syncedInvoiceId: string | undefined;

  try {
    const materials = normalizeMaterials(job.materials);
    const laborItems = normalizeLaborItems(job.laborItems);
    const measurementRooms = normalizeMeasurementRooms(job.measurementRooms);
    const laborCost = laborItems.reduce((total, item) => total + Number(item.price), 0).toFixed(2);
    const calculatedFinalCost = calculateFinalCost({ ...job, laborItems, materials });
    const normalizedStatus = normalizeJobStatus(job.status, job.dateBegin, job.dateEnd);
    const serviceAddress = {
      serviceAddressLine1: job.serviceAddressLine1,
      serviceAddressLine2: job.serviceAddressLine2,
      serviceCity: job.serviceCity,
      servicePostalCode: job.servicePostalCode,
      serviceState: job.serviceState,
    };
    const existingJob = await prisma.job.findUnique({
      where: {
        id_ownerId: {
          id,
          ownerId: workspaceId,
        },
      },
      select: {
        customerId: true,
        id: true,
        invoice: {
          select: {
            id: true,
          },
        },
      },
    });

    if (existingJob?.invoice && !syncExistingInvoice) {
      return {
        success: false,
        message: "This job already has an invoice. Confirm that you want to update the existing invoice before saving.",
      };
    }

    let customerId = job.customerId;

    if (!customerId && newCustomerName) {
      const customer = await createCustomerForJob({
        email: newCustomerEmail,
        name: newCustomerName,
        ownerId: workspaceId,
        phone: newCustomerPhone,
        serviceAddress,
        serviceLocation: formatServiceAddress(job) ?? undefined,
      });
      customerId = customer.id;
    }

    if (!customerId) {
      return {
        success: false,
        message: "Select an existing customer or create a new customer before saving the job.",
      };
    }

    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: {
          id_ownerId: {
            id: customerId,
            ownerId: workspaceId,
          },
        },
        select: {
          id: true,
        },
      });

      if (!customer) {
        return {
          success: false,
          message: "Select a customer from your account.",
        };
      }
    }

    const updatedJob = await prisma.job.update({
      where: {
        id_ownerId: {
          id,
          ownerId: workspaceId,
        },
      },
      data: {
        ...job,
        customerId: customerId || null,
        dateBegin: job.dateBegin ?? null,
        dateEnd: job.dateEnd ?? null,
        serviceLocation: formatServiceAddress(job) ?? null,
        serviceAddressLine1: job.serviceAddressLine1 || null,
        serviceAddressLine2: job.serviceAddressLine2 || null,
        serviceCity: job.serviceCity || null,
        serviceState: job.serviceState || null,
        servicePostalCode: job.servicePostalCode || null,
        estimatedCost: "0",
        laborCost,
        laborItems: JSON.stringify(laborItems),
        jobType: job.jobType,
        measurementRooms: JSON.stringify(measurementRooms),
        materialTaxRate: job.materialTaxRate ?? "0",
        materials: JSON.stringify(materials),
        paymentStatus: deriveJobPaymentStatus(normalizedStatus, calculatedFinalCost, await getJobPaidTotal(id)),
        finalCost: calculatedFinalCost,
        status: normalizedStatus,
        scope: job.scope || null,
        notes: job.notes || null,
      },
    });

    await syncJobPaymentSummary(updatedJob.id, workspaceId);
    if (existingJob?.invoice && syncExistingInvoice) {
      await syncExistingInvoiceSnapshotFromJob(updatedJob.id, workspaceId);
      syncedInvoiceId = existingJob.invoice.id;
    }

    await syncCustomerBillingStatus(existingJob?.customerId, workspaceId);
    if (updatedJob.customerId !== existingJob?.customerId) {
      await syncCustomerBillingStatus(updatedJob.customerId, workspaceId);
    }
  } catch (error) {
    console.error("Job update failed.", error);
    return {
      success: false,
      message: "Job could not be updated. Please try again.",
    };
  }

  await recordAuthorizationAuditEvent({
    workspaceId,
    actorUserId: authorization.principal.user.id,
    membershipId: authorization.membership.id,
    action: "job.update",
    targetType: "Job",
    targetId: id,
    metadata: { syncedInvoice: Boolean(syncExistingInvoice) },
  }).catch((error) => console.error("Job update audit could not be saved.", error));

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/jobs");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, `/dashboard/jobs/${id}`);
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/customers");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/invoices");
  if (syncedInvoiceId) {
    revalidateWorkspacePath(authorization.membership.workspaceSlug, `/dashboard/invoices/${syncedInvoiceId}`);
  }

  return {
    success: true,
    message: syncExistingInvoice ? "Job and invoice updated." : "Job updated.",
    redirectTo: `/dashboard/jobs/${id}`,
  };
}

const jobPaymentSchema = z.object({
  jobId: z.string().trim().min(1, "Job is required."),
  paymentType: z.enum(["deposit", "invoice_payment"]).default("deposit"),
  paidOn: z
    .string()
    .trim()
    .min(1, "Payment date is required.")
    .transform((value) => parseDateInput(value))
    .refine((value) => !Number.isNaN(value.getTime()), "Enter a valid payment date."),
  amount: z
    .string()
    .trim()
    .min(1, "Payment amount is required.")
    .refine((value) => Number(value) > 0, "Payment amount must be greater than $0.00."),
  method: z.string().trim().min(1, "Payment method is required."),
  referenceNumber: z.string().trim().optional(),
  description: z.string().trim().min(1, "Payment description is required."),
  notes: z.string().trim().optional(),
});

const deleteJobPaymentSchema = z.object({
  id: z.string().trim().min(1, "Payment is required."),
});

const updateJobPaymentSchema = jobPaymentSchema.extend({
  id: z.string().trim().min(1, "Payment is required."),
});

export async function createJobPaymentAction(
  _previousState: JobMutationState,
  formData: FormData,
): Promise<JobMutationState> {
  const authorization = await getPermittedDashboardAuthorization("invoices.record_payment");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to record payments.",
    };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = jobPaymentSchema.safeParse({
    jobId: formData.get("jobId"),
    paymentType: formData.get("paymentType") || "deposit",
    paidOn: formData.get("paidOn"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    referenceNumber: emptyToUndefined(formData.get("referenceNumber")),
    description: formData.get("description"),
    notes: emptyToUndefined(formData.get("notes")),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the payment details and try again.",
    };
  }

  try {
    const job = await prisma.job.findUnique({
      where: {
        id_ownerId: {
          id: parsed.data.jobId,
          ownerId: workspaceId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!job) {
      return {
        success: false,
        message: "Select a job from your account.",
      };
    }

    const payment = await prisma.jobPayment.create({
      data: {
        ownerId: workspaceId,
        jobId: parsed.data.jobId,
        paidOn: parsed.data.paidOn,
        amount: Number(parsed.data.amount).toFixed(2),
        paymentType: parsed.data.paymentType,
        method: parsed.data.method,
        referenceNumber: parsed.data.referenceNumber || null,
        description: parsed.data.description,
        notes: parsed.data.notes || null,
      },
    });

    await syncJobPaymentSummary(parsed.data.jobId, workspaceId);
    await recordAuthorizationAuditEvent({
      workspaceId,
      actorUserId: authorization.principal.user.id,
      membershipId: authorization.membership.id,
      action: "job.payment.create",
      targetType: "JobPayment",
      targetId: payment.id,
      metadata: { jobId: parsed.data.jobId, paymentType: parsed.data.paymentType },
    }).catch((error) => console.error("Job payment creation audit could not be saved.", error));
  } catch (error) {
    console.error("Job payment creation failed.", error);
    return {
      success: false,
      message: "Payment could not be recorded. Please try again.",
    };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/jobs");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/customers");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/invoices");

  return {
    success: true,
    message: parsed.data.paymentType === "deposit" ? "Deposit recorded." : "Payment recorded.",
  };
}

export async function updateJobPaymentAction(
  _previousState: JobMutationState,
  formData: FormData,
): Promise<JobMutationState> {
  const authorization = await getPermittedDashboardAuthorization("invoices.record_payment");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to update payments.",
    };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = updateJobPaymentSchema.safeParse({
    id: formData.get("id"),
    jobId: formData.get("jobId"),
    paymentType: formData.get("paymentType") || "deposit",
    paidOn: formData.get("paidOn"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    referenceNumber: emptyToUndefined(formData.get("referenceNumber")),
    description: formData.get("description"),
    notes: emptyToUndefined(formData.get("notes")),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the payment details and try again.",
    };
  }

  try {
    const payment = await prisma.jobPayment.findUnique({
      where: {
        id_ownerId: {
          id: parsed.data.id,
          ownerId: workspaceId,
        },
      },
      select: {
        jobId: true,
      },
    });

    if (!payment || payment.jobId !== parsed.data.jobId) {
      return {
        success: false,
        message: "Payment could not be found.",
      };
    }

    await prisma.jobPayment.update({
      where: {
        id_ownerId: {
          id: parsed.data.id,
          ownerId: workspaceId,
        },
      },
      data: {
        paidOn: parsed.data.paidOn,
        amount: Number(parsed.data.amount).toFixed(2),
        paymentType: parsed.data.paymentType,
        method: parsed.data.method,
        referenceNumber: parsed.data.referenceNumber || null,
        description: parsed.data.description,
        notes: parsed.data.notes || null,
      },
    });

    await syncJobPaymentSummary(parsed.data.jobId, workspaceId);
    await recordAuthorizationAuditEvent({
      workspaceId,
      actorUserId: authorization.principal.user.id,
      membershipId: authorization.membership.id,
      action: "job.payment.update",
      targetType: "JobPayment",
      targetId: parsed.data.id,
      metadata: { jobId: parsed.data.jobId, paymentType: parsed.data.paymentType },
    }).catch((error) => console.error("Job payment update audit could not be saved.", error));
  } catch (error) {
    console.error("Job payment update failed.", error);
    return {
      success: false,
      message: "Payment could not be updated. Please try again.",
    };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/jobs");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/customers");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/invoices");

  return {
    success: true,
    message: parsed.data.paymentType === "deposit" ? "Deposit updated." : "Payment updated.",
  };
}

export async function deleteJobPaymentAction(
  _previousState: JobMutationState,
  formData: FormData,
): Promise<JobMutationState> {
  const authorization = await getPermittedDashboardAuthorization("invoices.record_payment");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to delete payments.",
    };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = deleteJobPaymentSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select a payment and try again.",
    };
  }

  try {
    const payment = await prisma.jobPayment.findUnique({
      where: {
        id_ownerId: {
          id: parsed.data.id,
          ownerId: workspaceId,
        },
      },
      select: {
        jobId: true,
      },
    });

    if (!payment) {
      return {
        success: false,
        message: "Payment could not be found.",
      };
    }

    await prisma.jobPayment.delete({
      where: {
        id_ownerId: {
          id: parsed.data.id,
          ownerId: workspaceId,
        },
      },
    });

    await syncJobPaymentSummary(payment.jobId, workspaceId);
    await recordAuthorizationAuditEvent({
      workspaceId,
      actorUserId: authorization.principal.user.id,
      membershipId: authorization.membership.id,
      action: "job.payment.delete",
      targetType: "JobPayment",
      targetId: parsed.data.id,
      metadata: { jobId: payment.jobId },
    }).catch((error) => console.error("Job payment deletion audit could not be saved.", error));
  } catch (error) {
    console.error("Job payment deletion failed.", error);
    return {
      success: false,
      message: "Payment could not be deleted. Please try again.",
    };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/jobs");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/customers");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/invoices");

  return {
    success: true,
    message: "Payment deleted.",
  };
}

const deleteJobSchema = z.object({
  id: z.string().trim().min(1, "Job is required."),
});

export async function deleteJobAction(_previousState: JobMutationState, formData: FormData): Promise<JobMutationState> {
  const authorization = await getPermittedDashboardAuthorization("jobs.delete");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to delete jobs.",
    };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = deleteJobSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select a job and try again.",
    };
  }

  let reopenedEstimateIds: string[] = [];

  try {
    const job = await prisma.job.findUnique({
      where: {
        id_ownerId: {
          id: parsed.data.id,
          ownerId: workspaceId,
        },
      },
      select: {
        customerId: true,
        invoice: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!job) {
      return {
        success: false,
        message: "Job could not be found.",
      };
    }

    if (job.invoice) {
      return {
        success: false,
        message: "Delete the invoice first so its number can be released or permanently voided.",
      };
    }

    await prisma.$transaction(async (tx) => {
      const linkedEstimates = await tx.estimateRecord.findMany({
        where: {
          ownerId: workspaceId,
          convertedJobId: parsed.data.id,
        },
        select: {
          id: true,
        },
      });
      const linkedEstimateIds = linkedEstimates.map((estimate) => estimate.id);

      if (linkedEstimateIds.length) {
        await tx.estimate.updateMany({
          where: {
            estimateRecordId: {
              in: linkedEstimateIds,
            },
            ownerId: workspaceId,
          },
          data: {
            jobStatus: "Waiting on Customer",
          },
        });
        await tx.lead.updateMany({
          where: {
            estimateRecordId: {
              in: linkedEstimateIds,
            },
            ownerId: workspaceId,
          },
          data: {
            convertedAt: null,
            status: "In Progress",
          },
        });
      }

      await tx.estimateRecord.updateMany({
        where: {
          ownerId: workspaceId,
          convertedJobId: parsed.data.id,
        },
        data: {
          convertedJobId: null,
          decidedAt: null,
          status: "Waiting on Customer",
        },
      });
      const deletedJob = await tx.job.deleteMany({
        where: {
          id: parsed.data.id,
          invoice: { is: null },
          ownerId: workspaceId,
        },
      });

      if (deletedJob.count !== 1) {
        throw new Error("Delete the invoice first so its number can be released or permanently voided.");
      }

      reopenedEstimateIds = linkedEstimateIds;
    });

    await syncCustomerBillingStatus(job?.customerId, workspaceId);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error && error.message.startsWith("Delete the invoice first")
          ? error.message
          : "Job could not be deleted. Please try again.",
    };
  }

  await recordAuthorizationAuditEvent({
    workspaceId,
    actorUserId: authorization.principal.user.id,
    membershipId: authorization.membership.id,
    action: "job.delete",
    targetType: "Job",
    targetId: parsed.data.id,
    metadata: { reopenedEstimateCount: reopenedEstimateIds.length },
  }).catch((error) => console.error("Job deletion audit could not be saved.", error));

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/jobs");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/estimates");
  for (const estimateId of reopenedEstimateIds) {
    revalidateWorkspacePath(authorization.membership.workspaceSlug, `/dashboard/estimates/records/${estimateId}`);
  }
  // redirect("/dashboard/jobs");
  return {
    success: true,
    message: reopenedEstimateIds.length ? "Job deleted. The estimate has been reopened." : "Job deleted.",
  };
}
