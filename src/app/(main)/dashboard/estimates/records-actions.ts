"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { deriveCustomerBillingStatus } from "@/lib/customer-billing";
import { allocateDocumentNumber, attachDocumentNumber } from "@/lib/document-numbering";
import { normalizePhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { formatServiceAddress, getServiceAddressPayload, type ServiceAddressFields } from "@/lib/service-address";

import { parseMaterials } from "../jobs/_components/materials";
import { parsePricingItems } from "../jobs/_components/pricing-items";
import { getLeadStatusForEstimateStatus } from "../leads/constants";

type EstimateWriteClient = typeof prisma | Prisma.TransactionClient;

export type EstimateRecordMutationState = {
  customerCopyChangedFields?: string[];
  redirectTo?: string;
  requiresCustomerCopyConfirmation?: boolean;
  success: boolean;
  message: string;
};

const estimateRecordStatuses = ["Draft", "Ready to Send", "Waiting on Customer", "Won", "Lost"] as const;
const userManagedEstimateStatuses = ["Draft", "Ready to Send", "Waiting on Customer", "Lost"] as const;
const estimateJobTypes = ["Residential", "Commercial"] as const;

const emptyToUndefined = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
};

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? new Date(value) : undefined))
  .refine((value) => !value || !Number.isNaN(value.getTime()), "Enter a valid date.");

const optionalMoney = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid amount.")
  .transform((value) => (value ? value : undefined));

function normalizeMoney(value: string | undefined, fallback = "0.00") {
  const text = value?.trim() ?? "";
  if (!text) return fallback;

  const amount = Number(text);
  return Number.isFinite(amount) ? amount.toFixed(2) : fallback;
}

const lineItemsSchema = z.array(
  z.object({
    description: z.string().trim().optional(),
    quantity: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || (!Number.isNaN(Number(value)) && Number(value) > 0),
        "Enter a valid line item quantity.",
      ),
    unit: z.string().trim().optional(),
    unitPrice: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid line item unit price."),
    price: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid line item price."),
  }),
);

const materialsSchema = z.array(
  z.object({
    description: z.string().trim().optional(),
    quantity: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || (!Number.isNaN(Number(value)) && Number(value) >= 0),
        "Enter a valid material quantity.",
      ),
    unitPrice: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid material unit price."),
    unit: z.string().trim().optional(),
    price: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid material total."),
  }),
);

const measurementRoomsSchema = z.array(
  z.object({
    id: z.string().trim().optional(),
    name: z.string().trim().optional(),
    length: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || (!Number.isNaN(Number(value)) && Number(value) >= 0), "Enter a valid area length."),
    width: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || (!Number.isNaN(Number(value)) && Number(value) >= 0), "Enter a valid area width."),
  }),
);

const estimateRecordSchema = z.object({
  leadId: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  newCustomerName: z.string().trim().optional(),
  newCustomerEmail: z.string().trim().optional(),
  newCustomerPhone: z.string().trim().optional(),
  newLeadName: z.string().trim().optional(),
  newLeadEmail: z.preprocess((value) => {
    const email = String(value ?? "").trim();
    return email || undefined;
  }, z.string().email("Enter a valid lead email.").optional()),
  newLeadPhone: z.string().trim().optional(),
  newLeadSource: z.string().trim().optional(),
  description: z.string().trim().min(1, "Title is required."),
  serviceLocation: z.string().trim().optional(),
  serviceAddressLine1: z.string().trim().optional(),
  serviceAddressLine2: z.string().trim().optional(),
  serviceCity: z.string().trim().optional(),
  serviceState: z.string().trim().optional(),
  servicePostalCode: z.string().trim().optional(),
  dateBegin: optionalDate,
  dateEnd: optionalDate,
  laborItems: lineItemsSchema,
  jobType: z.enum(estimateJobTypes).default("Residential"),
  measurementRooms: measurementRoomsSchema,
  materialTaxRate: optionalMoney,
  materials: materialsSchema,
  scope: z.string().trim().optional(),
  category: z.string().trim().min(1, "Category is required."),
  status: z.enum(estimateRecordStatuses),
  notes: z.string().trim().optional(),
});

const createEstimateRecordSchema = estimateRecordSchema
  .refine((estimate) => !estimate.dateBegin || !estimate.dateEnd || estimate.dateEnd >= estimate.dateBegin, {
    message: "End date must be after begin date.",
  })
  .refine((estimate) => !(estimate.leadId && estimate.newLeadName), {
    message: "Choose the existing lead or create a new lead, not both.",
  });

const updateEstimateRecordSchema = createEstimateRecordSchema.and(
  z.object({
    id: z.string().trim().min(1, "Estimate is required."),
  }),
);

const updateEstimateStatusSchema = z.object({
  id: z.string().trim().min(1, "Estimate is required."),
  status: z.enum(userManagedEstimateStatuses),
});

function getEstimatePayload(formData: FormData) {
  const serviceAddress = getServiceAddressPayload(formData);

  return {
    leadId: emptyToUndefined(formData.get("leadId")),
    customerId: emptyToUndefined(formData.get("customerId")),
    newCustomerName: emptyToUndefined(formData.get("newCustomerName")),
    newCustomerEmail: emptyToUndefined(formData.get("newCustomerEmail")),
    newCustomerPhone: emptyToUndefined(formData.get("newCustomerPhone")),
    newLeadName: emptyToUndefined(formData.get("newLeadName")),
    newLeadEmail: emptyToUndefined(formData.get("newLeadEmail")),
    newLeadPhone: emptyToUndefined(formData.get("newLeadPhone")),
    newLeadSource: emptyToUndefined(formData.get("newLeadSource")),
    description: formData.get("description"),
    ...serviceAddress,
    dateBegin: emptyToUndefined(formData.get("dateBegin")),
    dateEnd: emptyToUndefined(formData.get("dateEnd")),
    laborItems: parsePricingItems(String(formData.get("laborItems") ?? "")),
    jobType: formData.get("jobType"),
    measurementRooms: parseMeasurementRooms(String(formData.get("measurementRooms") ?? "")),
    materialTaxRate: emptyToUndefined(formData.get("materialTaxRate")),
    materials: parseMaterials(String(formData.get("materials") ?? "")),
    scope: emptyToUndefined(formData.get("scope")),
    category: formData.get("category"),
    status: formData.get("status"),
    notes: emptyToUndefined(formData.get("notes")),
  };
}

function parseMeasurementRooms(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeItems(
  items: Array<{ description?: string; quantity?: string; unit?: string; unitPrice?: string; price?: string }>,
) {
  return items
    .map((item) => ({
      description: item.description?.trim() ?? "",
      quantity: item.quantity?.trim() ?? "",
      unit: item.unit?.trim() ?? "",
      unitPrice: normalizeMoney(item.unitPrice, ""),
      price: normalizeMoney(item.price),
    }))
    .filter((item) => item.description || item.quantity || item.unit || item.unitPrice || Number(item.price) !== 0);
}

function normalizeMaterials(
  items: Array<{ description?: string; quantity?: string; unit?: string; unitPrice?: string; price?: string }>,
) {
  return items
    .map((item) => ({
      description: item.description?.trim() ?? "",
      quantity: item.quantity?.trim() ?? "",
      unit: item.unit?.trim() ?? "",
      unitPrice: normalizeMoney(item.unitPrice, ""),
      price: normalizeMoney(item.price),
    }))
    .filter(
      (item) =>
        item.description.trim() ||
        item.unit.trim() ||
        item.unitPrice.trim() ||
        (item.price.trim() && Number(item.price) !== 0),
    )
    .filter((item) => item.description.trim() || item.unit.trim() || item.unitPrice.trim() || Number(item.price) !== 0);
}

function normalizeMeasurement(value: string | undefined) {
  const text = value?.trim() ?? "";
  if (!text) return "";

  const amount = Number(text);
  return Number.isFinite(amount) ? amount.toString() : "";
}

function normalizeMeasurementRooms(rooms: Array<{ id?: string; name?: string; length?: string; width?: string }>) {
  return rooms
    .map((room, index) => {
      const rawName = room.name?.trim() ?? "";
      const length = normalizeMeasurement(room.length);
      const width = normalizeMeasurement(room.width);
      const area = Number(length || 0) * Number(width || 0);
      const hasRoomData = rawName || Number(length) > 0 || Number(width) > 0;

      return {
        id: room.id?.trim() || `area-${index + 1}`,
        name: rawName || `Area ${index + 1}`,
        length,
        width,
        area: Number.isFinite(area) ? area.toFixed(2) : "0.00",
        hasRoomData,
      };
    })
    .filter((room) => room.hasRoomData)
    .map(({ hasRoomData: _hasRoomData, ...room }) => room);
}

function calculateTotal(input: {
  laborItems: Array<{ price: string }>;
  jobType: (typeof estimateJobTypes)[number];
  materialTaxRate?: string;
  materials: Array<{ price: string }>;
}) {
  const laborCost = input.laborItems.reduce((total, item) => total + Number(item.price), 0);
  const materialsSubtotal = input.materials.reduce((total, item) => total + Number(item.price), 0);
  const taxableSubtotal = input.jobType === "Commercial" ? laborCost + materialsSubtotal : materialsSubtotal;
  const tax = taxableSubtotal * (Number(input.materialTaxRate ?? 0) / 100);

  return {
    laborCost: laborCost.toFixed(2),
    taxableSubtotal: taxableSubtotal.toFixed(2),
    total: (laborCost + materialsSubtotal + tax).toFixed(2),
  };
}

function calculateSubtotal(items: Array<{ price: string }>) {
  return items.reduce((total, item) => total + Number(item.price || 0), 0);
}

async function assertCustomer(ownerId: string, customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: {
      id_ownerId: {
        id: customerId,
        ownerId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!customer) {
    throw new Error("Select a customer from your account.");
  }
}

function createCustomerAddressFromServiceAddress(
  serviceAddress: ServiceAddressFields & { serviceLocation?: string | null },
) {
  const displayLocation = formatServiceAddress(serviceAddress);

  if (!displayLocation) return undefined;

  return {
    label: "Service Location",
    line1: serviceAddress.serviceAddressLine1 || displayLocation,
    line2: serviceAddress.serviceAddressLine2 || null,
    city: serviceAddress.serviceCity || null,
    state: serviceAddress.serviceState || null,
    postalCode: serviceAddress.servicePostalCode || null,
  };
}

async function createCustomerForEstimate({
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
    throw new Error("Enter a customer name and phone number before creating the estimate.");
  }

  const normalizedPhone = normalizePhoneNumber(phone);

  if (normalizedPhone.length !== 10) {
    throw new Error("Enter a valid 10-digit phone number before creating the estimate.");
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

    const address = createCustomerAddressFromServiceAddress({
      ...serviceAddress,
      serviceLocation,
    });

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

async function createLeadForEstimate({
  customerId,
  db = prisma,
  email,
  estimateStatus,
  estimateRecordId,
  name,
  ownerId,
  phone,
  serviceAddress,
  serviceLocation,
  serviceType,
  source,
}: {
  customerId?: string;
  db?: EstimateWriteClient;
  email?: string;
  estimateStatus: string;
  estimateRecordId: string;
  name?: string;
  ownerId: string;
  phone?: string;
  serviceAddress?: ServiceAddressFields;
  serviceLocation?: string;
  serviceType?: string;
  source?: string;
}) {
  if (!name) {
    throw new Error("Enter a lead name before creating the estimate.");
  }

  const normalizedPhone = normalizePhoneNumber(phone);

  if (phone && normalizedPhone.length !== 10) {
    throw new Error("Enter a valid 10-digit lead phone number.");
  }

  return db.lead.create({
    data: {
      ownerId,
      customerId: customerId ?? null,
      estimateRecordId,
      name,
      email: email ?? null,
      phone: normalizedPhone.length ? normalizedPhone : null,
      source: source ?? null,
      serviceType: serviceType ?? null,
      serviceLocation: serviceLocation ?? null,
      serviceAddressLine1: serviceAddress?.serviceAddressLine1 ?? null,
      serviceAddressLine2: serviceAddress?.serviceAddressLine2 ?? null,
      serviceCity: serviceAddress?.serviceCity ?? null,
      serviceState: serviceAddress?.serviceState ?? null,
      servicePostalCode: serviceAddress?.servicePostalCode ?? null,
      status: getLeadStatusForEstimateStatus(estimateStatus),
      priority: "Normal",
    },
    select: {
      id: true,
    },
  });
}

async function findOrCreateCustomerForLead({
  db = prisma,
  lead,
  ownerId,
  serviceAddress,
  serviceLocation,
}: {
  db?: EstimateWriteClient;
  lead: {
    email: string | null;
    name: string;
    phone: string | null;
  };
  ownerId: string;
  serviceAddress?: ServiceAddressFields;
  serviceLocation?: string | null;
}) {
  const existingCustomer = lead.email
    ? await db.customer.findFirst({
        where: {
          email: lead.email,
          ownerId,
        },
        select: {
          id: true,
        },
      })
    : null;

  if (existingCustomer) {
    return existingCustomer;
  }

  const address = createCustomerAddressFromServiceAddress({
    ...serviceAddress,
    serviceLocation,
  });

  return db.customer.create({
    data: {
      ownerId,
      name: lead.name,
      email: lead.email,
      billingStatus: "No Balance",
      addresses: address
        ? {
            create: address,
          }
        : undefined,
      phoneNumbers: lead.phone
        ? {
            create: {
              label: "Primary",
              value: normalizePhoneNumber(lead.phone),
            },
          }
        : undefined,
    },
    select: {
      id: true,
    },
  });
}

async function syncCustomerBillingStatus(
  customerId: string | null | undefined,
  ownerId: string,
  db: EstimateWriteClient = prisma,
) {
  if (!customerId) return;

  const jobs = await db.job.findMany({
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

  await db.customer.update({
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

async function upsertPrintableEstimateSnapshotFromRecord(
  db: Prisma.TransactionClient,
  estimateRecordId: string,
  ownerId: string,
) {
  const estimate = await db.estimateRecord.findUnique({
    where: {
      id_ownerId: {
        id: estimateRecordId,
        ownerId,
      },
    },
    include: {
      customer: {
        include: {
          phoneNumbers: true,
        },
      },
      lead: true,
      printableEstimate: true,
    },
  });

  if (!estimate) {
    throw new Error("Estimate not found.");
  }

  const laborItems = normalizeItems(parsePricingItems(estimate.laborItems));
  const materials = normalizeMaterials(parseMaterials(estimate.materials));
  const printableItems = [
    ...laborItems.map((item) => ({ ...item, type: "labor" })),
    ...materials.map((item) => ({ ...item, type: "material" })),
  ];
  const materialsSubtotal = calculateSubtotal(materials);
  const laborCost = Number(estimate.laborCost ?? 0);
  const materialTaxRate = Number(estimate.materialTaxRate ?? 0);
  const taxableSubtotal = estimate.jobType === "Commercial" ? laborCost + materialsSubtotal : materialsSubtotal;
  const materialTaxAmount = taxableSubtotal * (materialTaxRate / 100);

  const snapshotData = {
    customerId: estimate.customerId,
    customerName: estimate.customer?.name ?? estimate.lead?.name ?? null,
    customerEmail: estimate.customer?.email ?? estimate.lead?.email ?? null,
    customerPhone: estimate.customer?.phoneNumbers[0]?.value ?? estimate.lead?.phone ?? null,
    jobTitle: estimate.description,
    jobDescription: estimate.scope,
    serviceLocation: formatServiceAddress(estimate) ?? undefined,
    serviceAddressLine1: estimate.serviceAddressLine1,
    serviceAddressLine2: estimate.serviceAddressLine2,
    serviceCity: estimate.serviceCity,
    serviceState: estimate.serviceState,
    servicePostalCode: estimate.servicePostalCode,
    dateBegin: estimate.dateBegin,
    dateEnd: estimate.dateEnd,
    laborCost: estimate.laborCost ?? "0",
    materialTaxRate: estimate.materialTaxRate ?? "0",
    materials: JSON.stringify(printableItems),
    materialsSubtotal: materialsSubtotal.toFixed(2),
    materialTaxAmount: materialTaxAmount.toFixed(2),
    estimatedTotal: estimate.estimatedTotal ?? "0",
    jobStatus: estimate.status,
  };

  if (estimate.printableEstimate) {
    await db.estimate.update({
      where: {
        id_ownerId: {
          id: estimate.printableEstimate.id,
          ownerId,
        },
      },
      data: snapshotData,
    });

    return estimate.printableEstimate.id;
  }

  const estimateNumberAssignment = await allocateDocumentNumber(db, ownerId, "estimate");
  const printableEstimate = await db.estimate.create({
    data: {
      ...snapshotData,
      ownerId,
      estimateNumber: estimateNumberAssignment.documentNumber,
      estimateRecordId: estimate.id,
    },
  });
  await attachDocumentNumber(db, estimateNumberAssignment.assignmentId, printableEstimate.id);

  return printableEstimate.id;
}

export async function createEstimateRecordAction(
  _previousState: EstimateRecordMutationState,
  formData: FormData,
): Promise<EstimateRecordMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to create an estimate." };
  }

  const parsed = createEstimateRecordSchema.safeParse(getEstimatePayload(formData));

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the estimate details and try again." };
  }

  if (parsed.data.status === "Won") {
    return { success: false, message: "An estimate becomes Won when it is converted to a job." };
  }

  let createdEstimateId = "";

  try {
    const {
      newCustomerEmail,
      newCustomerName,
      newCustomerPhone,
      newLeadEmail,
      newLeadName,
      newLeadPhone,
      newLeadSource,
      ...estimate
    } = parsed.data;
    const { jobType, leadId, measurementRooms, ...estimateInput } = estimate;
    const serviceAddress = {
      serviceAddressLine1: estimate.serviceAddressLine1,
      serviceAddressLine2: estimate.serviceAddressLine2,
      serviceCity: estimate.serviceCity,
      servicePostalCode: estimate.servicePostalCode,
      serviceState: estimate.serviceState,
    };
    const laborItems = normalizeItems(estimate.laborItems);
    const materials = normalizeMaterials(estimate.materials);
    const normalizedMeasurementRooms = normalizeMeasurementRooms(measurementRooms);
    const totals = calculateTotal({ ...estimate, laborItems, materials, jobType });
    const materialTaxRate = estimate.materialTaxRate ?? "8.25";
    let customerId = estimate.customerId;
    const selectedLead = leadId
      ? await prisma.lead.findUnique({
          where: {
            id_ownerId: {
              id: leadId,
              ownerId: currentUser.id,
            },
          },
          select: {
            customerId: true,
            estimateRecordId: true,
            id: true,
          },
        })
      : null;

    if (leadId && !selectedLead) {
      return {
        success: false,
        message: "Select a lead from your account.",
      };
    }

    if (selectedLead?.estimateRecordId) {
      return {
        success: false,
        message: "This lead is already linked to another estimate.",
      };
    }

    customerId = customerId ?? selectedLead?.customerId ?? undefined;

    if (!customerId && newCustomerName) {
      const customer = await createCustomerForEstimate({
        email: newCustomerEmail,
        name: newCustomerName,
        ownerId: currentUser.id,
        phone: newCustomerPhone,
        serviceAddress,
        serviceLocation: formatServiceAddress(estimate) ?? undefined,
      });
      customerId = customer.id;
    }

    if (!customerId && !leadId && !newLeadName) {
      return {
        success: false,
        message: "Select an existing customer or lead, create a lead, or create a customer before saving the estimate.",
      };
    }

    if (customerId) {
      await assertCustomer(currentUser.id, customerId);
    }

    const createdEstimate = await prisma.$transaction(async (tx) => {
      const createdEstimate = await tx.estimateRecord.create({
        data: {
          ...estimateInput,
          ownerId: currentUser.id,
          customerId: customerId ?? null,
          dateBegin: estimate.dateBegin ?? null,
          dateEnd: estimate.dateEnd ?? null,
          serviceLocation: formatServiceAddress(estimate) ?? null,
          serviceAddressLine1: estimate.serviceAddressLine1 || null,
          serviceAddressLine2: estimate.serviceAddressLine2 || null,
          serviceCity: estimate.serviceCity || null,
          serviceState: estimate.serviceState || null,
          servicePostalCode: estimate.servicePostalCode || null,
          laborCost: totals.laborCost,
          laborItems: JSON.stringify(laborItems),
          jobType,
          measurementRooms: JSON.stringify(normalizedMeasurementRooms),
          materialTaxRate,
          materials: JSON.stringify(materials),
          estimatedTotal: totals.total,
          status: estimate.status,
          scope: estimate.scope || null,
          notes: estimate.notes || null,
        },
      });

      if (newLeadName) {
        await createLeadForEstimate({
          customerId,
          db: tx,
          email: newLeadEmail,
          estimateStatus: estimate.status,
          estimateRecordId: createdEstimate.id,
          name: newLeadName,
          ownerId: currentUser.id,
          phone: newLeadPhone,
          serviceAddress,
          serviceLocation: formatServiceAddress(estimate) ?? undefined,
          serviceType: estimate.category,
          source: newLeadSource,
        });
      }

      if (leadId && selectedLead) {
        await tx.lead.update({
          where: {
            id_ownerId: {
              id: selectedLead.id,
              ownerId: currentUser.id,
            },
          },
          data: {
            customerId: customerId ?? selectedLead.customerId ?? null,
            estimateRecordId: createdEstimate.id,
            status: getLeadStatusForEstimateStatus(estimate.status),
          },
        });
      }

      if (estimate.status === "Ready to Send" || estimate.status === "Waiting on Customer") {
        await upsertPrintableEstimateSnapshotFromRecord(tx, createdEstimate.id, currentUser.id);
      }

      return createdEstimate;
    });
    createdEstimateId = createdEstimate.id;
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Estimate could not be created." };
  }

  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/command-center");
  return {
    success: true,
    message:
      parsed.data.status === "Waiting on Customer"
        ? "Estimate created, published, and marked Waiting on Customer."
        : parsed.data.status === "Ready to Send"
          ? "Estimate created and published."
          : "Estimate created.",
    redirectTo: `/dashboard/estimates/records/${createdEstimateId}`,
  };
}

export async function updateEstimateRecordAction(
  _previousState: EstimateRecordMutationState,
  formData: FormData,
): Promise<EstimateRecordMutationState> {
  const currentUser = await getCurrentUser();
  const syncExistingEstimate = formData.get("syncExistingEstimate") === "true";

  if (!currentUser) {
    return { success: false, message: "You must be signed in to update an estimate." };
  }

  const parsed = updateEstimateRecordSchema.safeParse({
    id: formData.get("id"),
    ...getEstimatePayload(formData),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the estimate details and try again." };
  }

  const {
    id,
    newCustomerEmail,
    newCustomerName,
    newCustomerPhone,
    newLeadEmail,
    newLeadName,
    newLeadPhone,
    newLeadSource,
    ...estimate
  } = parsed.data;
  let syncedPrintableEstimateId: string | undefined;
  let unpublishedCustomerCopy = false;
  let customerDocumentChanged = false;
  let previousStatus = "";
  let previouslyPublished = false;

  try {
    const { jobType, leadId, measurementRooms, ...estimateInput } = estimate;
    const serviceAddress = {
      serviceAddressLine1: estimate.serviceAddressLine1,
      serviceAddressLine2: estimate.serviceAddressLine2,
      serviceCity: estimate.serviceCity,
      servicePostalCode: estimate.servicePostalCode,
      serviceState: estimate.serviceState,
    };
    const laborItems = normalizeItems(estimate.laborItems);
    const materials = normalizeMaterials(estimate.materials);
    const normalizedMeasurementRooms = normalizeMeasurementRooms(measurementRooms);
    const totals = calculateTotal({ ...estimate, laborItems, materials, jobType });
    let customerId = estimate.customerId;
    const existingEstimate = await prisma.estimateRecord.findUnique({
      where: {
        id_ownerId: {
          id,
          ownerId: currentUser.id,
        },
      },
      select: {
        convertedJobId: true,
        customerId: true,
        dateBegin: true,
        dateEnd: true,
        description: true,
        estimatedTotal: true,
        jobType: true,
        laborCost: true,
        laborItems: true,
        lead: {
          select: {
            id: true,
          },
        },
        materialTaxRate: true,
        materials: true,
        printableEstimate: {
          select: {
            id: true,
          },
        },
        scope: true,
        serviceAddressLine1: true,
        serviceAddressLine2: true,
        serviceCity: true,
        serviceLocation: true,
        servicePostalCode: true,
        serviceState: true,
        status: true,
      },
    });

    if (!existingEstimate) {
      return {
        success: false,
        message: "Estimate not found.",
      };
    }

    if (existingEstimate.convertedJobId && estimate.status !== "Won") {
      return {
        success: false,
        message: "A converted estimate must remain Won while its job exists.",
      };
    }

    if (!existingEstimate.convertedJobId && estimate.status === "Won") {
      return {
        success: false,
        message: "Convert this estimate to a job to mark it Won.",
      };
    }

    const selectedLead = leadId
      ? await prisma.lead.findUnique({
          where: {
            id_ownerId: {
              id: leadId,
              ownerId: currentUser.id,
            },
          },
          select: {
            customerId: true,
            estimateRecordId: true,
            id: true,
          },
        })
      : null;

    if (leadId && !selectedLead) {
      return {
        success: false,
        message: "Select a lead from your account.",
      };
    }

    previousStatus = existingEstimate.status;
    previouslyPublished = Boolean(existingEstimate.printableEstimate);
    const changedCustomerDocumentFields = [
      ["new customer", Boolean(newCustomerName)],
      ["new lead", Boolean(newLeadName)],
      ["customer", (estimate.customerId ?? "") !== (existingEstimate.customerId ?? "")],
      ["lead", (leadId ?? "") !== (existingEstimate.lead?.id ?? "")],
      ["description", estimate.description !== existingEstimate.description],
      ["scope", (estimate.scope ?? "") !== (existingEstimate.scope ?? "")],
      ["service location", (formatServiceAddress(estimate) ?? "") !== (existingEstimate.serviceLocation ?? "")],
      ["address line 1", (estimate.serviceAddressLine1 ?? "") !== (existingEstimate.serviceAddressLine1 ?? "")],
      ["address line 2", (estimate.serviceAddressLine2 ?? "") !== (existingEstimate.serviceAddressLine2 ?? "")],
      ["city", (estimate.serviceCity ?? "") !== (existingEstimate.serviceCity ?? "")],
      ["state", (estimate.serviceState ?? "") !== (existingEstimate.serviceState ?? "")],
      ["postal code", (estimate.servicePostalCode ?? "") !== (existingEstimate.servicePostalCode ?? "")],
      ["start date", (estimate.dateBegin?.getTime() ?? 0) !== (existingEstimate.dateBegin?.getTime() ?? 0)],
      ["end date", (estimate.dateEnd?.getTime() ?? 0) !== (existingEstimate.dateEnd?.getTime() ?? 0)],
      ["job type", jobType !== existingEstimate.jobType],
      ["labor total", Number(totals.laborCost) !== Number(existingEstimate.laborCost ?? 0)],
      ["tax rate", Number(estimate.materialTaxRate ?? 0) !== Number(existingEstimate.materialTaxRate ?? 0)],
      [
        "labor items",
        JSON.stringify(laborItems) !== JSON.stringify(normalizeItems(parsePricingItems(existingEstimate.laborItems))),
      ],
      [
        "materials",
        JSON.stringify(materials) !== JSON.stringify(normalizeMaterials(parseMaterials(existingEstimate.materials))),
      ],
      ["total", Number(totals.total) !== Number(existingEstimate.estimatedTotal ?? 0)],
    ] as const;
    customerDocumentChanged = changedCustomerDocumentFields.some(([, changed]) => changed);
    const customerCopyChangedFields = changedCustomerDocumentFields
      .filter(([, changed]) => changed)
      .map(([field]) => field);

    if (
      existingEstimate.printableEstimate &&
      !syncExistingEstimate &&
      (estimate.status === "Draft" || customerDocumentChanged)
    ) {
      return {
        success: false,
        message:
          estimate.status === "Draft"
            ? "Confirm that you want to unpublish this estimate before saving it as Draft."
            : "Confirm that you want to update the published customer copy before saving.",
        customerCopyChangedFields,
        requiresCustomerCopyConfirmation: true,
      };
    }

    if (!customerId && newCustomerName) {
      const customer = await createCustomerForEstimate({
        email: newCustomerEmail,
        name: newCustomerName,
        ownerId: currentUser.id,
        phone: newCustomerPhone,
        serviceAddress,
        serviceLocation: formatServiceAddress(estimate) ?? undefined,
      });
      customerId = customer.id;
    }

    customerId = customerId ?? selectedLead?.customerId ?? undefined;

    if (!customerId && !leadId && !newLeadName) {
      return {
        success: false,
        message: "Select an existing customer or lead, create a lead, or create a customer before saving the estimate.",
      };
    }

    if (customerId) {
      await assertCustomer(currentUser.id, customerId);
    }

    if (selectedLead?.estimateRecordId && selectedLead.estimateRecordId !== id) {
      return {
        success: false,
        message: "This lead is already linked to another estimate.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.estimateRecord.update({
        where: {
          id_ownerId: {
            id,
            ownerId: currentUser.id,
          },
        },
        data: {
          ...estimateInput,
          customerId: customerId ?? null,
          dateBegin: estimate.dateBegin ?? null,
          dateEnd: estimate.dateEnd ?? null,
          serviceLocation: formatServiceAddress(estimate) ?? null,
          serviceAddressLine1: estimate.serviceAddressLine1 || null,
          serviceAddressLine2: estimate.serviceAddressLine2 || null,
          serviceCity: estimate.serviceCity || null,
          serviceState: estimate.serviceState || null,
          servicePostalCode: estimate.servicePostalCode || null,
          laborCost: totals.laborCost,
          laborItems: JSON.stringify(laborItems),
          jobType,
          measurementRooms: JSON.stringify(normalizedMeasurementRooms),
          materialTaxRate: estimate.materialTaxRate ?? "8.25",
          materials: JSON.stringify(materials),
          estimatedTotal: totals.total,
          scope: estimate.scope || null,
          notes: estimate.notes || null,
        },
      });

      if (newLeadName) {
        await tx.lead.updateMany({
          where: {
            ownerId: currentUser.id,
            estimateRecordId: id,
          },
          data: {
            convertedAt: null,
            estimateRecordId: null,
            status: "New",
          },
        });

        await createLeadForEstimate({
          customerId,
          db: tx,
          email: newLeadEmail,
          estimateStatus: estimate.status,
          estimateRecordId: id,
          name: newLeadName,
          ownerId: currentUser.id,
          phone: newLeadPhone,
          serviceAddress,
          serviceLocation: formatServiceAddress(estimate) ?? undefined,
          serviceType: estimate.category,
          source: newLeadSource,
        });
      }

      if (leadId && selectedLead) {
        await tx.lead.updateMany({
          where: {
            ownerId: currentUser.id,
            estimateRecordId: id,
            id: {
              not: selectedLead.id,
            },
          },
          data: {
            convertedAt: null,
            estimateRecordId: null,
            status: "New",
          },
        });

        await tx.lead.update({
          where: {
            id_ownerId: {
              id: selectedLead.id,
              ownerId: currentUser.id,
            },
          },
          data: {
            customerId: customerId ?? selectedLead.customerId ?? null,
            estimateRecordId: id,
            status: getLeadStatusForEstimateStatus(estimate.status),
          },
        });
      }

      if (estimate.status === "Draft" && existingEstimate.printableEstimate) {
        await tx.estimate.delete({
          where: {
            id_ownerId: {
              id: existingEstimate.printableEstimate.id,
              ownerId: currentUser.id,
            },
          },
        });
        unpublishedCustomerCopy = true;
      } else if (estimate.status === "Ready to Send" || estimate.status === "Waiting on Customer") {
        if (!existingEstimate.printableEstimate || customerDocumentChanged) {
          syncedPrintableEstimateId = await upsertPrintableEstimateSnapshotFromRecord(tx, id, currentUser.id);
        } else if (estimate.status !== existingEstimate.status) {
          await tx.estimate.update({
            where: {
              id_ownerId: {
                id: existingEstimate.printableEstimate.id,
                ownerId: currentUser.id,
              },
            },
            data: {
              jobStatus: estimate.status,
            },
          });
        }
      } else if (existingEstimate.printableEstimate && syncExistingEstimate) {
        syncedPrintableEstimateId = await upsertPrintableEstimateSnapshotFromRecord(tx, id, currentUser.id);
      }
    });
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Estimate could not be updated." };
  }

  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/command-center");
  if (syncedPrintableEstimateId) {
    revalidatePath(`/dashboard/estimates/${syncedPrintableEstimateId}`);
  }

  return {
    success: true,
    message: unpublishedCustomerCopy
      ? "Estimate saved as Draft and the customer copy was unpublished."
      : previouslyPublished && previousStatus !== estimate.status && !customerDocumentChanged
        ? estimate.status === "Waiting on Customer"
          ? "Estimate marked Waiting on Customer."
          : estimate.status === "Ready to Send"
            ? "Estimate marked Ready to Send."
            : `Estimate marked ${estimate.status}.`
        : previouslyPublished && customerDocumentChanged
          ? previousStatus !== estimate.status
            ? `Estimate updated and marked ${estimate.status}.`
            : "Estimate and customer copy updated."
          : previouslyPublished
            ? "Estimate updated."
            : estimate.status === "Waiting on Customer"
              ? "Estimate published and marked Waiting on Customer."
              : estimate.status === "Ready to Send"
                ? "Estimate published and marked Ready to Send."
                : syncedPrintableEstimateId
                  ? "Estimate and customer copy updated."
                  : "Estimate updated.",
  };
}

export async function deleteEstimateRecordAction(
  _previousState: EstimateRecordMutationState,
  formData: FormData,
): Promise<EstimateRecordMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to delete an estimate." };
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return { success: false, message: "Estimate is required." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const estimate = await tx.estimateRecord.findUnique({
        where: {
          id_ownerId: {
            id,
            ownerId: currentUser.id,
          },
        },
        select: {
          convertedJobId: true,
          lead: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!estimate) {
        throw new Error("Estimate not found.");
      }

      if (estimate.lead && !estimate.convertedJobId) {
        await tx.lead.update({
          where: {
            id_ownerId: {
              id: estimate.lead.id,
              ownerId: currentUser.id,
            },
          },
          data: {
            convertedAt: null,
            status: "New",
          },
        });
      }

      await tx.estimateRecord.delete({
        where: {
          id_ownerId: {
            id,
            ownerId: currentUser.id,
          },
        },
      });
    });
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Estimate could not be deleted." };
  }

  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/customers");
  redirect("/dashboard/estimates");
}

export async function updateEstimateStatusAction(
  _previousState: EstimateRecordMutationState,
  formData: FormData,
): Promise<EstimateRecordMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to update an estimate." };
  }

  const parsed = updateEstimateStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Choose a status and try again." };
  }

  let hadPublishedEstimate = false;

  try {
    const estimate = await prisma.estimateRecord.findUnique({
      where: {
        id_ownerId: {
          id: parsed.data.id,
          ownerId: currentUser.id,
        },
      },
      include: {
        lead: true,
        printableEstimate: true,
      },
    });

    if (!estimate) {
      return { success: false, message: "Estimate not found." };
    }

    if (estimate.convertedJobId) {
      return { success: false, message: "A converted estimate must remain Won while its job exists." };
    }

    hadPublishedEstimate = Boolean(estimate.printableEstimate);
    const customerId = estimate.customerId;

    await prisma.$transaction(async (tx) => {
      await tx.estimateRecord.update({
        where: {
          id_ownerId: {
            id: parsed.data.id,
            ownerId: currentUser.id,
          },
        },
        data: {
          customerId,
          status: parsed.data.status,
        },
      });

      if (estimate.lead) {
        await tx.lead.update({
          where: {
            id_ownerId: {
              id: estimate.lead.id,
              ownerId: currentUser.id,
            },
          },
          data: {
            customerId: customerId ?? estimate.lead.customerId,
            status: getLeadStatusForEstimateStatus(parsed.data.status),
          },
        });
      }

      if (parsed.data.status === "Draft" && estimate.printableEstimate) {
        await tx.estimate.delete({
          where: {
            id_ownerId: {
              id: estimate.printableEstimate.id,
              ownerId: currentUser.id,
            },
          },
        });
      } else if (parsed.data.status === "Ready to Send" || parsed.data.status === "Waiting on Customer") {
        if (estimate.printableEstimate) {
          await tx.estimate.update({
            where: {
              id_ownerId: {
                id: estimate.printableEstimate.id,
                ownerId: currentUser.id,
              },
            },
            data: {
              jobStatus: parsed.data.status,
            },
          });
        } else {
          await upsertPrintableEstimateSnapshotFromRecord(tx, parsed.data.id, currentUser.id);
        }
      } else if (estimate.printableEstimate) {
        await tx.estimate.update({
          where: {
            id_ownerId: {
              id: estimate.printableEstimate.id,
              ownerId: currentUser.id,
            },
          },
          data: {
            jobStatus: parsed.data.status,
          },
        });
      }
    });
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Estimate status could not be updated.",
    };
  }

  revalidatePath("/dashboard/estimates");
  revalidatePath(`/dashboard/estimates/records/${parsed.data.id}`);
  return {
    success: true,
    message:
      parsed.data.status === "Waiting on Customer"
        ? hadPublishedEstimate
          ? "Estimate marked Waiting on Customer."
          : "Estimate published and marked Waiting on Customer."
        : parsed.data.status === "Ready to Send"
          ? hadPublishedEstimate
            ? "Estimate marked Ready to Send."
            : "Estimate published and marked Ready to Send."
          : parsed.data.status === "Draft"
            ? "Estimate returned to Draft and unpublished."
            : "Estimate status updated.",
  };
}

export async function convertEstimateToJobAction(
  _previousState: EstimateRecordMutationState,
  formData: FormData,
): Promise<EstimateRecordMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to convert an estimate." };
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return { success: false, message: "Estimate is required." };
  }

  let convertedJobId = "";

  try {
    const conversion = await prisma.$transaction(async (tx) => {
      const estimate = await tx.estimateRecord.findUnique({
        where: {
          id_ownerId: {
            id,
            ownerId: currentUser.id,
          },
        },
        include: {
          lead: true,
          printableEstimate: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!estimate) {
        throw new Error("Estimate not found.");
      }

      if (estimate.convertedJobId) {
        throw new Error("This estimate has already been converted to a job.");
      }

      if (estimate.status !== "Waiting on Customer") {
        throw new Error("Only estimates waiting on a customer decision can be converted to a job.");
      }

      let customerId = estimate.customerId;

      if (!customerId && estimate.lead) {
        const customer = await findOrCreateCustomerForLead({
          db: tx,
          lead: estimate.lead,
          ownerId: currentUser.id,
          serviceAddress: estimate,
          serviceLocation: formatServiceAddress(estimate) ?? undefined,
        });

        customerId = customer.id;
      }

      if (!customerId) {
        throw new Error("Add a customer or lead before converting this estimate to a job.");
      }

      const job = await tx.job.create({
        data: {
          ownerId: currentUser.id,
          customerId,
          description: estimate.description,
          serviceLocation: formatServiceAddress(estimate) ?? undefined,
          serviceAddressLine1: estimate.serviceAddressLine1,
          serviceAddressLine2: estimate.serviceAddressLine2,
          serviceCity: estimate.serviceCity,
          serviceState: estimate.serviceState,
          servicePostalCode: estimate.servicePostalCode,
          dateBegin: estimate.dateBegin,
          dateEnd: estimate.dateEnd,
          estimatedCost: "0",
          laborCost: estimate.laborCost ?? "0",
          laborItems: estimate.laborItems,
          jobType: estimate.jobType,
          measurementRooms: estimate.measurementRooms,
          materialTaxRate: estimate.materialTaxRate ?? "0",
          materials: estimate.materials,
          finalCost: estimate.estimatedTotal ?? "0",
          amountPaid: "0",
          paymentStatus: "Pending Payment",
          scope: estimate.scope,
          category: estimate.category,
          status: estimate.dateBegin || estimate.dateEnd ? "Scheduled" : "Unscheduled",
          notes: estimate.notes,
        },
      });

      const updatedEstimate = await tx.estimateRecord.updateMany({
        where: {
          convertedJobId: null,
          id,
          ownerId: currentUser.id,
          status: "Waiting on Customer",
        },
        data: {
          status: "Won",
          convertedJobId: job.id,
          customerId,
        },
      });

      if (updatedEstimate.count !== 1) {
        throw new Error("This estimate was already updated. Refresh the page and try again.");
      }

      if (estimate.lead) {
        await tx.lead.update({
          where: {
            id_ownerId: {
              id: estimate.lead.id,
              ownerId: currentUser.id,
            },
          },
          data: {
            customerId,
            status: "Won",
            convertedAt: new Date(),
          },
        });
      }

      if (estimate.printableEstimate) {
        await tx.estimate.update({
          where: {
            id_ownerId: {
              id: estimate.printableEstimate.id,
              ownerId: currentUser.id,
            },
          },
          data: {
            customerId,
            jobStatus: "Won",
          },
        });
      }

      await syncCustomerBillingStatus(customerId, currentUser.id, tx);
      return { jobId: job.id };
    });

    convertedJobId = conversion.jobId;
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Estimate could not be converted." };
  }

  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/jobs");
  revalidatePath(`/dashboard/jobs/${convertedJobId}`);
  revalidatePath("/dashboard/customers");
  return {
    success: true,
    message: "Estimate converted to job.",
    redirectTo: `/dashboard/jobs/${convertedJobId}`,
  };
}

export async function createPrintableEstimateAction(
  _previousState: EstimateRecordMutationState,
  formData: FormData,
): Promise<EstimateRecordMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to publish an estimate." };
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return { success: false, message: "Estimate is required." };
  }

  try {
    const printableEstimateId = await prisma.$transaction(async (tx) => {
      const estimate = await tx.estimateRecord.findUnique({
        where: {
          id_ownerId: {
            id,
            ownerId: currentUser.id,
          },
        },
        select: {
          lead: {
            select: {
              id: true,
            },
          },
          status: true,
        },
      });

      if (!estimate) {
        throw new Error("Estimate not found.");
      }

      if (estimate.status === "Draft") {
        await tx.estimateRecord.update({
          where: {
            id_ownerId: {
              id,
              ownerId: currentUser.id,
            },
          },
          data: {
            status: "Ready to Send",
          },
        });
      }

      if (estimate.lead) {
        await tx.lead.update({
          where: {
            id_ownerId: {
              id: estimate.lead.id,
              ownerId: currentUser.id,
            },
          },
          data: {
            status: getLeadStatusForEstimateStatus(estimate.status === "Draft" ? "Ready to Send" : estimate.status),
          },
        });
      }

      return upsertPrintableEstimateSnapshotFromRecord(tx, id, currentUser.id);
    });
    revalidatePath(`/dashboard/estimates/${printableEstimateId}`);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Estimate could not be published.",
    };
  }

  revalidatePath("/dashboard/estimates");
  revalidatePath(`/dashboard/estimates/records/${id}`);
  redirect(`/dashboard/estimates/records/${id}?view=customer`);
}
