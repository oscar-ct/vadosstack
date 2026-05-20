"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { calculateOutstandingBalance } from "@/lib/customer-billing";
import { prisma } from "@/lib/prisma";

import { calculateSignedMaterialTotal } from "../jobs/_components/materials";
import type { InvoiceMutationState } from "./types";

const invoiceJobSchema = z.object({
  jobId: z.string().trim().min(1, "Job is required."),
});

const deleteInvoiceSchema = z.object({
  id: z.string().trim().min(1, "Invoice is required."),
  redirectTo: z.string().trim().optional(),
});

function parseInvoiceMaterials(value: string) {
  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((material) => ({
        description: String(material?.description ?? "").trim(),
        type: material?.type === "return" ? ("return" as const) : ("purchase" as const),
        vendor: String(material?.vendor ?? "").trim(),
        purchaseDate: String(material?.purchaseDate ?? "").trim(),
        quantity: String(material?.quantity ?? "").trim(),
        unitPrice: String(material?.unitPrice ?? material?.price ?? "").trim(),
        price: String(material?.price ?? "").trim(),
      }))
      .filter((material) => material.description && material.price);
  } catch {
    return [];
  }
}

function toMoney(value: { toString: () => string } | null | undefined) {
  return value?.toString() ?? "0";
}

export async function createInvoiceAction(
  _previousState: InvoiceMutationState,
  formData: FormData,
): Promise<InvoiceMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to create an invoice.",
    };
  }

  const parsed = invoiceJobSchema.safeParse({
    jobId: formData.get("jobId"),
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
          id: parsed.data.jobId,
          ownerId: currentUser.id,
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

    if (!job) {
      return {
        success: false,
        message: "Job could not be found.",
      };
    }

    if (job.invoice) {
      return {
        success: false,
        message: "This job already has an invoice. Delete the existing invoice before creating a new one.",
      };
    }

    if (job.status !== "Completed") {
      return {
        success: false,
        message: "Complete the job before creating an invoice.",
      };
    }

    const materials = parseInvoiceMaterials(job.materials);
    const materialsSubtotal = materials.reduce(
      (total, material) => total + Number(calculateSignedMaterialTotal(material)),
      0,
    );
    const laborCost = Number(job.laborCost ?? 0);
    const materialTaxRate = Number(job.materialTaxRate ?? 0);
    const materialTaxAmount = (laborCost + materialsSubtotal) * (materialTaxRate / 100);
    const balanceDue = calculateOutstandingBalance(job.status, job.finalCost?.toString(), job.amountPaid?.toString());

    await prisma.invoice.create({
      data: {
        ownerId: currentUser.id,
        jobId: job.id,
        customerId: job.customerId,
        customerName: job.customer?.name,
        customerEmail: job.customer?.email,
        customerPhone: job.customer?.phoneNumbers[0]?.value,
        jobTitle: job.description,
        jobDescription: job.scope,
        serviceLocation: job.serviceLocation,
        dateBegin: job.dateBegin,
        dateEnd: job.dateEnd,
        laborCost: toMoney(job.laborCost),
        materialTaxRate: toMoney(job.materialTaxRate),
        materials: JSON.stringify(materials),
        materialsSubtotal: materialsSubtotal.toFixed(2),
        materialTaxAmount: materialTaxAmount.toFixed(2),
        finalCost: toMoney(job.finalCost),
        amountPaid: toMoney(job.amountPaid),
        balanceDue: balanceDue.toFixed(2),
        paymentStatus: job.paymentStatus,
        jobStatus: job.status,
      },
    });
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Invoice could not be created. Please try again.",
    };
  }

  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/invoices");

  return {
    success: true,
    message: "Invoice created.",
  };
}

export async function deleteInvoiceAction(
  _previousState: InvoiceMutationState,
  formData: FormData,
): Promise<InvoiceMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to delete an invoice.",
    };
  }

  const parsed = deleteInvoiceSchema.safeParse({
    id: formData.get("id"),
    redirectTo: formData.get("redirectTo"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select an invoice and try again.",
    };
  }

  try {
    await prisma.invoice.delete({
      where: {
        id_ownerId: {
          id: parsed.data.id,
          ownerId: currentUser.id,
        },
      },
    });
  } catch {
    return {
      success: false,
      message: "Invoice could not be deleted. Please try again.",
    };
  }

  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/invoices");

  if (parsed.data.redirectTo?.startsWith("/dashboard/")) {
    redirect(parsed.data.redirectTo);
  }

  return {
    success: true,
    message: "Invoice deleted.",
  };
}
