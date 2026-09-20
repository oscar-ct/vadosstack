"use server";

import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { prisma } from "@/lib/prisma";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

import { parseMaterials } from "../jobs/_components/materials";
import { parsePricingItems } from "../jobs/_components/pricing-items";

export type ServiceTemplateMutationState = {
  success: boolean;
  message: string;
  redirectTo?: string;
};

const serviceCategories = ["Repair", "Installation", "Other"] as const;

const optionalMoney = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid tax rate.")
  .transform((value) => (value ? value : "0"));

function normalizeMoney(value: string | undefined, fallback = "0.00") {
  const text = value?.trim() ?? "";
  if (!text) return fallback;

  const amount = Number(text);
  return Number.isFinite(amount) ? amount.toFixed(2) : fallback;
}

const lineItemSchema = z.object({
  description: z.string().trim().optional(),
  quantity: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || (!Number.isNaN(Number(value)) && Number(value) > 0), "Enter a valid labor quantity."),
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
});

const materialItemSchema = z.object({
  description: z.string().trim().optional(),
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
    .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid material total."),
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
        item.description ||
        item.quantity ||
        item.unit ||
        item.unitPrice ||
        (item.price.trim() && Number(item.price) !== 0),
    );
}

export async function createServiceTemplateAction(
  _previousState: ServiceTemplateMutationState,
  formData: FormData,
): Promise<ServiceTemplateMutationState> {
  const authorization = await getPermittedDashboardAuthorization("services.manage");

  if (!authorization) {
    return { success: false, message: "You do not have permission to create services." };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = serviceTemplateSchema.safeParse(getServicePayload(formData));

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the service details and try again." };
  }

  let createdServiceId = "";

  try {
    const laborItems = normalizeItems(parsed.data.laborItems);
    const materials = normalizeMaterials(parsed.data.materials);

    const service = await prisma.$transaction(async (transaction) => {
      const createdService = await transaction.serviceTemplate.create({
        data: {
          ownerId: workspaceId,
          title: parsed.data.title,
          description: parsed.data.description || null,
          category: parsed.data.category,
          notes: parsed.data.notes || null,
          laborItems: JSON.stringify(laborItems),
          materialTaxRate: parsed.data.materialTaxRate,
          materials: JSON.stringify(materials),
        },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "service.create",
          targetType: "ServiceTemplate",
          targetId: createdService.id,
        },
        transaction,
      );
      return createdService;
    });
    createdServiceId = service.id;
  } catch (error) {
    console.error("Service creation failed.", error);
    return { success: false, message: "Service could not be created. Please try again." };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/services");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/jobs");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/estimates");
  return { success: true, message: "Service created.", redirectTo: `/dashboard/services/${createdServiceId}/edit` };
}

export async function updateServiceTemplateAction(
  _previousState: ServiceTemplateMutationState,
  formData: FormData,
): Promise<ServiceTemplateMutationState> {
  const authorization = await getPermittedDashboardAuthorization("services.manage");

  if (!authorization) {
    return { success: false, message: "You do not have permission to update services." };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = updateServiceTemplateSchema.safeParse({
    id: formData.get("id"),
    ...getServicePayload(formData),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the service details and try again." };
  }

  const { id, ...service } = parsed.data;

  try {
    const laborItems = normalizeItems(service.laborItems);
    const materials = normalizeMaterials(service.materials);

    await prisma.$transaction(async (transaction) => {
      await transaction.serviceTemplate.update({
        where: {
          id_ownerId: {
            id,
            ownerId: workspaceId,
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
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "service.update",
          targetType: "ServiceTemplate",
          targetId: id,
        },
        transaction,
      );
    });
  } catch (error) {
    console.error("Service update failed.", error);
    return { success: false, message: "Service could not be updated. Please try again." };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/services");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, `/dashboard/services/${id}/edit`);
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/jobs");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/estimates");
  return { success: true, message: "Service updated." };
}

export async function deleteServiceTemplateAction(
  _previousState: ServiceTemplateMutationState,
  formData: FormData,
): Promise<ServiceTemplateMutationState> {
  const authorization = await getPermittedDashboardAuthorization("services.manage");

  if (!authorization) {
    return { success: false, message: "You do not have permission to delete services." };
  }
  const workspaceId = authorization.workspaceId;

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return { success: false, message: "Service is required." };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.serviceTemplate.delete({
        where: { id_ownerId: { id, ownerId: workspaceId } },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "service.delete",
          targetType: "ServiceTemplate",
          targetId: id,
        },
        transaction,
      );
    });
  } catch (error) {
    console.error("Service deletion failed.", error);
    return { success: false, message: "Service could not be deleted. Please try again." };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/services");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/jobs");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/estimates");
  return { success: true, message: "Service deleted.", redirectTo: "/dashboard/services" };
}
