"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { deriveCustomerBillingStatus } from "@/lib/customer-billing";
import { normalizePhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

import { parseMaterials } from "../jobs/_components/materials";
import { parsePricingItems } from "../jobs/_components/pricing-items";

export type EstimateRecordMutationState = {
  success: boolean;
  message: string;
};

const estimateRecordStatuses = ["Draft", "Ready to Send", "Waiting on Customer", "Won", "Lost"] as const;

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
        (value) => !value || (!Number.isNaN(Number(value)) && Number(value) > 0),
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

const estimateRecordSchema = z.object({
  customerId: z.string().trim().optional(),
  newCustomerName: z.string().trim().optional(),
  newCustomerEmail: z.string().trim().optional(),
  newCustomerPhone: z.string().trim().optional(),
  description: z.string().trim().min(1, "Title is required."),
  serviceLocation: z.string().trim().optional(),
  dateBegin: optionalDate,
  dateEnd: optionalDate,
  laborItems: lineItemsSchema,
  materialTaxRate: optionalMoney,
  materials: materialsSchema,
  scope: z.string().trim().optional(),
  category: z.string().trim().min(1, "Category is required."),
  status: z.enum(estimateRecordStatuses),
  notes: z.string().trim().optional(),
});

const createEstimateRecordSchema = estimateRecordSchema.refine(
  (estimate) => !estimate.dateBegin || !estimate.dateEnd || estimate.dateEnd >= estimate.dateBegin,
  "End date must be after begin date.",
);

const updateEstimateRecordSchema = createEstimateRecordSchema.and(
  z.object({
    id: z.string().trim().min(1, "Estimate is required."),
  }),
);

const updateEstimateStatusSchema = z.object({
  id: z.string().trim().min(1, "Estimate is required."),
  status: z.enum(estimateRecordStatuses),
});

function getEstimatePayload(formData: FormData) {
  return {
    customerId: emptyToUndefined(formData.get("customerId")),
    newCustomerName: emptyToUndefined(formData.get("newCustomerName")),
    newCustomerEmail: emptyToUndefined(formData.get("newCustomerEmail")),
    newCustomerPhone: emptyToUndefined(formData.get("newCustomerPhone")),
    description: formData.get("description"),
    serviceLocation: emptyToUndefined(formData.get("serviceLocation")),
    dateBegin: emptyToUndefined(formData.get("dateBegin")),
    dateEnd: emptyToUndefined(formData.get("dateEnd")),
    laborItems: parsePricingItems(String(formData.get("laborItems") ?? "")),
    materialTaxRate: emptyToUndefined(formData.get("materialTaxRate")),
    materials: parseMaterials(String(formData.get("materials") ?? "")),
    scope: emptyToUndefined(formData.get("scope")),
    category: formData.get("category"),
    status: formData.get("status"),
    notes: emptyToUndefined(formData.get("notes")),
  };
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

function normalizeMaterials<
  T extends { description?: string; quantity?: string; unit?: string; unitPrice?: string; price?: string },
>(items: T[]) {
  return items
    .map((item) => ({
      ...item,
      description: item.description ?? "",
      quantity: item.quantity ?? "",
      unit: item.unit ?? "",
      unitPrice: normalizeMoney(item.unitPrice, ""),
      price: normalizeMoney(item.price),
    }))
    .filter(
      (item) =>
        item.description.trim() ||
        item.quantity.trim() ||
        item.unit.trim() ||
        item.unitPrice.trim() ||
        (item.price.trim() && Number(item.price) !== 0),
    )
    .filter(
      (item) =>
        item.description.trim() ||
        item.quantity.trim() ||
        item.unit.trim() ||
        item.unitPrice.trim() ||
        Number(item.price) !== 0,
    );
}

function calculateTotal(input: {
  laborItems: Array<{ price: string }>;
  materialTaxRate?: string;
  materials: Array<{ price: string }>;
}) {
  const laborCost = input.laborItems.reduce((total, item) => total + Number(item.price), 0);
  const materialsSubtotal = input.materials.reduce((total, item) => total + Number(item.price), 0);
  const tax = (laborCost + materialsSubtotal) * (Number(input.materialTaxRate ?? 0) / 100);

  return {
    laborCost: laborCost.toFixed(2),
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

async function createCustomerForEstimate({
  email,
  name,
  ownerId,
  phone,
  serviceLocation,
}: {
  email?: string;
  name?: string;
  ownerId: string;
  phone?: string;
  serviceLocation?: string;
}) {
  if (!name || !email || !phone) {
    throw new Error("Enter a customer name, email, and phone number before creating the estimate.");
  }

  const normalizedPhone = normalizePhoneNumber(phone);

  if (normalizedPhone.length !== 10) {
    throw new Error("Enter a valid 10-digit phone number before creating the estimate.");
  }

  const parsedEmail = z.string().trim().email("Enter a valid customer email.").safeParse(email);

  if (!parsedEmail.success) {
    throw new Error(parsedEmail.error.issues[0]?.message ?? "Enter a valid customer email.");
  }

  try {
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        email: parsedEmail.data,
        ownerId,
      },
      select: {
        id: true,
      },
    });

    if (existingCustomer) {
      throw new Error("A customer with that email already exists in your account. Select them from the customer list.");
    }

    return await prisma.customer.create({
      data: {
        ownerId,
        name,
        email: parsedEmail.data,
        billingStatus: "No Balance",
        addresses: serviceLocation
          ? {
              create: {
                label: "Service Location",
                line1: serviceLocation,
              },
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

async function syncCustomerBillingStatus(customerId: string | null | undefined, ownerId: string) {
  if (!customerId) return;

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

  try {
    const { newCustomerEmail, newCustomerName, newCustomerPhone, ...estimate } = parsed.data;
    const laborItems = normalizeItems(estimate.laborItems);
    const materials = normalizeMaterials(estimate.materials);
    const totals = calculateTotal({ ...estimate, laborItems, materials });
    let customerId = estimate.customerId;

    if (!customerId && newCustomerName) {
      const customer = await createCustomerForEstimate({
        email: newCustomerEmail,
        name: newCustomerName,
        ownerId: currentUser.id,
        phone: newCustomerPhone,
        serviceLocation: estimate.serviceLocation,
      });
      customerId = customer.id;
    }

    if (!customerId) {
      return {
        success: false,
        message: "Select an existing customer or create a new customer before saving the estimate.",
      };
    }

    await assertCustomer(currentUser.id, customerId);

    await prisma.estimateRecord.create({
      data: {
        ...estimate,
        ownerId: currentUser.id,
        customerId,
        serviceLocation: estimate.serviceLocation || null,
        laborCost: totals.laborCost,
        laborItems: JSON.stringify(laborItems),
        materialTaxRate: estimate.materialTaxRate ?? "8.25",
        materials: JSON.stringify(materials),
        estimatedTotal: totals.total,
        scope: estimate.scope || null,
        notes: estimate.notes || null,
      },
    });
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Estimate could not be created." };
  }

  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/customers");
  return { success: true, message: "Estimate created." };
}

export async function updateEstimateRecordAction(
  _previousState: EstimateRecordMutationState,
  formData: FormData,
): Promise<EstimateRecordMutationState> {
  const currentUser = await getCurrentUser();

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

  const { id, newCustomerEmail, newCustomerName, newCustomerPhone, ...estimate } = parsed.data;

  try {
    const laborItems = normalizeItems(estimate.laborItems);
    const materials = normalizeMaterials(estimate.materials);
    const totals = calculateTotal({ ...estimate, laborItems, materials });
    let customerId = estimate.customerId;

    if (!customerId && newCustomerName) {
      const customer = await createCustomerForEstimate({
        email: newCustomerEmail,
        name: newCustomerName,
        ownerId: currentUser.id,
        phone: newCustomerPhone,
        serviceLocation: estimate.serviceLocation,
      });
      customerId = customer.id;
    }

    if (!customerId) {
      return {
        success: false,
        message: "Select an existing customer or create a new customer before saving the estimate.",
      };
    }

    await assertCustomer(currentUser.id, customerId);

    await prisma.estimateRecord.update({
      where: {
        id_ownerId: {
          id,
          ownerId: currentUser.id,
        },
      },
      data: {
        ...estimate,
        customerId,
        serviceLocation: estimate.serviceLocation || null,
        laborCost: totals.laborCost,
        laborItems: JSON.stringify(laborItems),
        materialTaxRate: estimate.materialTaxRate ?? "8.25",
        materials: JSON.stringify(materials),
        estimatedTotal: totals.total,
        scope: estimate.scope || null,
        notes: estimate.notes || null,
      },
    });
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Estimate could not be updated." };
  }

  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/customers");
  return { success: true, message: "Estimate updated." };
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

  await prisma.estimateRecord.delete({
    where: {
      id_ownerId: {
        id,
        ownerId: currentUser.id,
      },
    },
  });

  revalidatePath("/dashboard/estimates");
  return { success: true, message: "Estimate deleted." };
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

  try {
    const estimate = await prisma.estimateRecord.findUnique({
      where: {
        id_ownerId: {
          id: parsed.data.id,
          ownerId: currentUser.id,
        },
      },
      include: {
        printableEstimate: true,
      },
    });

    if (!estimate) {
      return { success: false, message: "Estimate not found." };
    }

    await prisma.$transaction([
      prisma.estimateRecord.update({
        where: {
          id_ownerId: {
            id: parsed.data.id,
            ownerId: currentUser.id,
          },
        },
        data: {
          status: parsed.data.status,
        },
      }),
      ...(estimate.printableEstimate
        ? [
            prisma.estimate.update({
              where: {
                id_ownerId: {
                  id: estimate.printableEstimate.id,
                  ownerId: currentUser.id,
                },
              },
              data: {
                jobStatus: parsed.data.status,
              },
            }),
          ]
        : []),
    ]);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Estimate status could not be updated.",
    };
  }

  revalidatePath("/dashboard/estimates");
  return { success: true, message: "Estimate status updated." };
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

  try {
    const estimate = await prisma.estimateRecord.findUnique({
      where: {
        id_ownerId: {
          id,
          ownerId: currentUser.id,
        },
      },
    });

    if (!estimate) {
      return { success: false, message: "Estimate not found." };
    }

    if (estimate.convertedJobId) {
      return { success: false, message: "This estimate has already been converted to a job." };
    }

    const job = await prisma.job.create({
      data: {
        ownerId: currentUser.id,
        customerId: estimate.customerId,
        description: estimate.description,
        serviceLocation: estimate.serviceLocation,
        dateBegin: null,
        dateEnd: null,
        estimatedCost: "0",
        laborCost: estimate.laborCost ?? "0",
        laborItems: estimate.laborItems,
        materialTaxRate: estimate.materialTaxRate ?? "0",
        materials: estimate.materials,
        finalCost: estimate.estimatedTotal ?? "0",
        amountPaid: "0",
        paymentStatus: "Pending Payment",
        scope: estimate.scope,
        category: estimate.category,
        status: "Unscheduled",
        notes: estimate.notes,
      },
    });

    await prisma.estimateRecord.update({
      where: {
        id_ownerId: {
          id,
          ownerId: currentUser.id,
        },
      },
      data: {
        status: "Won",
        convertedJobId: job.id,
      },
    });

    await syncCustomerBillingStatus(job.customerId, currentUser.id);
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Estimate could not be converted." };
  }

  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/customers");
  return { success: true, message: "Estimate converted to job." };
}

export async function createPrintableEstimateAction(
  _previousState: EstimateRecordMutationState,
  formData: FormData,
): Promise<EstimateRecordMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to create a printable estimate." };
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return { success: false, message: "Estimate is required." };
  }

  try {
    const estimate = await prisma.estimateRecord.findUnique({
      where: {
        id_ownerId: {
          id,
          ownerId: currentUser.id,
        },
      },
      include: {
        customer: {
          include: {
            phoneNumbers: true,
          },
        },
        printableEstimate: true,
      },
    });

    if (!estimate) {
      return { success: false, message: "Estimate not found." };
    }

    if (estimate.printableEstimate) {
      return { success: false, message: "This estimate already has a printable version." };
    }

    const laborItems = normalizeItems(parsePricingItems(estimate.laborItems));
    const materials = normalizeMaterials(parseMaterials(estimate.materials));
    const printableItems = [
      ...laborItems.map((item) => ({ ...item, type: "labor" })),
      ...materials.map((item) => ({ ...item, type: "material" })),
    ];
    const materialsSubtotal = calculateSubtotal(materials);
    const materialTaxAmount =
      ((Number(estimate.laborCost ?? 0) + materialsSubtotal) * Number(estimate.materialTaxRate ?? 0)) / 100;

    await prisma.estimate.create({
      data: {
        ownerId: currentUser.id,
        estimateRecordId: estimate.id,
        customerId: estimate.customerId,
        customerName: estimate.customer?.name,
        customerEmail: estimate.customer?.email,
        customerPhone: estimate.customer?.phoneNumbers[0]?.value,
        jobTitle: estimate.description,
        jobDescription: estimate.scope,
        serviceLocation: estimate.serviceLocation,
        dateBegin: estimate.dateBegin,
        dateEnd: estimate.dateEnd,
        laborCost: estimate.laborCost ?? "0",
        materialTaxRate: estimate.materialTaxRate ?? "0",
        materials: JSON.stringify(printableItems),
        materialsSubtotal: materialsSubtotal.toFixed(2),
        materialTaxAmount: materialTaxAmount.toFixed(2),
        estimatedTotal: estimate.estimatedTotal ?? "0",
        jobStatus: estimate.status === "Draft" ? "Ready to Send" : estimate.status,
      },
    });

    if (estimate.status === "Draft") {
      await prisma.estimateRecord.update({
        where: {
          id_ownerId: {
            id: estimate.id,
            ownerId: currentUser.id,
          },
        },
        data: {
          status: "Ready to Send",
        },
      });
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Printable estimate could not be created.",
    };
  }

  revalidatePath("/dashboard/estimates");
  return { success: true, message: "Printable estimate created." };
}
