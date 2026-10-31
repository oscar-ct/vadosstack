"use server";

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { CommerceError, commerceTransaction } from "@/lib/commerce/transaction";
import { amountSchema, CommerceInputError, parseCommerceInput } from "@/lib/commerce/validation";
import { prisma } from "@/lib/prisma";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

export type InventoryActionState = {
  message: string;
  success: boolean;
};

class InventoryActionError extends CommerceError {}

function getInventoryErrorMessage(error: unknown, fallback: string) {
  if (error instanceof CommerceError || error instanceof CommerceInputError || error instanceof z.ZodError)
    return error.message;
  console.error(fallback, error);
  return fallback;
}

function optionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function requiredString(value: FormDataEntryValue | null, label: string) {
  const text = optionalString(value);

  if (!text) {
    throw new InventoryActionError(`${label} is required.`);
  }

  return text;
}

async function resolveOption(
  tx: Prisma.TransactionClient,
  kind: "category" | "location",
  ownerId: string,
  name: string,
) {
  const result =
    kind === "category"
      ? await tx.inventoryCategory.findFirst({ where: { ownerId, name }, select: { id: true } })
      : await tx.inventoryLocation.findFirst({ where: { ownerId, name }, select: { id: true } });
  if (!result)
    throw new InventoryActionError(
      `${kind === "category" ? "Category" : "Location"} changed or no longer exists. Refresh and choose an existing option, or add one in Manage inventory.`,
    );
  return result;
}

export async function saveInventoryItemAction(
  itemId: string | null,
  _previousState: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const authorization = await getPermittedDashboardAuthorization("inventory.manage");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to update inventory.",
    };
  }
  const workspaceId = authorization.workspaceId;

  try {
    const nonnegativeInt = z.number().int().min(0).max(1_000_000_000);
    const data = parseCommerceInput(
      z.object({
        product: z.string().trim().min(1).max(500),
        sku: z.string().trim().max(100).nullable(),
        description: z.string().max(5000).nullable(),
        unit: z.string().trim().min(1).max(40),
        stock: nonnegativeInt,
        reorderPoint: nonnegativeInt,
        maxStock: nonnegativeInt,
        cost: amountSchema,
        unitPrice: amountSchema,
        taxable: z.boolean(),
        itemStatus: z.enum(["Active", "Inactive"]),
        barcode: z.string().max(200).nullable(),
        vendor: z.string().max(200).nullable(),
        notes: z.string().max(5000).nullable(),
      }),
      {
        product: formData.get("product"),
        sku: optionalString(formData.get("sku")),
        description: optionalString(formData.get("description")),
        stock: Number(formData.get("stock")),
        reorderPoint: Number(formData.get("reorderPoint")),
        maxStock: Number(formData.get("maxStock")),
        cost: Number(formData.get("cost")),
        unitPrice: Number(formData.get("unitPrice")),
        taxable: formData.get("taxable") === "true",
        unit: optionalString(formData.get("unit")) ?? "each",
        itemStatus: formData.get("itemStatus"),
        barcode: optionalString(formData.get("barcode")),
        vendor: optionalString(formData.get("vendor")),
        notes: optionalString(formData.get("notes")),
      },
    );
    await commerceTransaction(async (tx) => {
      const existing = itemId
        ? await tx.inventoryItem.findFirst({
            where: { id: itemId, ownerId: workspaceId },
            include: { _count: { select: { orderItems: true, returnItems: true, stockMovements: true } } },
          })
        : null;
      if (itemId && !existing) throw new InventoryActionError("Inventory item was not found.");
      if (existing && existing.updatedAt.toISOString() !== formData.get("expectedUpdatedAt"))
        throw new InventoryActionError("Inventory changed since you opened this form. Refresh before saving.");
      if (existing && data.stock !== existing.stock)
        throw new InventoryActionError("Use a stock adjustment to receive, count, or remove inventory.");
      if (existing) {
        const linked =
          existing.stock !== 0 ||
          existing._count.orderItems > 0 ||
          existing._count.returnItems > 0 ||
          existing._count.stockMovements > 0;
        const shared = await tx.inventoryItem.count({
          where: { ownerId: workspaceId, productId: existing.productId, id: { not: existing.id } },
        });
        if (
          (linked || shared > 0) &&
          (data.product !== existing.product ||
            data.sku !== existing.sku ||
            data.unit !== existing.unit ||
            data.barcode !== existing.barcode)
        )
          throw new InventoryActionError(
            "Product name, SKU, unit, and barcode are locked after stock or history is recorded. Create a new item for a different product.",
          );
      }
      const categoryName = requiredString(formData.get("category"), "Category");
      const locationName = requiredString(formData.get("location"), "Location");
      const category =
        categoryName === "Uncategorized" ? null : await resolveOption(tx, "category", workspaceId, categoryName);
      const location =
        locationName === "Unassigned" ? null : await resolveOption(tx, "location", workspaceId, locationName);
      if (
        existing &&
        existing.locationId !== (location?.id ?? null) &&
        (existing.stock !== 0 ||
          existing._count.orderItems > 0 ||
          existing._count.returnItems > 0 ||
          existing._count.stockMovements > 0)
      )
        throw new InventoryActionError(
          "Location is locked because this item has stock or transaction history. Use Adjust stock → Move stock to transfer units to another location.",
        );
      const { stock, ...productData } = data;
      const saved = existing
        ? await tx.inventoryItem.update({
            where: { id: existing.id },
            data: { ...productData, categoryId: category?.id ?? null, locationId: location?.id ?? null },
          })
        : await tx.inventoryItem.create({
            data: {
              ...productData,
              stock,
              ownerId: workspaceId,
              categoryId: category?.id ?? null,
              locationId: location?.id ?? null,
            },
          });
      if (!existing || existing.locationId !== saved.locationId)
        await tx.inventoryStockMovement.create({
          data: {
            ownerId: workspaceId,
            inventoryItemId: saved.id,
            quantityChange: existing ? 0 : stock,
            balanceAfter: saved.stock,
            reason: existing ? "Location changed" : "Opening balance",
            notes: existing
              ? `${existing.locationId ?? "Unassigned"} -> ${saved.locationId ?? "Unassigned"}`
              : undefined,
            actorUserId: authorization.principal.user.id,
          },
        });
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: existing ? "inventory.update" : "inventory.create",
          targetType: "InventoryItem",
          targetId: saved.id,
        },
        tx,
      );
    });

    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/inventory");
    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/inventory-analytics");

    return {
      success: true,
      message: itemId ? "Inventory item updated." : "Inventory item created.",
    };
  } catch (error) {
    return {
      success: false,
      message: getInventoryErrorMessage(
        error,
        "Inventory item could not be saved. Check quantities, prices, and tax rates.",
      ),
    };
  }
}

export async function archiveInventoryItemAction(itemId: string): Promise<InventoryActionState> {
  const authorization = await getPermittedDashboardAuthorization("inventory.manage");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to archive inventory.",
    };
  }
  const workspaceId = authorization.workspaceId;

  try {
    const archived = await commerceTransaction(async (tx) => {
      const result = await tx.inventoryItem.updateMany({
        where: { id: itemId, ownerId: workspaceId, itemStatus: "Active" },
        data: { itemStatus: "Inactive" },
      });
      if (!result.count) {
        const item = await tx.inventoryItem.findFirst({
          where: { id: itemId, ownerId: workspaceId },
          select: { id: true },
        });
        if (!item) throw new InventoryActionError("Inventory item was not found.");
        return false;
      }
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "inventory.archive",
          targetType: "InventoryItem",
          targetId: itemId,
        },
        tx,
      );
      return true;
    });
    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/inventory");
    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/inventory-analytics");

    return {
      success: true,
      message: archived
        ? "Inventory item archived. Its stock and history are preserved."
        : "Inventory item is already archived.",
    };
  } catch (error) {
    return {
      success: false,
      message: getInventoryErrorMessage(error, "Inventory item could not be archived."),
    };
  }
}

export async function saveInventoryStockRulesAction(
  _previousState: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const authorization = await getPermittedDashboardAuthorization("inventory.manage");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to manage stock rules.",
    };
  }
  const workspaceId = authorization.workspaceId;

  try {
    const rules = parseCommerceInput(
      z
        .object({
          restockAlertEmail: z.union([z.email(), z.literal("")]).transform((value) => value || null),
          lowStockThreshold: z.number().int().min(0).max(1000000),
          criticalStockThreshold: z.number().int().min(0).max(1000000),
          defaultReorderPoint: z.number().int().min(0).max(1000000),
          defaultMaxStock: z.number().int().min(0).max(1000000),
          autoRestockAlerts: z.boolean(),
          includeOutOfStock: z.boolean(),
        })
        .refine(
          (value) =>
            value.criticalStockThreshold <= value.lowStockThreshold &&
            value.defaultReorderPoint <= value.defaultMaxStock,
          "Critical stock must not exceed low stock, and reorder point must not exceed max stock.",
        ),
      {
        restockAlertEmail: String(formData.get("restockAlertEmail") ?? "").trim(),
        lowStockThreshold: Number(formData.get("lowStockThreshold")),
        criticalStockThreshold: Number(formData.get("criticalStockThreshold")),
        defaultReorderPoint: Number(formData.get("defaultReorderPoint")),
        defaultMaxStock: Number(formData.get("defaultMaxStock")),
        autoRestockAlerts: formData.get("autoRestockAlerts") === "true",
        includeOutOfStock: formData.get("includeOutOfStock") === "true",
      },
    );
    await prisma.inventorySettings.upsert({
      where: {
        ownerId: workspaceId,
      },
      update: rules,
      create: { ownerId: workspaceId, ...rules },
    });

    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/inventory");
    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/inventory-analytics");

    return {
      success: true,
      message: "Stock rules saved.",
    };
  } catch (error) {
    return {
      success: false,
      message: getInventoryErrorMessage(error, "Stock rules could not be saved."),
    };
  }
}
