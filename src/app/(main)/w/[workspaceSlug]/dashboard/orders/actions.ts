"use server";

import { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { z } from "zod";

import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { getOrderBalance, refreshOrderPaymentStatus, requireVersion } from "@/lib/commerce/ledger";
import { calculateOrderTotals, cents } from "@/lib/commerce/money";
import { isWalkInOrder } from "@/lib/commerce/order-customer";
import { adjustStock, CommerceError, commerceTransaction, lockOrder } from "@/lib/commerce/transaction";
import { type OrderInput, orderInputSchema, parseCommerceInput, submissionKeySchema } from "@/lib/commerce/validation";
import { allocateDocumentNumber, attachDocumentNumber } from "@/lib/document-numbering";
import { escapeHtml, plainTextToEmailHtml, sanitizeEmailHtml } from "@/lib/email-content";
import { logEmailRecord } from "@/lib/email-records";
import {
  decryptGoogleToken,
  GMAIL_REFRESH_ERROR_MESSAGE,
  refreshGoogleAccessToken,
  sendGmailMessage,
} from "@/lib/google-mail";
import { prisma } from "@/lib/prisma";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

import { getOrderDocumentData, sanitizeOrderPdfFilename } from "./_lib/order-document";
import { renderOrderPdfBuffer } from "./_lib/order-pdf";
import { createHash } from "node:crypto";

type CreateOrderInput = OrderInput;

type EmailOrderState = {
  success: boolean;
  message: string;
  reconnectRequired?: boolean;
  submittedAt?: number;
};

class OrderActionError extends CommerceError {}

const emailOrderSchema = z.object({
  orderId: z.string().trim().min(1, "Order is required."),
});

function createEmailOrderState(success: boolean, message: string, reconnectRequired = false): EmailOrderState {
  return {
    success,
    message,
    reconnectRequired,
    submittedAt: Date.now(),
  };
}

function getSubmittedEmailContent(formData: FormData, fallback: { html: string; subject: string; text: string }) {
  const subject = String(formData.get("subject") ?? "").trim() || fallback.subject;
  const text = String(formData.get("message") ?? "").trim() || fallback.text;
  const html = sanitizeEmailHtml(String(formData.get("html") ?? "").trim());

  return {
    html: html || (text === fallback.text ? fallback.html : plainTextToEmailHtml(text)),
    subject,
    text,
  };
}

function toDecimal(value: number) {
  return new Prisma.Decimal((Number.isFinite(value) ? value : 0).toFixed(2));
}

function optionalString(value?: string | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

async function resolveCustomerId(tx: Prisma.TransactionClient, ownerId: string, input: CreateOrderInput) {
  if (isWalkInOrder(input)) return null;
  if (input.customerId) {
    const customer = await tx.customer.findFirst({
      where: {
        id: input.customerId,
        ownerId,
      },
      select: {
        id: true,
      },
    });

    if (!customer) throw new OrderActionError("Customer was not found in this workspace.");
    return customer.id;
  }

  const email = optionalString(input.customerEmail);
  if (!email) return null;

  const customer = await tx.customer.findFirst({
    where: {
      ownerId,
      email,
    },
    select: {
      id: true,
    },
  });

  return customer?.id ?? null;
}

async function prepareOrderItems(
  tx: Prisma.TransactionClient,
  ownerId: string,
  input: CreateOrderInput,
  existing: Awaited<ReturnType<typeof tx.orderItem.findMany>> = [],
  canOverridePrices = false,
) {
  return Promise.all(
    input.items.map(async (item) => {
      const old = item.id ? existing.find((line) => line.id === item.id) : undefined;
      if (old && old.inventoryItemId !== (item.inventoryItemId ?? null))
        throw new OrderActionError("Remove the old line before replacing its product.");
      const inventoryItem = item.inventoryItemId
        ? await tx.inventoryItem.findFirst({
            where: { id: item.inventoryItemId, ownerId },
            include: { category: true },
          })
        : null;
      if (!old && inventoryItem && item.taxable !== undefined && item.taxable !== inventoryItem.taxable)
        throw new OrderActionError("Catalog pricing or tax changed. Refresh the product before saving.");
      if (item.inventoryItemId && !inventoryItem) throw new OrderActionError("Inventory item was not found.");
      if (inventoryItem?.itemStatus !== "Active" && inventoryItem && (!old || item.quantity > old.quantity))
        throw new OrderActionError("Inactive products cannot be added to orders.");
      if (
        !old &&
        inventoryItem &&
        item.expectedCatalogUnitPrice != null &&
        cents(item.expectedCatalogUnitPrice) !== cents(inventoryItem.unitPrice)
      )
        throw new OrderActionError("Catalog price changed. Refresh the product before saving.");
      const referencePrice = old?.unitPrice ?? inventoryItem?.unitPrice;
      const priceChanged = referencePrice !== undefined && cents(referencePrice) !== cents(item.unitPrice);
      const overrideReason = item.priceOverrideReason?.trim();
      if (item.priceOverride && !inventoryItem)
        throw new OrderActionError("Custom items do not use catalog price overrides.");
      if (inventoryItem && (priceChanged || item.priceOverride)) {
        if (!canOverridePrices) throw new OrderActionError("You do not have permission to override inventory prices.");
        if (!item.priceOverride || !overrideReason)
          throw new OrderActionError("Use Override price and enter a reason to change an inventory price.");
      }
      return {
        id: old?.id,
        inventoryItemId: inventoryItem?.id ?? null,
        category: inventoryItem
          ? old
            ? old.category
            : (inventoryItem.category?.name ?? null)
          : (item.category ?? null),
        product: inventoryItem ? (old?.product ?? inventoryItem.product) : item.product,
        sku: inventoryItem ? (old ? old.sku : inventoryItem.sku) : (item.sku ?? null),
        description: old ? old.description : (inventoryItem?.description ?? item.description ?? null),
        unit: old ? old.unit : (inventoryItem?.unit ?? item.unit ?? null),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        catalogUnitPrice: old ? (old.catalogUnitPrice ?? null) : (inventoryItem?.unitPrice ?? null),
        priceOverrideReason: item.priceOverride ? (overrideReason ?? null) : (old?.priceOverrideReason ?? null),
        unitCost: old ? old.unitCost : (inventoryItem?.cost ?? null),
        taxable: old?.taxable ?? inventoryItem?.taxable ?? item.taxable ?? true,
        taxRate:
          old && !input.overrideTaxRate
            ? Number(old.taxRate)
            : (old?.taxable ?? inventoryItem?.taxable ?? item.taxable ?? true)
              ? input.taxRate
              : 0,
      };
    }),
  );
}

function orderData(
  ownerId: string,
  customerId: string | null,
  input: CreateOrderInput,
  totals: ReturnType<typeof calculateOrderTotals>,
  orderNumber: string,
) {
  return {
    ownerId,
    customerId,
    orderNumber,
    paymentStatus: input.paymentStatus,
    fulfillmentStatus: input.fulfillmentStatus,
    orderDate: input.orderDate,
    estimatedDelivery: input.estimatedDelivery ?? null,
    shippingService: optionalString(input.shippingService),
    trackingNumber: optionalString(input.trackingNumber),
    paymentMethod: optionalString(input.paymentMethod),
    paymentReference: optionalString(input.paymentReference),
    customerNotes: optionalString(input.customerNotes),
    customerName: optionalString(input.customerName),
    customerEmail: optionalString(input.customerEmail),
    customerPhone: optionalString(input.customerPhone),
    shippingLine1: optionalString(input.shippingLine1),
    shippingLine2: optionalString(input.shippingLine2),
    shippingCity: optionalString(input.shippingCity),
    shippingState: optionalString(input.shippingState),
    shippingPostalCode: optionalString(input.shippingPostalCode),
    subtotal: toDecimal(totals.subtotal),
    shippingAmount: toDecimal(totals.shippingAmount),
    taxRate: toDecimal(input.taxRate ?? 0),
    taxAmount: toDecimal(totals.taxAmount),
    discountAmount: toDecimal(totals.discountAmount),
    total: toDecimal(totals.total),
    footerMessage: input.footerMessage ?? "",
  };
}

function hashSubmission(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function revalidateCommerce(slug: string, orderId?: string) {
  for (const path of [
    "/dashboard/orders",
    "/dashboard/inventory",
    "/dashboard/inventory-analytics",
    "/dashboard/commerce-pulse",
    ...(orderId ? [`/dashboard/orders/${orderId}/edit`, `/dashboard/orders/${orderId}/return`] : []),
  ])
    revalidateWorkspacePath(slug, path);
}

export async function createOrderWithInventoryAdjustments(rawInput: CreateOrderInput) {
  const authorization = await getPermittedDashboardAuthorization("orders.create");
  if (!authorization) throw new Error("You do not have permission to create orders.");
  const input = parseCommerceInput(orderInputSchema, rawInput);
  const submissionKey = parseCommerceInput(submissionKeySchema, input.submissionKey);
  if (!["Paid", "Pending"].includes(input.paymentStatus) || input.fulfillmentStatus === "Partially Fulfilled")
    throw new OrderActionError("Use Pending or Paid for a new order.");
  if (
    input.paymentStatus === "Paid" &&
    (!can(authorization.membership, "orders.payments.manage") ||
      !input.externalPaymentConfirmed ||
      !input.paymentMethod?.trim())
  )
    throw new OrderActionError("Confirm the external payment and its method, or create the order as Pending.");
  const workspaceId = authorization.workspaceId;
  const submissionHash = hashSubmission(input);
  const result = await commerceTransaction(async (tx) => {
    const previous = await tx.order.findUnique({
      where: { ownerId_submissionKey: { ownerId: workspaceId, submissionKey } },
    });
    if (previous) {
      if (previous.submissionHash !== submissionHash)
        throw new OrderActionError("This submission key was already used for a different order.");
      return { id: previous.id, orderNumber: previous.orderNumber, version: previous.version };
    }
    const workspace = await tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { orderMessageText: true },
    });
    const customerId = await resolveCustomerId(tx, workspaceId, input);
    const prepared = await prepareOrderItems(
      tx,
      workspaceId,
      input,
      [],
      can(authorization.membership, "orders.prices.override"),
    );
    const totals = calculateOrderTotals(prepared, input.shippingAmount, input.discountAmount, input.taxRate);
    if (cents(input.discountAmount) > cents(totals.subtotal))
      throw new OrderActionError("Discount cannot exceed the merchandise subtotal.");
    const number = await allocateDocumentNumber(tx, workspaceId, "order");
    const order = await tx.order.create({
      data: {
        ...orderData(workspaceId, customerId, input, totals, number.documentNumber),
        submissionKey,
        submissionHash,
        reservationExpiresAt:
          input.paymentStatus === "Pending" && input.fulfillmentStatus === "Unfulfilled"
            ? new Date(Date.now() + 7 * 86400000)
            : null,
        footerMessage: input.footerMessage ?? workspace.orderMessageText,
      },
    });
    await attachDocumentNumber(tx, number.assignmentId, order.id);
    const createdLines: Array<{ orderItemId: string; quantity: number }> = [];
    for (const [index, item] of prepared.entries()) {
      const { id: _id, ...data } = item;
      const line = await tx.orderItem.create({
        data: {
          ...data,
          ...totals.lines[index],
          ownerId: workspaceId,
          orderId: order.id,
          shippedQuantity: input.fulfillmentStatus === "Fulfilled" ? item.quantity : 0,
        },
      });
      createdLines.push({ orderItemId: line.id, quantity: item.quantity });
      if (item.inventoryItemId)
        await adjustStock(tx, {
          ownerId: workspaceId,
          inventoryItemId: item.inventoryItemId,
          quantityChange: -item.quantity,
          reason: "Order reserved",
          orderId: order.id,
          orderItemId: line.id,
          notes: order.orderNumber,
          actorUserId: authorization.principal.user.id,
        });
    }
    if (input.fulfillmentStatus === "Fulfilled")
      await tx.orderShipment.create({
        data: {
          orderId: order.id,
          idempotencyKey: `order:${submissionKey}`,
          actorUserId: authorization.principal.user.id,
          carrier: optionalString(input.shippingService),
          trackingNumber: optionalString(input.trackingNumber),
          items: { create: createdLines },
        },
      });
    if (input.paymentStatus === "Paid" && totals.total > 0)
      await tx.orderPayment.create({
        data: {
          ownerId: workspaceId,
          orderId: order.id,
          amount: totals.total,
          method: input.paymentMethod?.trim() ?? "",
          reference: optionalString(input.paymentReference),
          idempotencyKey: `order:${submissionKey}`,
          actorUserId: authorization.principal.user.id,
        },
      });
    await refreshOrderPaymentStatus(tx, workspaceId, order.id);
    await recordAuthorizationAuditEvent(
      {
        workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "order.create",
        targetType: "Order",
        targetId: order.id,
        metadata: {
          priceOverrides: prepared.flatMap((line, index) =>
            input.items[index].priceOverride
              ? [
                  {
                    inventoryItemId: line.inventoryItemId,
                    catalogUnitPrice: line.catalogUnitPrice == null ? null : Number(line.catalogUnitPrice),
                    unitPrice: line.unitPrice,
                    reason: line.priceOverrideReason,
                  },
                ]
              : [],
          ),
        },
      },
      tx,
    );
    return { id: order.id, orderNumber: order.orderNumber, version: order.version };
  });
  revalidateCommerce(authorization.membership.workspaceSlug, result.id);
  return result;
}

export async function updateOrderWithInventoryAdjustments(orderId: string, rawInput: CreateOrderInput) {
  const authorization = await getPermittedDashboardAuthorization("orders.update");
  if (!authorization) throw new Error("You do not have permission to update orders.");
  const input = parseCommerceInput(orderInputSchema, rawInput);
  const workspaceId = authorization.workspaceId;
  const result = await commerceTransaction(async (tx) => {
    await lockOrder(tx, workspaceId, orderId);
    const existing = await tx.order.findFirstOrThrow({
      where: { id: orderId, ownerId: workspaceId },
      include: { items: true, returns: { include: { items: true } }, shipments: true },
    });
    requireVersion(existing.version, input.expectedVersion);
    if (existing.orderStatus !== "Active") throw new OrderActionError("Cancelled orders cannot be edited.");
    if (input.paymentStatus !== existing.paymentStatus || input.fulfillmentStatus !== existing.fulfillmentStatus)
      throw new OrderActionError("Use the payment and shipping controls to change order status.");
    const prepared = await prepareOrderItems(
      tx,
      workspaceId,
      input,
      existing.items,
      can(authorization.membership, "orders.prices.override"),
    );
    const totals = calculateOrderTotals(prepared, input.shippingAmount, input.discountAmount, input.taxRate);
    if (cents(input.discountAmount) > cents(totals.subtotal))
      throw new OrderActionError("Discount cannot exceed the merchandise subtotal.");
    const hasHistory = existing.returns.length > 0 || existing.items.some((line) => line.shippedQuantity > 0);
    const financialChanged =
      prepared.length !== existing.items.length ||
      prepared.some((line) => {
        const old = existing.items.find((item) => item.id === line.id);
        return (
          !old ||
          old.quantity !== line.quantity ||
          cents(old.unitPrice) !== cents(line.unitPrice) ||
          Number(old.taxRate) !== line.taxRate ||
          old.taxable !== line.taxable
        );
      }) ||
      cents(existing.shippingAmount) !== cents(totals.shippingAmount) ||
      cents(existing.discountAmount) !== cents(totals.discountAmount);
    const identityChanged = prepared.some((line) => {
      const old = existing.items.find((item) => item.id === line.id);
      return old && (old.product !== line.product || old.sku !== line.sku || old.category !== line.category);
    });
    if (hasHistory && (financialChanged || identityChanged))
      throw new OrderActionError(
        "Orders with shipments or returns keep their original financial lines. Use a new order for additional items.",
      );
    const balance = await getOrderBalance(tx, workspaceId, orderId);
    if (balance.paid - balance.refunded > cents(totals.total))
      throw new OrderActionError("Refund the excess payment before reducing the order total.");
    // Preserve legacy rounded amounts on metadata-only edits as well.
    const savedTotals = financialChanged
      ? totals
      : {
          ...totals,
          subtotal: Number(existing.subtotal),
          taxAmount: Number(existing.taxAmount),
          total: Number(existing.total),
        };
    for (const old of existing.items) {
      if (prepared.some((line) => line.id === old.id)) continue;
      if (old.inventoryItemId)
        await adjustStock(tx, {
          ownerId: workspaceId,
          inventoryItemId: old.inventoryItemId,
          quantityChange: old.quantity,
          reason: "Order line removed",
          orderId,
          orderItemId: old.id,
          actorUserId: authorization.principal.user.id,
        });
      await tx.orderItem.delete({ where: { id: old.id } });
    }
    for (const [index, line] of prepared.entries()) {
      const old = existing.items.find((item) => item.id === line.id);
      const { id, ...data } = line;
      const pricing =
        !financialChanged && old
          ? { lineTotal: old.lineTotal, discountAmount: old.discountAmount, taxAmount: old.taxAmount }
          : totals.lines[index];
      const saved = old
        ? await tx.orderItem.update({ where: { id: old.id }, data: { ...data, ...pricing } })
        : await tx.orderItem.create({ data: { ...data, ...pricing, orderId, ownerId: workspaceId } });
      if (line.inventoryItemId)
        await adjustStock(tx, {
          ownerId: workspaceId,
          inventoryItemId: line.inventoryItemId,
          quantityChange: (old?.quantity ?? 0) - line.quantity,
          reason: "Order updated",
          orderId,
          orderItemId: saved.id,
          actorUserId: authorization.principal.user.id,
        });
    }
    const customerId = await resolveCustomerId(tx, workspaceId, input);
    const order = await tx.order.update({
      where: { id: orderId },
      data: {
        ...orderData(workspaceId, customerId, input, savedTotals, existing.orderNumber),
        version: { increment: 1 },
      },
    });
    await refreshOrderPaymentStatus(tx, workspaceId, orderId);
    await recordAuthorizationAuditEvent(
      {
        workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "order.update",
        targetType: "Order",
        targetId: orderId,
        metadata: {
          priceOverrides: prepared.flatMap((line, index) =>
            input.items[index].priceOverride
              ? [
                  {
                    inventoryItemId: line.inventoryItemId,
                    catalogUnitPrice: line.catalogUnitPrice == null ? null : Number(line.catalogUnitPrice),
                    unitPrice: line.unitPrice,
                    reason: line.priceOverrideReason,
                    previousUnitPrice:
                      existing.items.find((old) => old.id === line.id)?.unitPrice == null
                        ? null
                        : Number(existing.items.find((old) => old.id === line.id)?.unitPrice),
                  },
                ]
              : [],
          ),
        },
      },
      tx,
    );
    return { id: order.id, orderNumber: order.orderNumber, version: order.version };
  });
  revalidateCommerce(authorization.membership.workspaceSlug, orderId);
  return result;
}

export async function updateOrderStatusesAction(
  orderId: string,
  rawStatuses: Partial<{ fulfillmentStatus: "Fulfilled" | "Unfulfilled"; paymentStatus: "Paid" | "Pending" }>,
  expectedVersion?: number,
) {
  const authorization = await getPermittedDashboardAuthorization("orders.update");
  if (!authorization) throw new Error("You do not have permission to update orders.");
  const statuses = parseCommerceInput(
    z
      .object({
        fulfillmentStatus: z.enum(["Fulfilled", "Unfulfilled"]).optional(),
        paymentStatus: z.enum(["Paid", "Pending"]).optional(),
      })
      .strict(),
    rawStatuses,
  );
  if (statuses.paymentStatus) throw new OrderActionError("Record a payment using the order payment controls.");
  if (statuses.fulfillmentStatus !== "Fulfilled")
    throw new OrderActionError("Use a return to reverse a completed shipment.");
  await commerceTransaction(async (tx) => {
    await lockOrder(tx, authorization.workspaceId, orderId);
    const order = await tx.order.findFirstOrThrow({
      where: { id: orderId, ownerId: authorization.workspaceId },
      include: { items: true, returns: true },
    });
    requireVersion(order.version, expectedVersion);
    if (order.orderStatus !== "Active" || order.returns.length)
      throw new OrderActionError("Cancelled or returned orders cannot be fulfilled.");
    const remaining = order.items.filter((item) => item.shippedQuantity < item.quantity);
    if (remaining.length)
      await tx.orderShipment.create({
        data: {
          orderId,
          idempotencyKey: `complete:${order.version}`,
          actorUserId: authorization.principal.user.id,
          carrier: order.shippingService,
          trackingNumber: order.trackingNumber,
          items: {
            create: remaining.map((item) => ({ orderItemId: item.id, quantity: item.quantity - item.shippedQuantity })),
          },
        },
      });
    for (const item of remaining)
      await tx.orderItem.update({ where: { id: item.id }, data: { shippedQuantity: item.quantity } });
    await tx.order.update({
      where: { id: orderId },
      data: { fulfillmentStatus: "Fulfilled", reservationExpiresAt: null, version: { increment: 1 } },
    });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: authorization.workspaceId,
        actorUserId: authorization.principal.user.id,
        membershipId: authorization.membership.id,
        action: "order.ship",
        targetType: "Order",
        targetId: orderId,
      },
      tx,
    );
  });
  revalidateCommerce(authorization.membership.workspaceSlug, orderId);
  return { success: true, message: "Order fulfilled." };
}

export async function emailOrderAction(_previousState: EmailOrderState, formData: FormData): Promise<EmailOrderState> {
  const authorization = await getPermittedDashboardAuthorization("email.send");

  if (!authorization) {
    return createEmailOrderState(false, "You do not have permission to email orders.");
  }
  const workspaceId = authorization.workspaceId;
  if (!can(authorization.membership, "orders.view")) {
    return createEmailOrderState(false, "You do not have permission to view orders.");
  }

  const parsed = emailOrderSchema.safeParse({
    orderId: formData.get("orderId"),
  });

  if (!parsed.success) {
    return createEmailOrderState(false, parsed.error.issues[0]?.message ?? "Select an order and try again.");
  }

  const [order, googleMailAccount, workspace] = await Promise.all([
    prisma.order.findFirst({
      where: {
        id: parsed.data.orderId,
        ownerId: workspaceId,
      },
    }),
    prisma.googleMailAccount.findUnique({
      where: {
        workspaceId,
      },
    }),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
  ]);

  if (!order || !workspace) {
    return createEmailOrderState(false, "Order could not be found.");
  }

  const orderTitle = order.paymentStatus === "Paid" ? "Order Receipt" : "Order Confirmation";
  const emailRecordBase = {
    ownerId: workspaceId,
    documentType: "order" as const,
    documentId: order.id,
    documentNumber: order.orderNumber,
    documentTotal: order.total,
    recipientName: order.customerName,
    recipientEmail: order.customerEmail,
    senderEmail: googleMailAccount?.email,
    sentByUserId: authorization.principal.user.id,
    sentByName: authorization.principal.user.name,
    sentByEmail: authorization.principal.user.email,
  };

  if (!order.customerEmail) {
    await logEmailRecord({
      ...emailRecordBase,
      status: "error",
      errorMessage: "Add an email address to this customer before sending the order.",
    });

    return createEmailOrderState(false, "Add an email address to this customer before sending the order.");
  }

  if (!googleMailAccount) {
    await logEmailRecord({
      ...emailRecordBase,
      status: "error",
      errorMessage: "Connect Gmail before emailing orders.",
    });

    return createEmailOrderState(false, "Connect Gmail before emailing orders.", true);
  }

  let bodyText: string | undefined;
  let subject: string | undefined;

  try {
    const documentData = await getOrderDocumentData(workspaceId, order.id);

    if (!documentData) {
      return createEmailOrderState(false, "Order could not be found.");
    }

    const fallback = {
      html: [
        `<p>Hi ${escapeHtml(order.customerName?.trim() || "there")},</p>`,
        `<p>Your ${escapeHtml(orderTitle.toLowerCase())} <strong>${escapeHtml(order.orderNumber)}</strong> from ${escapeHtml(workspace.name)} is attached as a PDF.</p>`,
        `<p><span style="color:#18181b;font-size:22px"><strong>${documentData.total}</strong></span><br><span style="color:#52525b">Order total</span></p>`,
        `<p><strong>Order date:</strong> ${format(order.orderDate, "MMM d, yyyy")}</p>`,
        "<p>Please review the attached document at your convenience. If you have any questions, reply to this email and we will be happy to help.</p>",
        `<p>Thank you,<br><strong>${escapeHtml(workspace.name)}</strong></p>`,
      ].join(""),
      subject: `${orderTitle} ${order.orderNumber} from ${workspace.name}`,
      text: [
        `Hi ${order.customerName?.trim() || "there"},`,
        "",
        `Your ${orderTitle.toLowerCase()} ${order.orderNumber} from ${workspace.name} is attached as a PDF.`,
        `Order total: ${documentData.total}`,
        `Order date: ${format(order.orderDate, "MMM d, yyyy")}`,
        "",
        "Please review the attached document at your convenience.",
        "",
        "Thank you.",
        workspace.name,
      ].join("\n"),
    };
    const submittedEmailContent = getSubmittedEmailContent(formData, fallback);
    const pdfBuffer = await renderOrderPdfBuffer(documentData);
    const refreshToken = decryptGoogleToken(googleMailAccount.refreshTokenCipher);
    const accessToken = await refreshGoogleAccessToken(refreshToken);
    bodyText = submittedEmailContent.text;
    subject = submittedEmailContent.subject;

    await sendGmailMessage(accessToken, {
      attachments: [
        {
          content: pdfBuffer,
          contentType: "application/pdf",
          filename: sanitizeOrderPdfFilename(order.orderNumber),
        },
      ],
      from: googleMailAccount.email,
      html: submittedEmailContent.html,
      subject: submittedEmailContent.subject,
      text: submittedEmailContent.text,
      to: order.customerEmail,
    });

    await logEmailRecord({
      ...emailRecordBase,
      bodyText,
      senderEmail: googleMailAccount.email,
      subject,
      status: "success",
    });
    await recordAuthorizationAuditEvent({
      workspaceId,
      actorUserId: authorization.principal.user.id,
      membershipId: authorization.membership.id,
      action: "order.send",
      targetType: "Order",
      targetId: order.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Order email could not be sent. Please try again.";
    const reconnectRequired = message === GMAIL_REFRESH_ERROR_MESSAGE;
    const responseMessage = reconnectRequired
      ? `${message} Please reconnect to continue.`
      : "Order email could not be sent. Please try again.";
    console.error("Order email failed.", error);

    if (reconnectRequired) {
      await prisma.googleMailAccount.deleteMany({
        where: {
          workspaceId,
        },
      });
    }

    await logEmailRecord({
      ...emailRecordBase,
      bodyText,
      senderEmail: googleMailAccount.email,
      subject,
      status: "error",
      errorMessage: message,
    });

    return createEmailOrderState(false, responseMessage, reconnectRequired);
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/email-history");

  return createEmailOrderState(true, `Order sent to ${order.customerEmail}.`);
}
