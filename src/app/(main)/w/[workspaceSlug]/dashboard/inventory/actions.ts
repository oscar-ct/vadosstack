"use server";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

export type InventoryActionState = {
  message: string;
  success: boolean;
};

type InventoryListItemType = "category" | "location";

class InventoryActionError extends Error {}

function getInventoryErrorMessage(error: unknown, fallback: string) {
  if (error instanceof InventoryActionError) return error.message;
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

function numberValue(value: FormDataEntryValue | null, fallback = 0) {
  const rawValue = typeof value === "string" ? value : "";
  const parsed = Number(rawValue);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function intValue(value: FormDataEntryValue | null, fallback = 0) {
  return Math.max(Math.trunc(numberValue(value, fallback)), 0);
}

async function getOrCreateCategory(ownerId: string, name: string) {
  return prisma.inventoryCategory.upsert({
    where: {
      ownerId_name: {
        ownerId,
        name,
      },
    },
    update: {},
    create: {
      ownerId,
      name,
    },
    select: {
      id: true,
    },
  });
}

async function getOrCreateLocation(ownerId: string, name: string) {
  return prisma.inventoryLocation.upsert({
    where: {
      ownerId_name: {
        ownerId,
        name,
      },
    },
    update: {},
    create: {
      ownerId,
      name,
    },
    select: {
      id: true,
    },
  });
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
    const product = requiredString(formData.get("product"), "Product name");
    const sku = optionalString(formData.get("sku"));
    const categoryName = requiredString(formData.get("category"), "Category");
    const locationName = requiredString(formData.get("location"), "Location");
    const category = categoryName === "Uncategorized" ? null : await getOrCreateCategory(workspaceId, categoryName);
    const location = locationName === "Unassigned" ? null : await getOrCreateLocation(workspaceId, locationName);
    const taxable = formData.get("taxable") === "true";
    const data = {
      categoryId: category?.id ?? null,
      locationId: location?.id ?? null,
      sku,
      product,
      description: optionalString(formData.get("description")),
      stock: intValue(formData.get("stock")),
      reorderPoint: intValue(formData.get("reorderPoint")),
      maxStock: intValue(formData.get("maxStock")),
      unit: optionalString(formData.get("unit")) ?? "each",
      cost: numberValue(formData.get("cost")),
      unitPrice: numberValue(formData.get("unitPrice")),
      taxable,
      taxRate: taxable ? numberValue(formData.get("taxRate")) : 0,
      itemStatus: optionalString(formData.get("itemStatus")) === "Inactive" ? "Inactive" : "Active",
      barcode: optionalString(formData.get("barcode")),
      vendor: optionalString(formData.get("vendor")),
      notes: optionalString(formData.get("notes")),
    };

    if (itemId) {
      const result = await prisma.inventoryItem.updateMany({
        where: {
          id: itemId,
          ownerId: workspaceId,
        },
        data,
      });

      if (result.count === 0) {
        throw new InventoryActionError("Inventory item was not found.");
      }
    } else {
      await prisma.inventoryItem.create({
        data: {
          ownerId: workspaceId,
          ...data,
        },
      });
    }

    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/inventory");

    return {
      success: true,
      message: itemId ? "Inventory item updated." : "Inventory item created.",
    };
  } catch (error) {
    return {
      success: false,
      message: getInventoryErrorMessage(error, "Inventory item could not be saved."),
    };
  }
}

export async function deleteInventoryItemAction(itemId: string): Promise<InventoryActionState> {
  const authorization = await getPermittedDashboardAuthorization("inventory.manage");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to delete inventory.",
    };
  }
  const workspaceId = authorization.workspaceId;

  try {
    const result = await prisma.inventoryItem.deleteMany({
      where: {
        id: itemId,
        ownerId: workspaceId,
      },
    });

    if (result.count === 0) {
      throw new InventoryActionError("Inventory item was not found.");
    }
    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/inventory");

    return {
      success: true,
      message: "Inventory item deleted.",
    };
  } catch (error) {
    return {
      success: false,
      message: getInventoryErrorMessage(error, "Inventory item could not be deleted."),
    };
  }
}

export async function createInventoryListItemAction(
  itemType: InventoryListItemType,
  _previousState: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const authorization = await getPermittedDashboardAuthorization("inventory.manage");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to manage inventory.",
    };
  }
  const workspaceId = authorization.workspaceId;

  try {
    const name = requiredString(formData.get("name"), itemType === "category" ? "Category" : "Location");

    if (itemType === "category") {
      await prisma.inventoryCategory.upsert({
        where: {
          ownerId_name: {
            ownerId: workspaceId,
            name,
          },
        },
        update: {},
        create: {
          ownerId: workspaceId,
          name,
        },
      });
    } else {
      await prisma.inventoryLocation.upsert({
        where: {
          ownerId_name: {
            ownerId: workspaceId,
            name,
          },
        },
        update: {},
        create: {
          ownerId: workspaceId,
          name,
        },
      });
    }

    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/inventory");

    return {
      success: true,
      message: itemType === "category" ? "Category added." : "Location added.",
    };
  } catch (error) {
    return {
      success: false,
      message: getInventoryErrorMessage(error, "Inventory option could not be added."),
    };
  }
}

export async function deleteInventoryListItemAction(
  itemType: InventoryListItemType,
  name: string,
): Promise<InventoryActionState> {
  const authorization = await getPermittedDashboardAuthorization("inventory.manage");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to manage inventory.",
    };
  }
  const workspaceId = authorization.workspaceId;

  try {
    const cleanName = requiredString(name, itemType === "category" ? "Category" : "Location");
    const record =
      itemType === "category"
        ? await prisma.inventoryCategory.findUnique({
            where: {
              ownerId_name: {
                ownerId: workspaceId,
                name: cleanName,
              },
            },
            select: {
              id: true,
            },
          })
        : await prisma.inventoryLocation.findUnique({
            where: {
              ownerId_name: {
                ownerId: workspaceId,
                name: cleanName,
              },
            },
            select: {
              id: true,
            },
          });

    if (!record) {
      throw new InventoryActionError(itemType === "category" ? "Category was not found." : "Location was not found.");
    }

    const linkedItems = await prisma.inventoryItem.count({
      where:
        itemType === "category"
          ? {
              ownerId: workspaceId,
              categoryId: record.id,
            }
          : {
              ownerId: workspaceId,
              locationId: record.id,
            },
    });

    if (linkedItems > 0) {
      throw new InventoryActionError(
        itemType === "category"
          ? `Category is used by ${linkedItems} inventory ${linkedItems === 1 ? "item" : "items"}. Reassign those items before deleting it.`
          : `Location is used by ${linkedItems} inventory ${linkedItems === 1 ? "item" : "items"}. Reassign those items before deleting it.`,
      );
    }

    if (itemType === "category") {
      await prisma.inventoryCategory.delete({
        where: {
          id: record.id,
        },
      });
    } else {
      await prisma.inventoryLocation.delete({
        where: {
          id: record.id,
        },
      });
    }

    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/inventory");

    return {
      success: true,
      message: itemType === "category" ? "Category deleted." : "Location deleted.",
    };
  } catch (error) {
    return {
      success: false,
      message: getInventoryErrorMessage(error, "Inventory option could not be deleted."),
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
    await prisma.inventorySettings.upsert({
      where: {
        ownerId: workspaceId,
      },
      update: {
        lowStockThreshold: intValue(formData.get("lowStockThreshold"), 25),
        criticalStockThreshold: intValue(formData.get("criticalStockThreshold"), 8),
        defaultReorderPoint: intValue(formData.get("defaultReorderPoint"), 20),
        defaultMaxStock: intValue(formData.get("defaultMaxStock"), 100),
        autoRestockAlerts: formData.get("autoRestockAlerts") === "true",
        includeOutOfStock: formData.get("includeOutOfStock") === "true",
      },
      create: {
        ownerId: workspaceId,
        lowStockThreshold: intValue(formData.get("lowStockThreshold"), 25),
        criticalStockThreshold: intValue(formData.get("criticalStockThreshold"), 8),
        defaultReorderPoint: intValue(formData.get("defaultReorderPoint"), 20),
        defaultMaxStock: intValue(formData.get("defaultMaxStock"), 100),
        autoRestockAlerts: formData.get("autoRestockAlerts") === "true",
        includeOutOfStock: formData.get("includeOutOfStock") === "true",
      },
    });

    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/inventory");

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
