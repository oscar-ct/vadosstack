import type { Prisma } from "@prisma/client";

import { cents, money } from "./money";
import { cancellableQuantity, cancellationLineAmount } from "./order-cancellation";
import { adjustStock, CommerceError } from "./transaction";
import { createHash } from "node:crypto";

type CancellationLine = {
  orderItemId: string;
  quantity: number;
};

export async function createCancellationAdjustment(
  tx: Prisma.TransactionClient,
  input: {
    ownerId: string;
    orderId: string;
    lines: CancellationLine[];
    reason: string;
    idempotencyKey: string;
    actorUserId?: string;
  },
) {
  const normalizedLines = [...input.lines]
    .filter((line) => line.quantity > 0)
    .sort((left, right) => left.orderItemId.localeCompare(right.orderItemId));
  if (!normalizedLines.length) throw new CommerceError("Select at least one item to cancel.");
  if (new Set(normalizedLines.map((line) => line.orderItemId)).size !== normalizedLines.length)
    throw new CommerceError("Each cancellation line must be unique.");

  const submissionHash = createHash("sha256")
    .update(JSON.stringify({ orderId: input.orderId, lines: normalizedLines, reason: input.reason }))
    .digest("hex");
  const previous = await tx.orderAdjustment.findUnique({
    where: { ownerId_idempotencyKey: { ownerId: input.ownerId, idempotencyKey: input.idempotencyKey } },
    include: { items: true },
  });
  if (previous) {
    if (
      previous.orderId !== input.orderId ||
      previous.kind !== "Cancellation" ||
      previous.submissionHash !== submissionHash
    )
      throw new CommerceError("Submission key already used for a different cancellation.");
    return previous;
  }

  const order = await tx.order.findFirstOrThrow({
    where: { id: input.orderId, ownerId: input.ownerId },
    include: {
      items: {
        include: {
          adjustmentItems: { include: { adjustment: { select: { kind: true } } } },
          returnItems: { select: { returnQuantity: true } },
        },
      },
      adjustments: { where: { kind: "Cancellation" }, select: { shippingAmount: true } },
    },
  });
  if (order.orderStatus !== "Active") throw new CommerceError("Only active orders can be cancelled.");

  const allocations = normalizedLines.map((requested) => {
    const line = order.items.find((item) => item.id === requested.orderItemId);
    if (!line) throw new CommerceError("An item selected for cancellation was not found.");
    const cancelledQuantity = (line.adjustmentItems ?? []).reduce(
      (sum, item) => sum + (item.adjustment.kind === "Cancellation" ? item.quantity : 0),
      0,
    );
    const returnedQuantity = (line.returnItems ?? []).reduce((sum, item) => sum + item.returnQuantity, 0);
    const available = cancellableQuantity({
      quantity: line.quantity,
      shippedQuantity: line.shippedQuantity,
      cancelledQuantity,
      returnedQuantity,
    });
    if (requested.quantity > available)
      throw new CommerceError(`${line.product} only has ${available} cancellable unit${available === 1 ? "" : "s"}.`);
    // Cancellation and return credits share the same original line allocation.
    // Count both so a mixed resolution cannot credit the same discount/tax slice twice.
    const resolvedBefore = cancelledQuantity + returnedQuantity;
    return {
      line,
      quantity: requested.quantity,
      grossAmount: cancellationLineAmount({
        amountCents: cents(line.lineTotal),
        quantity: line.quantity,
        previouslyResolved: resolvedBefore,
        cancelling: requested.quantity,
      }),
      discountAmount: cancellationLineAmount({
        amountCents: cents(line.discountAmount),
        quantity: line.quantity,
        previouslyResolved: resolvedBefore,
        cancelling: requested.quantity,
      }),
      taxAmount: cancellationLineAmount({
        amountCents: cents(line.taxAmount),
        quantity: line.quantity,
        previouslyResolved: resolvedBefore,
        cancelling: requested.quantity,
      }),
      cancelledBefore: cancelledQuantity,
      returnedQuantity,
    };
  });

  const cancellingById = new Map(allocations.map((entry) => [entry.line.id, entry.quantity]));
  const allRemainingUnitsCancelled = order.items.every((line) => {
    const cancelled = (line.adjustmentItems ?? []).reduce(
      (sum, item) => sum + (item.adjustment.kind === "Cancellation" ? item.quantity : 0),
      0,
    );
    const returned = (line.returnItems ?? []).reduce((sum, item) => sum + item.returnQuantity, 0);
    return (
      cancellableQuantity({
        quantity: line.quantity,
        shippedQuantity: line.shippedQuantity,
        cancelledQuantity: cancelled + (cancellingById.get(line.id) ?? 0),
        returnedQuantity: returned,
      }) === 0
    );
  });
  const hasFulfilledUnits = order.items.some((line) => line.shippedQuantity > 0);
  const shippingAlreadyCredited = (order.adjustments ?? []).reduce(
    (sum, adjustment) => sum + cents(adjustment.shippingAmount),
    0,
  );
  const shippingAmount =
    allRemainingUnitsCancelled && !hasFulfilledUnits
      ? Math.max(cents(order.shippingAmount) - shippingAlreadyCredited, 0)
      : 0;
  const merchandiseAmount = allocations.reduce((sum, entry) => sum + entry.grossAmount, 0);
  const discountAmount = allocations.reduce((sum, entry) => sum + entry.discountAmount, 0);
  const taxAmount = allocations.reduce((sum, entry) => sum + entry.taxAmount, 0);

  const adjustment = await tx.orderAdjustment.create({
    data: {
      ownerId: input.ownerId,
      orderId: input.orderId,
      kind: "Cancellation",
      merchandiseAmount: money(merchandiseAmount),
      discountAmount: money(discountAmount),
      taxAmount: money(taxAmount),
      shippingAmount: money(shippingAmount),
      reason: input.reason,
      actorUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      submissionHash,
      items: {
        create: allocations.map((entry) => ({
          orderItemId: entry.line.id,
          quantity: entry.quantity,
          grossAmount: money(entry.grossAmount),
          discountAmount: money(entry.discountAmount),
          taxAmount: money(entry.taxAmount),
        })),
      },
    },
    include: { items: true },
  });

  for (const entry of allocations)
    if (entry.line.inventoryItemId)
      await adjustStock(tx, {
        ownerId: input.ownerId,
        inventoryItemId: entry.line.inventoryItemId,
        quantityChange: entry.quantity,
        reason: "Order cancellation",
        orderId: input.orderId,
        orderItemId: entry.line.id,
        actorUserId: input.actorUserId,
        idempotencyKey: `${input.idempotencyKey}:${entry.line.id}`,
        notes: input.reason,
      });

  const orderStatus = allRemainingUnitsCancelled && !hasFulfilledUnits ? "Cancelled" : "Active";
  const activeQuantity = order.items.reduce((sum, line) => {
    const cancelled = (line.adjustmentItems ?? []).reduce(
      (value, item) => value + (item.adjustment.kind === "Cancellation" ? item.quantity : 0),
      0,
    );
    return sum + Math.max(0, line.quantity - cancelled - (cancellingById.get(line.id) ?? 0));
  }, 0);
  const shippedQuantity = order.items.reduce((sum, line) => sum + line.shippedQuantity, 0);
  const fulfillmentStatus =
    activeQuantity === 0 || shippedQuantity === activeQuantity
      ? "Fulfilled"
      : shippedQuantity > 0
        ? "Partially Fulfilled"
        : "Unfulfilled";
  await tx.order.update({
    where: { id: input.orderId },
    data: {
      orderStatus,
      cancelledAt: orderStatus === "Cancelled" ? new Date() : null,
      fulfillmentStatus: orderStatus === "Cancelled" ? "Unfulfilled" : fulfillmentStatus,
      reservationExpiresAt: orderStatus === "Cancelled" ? null : order.reservationExpiresAt,
      version: { increment: 1 },
    },
  });
  return adjustment;
}
