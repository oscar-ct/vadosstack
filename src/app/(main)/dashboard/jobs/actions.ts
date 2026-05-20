"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { deriveCustomerBillingStatus, deriveJobPaymentStatus } from "@/lib/customer-billing";
import { normalizePhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

import { calculateSignedMaterialTotal, parseMaterials } from "./_components/materials";
import { parsePricingItems } from "./_components/pricing-items";

const jobStatuses = ["Unscheduled", "Scheduled", "In Progress", "Completed", "On Hold", "Cancelled"] as const;

export type JobMutationState = {
  success: boolean;
  message: string;
};

const emptyToUndefined = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
};

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

const materialsSchema = z.array(
  z.object({
    type: z.enum(["purchase", "return"]).optional(),
    description: z.string().trim().min(1, "Material description is required."),
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
    unitPrice: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid material unit price."),
    price: z
      .string()
      .trim()
      .refine((value) => value.length > 0 && !Number.isNaN(Number(value)), "Enter a valid material amount."),
  }),
);

const laborItemsSchema = z.array(
  z.object({
    description: z.string().trim().min(1, "Labor description is required."),
    price: z
      .string()
      .trim()
      .refine((value) => value.length > 0 && !Number.isNaN(Number(value)), "Enter a valid labor price."),
  }),
);

const jobSchema = z.object({
  customerId: z.string().trim().optional(),
  newCustomerName: z.string().trim().optional(),
  newCustomerEmail: z.string().trim().optional(),
  newCustomerPhone: z.string().trim().optional(),
  description: z.string().trim().min(1, "Job title is required."),
  serviceLocation: z.string().trim().optional(),
  dateBegin: optionalDate,
  dateEnd: optionalDate,
  estimatedCost: optionalMoney,
  laborItems: laborItemsSchema,
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
  return {
    customerId: emptyToUndefined(formData.get("customerId")),
    newCustomerName: emptyToUndefined(formData.get("newCustomerName")),
    newCustomerEmail: emptyToUndefined(formData.get("newCustomerEmail")),
    newCustomerPhone: emptyToUndefined(formData.get("newCustomerPhone")),
    description: formData.get("description"),
    serviceLocation: emptyToUndefined(formData.get("serviceLocation")),
    dateBegin: emptyToUndefined(formData.get("dateBegin")),
    dateEnd: emptyToUndefined(formData.get("dateEnd")),
    estimatedCost: emptyToUndefined(formData.get("estimatedCost")),
    laborItems: parsePricingItems(String(formData.get("laborItems") ?? "")),
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

async function createCustomerForJob({
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
  if (!name || !phone) {
    throw new Error("Enter a customer name and phone number before creating the job.");
  }

  const normalizedPhone = normalizePhoneNumber(phone);

  if (normalizedPhone.length !== 10) {
    throw new Error("Enter a valid 10-digit phone number before creating the job.");
  }

  const parsedEmail = email ? z.string().trim().email("Enter a valid customer email.").safeParse(email) : undefined;

  if (parsedEmail && !parsedEmail.success) {
    throw new Error(parsedEmail.error.issues[0]?.message ?? "Enter a valid customer email.");
  }

  try {
    if (parsedEmail?.data) {
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
        throw new Error(
          "A customer with that email already exists in your account. Select them from the customer list.",
        );
      }
    }

    return await prisma.customer.create({
      data: {
        ownerId,
        name,
        email: parsedEmail?.data ?? null,
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
    if (parsedEmail?.data && error instanceof Error && error.message.includes("Unique constraint failed")) {
      throw new Error("A customer with that email already exists in your account. Select them from the customer list.");
    }

    throw error;
  }
}

function normalizeMaterials(
  materials: Array<{
    description: string;
    type?: "purchase" | "return";
    vendor?: string;
    purchaseDate?: string;
    quantity?: string;
    unitPrice?: string;
    price: string;
  }>,
) {
  return materials
    .map((material) => ({
      description: material.description,
      type: material.type ?? "purchase",
      vendor: material.vendor ?? "",
      purchaseDate: material.purchaseDate ?? "",
      quantity: material.quantity ?? "",
      unitPrice: material.unitPrice ?? "",
      price: material.price,
    }))
    .filter((material) => material.description.trim() && material.price.trim());
}

function normalizeLaborItems(laborItems: Array<{ description: string; price: string }>) {
  return laborItems.filter((item) => item.description.trim() && item.price.trim());
}

function calculateFinalCost(job: {
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
  const tax = (laborCost + materialsSubtotal) * (materialTaxRate / 100);

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
        balanceDue: Math.max(0, finalCost - Number(amountPaid)).toFixed(2),
        paymentStatus,
      },
    });
  }

  await syncCustomerBillingStatus(job.customerId, ownerId);
}

export async function createJobAction(_previousState: JobMutationState, formData: FormData): Promise<JobMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to create a job.",
    };
  }

  const parsed = createJobSchema.safeParse(getJobPayload(formData));

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the job details and try again.",
    };
  }

  try {
    const { newCustomerEmail, newCustomerName, newCustomerPhone, ...job } = parsed.data;
    const materials = normalizeMaterials(job.materials);
    const laborItems = normalizeLaborItems(job.laborItems);
    const laborCost = laborItems.reduce((total, item) => total + Number(item.price), 0).toFixed(2);
    const calculatedFinalCost = calculateFinalCost({ ...job, laborItems, materials });
    const normalizedStatus = normalizeJobStatus(job.status, job.dateBegin, job.dateEnd);

    let customerId = job.customerId;

    if (!customerId && newCustomerName) {
      const customer = await createCustomerForJob({
        email: newCustomerEmail,
        name: newCustomerName,
        ownerId: currentUser.id,
        phone: newCustomerPhone,
        serviceLocation: job.serviceLocation,
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
            ownerId: currentUser.id,
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
        ownerId: currentUser.id,
        customerId: customerId || null,
        serviceLocation: job.serviceLocation || null,
        estimatedCost: "0",
        laborCost,
        laborItems: JSON.stringify(laborItems),
        materialTaxRate: job.materialTaxRate ?? "0",
        materials: JSON.stringify(materials),
        paymentStatus: deriveJobPaymentStatus(normalizedStatus, calculatedFinalCost, "0"),
        amountPaid: "0.00",
        finalCost: calculatedFinalCost,
        status: normalizedStatus,
        scope: job.scope || null,
        notes: job.notes || null,
      },
    });

    await syncCustomerBillingStatus(createdJob.customerId, currentUser.id);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Job could not be created. Please try again.",
    };
  }

  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/customers");

  return {
    success: true,
    message: "Job created.",
  };
}

export async function updateJobAction(_previousState: JobMutationState, formData: FormData): Promise<JobMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message:
        "Your session expired before this job could be saved. Keep this window open, sign in again in another tab, then come back and save.",
    };
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

  const { id, newCustomerEmail, newCustomerName, newCustomerPhone, ...job } = parsed.data;

  try {
    const materials = normalizeMaterials(job.materials);
    const laborItems = normalizeLaborItems(job.laborItems);
    const laborCost = laborItems.reduce((total, item) => total + Number(item.price), 0).toFixed(2);
    const calculatedFinalCost = calculateFinalCost({ ...job, laborItems, materials });
    const normalizedStatus = normalizeJobStatus(job.status, job.dateBegin, job.dateEnd);
    const existingJob = await prisma.job.findUnique({
      where: {
        id_ownerId: {
          id,
          ownerId: currentUser.id,
        },
      },
      select: {
        customerId: true,
        id: true,
      },
    });

    let customerId = job.customerId;

    if (!customerId && newCustomerName) {
      const customer = await createCustomerForJob({
        email: newCustomerEmail,
        name: newCustomerName,
        ownerId: currentUser.id,
        phone: newCustomerPhone,
        serviceLocation: job.serviceLocation,
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
            ownerId: currentUser.id,
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
          ownerId: currentUser.id,
        },
      },
      data: {
        ...job,
        customerId: customerId || null,
        serviceLocation: job.serviceLocation || null,
        estimatedCost: "0",
        laborCost,
        laborItems: JSON.stringify(laborItems),
        materialTaxRate: job.materialTaxRate ?? "0",
        materials: JSON.stringify(materials),
        paymentStatus: deriveJobPaymentStatus(normalizedStatus, calculatedFinalCost, await getJobPaidTotal(id)),
        finalCost: calculatedFinalCost,
        status: normalizedStatus,
        scope: job.scope || null,
        notes: job.notes || null,
      },
    });

    await syncJobPaymentSummary(updatedJob.id, currentUser.id);

    await syncCustomerBillingStatus(existingJob?.customerId, currentUser.id);
    if (updatedJob.customerId !== existingJob?.customerId) {
      await syncCustomerBillingStatus(updatedJob.customerId, currentUser.id);
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Job could not be updated. Please try again.",
    };
  }

  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/customers");

  return {
    success: true,
    message: "Job updated.",
  };
}

const jobPaymentSchema = z.object({
  jobId: z.string().trim().min(1, "Job is required."),
  paidOn: z
    .string()
    .trim()
    .min(1, "Payment date is required.")
    .transform((value) => new Date(value))
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

export async function createJobPaymentAction(
  _previousState: JobMutationState,
  formData: FormData,
): Promise<JobMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to record a payment.",
    };
  }

  const parsed = jobPaymentSchema.safeParse({
    jobId: formData.get("jobId"),
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
          ownerId: currentUser.id,
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

    await prisma.jobPayment.create({
      data: {
        ownerId: currentUser.id,
        jobId: parsed.data.jobId,
        paidOn: parsed.data.paidOn,
        amount: Number(parsed.data.amount).toFixed(2),
        method: parsed.data.method,
        referenceNumber: parsed.data.referenceNumber || null,
        description: parsed.data.description,
        notes: parsed.data.notes || null,
      },
    });

    await syncJobPaymentSummary(parsed.data.jobId, currentUser.id);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Payment could not be recorded. Please try again.",
    };
  }

  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/invoices");

  return {
    success: true,
    message: "Payment recorded.",
  };
}

export async function deleteJobPaymentAction(
  _previousState: JobMutationState,
  formData: FormData,
): Promise<JobMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to delete a payment.",
    };
  }

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
          ownerId: currentUser.id,
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
          ownerId: currentUser.id,
        },
      },
    });

    await syncJobPaymentSummary(payment.jobId, currentUser.id);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Payment could not be deleted. Please try again.",
    };
  }

  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/invoices");

  return {
    success: true,
    message: "Payment deleted.",
  };
}

const deleteJobSchema = z.object({
  id: z.string().trim().min(1, "Job is required."),
});

export async function deleteJobAction(_previousState: JobMutationState, formData: FormData): Promise<JobMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to delete a job.",
    };
  }

  const parsed = deleteJobSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select a job and try again.",
    };
  }

  try {
    const job = await prisma.job.findUnique({
      where: {
        id_ownerId: {
          id: parsed.data.id,
          ownerId: currentUser.id,
        },
      },
      select: {
        customerId: true,
      },
    });

    await prisma.$transaction([
      prisma.estimateRecord.updateMany({
        where: {
          ownerId: currentUser.id,
          convertedJobId: parsed.data.id,
        },
        data: {
          convertedJobId: null,
          status: "Estimate Provided",
        },
      }),
      prisma.job.delete({
        where: {
          id_ownerId: {
            id: parsed.data.id,
            ownerId: currentUser.id,
          },
        },
      }),
    ]);

    await syncCustomerBillingStatus(job?.customerId, currentUser.id);
  } catch {
    return {
      success: false,
      message: "Job could not be deleted. Please try again.",
    };
  }

  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/estimates");

  return {
    success: true,
    message: "Job deleted.",
  };
}
