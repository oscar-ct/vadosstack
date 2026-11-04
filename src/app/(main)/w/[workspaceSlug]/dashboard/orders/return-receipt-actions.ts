"use server";

import { z } from "zod";

import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { adjustStock, CommerceError, commerceTransaction, lockOrder } from "@/lib/commerce/transaction";
import { parseCommerceInput, quantitySchema, submissionKeySchema } from "@/lib/commerce/validation";
import { prisma } from "@/lib/prisma";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

import { createHash } from "node:crypto";

async function loadReceipt(tx: Pick<typeof prisma, "orderReturn">, ownerId: string, orderId: string, returnId: string) {
  const record = await tx.orderReturn.findFirst({
    where: { id: returnId, orderId, ownerId },
    include: { items: true, physicalReceipts: { include: { items: true } }, order: { select: { version: true } } },
  });
  if (!record || (!record.savedAt && record.returnStatus !== "Returned"))
    throw new CommerceError("Saved resolution was not found.");
  const items = record.items
    .filter((item) => item.returnQuantity > 0)
    .map((item) => {
      const receipts = record.physicalReceipts
        .flatMap((receipt) => receipt.items)
        .filter((line) => line.orderItemId === item.orderItemId);
      const received = receipts.length
        ? receipts.reduce((sum, line) => sum + line.receivedQuantity, 0)
        : item.disposition === "Returned"
          ? item.returnQuantity
          : 0;
      return {
        orderItemId: item.orderItemId,
        product: item.product,
        inventoryItemId: item.inventoryItemId,
        received,
        remaining: Math.max(item.returnQuantity - received, 0),
        item,
      };
    });
  return { record, items };
}

export async function getReturnReceiptAction(orderId: string, returnId: string) {
  const auth = await getPermittedDashboardAuthorization("orders.view");
  if (!auth || !can(auth.membership, "orders.returns.manage"))
    throw new CommerceError("You cannot receive returned items.");
  const result = await loadReceipt(
    prisma,
    auth.workspaceId,
    z.string().min(1).max(200).parse(orderId),
    z.string().min(1).max(200).parse(returnId),
  );
  return {
    version: result.record.order.version,
    items: result.items.map(({ item: _, ...item }) => item),
    receipts: result.record.physicalReceipts.map((receipt) => ({
      id: receipt.id,
      date: receipt.receivedAt.toISOString().slice(0, 10),
      received: receipt.items.reduce((sum, item) => sum + item.receivedQuantity, 0),
      restocked: receipt.items.reduce((sum, item) => sum + item.restockedQuantity, 0),
      notes: receipt.notes?.replace(/\s+\[[a-f0-9]{64}\]$/, "") ?? "",
    })),
  };
}

const receiptSchema = z
  .object({
    orderId: z.string().min(1),
    returnId: z.string().min(1),
    expectedVersion: z.number().int().positive(),
    submissionKey: submissionKeySchema,
    receivedDate: z.iso.date(),
    notes: z.string().trim().min(1).max(1000),
    confirmed: z.literal(true),
    items: z
      .array(
        z
          .object({
            orderItemId: z.string().min(1),
            quantity: quantitySchema,
            condition: z.enum(["Sellable", "Damaged"]),
            restock: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(250),
  })
  .strict();
export async function receiveReturnedItemsAction(raw: z.infer<typeof receiptSchema>) {
  const auth = await getPermittedDashboardAuthorization("orders.view");
  if (!auth || !can(auth.membership, "orders.returns.manage"))
    throw new CommerceError("You cannot receive returned items.");
  const input = parseCommerceInput(receiptSchema, raw);
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const result = await commerceTransaction(async (tx) => {
    await lockOrder(tx, auth.workspaceId, input.orderId);
    const previous = await tx.orderReturnReceipt.findUnique({
      where: { ownerId_idempotencyKey: { ownerId: auth.workspaceId, idempotencyKey: input.submissionKey } },
      include: { items: true },
    });
    if (previous) {
      if (
        previous.orderId !== input.orderId ||
        previous.orderReturnId !== input.returnId ||
        previous.notes !== `${input.notes} [${hash}]`
      )
        throw new CommerceError("Submission key already used for another receipt.");
      return { id: previous.id };
    }
    const { record, items } = await loadReceipt(tx, auth.workspaceId, input.orderId, input.returnId);
    if (record.order.version !== input.expectedVersion)
      throw new CommerceError("Order changed. Reopen the receipt form before saving.");
    if (new Set(input.items.map((item) => item.orderItemId)).size !== input.items.length)
      throw new CommerceError("Each received item must be unique.");
    const receipt = await tx.orderReturnReceipt.create({
      data: {
        ownerId: auth.workspaceId,
        orderId: input.orderId,
        orderReturnId: input.returnId,
        idempotencyKey: input.submissionKey,
        notes: `${input.notes} [${hash}]`,
        receivedAt: new Date(`${input.receivedDate}T12:00:00Z`),
        actorUserId: auth.principal.user.id,
      },
    });
    for (const line of input.items) {
      const original = items.find((item) => item.orderItemId === line.orderItemId);
      if (!original || line.quantity > original.remaining)
        throw new CommerceError("Received quantity exceeds the units still awaiting receipt on this resolution.");
      if (line.restock && (line.condition !== "Sellable" || !original.inventoryItemId))
        throw new CommerceError("Only sellable inventory items can be restocked.");
      let stockMovementId: string | undefined;
      if (line.restock && original.inventoryItemId) {
        const key = `${input.submissionKey}:${line.orderItemId}`;
        await adjustStock(tx, {
          ownerId: auth.workspaceId,
          inventoryItemId: original.inventoryItemId,
          quantityChange: line.quantity,
          reason: "Return",
          notes: record.returnNumber,
          orderId: input.orderId,
          orderItemId: line.orderItemId,
          idempotencyKey: key,
          actorUserId: auth.principal.user.id,
        });
        stockMovementId = (
          await tx.inventoryStockMovement.findUniqueOrThrow({
            where: { ownerId_idempotencyKey: { ownerId: auth.workspaceId, idempotencyKey: key } },
          })
        ).id;
      }
      await tx.orderReturnReceiptItem.create({
        data: {
          ownerId: auth.workspaceId,
          receiptId: receipt.id,
          orderItemId: line.orderItemId,
          inventoryItemId: original.inventoryItemId,
          stockMovementId,
          receivedQuantity: line.quantity,
          restockedQuantity: line.restock ? line.quantity : 0,
          condition: line.condition,
          unitCost: original.item.unitCost,
          retailUnitPrice: original.item.unitPrice,
          evidence: { product: original.item.product, sku: original.item.sku, source: "Later physical receipt" },
        },
      });
    }
    await tx.order.update({ where: { id: input.orderId }, data: { version: { increment: 1 } } });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: auth.workspaceId,
        actorUserId: auth.principal.user.id,
        membershipId: auth.membership.id,
        action: "order.return.receive",
        targetType: "OrderReturnReceipt",
        targetId: receipt.id,
        metadata: { orderId: input.orderId, returnId: input.returnId },
      },
      tx,
    );
    return { id: receipt.id };
  });
  for (const path of [
    "/dashboard/inventory",
    "/dashboard/orders",
    "/dashboard/commerce-analytics",
    `/dashboard/orders/${input.orderId}/edit`,
    `/dashboard/orders/${input.orderId}/return`,
  ])
    revalidateWorkspacePath(auth.membership.workspaceSlug, path);
  return result;
}
