"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { parseMaterials } from "../jobs/_components/materials";
import { parsePricingItems } from "../jobs/_components/pricing-items";

export type ServiceTemplateMutationState = {
  success: boolean;
  message: string;
};

const serviceCategories = ["Repair", "Installation", "Other"] as const;

const optionalMoney = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid tax rate.")
  .transform((value) => (value ? value : "0"));

const lineItemSchema = z.object({
  description: z.string().trim(),
  price: z.string().trim(),
});

const materialItemSchema = z.object({
  description: z.string().trim(),
  quantity: z.string().trim(),
  unitPrice: z.string().trim(),
  price: z.string().trim(),
});

const serviceTemplateSchema = z.object({
  title: z.string().trim().min(1, "Service title is required."),
  description: z.string().trim().optional(),
  category: z.enum(serviceCategories),
  notes: z.string().trim().optional(),
  laborItems: z.array(lineItemSchema),
  materialTaxRate: optionalMoney,
  materials: z.array(materialItemSchema),
});

const updateServiceTemplateSchema = serviceTemplateSchema.extend({
  id: z.string().trim().min(1, "Service is required."),
});

function emptyToUndefined(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}

function getServicePayload(formData: FormData) {
  return {
    title: formData.get("title"),
    description: emptyToUndefined(formData.get("description")),
    category: formData.get("category"),
    notes: emptyToUndefined(formData.get("notes")),
    laborItems: parsePricingItems(String(formData.get("laborItems") ?? "")),
    materialTaxRate: emptyToUndefined(formData.get("materialTaxRate")),
    materials: parseMaterials(String(formData.get("materials") ?? "")),
  };
}

function normalizeItems(items: Array<{ description: string; price: string }>, label: string) {
  return items
    .map((item) => ({
      description: item.description.trim(),
      price: item.price.trim(),
    }))
    .filter((item) => item.description || item.price)
    .map((item) => {
      if (!item.description || !item.price || Number.isNaN(Number(item.price))) {
        throw new Error(`Enter a description and valid price for each ${label} line item.`);
      }

      return item;
    });
}

function normalizeMaterials(items: Array<{ description: string; quantity: string; unitPrice: string; price: string }>) {
  return items
    .map((item) => ({
      description: item.description.trim(),
      quantity: item.quantity.trim() || "1",
      unitPrice: item.unitPrice.trim(),
      price: item.price.trim(),
    }))
    .filter((item) => item.description || item.unitPrice || item.price)
    .map((item) => {
      if (
        !item.description ||
        !item.unitPrice ||
        Number.isNaN(Number(item.unitPrice)) ||
        !item.quantity ||
        Number.isNaN(Number(item.quantity)) ||
        Number(item.quantity) <= 0
      ) {
        throw new Error("Enter a description, quantity, and valid unit price for each material line item.");
      }

      return item;
    });
}

export async function createServiceTemplateAction(
  _previousState: ServiceTemplateMutationState,
  formData: FormData,
): Promise<ServiceTemplateMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to create a service." };
  }

  const parsed = serviceTemplateSchema.safeParse(getServicePayload(formData));

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the service details and try again." };
  }

  try {
    const laborItems = normalizeItems(parsed.data.laborItems, "labor");
    const materials = normalizeMaterials(parsed.data.materials);

    await prisma.serviceTemplate.create({
      data: {
        ownerId: currentUser.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        category: parsed.data.category,
        notes: parsed.data.notes || null,
        laborItems: JSON.stringify(laborItems),
        materialTaxRate: parsed.data.materialTaxRate,
        materials: JSON.stringify(materials),
      },
    });
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Service could not be created." };
  }

  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/estimates");
  return { success: true, message: "Service created." };
}

export async function updateServiceTemplateAction(
  _previousState: ServiceTemplateMutationState,
  formData: FormData,
): Promise<ServiceTemplateMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to update a service." };
  }

  const parsed = updateServiceTemplateSchema.safeParse({
    id: formData.get("id"),
    ...getServicePayload(formData),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the service details and try again." };
  }

  const { id, ...service } = parsed.data;

  try {
    const laborItems = normalizeItems(service.laborItems, "labor");
    const materials = normalizeMaterials(service.materials);

    await prisma.serviceTemplate.update({
      where: {
        id_ownerId: {
          id,
          ownerId: currentUser.id,
        },
      },
      data: {
        title: service.title,
        description: service.description || null,
        category: service.category,
        notes: service.notes || null,
        laborItems: JSON.stringify(laborItems),
        materialTaxRate: service.materialTaxRate,
        materials: JSON.stringify(materials),
      },
    });
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Service could not be updated." };
  }

  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/estimates");
  return { success: true, message: "Service updated." };
}

export async function deleteServiceTemplateAction(
  _previousState: ServiceTemplateMutationState,
  formData: FormData,
): Promise<ServiceTemplateMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to delete a service." };
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return { success: false, message: "Service is required." };
  }

  await prisma.serviceTemplate.delete({
    where: {
      id_ownerId: {
        id,
        ownerId: currentUser.id,
      },
    },
  });

  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/estimates");
  return { success: true, message: "Service deleted." };
}
