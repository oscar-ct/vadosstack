"use server";

import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { isMatchingTransferDestination, previewStockAdjustment } from "@/lib/commerce/stock-adjustment";
import { adjustStock, CommerceError, commerceTransaction } from "@/lib/commerce/transaction";
import { parseCommerceInput, submissionKeySchema } from "@/lib/commerce/validation";
import { prisma } from "@/lib/prisma";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

import { createHash, randomUUID } from "node:crypto";

const adjustmentSchema = z
  .object({
    inventoryItemId: z.string().min(1),
    expectedUpdatedAt: z.iso.datetime(),
    submissionKey: submissionKeySchema,
    kind: z.enum(["Receive", "Damage", "Count", "Transfer"]),
    quantity: z.number().int().min(0).max(1000000),
    destinationItemId: z.string().min(1).optional(),
    destinationLocationId: z.string().min(1).optional(),
    notes: z.string().trim().min(1).max(1000),
  })
  .strict();

export async function adjustInventoryStockAction(raw: z.infer<typeof adjustmentSchema>) {
  const auth = await getPermittedDashboardAuthorization("inventory.manage");
  if (!auth) throw new Error("You do not have permission to adjust stock.");
  const input = parseCommerceInput(adjustmentSchema, raw);
  const signature = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const result = await commerceTransaction(async (tx) => {
    const previous = await tx.inventoryStockMovement.findUnique({
      where: { ownerId_idempotencyKey: { ownerId: auth.workspaceId, idempotencyKey: input.submissionKey } },
    });
    if (previous) {
      if (!previous.notes?.endsWith(`[${signature}]`))
        throw new CommerceError("Submission key already used for a different stock adjustment.");
      return { id: previous.id };
    }
    const item = await tx.inventoryItem.findFirst({ where: { id: input.inventoryItemId, ownerId: auth.workspaceId } });
    if (!item) throw new CommerceError("Inventory item was not found.");
    if (item.updatedAt.toISOString() !== input.expectedUpdatedAt)
      throw new CommerceError("Stock changed since you opened this form. Refresh before adjusting it.");
    if (input.kind !== "Transfer" && (input.destinationItemId || input.destinationLocationId))
      throw new CommerceError("A destination is only used when moving stock.");
    const preview = previewStockAdjustment(input.kind, item.stock, input.quantity);
    if (!preview.valid) throw new CommerceError(preview.error);
    if (input.destinationItemId && input.destinationLocationId)
      throw new CommerceError("Choose one transfer destination.");
    let destinationId = input.destinationItemId;
    if (input.kind === "Transfer" && input.destinationLocationId) {
      const location = await tx.inventoryLocation.findFirst({
        where: { id: input.destinationLocationId, ownerId: auth.workspaceId },
      });
      if (!location || location.id === item.locationId)
        throw new CommerceError("Choose a different destination location in this workspace.");
      const matches = await tx.inventoryItem.findMany({
        where: {
          ownerId: auth.workspaceId,
          locationId: location.id,
          itemStatus: "Active",
          productId: item.productId,
          unit: item.unit,
          cost: item.cost,
        },
        take: 2,
      });
      if (matches.length > 1)
        throw new CommerceError(
          "Multiple matching items exist at this location. Resolve the duplicate records before transferring stock.",
        );
      if (matches.length) destinationId = matches[0].id;
      else {
        if (item.itemStatus === "Inactive")
          throw new CommerceError("Restore this archived item before moving it to a new location.");
        const firstRecord = await tx.inventoryItem.findFirst({
          where: { ownerId: auth.workspaceId, productId: item.productId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { sku: true },
        });
        const skuPrefix = firstRecord?.sku?.trim().slice(0, 12) || "ITEM";
        const destination = await tx.inventoryItem.create({
          data: {
            ownerId: auth.workspaceId,
            locationId: location.id,
            categoryId: item.categoryId,
            productId: item.productId,
            product: item.product,
            description: item.description,
            unit: item.unit,
            cost: item.cost,
            unitPrice: item.unitPrice,
            taxable: item.taxable,
            taxRate: item.taxRate,
            reorderPoint: item.reorderPoint,
            maxStock: item.maxStock,
            barcode: item.barcode,
            vendor: item.vendor,
            notes: item.notes,
            itemStatus: "Active",
            stock: 0,
            sku: `${skuPrefix}-${randomUUID().slice(0, 8).toUpperCase()}`,
          },
        });
        destinationId = destination.id;
        await recordAuthorizationAuditEvent(
          {
            workspaceId: auth.workspaceId,
            actorUserId: auth.principal.user.id,
            membershipId: auth.membership.id,
            action: "inventory.create",
            targetType: "InventoryItem",
            targetId: destination.id,
            metadata: { sourceInventoryItemId: item.id, reason: "Stock transfer" },
          },
          tx,
        );
      }
    }
    const quantityChange = preview.change;
    const metadata = {
      ownerId: auth.workspaceId,
      inventoryItemId: item.id,
      actorUserId: auth.principal.user.id,
      reason: input.kind,
      notes: `${input.notes} [${signature}]`,
      idempotencyKey: input.submissionKey,
    };
    if (quantityChange === 0) {
      await tx.inventoryStockMovement.create({ data: { ...metadata, quantityChange: 0, balanceAfter: item.stock } });
    } else await adjustStock(tx, { ...metadata, quantityChange });
    if (input.kind === "Transfer") {
      if (!destinationId || destinationId === item.id)
        throw new CommerceError("Choose a different destination inventory record.");
      const destination = await tx.inventoryItem.findFirst({
        where: { id: destinationId, ownerId: auth.workspaceId, itemStatus: "Active" },
      });
      if (
        !destination ||
        !isMatchingTransferDestination(
          { ...item, location: item.locationId },
          { ...destination, location: destination.locationId },
        )
      )
        throw new CommerceError("Choose the same product and unit cost at a different location.");
      await adjustStock(tx, {
        ...metadata,
        inventoryItemId: destination.id,
        quantityChange: input.quantity,
        idempotencyKey: `${input.submissionKey}:destination`,
      });
    }
    await recordAuthorizationAuditEvent(
      {
        workspaceId: auth.workspaceId,
        actorUserId: auth.principal.user.id,
        membershipId: auth.membership.id,
        action: "inventory.stock.adjust",
        targetType: "InventoryItem",
        targetId: item.id,
        metadata: {
          kind: input.kind,
          quantityChange,
          notes: input.notes,
          destinationItemId: destinationId ?? null,
          destinationLocationId: input.destinationLocationId ?? null,
        },
      },
      tx,
    );
    return { id: item.id };
  });
  for (const path of ["/dashboard/inventory", "/dashboard/orders", "/dashboard/commerce-pulse"])
    revalidateWorkspacePath(auth.membership.workspaceSlug, path);
  return result;
}

export async function getStockTransferLocationsAction(inventoryItemId: string) {
  const auth = await getPermittedDashboardAuthorization("inventory.manage");
  if (!auth) throw new Error("You do not have permission to view stock transfer destinations.");
  const id = parseCommerceInput(z.string().trim().min(1).max(100), inventoryItemId);
  const source = await prisma.inventoryItem.findFirst({ where: { id, ownerId: auth.workspaceId } });
  if (!source) throw new CommerceError("Inventory item was not found.");
  const [locations, matches] = await Promise.all([
    prisma.inventoryLocation.findMany({
      where: { ownerId: auth.workspaceId, ...(source.locationId ? { id: { not: source.locationId } } : {}) },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.inventoryItem.findMany({
      where: {
        ownerId: auth.workspaceId,
        productId: source.productId,
        unit: source.unit,
        cost: source.cost,
        itemStatus: "Active",
        ...(source.locationId ? { locationId: { not: source.locationId } } : {}),
      },
      select: { id: true, locationId: true, stock: true },
    }),
  ]);
  return locations.map((location) => {
    const items = matches.filter((item) => item.locationId === location.id);
    return {
      id: location.id,
      location: location.name,
      stock: items.length === 1 ? items[0].stock : 0,
      createsItem: items.length === 0,
      ambiguous: items.length > 1,
    };
  });
}
