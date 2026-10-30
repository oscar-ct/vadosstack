"use server";

import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { getOrderBalance, refreshOrderPaymentStatus, requireVersion } from "@/lib/commerce/ledger";
import { cents } from "@/lib/commerce/money";
import { adjustStock, CommerceError, commerceTransaction, lockOrder } from "@/lib/commerce/transaction";
import { amountSchema, parseCommerceInput, quantitySchema, submissionKeySchema } from "@/lib/commerce/validation";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

const operationSchema = z.object({
  orderId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  submissionKey: submissionKeySchema,
});
const externalMoneySchema = operationSchema.extend({
  amount: amountSchema.refine((value) => value > 0, "Amount must be greater than zero."),
  method: z.string().trim().min(1).max(100),
  reference: z.string().trim().max(200),
  externalConfirmed: z.boolean().refine((value) => value, "Confirm that the external transaction has completed."),
});

function refresh(slug: string, orderId: string) {
  for (const path of [
    "/dashboard/orders",
    "/dashboard/inventory",
    "/dashboard/commerce-pulse",
    `/dashboard/orders/${orderId}/edit`,
    `/dashboard/orders/${orderId}/return`,
  ])
    revalidateWorkspacePath(slug, path);
}

export async function recordOrderPaymentAction(raw: z.infer<typeof externalMoneySchema>) {
  const auth = await getPermittedDashboardAuthorization("orders.payments.manage");
  if (!auth) throw new Error("You do not have permission to record order payments.");
  const input = parseCommerceInput(externalMoneySchema.strict(), raw);
  const result = await commerceTransaction(async (tx) => {
    await lockOrder(tx, auth.workspaceId, input.orderId);
    const previous = await tx.orderPayment.findUnique({
      where: { ownerId_idempotencyKey: { ownerId: auth.workspaceId, idempotencyKey: input.submissionKey } },
    });
    if (previous) {
      if (
        previous.orderId !== input.orderId ||
        cents(previous.amount) !== cents(input.amount) ||
        previous.method !== input.method ||
        (previous.reference ?? "") !== input.reference
      )
        throw new CommerceError("Submission key already used for a different payment.");
      return { id: previous.id };
    }
    const balance = await getOrderBalance(tx, auth.workspaceId, input.orderId);
    requireVersion(balance.order.version, input.expectedVersion);
    if (balance.order.orderStatus !== "Active") throw new CommerceError("Cancelled orders cannot receive payments.");
    if (cents(input.amount) > balance.due) throw new CommerceError("Payment exceeds the remaining order balance.");
    const payment = await tx.orderPayment.create({
      data: {
        ownerId: auth.workspaceId,
        orderId: input.orderId,
        amount: input.amount,
        method: input.method,
        reference: input.reference || null,
        idempotencyKey: input.submissionKey,
        actorUserId: auth.principal.user.id,
      },
    });
    await tx.order.update({
      where: { id: input.orderId },
      data: { version: { increment: 1 }, reservationExpiresAt: null },
    });
    await refreshOrderPaymentStatus(tx, auth.workspaceId, input.orderId);
    await recordAuthorizationAuditEvent(
      {
        workspaceId: auth.workspaceId,
        actorUserId: auth.principal.user.id,
        membershipId: auth.membership.id,
        action: "order.payment.record",
        targetType: "OrderPayment",
        targetId: payment.id,
        metadata: { orderId: input.orderId, amount: input.amount },
      },
      tx,
    );
    return { id: payment.id };
  });
  refresh(auth.membership.workspaceSlug, input.orderId);
  return result;
}

const refundSchema = externalMoneySchema
  .extend({ paymentId: z.string().min(1), returnId: z.string().min(1).optional() })
  .strict();

export async function recordOrderRefundAction(raw: z.infer<typeof refundSchema>) {
  const auth = await getPermittedDashboardAuthorization("orders.payments.manage");
  if (!auth) throw new Error("You do not have permission to record order refunds.");
  const input = parseCommerceInput(refundSchema, raw);
  const result = await commerceTransaction(async (tx) => {
    await lockOrder(tx, auth.workspaceId, input.orderId);
    const previous = await tx.orderRefund.findUnique({
      where: { ownerId_idempotencyKey: { ownerId: auth.workspaceId, idempotencyKey: input.submissionKey } },
    });
    if (previous) {
      if (
        previous.orderId !== input.orderId ||
        previous.paymentId !== input.paymentId ||
        (previous.orderReturnId ?? undefined) !== input.returnId ||
        cents(previous.amount) !== cents(input.amount) ||
        previous.method !== input.method ||
        (previous.reference ?? "") !== input.reference
      )
        throw new CommerceError("Submission key already used for a different refund.");
      return { id: previous.id };
    }
    const balance = await getOrderBalance(tx, auth.workspaceId, input.orderId);
    requireVersion(balance.order.version, input.expectedVersion);
    const payment = balance.payments.find((entry) => entry.id === input.paymentId);
    if (!payment) throw new CommerceError("Payment was not found for this order.");
    const refunded = balance.refunds
      .filter((entry) => entry.paymentId === payment.id)
      .reduce((sum, entry) => sum + cents(entry.amount), 0);
    if (cents(input.amount) > cents(payment.amount) - refunded)
      throw new CommerceError("Refund exceeds this payment's refundable balance.");
    const receipt = input.returnId
      ? await tx.orderReturn.findFirst({
          where: { id: input.returnId, orderId: input.orderId, ownerId: auth.workspaceId },
        })
      : null;
    if (input.returnId && !receipt) throw new CommerceError("Return was not found for this order.");
    const alreadyRefunded = receipt
      ? balance.refunds
          .filter((entry) => entry.orderReturnId === receipt.id)
          .reduce((sum, entry) => sum + cents(entry.amount), 0)
      : 0;
    if (receipt && cents(input.amount) > cents(receipt.refundAmount) - alreadyRefunded)
      throw new CommerceError("Refund exceeds the amount requested on this return.");
    const refund = await tx.orderRefund.create({
      data: {
        ownerId: auth.workspaceId,
        orderId: input.orderId,
        paymentId: payment.id,
        orderReturnId: receipt?.id,
        amount: input.amount,
        method: input.method,
        reference: input.reference || null,
        idempotencyKey: input.submissionKey,
        actorUserId: auth.principal.user.id,
      },
    });
    if (receipt)
      await tx.orderReturn.update({
        where: { id: receipt.id },
        data: {
          refundState:
            alreadyRefunded + cents(input.amount) === cents(receipt.refundAmount) ? "succeeded" : "partially_refunded",
        },
      });
    await tx.order.update({ where: { id: input.orderId }, data: { version: { increment: 1 } } });
    await refreshOrderPaymentStatus(tx, auth.workspaceId, input.orderId);
    await recordAuthorizationAuditEvent(
      {
        workspaceId: auth.workspaceId,
        actorUserId: auth.principal.user.id,
        membershipId: auth.membership.id,
        action: "order.refund.record",
        targetType: "OrderRefund",
        targetId: refund.id,
        metadata: { orderId: input.orderId, amount: input.amount },
      },
      tx,
    );
    return { id: refund.id };
  });
  refresh(auth.membership.workspaceSlug, input.orderId);
  return result;
}

const shipmentSchema = operationSchema
  .extend({
    carrier: z.string().trim().max(100),
    trackingNumber: z.string().trim().max(200),
    items: z
      .array(z.object({ orderItemId: z.string().min(1), quantity: quantitySchema }).strict())
      .min(1)
      .max(250),
  })
  .strict();

export async function shipOrderItemsAction(raw: z.infer<typeof shipmentSchema>) {
  const auth = await getPermittedDashboardAuthorization("orders.update");
  if (!auth) throw new Error("You do not have permission to ship orders.");
  const input = parseCommerceInput(shipmentSchema, raw);
  const result = await commerceTransaction(async (tx) => {
    await lockOrder(tx, auth.workspaceId, input.orderId);
    const previous = await tx.orderShipment.findUnique({
      where: { orderId_idempotencyKey: { orderId: input.orderId, idempotencyKey: input.submissionKey } },
      include: { items: true },
    });
    if (previous) {
      const matches =
        previous.carrier === input.carrier &&
        previous.trackingNumber === input.trackingNumber &&
        previous.items.length === input.items.length &&
        previous.items.every((line) =>
          input.items.some((item) => item.orderItemId === line.orderItemId && item.quantity === line.quantity),
        );
      if (!matches) throw new CommerceError("Submission key already used for a different shipment.");
      return { id: previous.id };
    }
    const order = await tx.order.findFirstOrThrow({
      where: { id: input.orderId, ownerId: auth.workspaceId },
      include: { items: true, returns: true },
    });
    requireVersion(order.version, input.expectedVersion);
    if (order.orderStatus !== "Active" || order.returns.length)
      throw new CommerceError("Cancelled or returned orders cannot be shipped.");
    if (new Set(input.items.map((item) => item.orderItemId)).size !== input.items.length)
      throw new CommerceError("Each shipment line must be unique.");
    for (const item of input.items) {
      const line = order.items.find((entry) => entry.id === item.orderItemId);
      if (!line || item.quantity > line.quantity - line.shippedQuantity)
        throw new CommerceError("Shipment quantity exceeds the remaining order quantity.");
      await tx.orderItem.update({ where: { id: line.id }, data: { shippedQuantity: { increment: item.quantity } } });
      line.shippedQuantity += item.quantity;
    }
    const shipment = await tx.orderShipment.create({
      data: {
        orderId: input.orderId,
        idempotencyKey: input.submissionKey,
        actorUserId: auth.principal.user.id,
        carrier: input.carrier,
        trackingNumber: input.trackingNumber,
        items: { create: input.items },
      },
    });
    await tx.order.update({
      where: { id: input.orderId },
      data: {
        fulfillmentStatus: order.items.every((item) => item.shippedQuantity === item.quantity)
          ? "Fulfilled"
          : "Partially Fulfilled",
        reservationExpiresAt: null,
        version: { increment: 1 },
        shippingService: input.carrier,
        trackingNumber: input.trackingNumber,
      },
    });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: auth.workspaceId,
        actorUserId: auth.principal.user.id,
        membershipId: auth.membership.id,
        action: "order.ship",
        targetType: "OrderShipment",
        targetId: shipment.id,
      },
      tx,
    );
    return { id: shipment.id };
  });
  refresh(auth.membership.workspaceSlug, input.orderId);
  return result;
}

export async function cancelOrderAction(raw: z.infer<typeof operationSchema>) {
  const auth = await getPermittedDashboardAuthorization("orders.update");
  if (!auth) throw new Error("You do not have permission to cancel orders.");
  const input = parseCommerceInput(operationSchema.strict(), raw);
  await commerceTransaction(async (tx) => {
    await lockOrder(tx, auth.workspaceId, input.orderId);
    const balance = await getOrderBalance(tx, auth.workspaceId, input.orderId);
    if (balance.order.orderStatus === "Cancelled") return;
    requireVersion(balance.order.version, input.expectedVersion);
    const items = await tx.orderItem.findMany({ where: { orderId: input.orderId, ownerId: auth.workspaceId } });
    const returned = await tx.orderReturn.count({ where: { orderId: input.orderId, ownerId: auth.workspaceId } });
    if (items.some((item) => item.shippedQuantity) || returned)
      throw new CommerceError("Use returns for an order that has shipments or returns.");
    if (balance.refundable > 0)
      throw new CommerceError("Record the external refund before cancelling this paid order.");
    for (const item of items)
      if (item.inventoryItemId)
        await adjustStock(tx, {
          ownerId: auth.workspaceId,
          inventoryItemId: item.inventoryItemId,
          quantityChange: item.quantity,
          reason: "Order cancelled",
          orderId: input.orderId,
          orderItemId: item.id,
          actorUserId: auth.principal.user.id,
        });
    await tx.order.update({
      where: { id: input.orderId },
      data: {
        orderStatus: "Cancelled",
        cancelledAt: new Date(),
        reservationExpiresAt: null,
        version: { increment: 1 },
      },
    });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: auth.workspaceId,
        actorUserId: auth.principal.user.id,
        membershipId: auth.membership.id,
        action: "order.cancel",
        targetType: "Order",
        targetId: input.orderId,
      },
      tx,
    );
  });
  refresh(auth.membership.workspaceSlug, input.orderId);
  return { success: true };
}
