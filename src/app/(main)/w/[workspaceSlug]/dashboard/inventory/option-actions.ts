"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import {
  type InventoryOptionType,
  inventoryOptionName,
  inventoryOptionTypeSchema,
} from "@/lib/commerce/inventory-options";
import { CommerceError, commerceTransaction } from "@/lib/commerce/transaction";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

const optionInput = z
  .object({ kind: inventoryOptionTypeSchema, id: z.string().min(1), expectedUpdatedAt: z.string().datetime() })
  .strict();
const mergeSelection = z
  .object({ kind: inventoryOptionTypeSchema, sourceId: z.string().min(1), targetId: z.string().min(1) })
  .strict();
export type InventoryOptionResult = { success: boolean; message: string };
export type InventoryMergePreview = {
  sourceCount: number;
  targetCount: number;
  conflictCount: number;
  sourceName: string;
  targetName: string;
};
function message(error: unknown) {
  if (error instanceof CommerceError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the option details.";
  return "The inventory option could not be updated. Refresh and try again.";
}
function refresh(slug: string) {
  for (const path of [
    "/dashboard/inventory",
    "/dashboard/inventory-analytics",
    "/dashboard/orders/create",
    "/dashboard/commerce-pulse",
  ])
    revalidateWorkspacePath(slug, path);
}
async function lockOptions(tx: Prisma.TransactionClient, kind: InventoryOptionType, ownerId: string, ids: string[]) {
  const table = Prisma.raw(kind === "category" ? '"inventory_categories"' : '"inventory_locations"');
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM ${table} WHERE "ownerId" = ${ownerId} AND id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`,
  );
}
async function record(tx: Prisma.TransactionClient, kind: InventoryOptionType, ownerId: string, id: string) {
  const result =
    kind === "category"
      ? await tx.inventoryCategory.findFirst({ where: { id, ownerId } })
      : await tx.inventoryLocation.findFirst({ where: { id, ownerId } });
  if (!result) throw new CommerceError("This option no longer exists in this workspace. Refresh the list.");
  return result;
}
function version(current: Date, expected: string) {
  if (current.toISOString() !== expected)
    throw new CommerceError("This option changed since you opened it. Refresh and try again.");
}
async function uniqueName(
  tx: Prisma.TransactionClient,
  kind: InventoryOptionType,
  ownerId: string,
  name: string,
  exceptId?: string,
) {
  const records =
    kind === "category"
      ? await tx.inventoryCategory.findMany({ where: { ownerId }, select: { id: true, name: true } })
      : await tx.inventoryLocation.findMany({ where: { ownerId }, select: { id: true, name: true } });
  const key = (value: string) => value.normalize("NFC").trim().replace(/\s+/gu, " ").toLowerCase();
  if (records.some((entry) => entry.id !== exceptId && key(entry.name) === key(name)))
    throw new CommerceError("An option with this name already exists. Rename it or merge duplicates instead.");
}
async function mergeDetails(
  tx: Prisma.TransactionClient,
  kind: InventoryOptionType,
  ownerId: string,
  sourceId: string,
  targetId: string,
) {
  if (sourceId === targetId) throw new CommerceError("Choose a different option to keep.");
  const source = await record(tx, kind, ownerId, sourceId);
  const target = await record(tx, kind, ownerId, targetId);
  const items = await tx.inventoryItem.findMany({
    where: {
      ownerId,
      ...(kind === "category"
        ? { categoryId: { in: [sourceId, targetId] } }
        : { locationId: { in: [sourceId, targetId] } }),
    },
    select: { id: true, productId: true, categoryId: true, locationId: true },
  });
  const sourceItems = items.filter((item) => (kind === "category" ? item.categoryId : item.locationId) === sourceId);
  const targetItems = items.filter((item) => (kind === "category" ? item.categoryId : item.locationId) === targetId);
  const targetProducts = new Set(targetItems.map((item) => item.productId));
  const conflictCount =
    kind === "location"
      ? new Set(sourceItems.filter((item) => targetProducts.has(item.productId)).map((item) => item.productId)).size
      : 0;
  return {
    source,
    target,
    sourceItems,
    preview: {
      sourceName: source.name,
      targetName: target.name,
      sourceCount: sourceItems.length,
      targetCount: targetItems.length,
      conflictCount,
    },
  };
}

export async function createInventoryOptionAction(
  kindValue: unknown,
  nameValue: unknown,
): Promise<InventoryOptionResult> {
  const auth = await getPermittedDashboardAuthorization("inventory.manage");
  if (!auth) return { success: false, message: "You do not have permission to manage inventory." };
  try {
    const kind = inventoryOptionTypeSchema.parse(kindValue);
    const name = inventoryOptionName(kind, nameValue);
    await commerceTransaction(async (tx) => {
      await uniqueName(tx, kind, auth.workspaceId, name);
      const created =
        kind === "category"
          ? await tx.inventoryCategory.create({ data: { ownerId: auth.workspaceId, name } })
          : await tx.inventoryLocation.create({ data: { ownerId: auth.workspaceId, name } });
      await recordAuthorizationAuditEvent(
        {
          workspaceId: auth.workspaceId,
          actorUserId: auth.principal.user.id,
          membershipId: auth.membership.id,
          action: `inventory.${kind}.create`,
          targetType: kind === "category" ? "InventoryCategory" : "InventoryLocation",
          targetId: created.id,
          metadata: { name },
        },
        tx,
      );
    });
    refresh(auth.membership.workspaceSlug);
    return { success: true, message: kind === "category" ? "Category added." : "Location added." };
  } catch (error) {
    return { success: false, message: message(error) };
  }
}

export async function renameInventoryOptionAction(rawInput: unknown): Promise<InventoryOptionResult> {
  const auth = await getPermittedDashboardAuthorization("inventory.manage");
  if (!auth) return { success: false, message: "You do not have permission to manage inventory." };
  try {
    const input = optionInput.extend({ name: z.string() }).parse(rawInput);
    const name = inventoryOptionName(input.kind, input.name);
    await commerceTransaction(async (tx) => {
      await lockOptions(tx, input.kind, auth.workspaceId, [input.id]);
      const current = await record(tx, input.kind, auth.workspaceId, input.id);
      version(current.updatedAt, input.expectedUpdatedAt);
      if (current.name === name) return;
      await uniqueName(tx, input.kind, auth.workspaceId, name, input.id);
      if (input.kind === "category") await tx.inventoryCategory.update({ where: { id: input.id }, data: { name } });
      else await tx.inventoryLocation.update({ where: { id: input.id }, data: { name } });
      await recordAuthorizationAuditEvent(
        {
          workspaceId: auth.workspaceId,
          actorUserId: auth.principal.user.id,
          membershipId: auth.membership.id,
          action: `inventory.${input.kind}.rename`,
          targetType: input.kind === "category" ? "InventoryCategory" : "InventoryLocation",
          targetId: input.id,
          metadata: { previousName: current.name, name },
        },
        tx,
      );
    });
    refresh(auth.membership.workspaceSlug);
    return {
      success: true,
      message: "Name updated. Existing inventory stays assigned; recorded history is unchanged.",
    };
  } catch (error) {
    return { success: false, message: message(error) };
  }
}

export async function deleteInventoryOptionAction(rawInput: unknown): Promise<InventoryOptionResult> {
  const auth = await getPermittedDashboardAuthorization("inventory.manage");
  if (!auth) return { success: false, message: "You do not have permission to manage inventory." };
  try {
    const input = optionInput.parse(rawInput);
    await commerceTransaction(async (tx) => {
      await lockOptions(tx, input.kind, auth.workspaceId, [input.id]);
      const current = await record(tx, input.kind, auth.workspaceId, input.id);
      version(current.updatedAt, input.expectedUpdatedAt);
      const count = await tx.inventoryItem.count({
        where: {
          ownerId: auth.workspaceId,
          ...(input.kind === "category" ? { categoryId: input.id } : { locationId: input.id }),
        },
      });
      if (count)
        throw new CommerceError(
          `Used by ${count} inventory records, including archived records. Reassign them or merge this option before deleting it.`,
        );
      if (input.kind === "category") await tx.inventoryCategory.delete({ where: { id: input.id } });
      else await tx.inventoryLocation.delete({ where: { id: input.id } });
      await recordAuthorizationAuditEvent(
        {
          workspaceId: auth.workspaceId,
          actorUserId: auth.principal.user.id,
          membershipId: auth.membership.id,
          action: `inventory.${input.kind}.delete`,
          targetType: input.kind === "category" ? "InventoryCategory" : "InventoryLocation",
          targetId: input.id,
          metadata: { name: current.name },
        },
        tx,
      );
    });
    refresh(auth.membership.workspaceSlug);
    return { success: true, message: "Unused option deleted." };
  } catch (error) {
    return { success: false, message: message(error) };
  }
}

export async function previewInventoryOptionMergeAction(
  rawInput: unknown,
): Promise<InventoryOptionResult & { preview?: InventoryMergePreview }> {
  const auth = await getPermittedDashboardAuthorization("inventory.manage");
  if (!auth) return { success: false, message: "You do not have permission to manage inventory." };
  try {
    const input = mergeSelection.parse(rawInput);
    const details = await commerceTransaction((tx) =>
      mergeDetails(tx, input.kind, auth.workspaceId, input.sourceId, input.targetId),
    );
    return { success: true, message: "", preview: details.preview };
  } catch (error) {
    return { success: false, message: message(error) };
  }
}

export async function mergeInventoryOptionAction(rawInput: unknown): Promise<InventoryOptionResult> {
  const auth = await getPermittedDashboardAuthorization("inventory.manage");
  if (!auth) return { success: false, message: "You do not have permission to manage inventory." };
  try {
    const input = mergeSelection
      .extend({
        sourceUpdatedAt: z.string().datetime(),
        targetUpdatedAt: z.string().datetime(),
        reason: z.string().trim().min(1, "Enter a merge reason.").max(500),
        confirmed: z.literal(true),
        samePhysicalLocation: z.boolean().optional(),
      })
      .parse(rawInput);
    if (input.kind === "location" && input.samePhysicalLocation !== true)
      throw new CommerceError(
        "Confirm that both names refer to the same physical location. Use Adjust stock for physical stock moves.",
      );
    await commerceTransaction(async (tx) => {
      await lockOptions(tx, input.kind, auth.workspaceId, [input.sourceId, input.targetId]);
      const { source, target, sourceItems, preview } = await mergeDetails(
        tx,
        input.kind,
        auth.workspaceId,
        input.sourceId,
        input.targetId,
      );
      version(source.updatedAt, input.sourceUpdatedAt);
      version(target.updatedAt, input.targetUpdatedAt);
      if (preview.conflictCount)
        throw new CommerceError(
          `These locations share ${preview.conflictCount} product identities. Merging would create duplicate product/location records. Reconcile those records separately; use Rename for typo fixes.`,
        );
      if (input.kind === "location")
        await tx.inventoryLocationMerge.create({
          data: {
            ownerId: auth.workspaceId,
            sourceLocationId: source.id,
            targetLocationId: target.id,
            sourceName: source.name,
            targetName: target.name,
            actorUserId: auth.principal.user.id,
            reason: input.reason,
            itemIds: sourceItems.map((item) => item.id),
          },
        });
      const updated = await tx.inventoryItem.updateMany({
        where: {
          ownerId: auth.workspaceId,
          ...(input.kind === "category" ? { categoryId: source.id } : { locationId: source.id }),
          id: { in: sourceItems.map((item) => item.id) },
        },
        data: input.kind === "category" ? { categoryId: target.id } : { locationId: target.id },
      });
      if (updated.count !== sourceItems.length)
        throw new CommerceError("Inventory changed during the merge. Refresh and try again.");
      const remaining = await tx.inventoryItem.count({
        where: {
          ownerId: auth.workspaceId,
          ...(input.kind === "category" ? { categoryId: source.id } : { locationId: source.id }),
        },
      });
      if (remaining) throw new CommerceError("Inventory changed during the merge. Refresh and try again.");
      if (input.kind === "category") await tx.inventoryCategory.delete({ where: { id: source.id } });
      else await tx.inventoryLocation.delete({ where: { id: source.id } });
      await recordAuthorizationAuditEvent(
        {
          workspaceId: auth.workspaceId,
          actorUserId: auth.principal.user.id,
          membershipId: auth.membership.id,
          action: `inventory.${input.kind}.merge`,
          targetType: input.kind === "category" ? "InventoryCategory" : "InventoryLocation",
          targetId: source.id,
          metadata: {
            sourceName: source.name,
            targetName: target.name,
            targetId: target.id,
            recordsReassigned: updated.count,
            reason: input.reason,
            samePhysicalLocation: input.kind === "location",
          },
        },
        tx,
      );
    });
    refresh(auth.membership.workspaceSlug);
    return {
      success: true,
      message: "Duplicates merged. Inventory quantities and recorded transaction history are unchanged.",
    };
  } catch (error) {
    return { success: false, message: message(error) };
  }
}
