"use server";

import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { checkComponents, remainingPaymentComponents, splitAmount } from "@/lib/commerce/allocations";
import { getOrderBalance, refreshOrderPaymentStatus, requireVersion } from "@/lib/commerce/ledger";
import { cents, money } from "@/lib/commerce/money";
import { createCancellationAdjustment } from "@/lib/commerce/order-adjustments";
import { adjustmentCreditCents, cancellableQuantity } from "@/lib/commerce/order-cancellation";
import { CommerceError, commerceTransaction, lockOrder } from "@/lib/commerce/transaction";
import { amountSchema, parseCommerceInput, quantitySchema, submissionKeySchema } from "@/lib/commerce/validation";
import { prisma } from "@/lib/prisma";
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
    "/dashboard/commerce-analytics",
    "/dashboard/orders",
    "/dashboard/inventory",
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
        ...splitAmount(
          input.amount,
          remainingPaymentComponents(balance.order, balance.payments, balance.refunds, balance.adjustments),
        ),
        ...(balance.payments.some((p) => p.taxAmount == null) || balance.refunds.some((r) => r.taxAmount == null)
          ? { allocationSource: "estimated" }
          : {}),
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
  .extend({
    paymentId: z.string().min(1),
    returnId: z.string().min(1).optional(),
    adjustmentId: z.string().min(1).optional(),
    merchandiseAmount: amountSchema.optional(),
    taxAmount: amountSchema.optional(),
    shippingAmount: amountSchema.optional(),
  })
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
        (previous.adjustmentId ?? undefined) !== input.adjustmentId ||
        cents(previous.amount) !== cents(input.amount) ||
        previous.method !== input.method ||
        (previous.reference ?? "") !== input.reference ||
        (["merchandiseAmount", "taxAmount", "shippingAmount"] as const).some(
          (key) =>
            input[key] !== undefined && (previous[key] == null || cents(previous[key] ?? 0) !== cents(input[key] ?? 0)),
        )
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
    const adjustment = input.adjustmentId
      ? await tx.orderAdjustment.findFirst({
          where: { id: input.adjustmentId, orderId: input.orderId, ownerId: auth.workspaceId },
        })
      : null;
    if (input.adjustmentId && !adjustment) throw new CommerceError("Credit adjustment was not found for this order.");
    if (!receipt && cents(input.amount) > balance.creditOwed)
      throw new CommerceError("Refund exceeds the credit currently owed to the customer.");
    if (adjustment) {
      const adjustmentRefunded = balance.refunds
        .filter((entry) => entry.adjustmentId === adjustment.id)
        .reduce((sum, entry) => sum + cents(entry.amount), 0);
      const adjustmentAvailable =
        adjustmentCreditCents({
          merchandiseAmount: cents(adjustment.merchandiseAmount),
          discountAmount: cents(adjustment.discountAmount),
          taxAmount: cents(adjustment.taxAmount),
          shippingAmount: cents(adjustment.shippingAmount),
        }) - adjustmentRefunded;
      if (cents(input.amount) > adjustmentAvailable)
        throw new CommerceError("Refund exceeds the amount remaining on the selected credit adjustment.");
    }
    const alreadyRefunded = receipt
      ? balance.refunds
          .filter((entry) => entry.orderReturnId === receipt.id)
          .reduce((sum, entry) => sum + cents(entry.amount), 0)
      : 0;
    if (receipt && cents(input.amount) > cents(receipt.refundAmount) - alreadyRefunded)
      throw new CommerceError("Refund exceeds the amount requested on this return.");
    const prior = balance.refunds.filter((r) => r.paymentId === payment.id);
    const legacy = payment.taxAmount == null || prior.some((r) => r.taxAmount == null);
    const source =
      payment.taxAmount != null && payment.merchandiseAmount != null && payment.shippingAmount != null
        ? payment
        : splitAmount(payment.amount, {
            merchandiseAmount: Number(balance.order.subtotal) - Number(balance.order.discountAmount),
            taxAmount: Number(balance.order.taxAmount),
            shippingAmount: Number(balance.order.shippingAmount),
          });
    const limits = {
      merchandiseAmount: Number(source.merchandiseAmount),
      taxAmount: Number(source.taxAmount),
      shippingAmount: Number(source.shippingAmount),
    };
    for (const refund of prior) {
      const parts =
        refund.taxAmount != null && refund.merchandiseAmount != null && refund.shippingAmount != null
          ? refund
          : splitAmount(refund.amount, limits);
      for (const key of ["merchandiseAmount", "taxAmount", "shippingAmount"] as const)
        limits[key] = money(Math.max(0, cents(limits[key]) - cents(parts[key] ?? 0)));
    }
    const allocation =
      input.merchandiseAmount !== undefined && input.taxAmount !== undefined && input.shippingAmount !== undefined
        ? checkComponents(input.amount, {
            merchandiseAmount: input.merchandiseAmount,
            taxAmount: input.taxAmount,
            shippingAmount: input.shippingAmount,
          })
        : splitAmount(input.amount, limits);
    for (const key of ["merchandiseAmount", "taxAmount", "shippingAmount"] as const)
      if (cents(allocation[key]) > cents(limits[key]))
        throw new CommerceError("Refund exceeds the remaining component balance.");
    const refund = await tx.orderRefund.create({
      data: {
        ownerId: auth.workspaceId,
        orderId: input.orderId,
        paymentId: payment.id,
        orderReturnId: receipt?.id,
        adjustmentId: adjustment?.id,
        ...allocation,
        ...(legacy ? { allocationSource: "estimated" } : {}),
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

const creditRefundSchema = externalMoneySchema.extend({ paymentId: z.string().min(1) }).strict();

export async function recordOrderCreditRefundAction(raw: z.infer<typeof creditRefundSchema>) {
  const auth = await getPermittedDashboardAuthorization("orders.payments.manage");
  if (!auth) throw new Error("You do not have permission to record order refunds.");
  const input = parseCommerceInput(creditRefundSchema, raw);
  const result = await commerceTransaction(async (tx) => {
    await lockOrder(tx, auth.workspaceId, input.orderId);
    const priorAttempt = await tx.orderRefund.findMany({
      where: { ownerId: auth.workspaceId, idempotencyKey: { startsWith: `${input.submissionKey}:` } },
      orderBy: { idempotencyKey: "asc" },
    });
    if (priorAttempt.length) {
      const matches =
        priorAttempt.every(
          (refund) =>
            refund.orderId === input.orderId &&
            refund.paymentId === input.paymentId &&
            refund.method === input.method &&
            (refund.reference ?? "") === input.reference,
        ) && priorAttempt.reduce((sum, refund) => sum + cents(refund.amount), 0) === cents(input.amount);
      if (!matches) throw new CommerceError("Submission key already used for a different refund.");
      return { ids: priorAttempt.map((refund) => refund.id) };
    }

    const balance = await getOrderBalance(tx, auth.workspaceId, input.orderId);
    requireVersion(balance.order.version, input.expectedVersion);
    if (cents(input.amount) > balance.creditOwed)
      throw new CommerceError("Refund exceeds the credit currently owed to the customer.");
    const payment = balance.payments.find((entry) => entry.id === input.paymentId);
    if (!payment) throw new CommerceError("Payment was not found for this order.");
    const paymentRefunds = balance.refunds.filter((entry) => entry.paymentId === payment.id);
    const paymentRefunded = paymentRefunds.reduce((sum, entry) => sum + cents(entry.amount), 0);
    if (cents(input.amount) > cents(payment.amount) - paymentRefunded)
      throw new CommerceError("Refund exceeds the selected payment's refundable balance.");

    const source =
      payment.taxAmount != null && payment.merchandiseAmount != null && payment.shippingAmount != null
        ? payment
        : splitAmount(payment.amount, {
            merchandiseAmount: Number(balance.order.subtotal) - Number(balance.order.discountAmount),
            taxAmount: Number(balance.order.taxAmount),
            shippingAmount: Number(balance.order.shippingAmount),
          });
    const componentLimits = {
      merchandiseAmount: Number(source.merchandiseAmount),
      taxAmount: Number(source.taxAmount),
      shippingAmount: Number(source.shippingAmount),
    };
    for (const refund of paymentRefunds) {
      const parts =
        refund.taxAmount != null && refund.merchandiseAmount != null && refund.shippingAmount != null
          ? refund
          : splitAmount(refund.amount, componentLimits);
      for (const key of ["merchandiseAmount", "taxAmount", "shippingAmount"] as const)
        componentLimits[key] = money(Math.max(0, cents(componentLimits[key]) - cents(parts[key] ?? 0)));
    }

    let remaining = cents(input.amount);
    const sources = balance.adjustments
      .map((adjustment) => {
        const alreadyRefunded = balance.refunds
          .filter((refund) => refund.adjustmentId === adjustment.id)
          .reduce((sum, refund) => sum + cents(refund.amount), 0);
        return {
          adjustment,
          available:
            adjustmentCreditCents({
              merchandiseAmount: cents(adjustment.merchandiseAmount),
              discountAmount: cents(adjustment.discountAmount),
              taxAmount: cents(adjustment.taxAmount),
              shippingAmount: cents(adjustment.shippingAmount),
            }) - alreadyRefunded,
        };
      })
      .filter((sourceEntry) => sourceEntry.available > 0);
    const refundRows: Array<{ adjustmentId: string; amount: number }> = [];
    for (const sourceEntry of sources) {
      if (remaining <= 0) break;
      const amount = Math.min(remaining, sourceEntry.available);
      refundRows.push({ adjustmentId: sourceEntry.adjustment.id, amount });
      remaining -= amount;
    }
    if (remaining > 0) throw new CommerceError("Refund exceeds the available credit adjustments.");

    const legacy = payment.taxAmount == null || paymentRefunds.some((refund) => refund.taxAmount == null);
    const created = [];
    for (const [index, row] of refundRows.entries()) {
      const allocation = splitAmount(money(row.amount), componentLimits);
      const refund = await tx.orderRefund.create({
        data: {
          ownerId: auth.workspaceId,
          orderId: input.orderId,
          paymentId: payment.id,
          adjustmentId: row.adjustmentId,
          ...allocation,
          ...(legacy ? { allocationSource: "estimated" } : {}),
          amount: money(row.amount),
          method: input.method,
          reference: input.reference || null,
          idempotencyKey: `${input.submissionKey}:${index.toString().padStart(3, "0")}`,
          actorUserId: auth.principal.user.id,
        },
      });
      for (const key of ["merchandiseAmount", "taxAmount", "shippingAmount"] as const)
        componentLimits[key] = money(Math.max(0, cents(componentLimits[key]) - cents(allocation[key])));
      created.push(refund);
    }
    await tx.order.update({ where: { id: input.orderId }, data: { version: { increment: 1 } } });
    await refreshOrderPaymentStatus(tx, auth.workspaceId, input.orderId);
    await recordAuthorizationAuditEvent(
      {
        workspaceId: auth.workspaceId,
        actorUserId: auth.principal.user.id,
        membershipId: auth.membership.id,
        action: "order.credit.refund.record",
        targetType: "OrderRefund",
        targetId: created[0].id,
        metadata: {
          orderId: input.orderId,
          amount: input.amount,
          refundIds: created.map((refund) => refund.id),
          adjustmentIds: refundRows.map((row) => row.adjustmentId),
        },
      },
      tx,
    );
    return { ids: created.map((refund) => refund.id) };
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

const shipmentReversalSchema = operationSchema
  .extend({ reason: z.string().trim().min(1, "Enter a reason for undoing this fulfillment.").max(500) })
  .strict();

export async function getOrderFulfillmentAction(orderId: string) {
  const auth = await getPermittedDashboardAuthorization("orders.update");
  if (!auth) throw new Error("You do not have permission to fulfill orders.");
  const id = z.string().trim().min(1).max(100).parse(orderId);
  const order = await prisma.order.findFirst({
    where: { id, ownerId: auth.workspaceId },
    select: {
      id: true,
      version: true,
      orderNumber: true,
      orderStatus: true,
      items: {
        select: {
          id: true,
          product: true,
          quantity: true,
          shippedQuantity: true,
          returnItems: { select: { returnQuantity: true } },
          adjustmentItems: { select: { quantity: true, adjustment: { select: { kind: true } } } },
        },
      },
    },
  });
  if (!order) throw new Error("Order not found.");
  if (order.orderStatus !== "Active") throw new Error("Cancelled orders cannot be fulfilled.");
  const items = order.items
    .map((item) => ({
      id: item.id,
      product: item.product,
      remaining: cancellableQuantity({
        quantity: item.quantity,
        shippedQuantity: item.shippedQuantity,
        cancelledQuantity: (item.adjustmentItems ?? []).reduce(
          (sum, entry) => sum + (entry.adjustment.kind === "Cancellation" ? entry.quantity : 0),
          0,
        ),
        returnedQuantity: (item.returnItems ?? []).reduce((sum, entry) => sum + entry.returnQuantity, 0),
      }),
    }))
    .filter((item) => item.remaining > 0);
  if (!items.length) throw new Error("There are no remaining items to fulfill.");
  return { id: order.id, version: order.version, orderNumber: order.orderNumber, items };
}

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
      include: {
        items: {
          include: {
            returnItems: { select: { returnQuantity: true } },
            adjustmentItems: { include: { adjustment: { select: { kind: true } } } },
          },
        },
      },
    });
    requireVersion(order.version, input.expectedVersion);
    if (order.orderStatus !== "Active") throw new CommerceError("Cancelled orders cannot be shipped.");
    if (new Set(input.items.map((item) => item.orderItemId)).size !== input.items.length)
      throw new CommerceError("Each shipment line must be unique.");
    for (const item of input.items) {
      const line = order.items.find((entry) => entry.id === item.orderItemId);
      const remaining = line
        ? cancellableQuantity({
            quantity: line.quantity,
            shippedQuantity: line.shippedQuantity,
            cancelledQuantity: (line.adjustmentItems ?? []).reduce(
              (sum, entry) => sum + (entry.adjustment.kind === "Cancellation" ? entry.quantity : 0),
              0,
            ),
            returnedQuantity: (line.returnItems ?? []).reduce((sum, entry) => sum + entry.returnQuantity, 0),
          })
        : 0;
      if (!line || item.quantity > remaining)
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
        fulfillmentStatus: order.items.every((item) => {
          const cancelled = (item.adjustmentItems ?? []).reduce(
            (sum, entry) => sum + (entry.adjustment.kind === "Cancellation" ? entry.quantity : 0),
            0,
          );
          return item.shippedQuantity + cancelled === item.quantity;
        })
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

export async function reverseLatestOrderShipmentAction(raw: z.infer<typeof shipmentReversalSchema>) {
  const auth = await getPermittedDashboardAuthorization("orders.update");
  if (!auth) throw new Error("You do not have permission to correct fulfillment records.");
  const input = parseCommerceInput(shipmentReversalSchema, raw);
  const result = await commerceTransaction(async (tx) => {
    await lockOrder(tx, auth.workspaceId, input.orderId);
    const previous = await tx.orderShipmentReversal.findUnique({
      where: { idempotencyKey: input.submissionKey },
      include: { shipment: { include: { order: true } } },
    });
    if (previous) {
      if (
        previous.shipment.orderId !== input.orderId ||
        previous.shipment.order.ownerId !== auth.workspaceId ||
        previous.reason !== input.reason
      )
        throw new CommerceError("Submission key already used for a different fulfillment reversal.");
      return { id: previous.id };
    }
    const order = await tx.order.findFirstOrThrow({
      where: { id: input.orderId, ownerId: auth.workspaceId },
      include: {
        items: true,
        returns: true,
        shipments: {
          include: { items: true, reversal: true },
          orderBy: { shippedAt: "desc" },
        },
      },
    });
    requireVersion(order.version, input.expectedVersion);
    if (order.orderStatus !== "Active") throw new CommerceError("Cancelled orders cannot be changed.");
    if (order.returns.length)
      throw new CommerceError("Fulfillment cannot be corrected after a return has been started.");
    const shipment = order.shipments.find((entry) => !entry.reversal);
    if (!shipment) throw new CommerceError("There is no recorded fulfillment to correct.");

    for (const shipmentItem of shipment.items) {
      const line = order.items.find((entry) => entry.id === shipmentItem.orderItemId);
      if (!line || line.shippedQuantity < shipmentItem.quantity)
        throw new CommerceError("The fulfillment history does not match the order quantities.");
      await tx.orderItem.update({
        where: { id: line.id },
        data: { shippedQuantity: { decrement: shipmentItem.quantity } },
      });
      line.shippedQuantity -= shipmentItem.quantity;
    }

    const reversal = await tx.orderShipmentReversal.create({
      data: {
        shipmentId: shipment.id,
        idempotencyKey: input.submissionKey,
        actorUserId: auth.principal.user.id,
        reason: input.reason,
      },
    });
    const priorShipment = order.shipments.find((entry) => entry.id !== shipment.id && !entry.reversal);
    const shippedQuantity = order.items.reduce((sum, item) => sum + item.shippedQuantity, 0);
    const fulfillmentStatus =
      shippedQuantity === 0
        ? "Unfulfilled"
        : order.items.every((item) => item.shippedQuantity === item.quantity)
          ? "Fulfilled"
          : "Partially Fulfilled";
    await tx.order.update({
      where: { id: input.orderId },
      data: {
        fulfillmentStatus,
        shippingService: priorShipment?.carrier ?? null,
        trackingNumber: priorShipment?.trackingNumber ?? null,
        reservationExpiresAt:
          fulfillmentStatus === "Unfulfilled" && order.paymentStatus !== "Paid"
            ? new Date(Date.now() + 7 * 86400000)
            : null,
        version: { increment: 1 },
      },
    });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: auth.workspaceId,
        actorUserId: auth.principal.user.id,
        membershipId: auth.membership.id,
        action: "order.shipment.reverse",
        targetType: "OrderShipmentReversal",
        targetId: reversal.id,
        metadata: { orderId: input.orderId, shipmentId: shipment.id, reason: input.reason },
      },
      tx,
    );
    return { id: reversal.id };
  });
  refresh(auth.membership.workspaceSlug, input.orderId);
  return result;
}

const cancellationSchema = operationSchema
  .extend({
    reason: z.string().trim().min(1, "Choose or enter a cancellation reason.").max(500),
    items: z
      .array(z.object({ orderItemId: z.string().min(1), quantity: quantitySchema }).strict())
      .min(1)
      .max(250),
  })
  .strict();

export async function cancelOrderItemsAction(raw: z.infer<typeof cancellationSchema>) {
  const auth = await getPermittedDashboardAuthorization("orders.update");
  if (!auth) throw new Error("You do not have permission to cancel orders.");
  const input = parseCommerceInput(cancellationSchema, raw);
  let result: { id: string };
  try {
    result = await commerceTransaction(async (tx) => {
      await lockOrder(tx, auth.workspaceId, input.orderId);
      const balance = await getOrderBalance(tx, auth.workspaceId, input.orderId);
      requireVersion(balance.order.version, input.expectedVersion);
      const adjustment = await createCancellationAdjustment(tx, {
        ownerId: auth.workspaceId,
        orderId: input.orderId,
        lines: input.items,
        reason: input.reason,
        idempotencyKey: input.submissionKey,
        actorUserId: auth.principal.user.id,
      });
      await refreshOrderPaymentStatus(tx, auth.workspaceId, input.orderId);
      await recordAuthorizationAuditEvent(
        {
          workspaceId: auth.workspaceId,
          actorUserId: auth.principal.user.id,
          membershipId: auth.membership.id,
          action: "order.items.cancel",
          targetType: "OrderAdjustment",
          targetId: adjustment.id,
          metadata: { orderId: input.orderId, reason: input.reason, items: input.items },
        },
        tx,
      );
      return { id: adjustment.id };
    });
  } catch (error) {
    if (error instanceof CommerceError) throw error;
    console.error("Order cancellation failed", error);
    throw new CommerceError("Cancellation could not be saved. Refresh the order and try again.");
  }
  refresh(auth.membership.workspaceSlug, input.orderId);
  return result;
}

/** Backward-compatible full cancellation entry point for older callers. */
export async function cancelOrderAction(raw: z.infer<typeof operationSchema>) {
  const auth = await getPermittedDashboardAuthorization("orders.update");
  if (!auth) throw new Error("You do not have permission to cancel orders.");
  const input = parseCommerceInput(operationSchema.strict(), raw);
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, ownerId: auth.workspaceId },
    select: {
      items: {
        select: {
          id: true,
          quantity: true,
          shippedQuantity: true,
          returnItems: { select: { returnQuantity: true } },
          adjustmentItems: { select: { quantity: true, adjustment: { select: { kind: true } } } },
        },
      },
    },
  });
  if (!order) throw new CommerceError("Order was not found.");
  const items = order.items
    .map((item) => ({
      orderItemId: item.id,
      quantity: cancellableQuantity({
        quantity: item.quantity,
        shippedQuantity: item.shippedQuantity,
        returnedQuantity: (item.returnItems ?? []).reduce((sum, entry) => sum + entry.returnQuantity, 0),
        cancelledQuantity: (item.adjustmentItems ?? []).reduce(
          (sum, entry) => sum + (entry.adjustment.kind === "Cancellation" ? entry.quantity : 0),
          0,
        ),
      }),
    }))
    .filter((item) => item.quantity > 0);
  return cancelOrderItemsAction({ ...input, reason: "Order cancelled", items });
}
