"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type InventoryActionState = {
  message: string;
  success: boolean;
};

type InventoryListItemType = "category" | "location";

function optionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function requiredString(value: FormDataEntryValue | null, label: string) {
  const text = optionalString(value);

  if (!text) {
    throw new Error(`${label} is required.`);
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
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to update inventory.",
    };
  }

  try {
    const product = requiredString(formData.get("product"), "Product name");
    const sku = optionalString(formData.get("sku"));
    const categoryName = requiredString(formData.get("category"), "Category");
    const locationName = requiredString(formData.get("location"), "Location");
    const category = categoryName === "Uncategorized" ? null : await getOrCreateCategory(currentUser.id, categoryName);
    const location = locationName === "Unassigned" ? null : await getOrCreateLocation(currentUser.id, locationName);
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
          ownerId: currentUser.id,
        },
        data,
      });

      if (result.count === 0) {
        throw new Error("Inventory item was not found.");
      }
    } else {
      await prisma.inventoryItem.create({
        data: {
          ownerId: currentUser.id,
          ...data,
        },
      });
    }

    revalidatePath("/dashboard/inventory");

    return {
      success: true,
      message: itemId ? "Inventory item updated." : "Inventory item created.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Inventory item could not be saved.",
    };
  }
}

export async function deleteInventoryItemAction(itemId: string): Promise<InventoryActionState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to delete inventory.",
    };
  }

  try {
    const result = await prisma.inventoryItem.deleteMany({
      where: {
        id: itemId,
        ownerId: currentUser.id,
      },
    });

    if (result.count === 0) {
      throw new Error("Inventory item was not found.");
    }
    revalidatePath("/dashboard/inventory");

    return {
      success: true,
      message: "Inventory item deleted.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Inventory item could not be deleted.",
    };
  }
}

export async function createInventoryListItemAction(
  itemType: InventoryListItemType,
  _previousState: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to manage inventory.",
    };
  }

  try {
    const name = requiredString(formData.get("name"), itemType === "category" ? "Category" : "Location");

    if (itemType === "category") {
      await prisma.inventoryCategory.upsert({
        where: {
          ownerId_name: {
            ownerId: currentUser.id,
            name,
          },
        },
        update: {},
        create: {
          ownerId: currentUser.id,
          name,
        },
      });
    } else {
      await prisma.inventoryLocation.upsert({
        where: {
          ownerId_name: {
            ownerId: currentUser.id,
            name,
          },
        },
        update: {},
        create: {
          ownerId: currentUser.id,
          name,
        },
      });
    }

    revalidatePath("/dashboard/inventory");

    return {
      success: true,
      message: itemType === "category" ? "Category added." : "Location added.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Inventory option could not be added.",
    };
  }
}

export async function deleteInventoryListItemAction(
  itemType: InventoryListItemType,
  name: string,
): Promise<InventoryActionState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to manage inventory.",
    };
  }

  try {
    const cleanName = requiredString(name, itemType === "category" ? "Category" : "Location");
    const record =
      itemType === "category"
        ? await prisma.inventoryCategory.findUnique({
            where: {
              ownerId_name: {
                ownerId: currentUser.id,
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
                ownerId: currentUser.id,
                name: cleanName,
              },
            },
            select: {
              id: true,
            },
          });

    if (!record) {
      throw new Error(itemType === "category" ? "Category was not found." : "Location was not found.");
    }

    const linkedItems = await prisma.inventoryItem.count({
      where:
        itemType === "category"
          ? {
              ownerId: currentUser.id,
              categoryId: record.id,
            }
          : {
              ownerId: currentUser.id,
              locationId: record.id,
            },
    });

    if (linkedItems > 0) {
      throw new Error(
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

    revalidatePath("/dashboard/inventory");

    return {
      success: true,
      message: itemType === "category" ? "Category deleted." : "Location deleted.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Inventory option could not be deleted.",
    };
  }
}

export async function saveInventoryStockRulesAction(
  _previousState: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to manage stock rules.",
    };
  }

  try {
    await prisma.inventorySettings.upsert({
      where: {
        ownerId: currentUser.id,
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
        ownerId: currentUser.id,
        lowStockThreshold: intValue(formData.get("lowStockThreshold"), 25),
        criticalStockThreshold: intValue(formData.get("criticalStockThreshold"), 8),
        defaultReorderPoint: intValue(formData.get("defaultReorderPoint"), 20),
        defaultMaxStock: intValue(formData.get("defaultMaxStock"), 100),
        autoRestockAlerts: formData.get("autoRestockAlerts") === "true",
        includeOutOfStock: formData.get("includeOutOfStock") === "true",
      },
    });

    revalidatePath("/dashboard/inventory");

    return {
      success: true,
      message: "Stock rules saved.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Stock rules could not be saved.",
    };
  }
}
