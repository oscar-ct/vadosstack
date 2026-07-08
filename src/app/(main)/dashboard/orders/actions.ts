"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { escapeHtml, plainTextToEmailHtml, sanitizeEmailHtml } from "@/lib/email-content";
import { logEmailRecord } from "@/lib/email-records";
import {
  decryptGoogleToken,
  GMAIL_REFRESH_ERROR_MESSAGE,
  refreshGoogleAccessToken,
  sendGmailMessage,
} from "@/lib/google-mail";
import { prisma } from "@/lib/prisma";

import { getOrderDocumentData, sanitizeOrderPdfFilename } from "./_lib/order-document";
import { renderOrderPdfBuffer } from "./_lib/order-pdf";

type CreateOrderLineItemInput = {
  category?: string | null;
  inventoryItemId?: string | null;
  product: string;
  quantity: number;
  sku?: string | null;
  taxRate?: number;
  taxable?: boolean;
  unitPrice: number;
};

type CreateOrderInput = {
  customerEmail?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerNotes?: string | null;
  customerPhone?: string | null;
  discountAmount?: number;
  estimatedDelivery?: Date | null;
  footerMessage?: string | null;
  fulfillmentStatus: "Fulfilled" | "Returned" | "Unfulfilled";
  items: CreateOrderLineItemInput[];
  orderDate: Date;
  orderNumber: string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  paymentStatus: "Paid" | "Pending";
  shippingAmount?: number;
  shippingCity?: string | null;
  shippingLine1?: string | null;
  shippingLine2?: string | null;
  shippingPostalCode?: string | null;
  shippingService?: string | null;
  shippingState?: string | null;
  taxRate?: number;
  trackingNumber?: string | null;
};

type EmailOrderState = {
  success: boolean;
  message: string;
  reconnectRequired?: boolean;
  submittedAt?: number;
};

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

async function resolveCustomerId(ownerId: string, input: CreateOrderInput) {
  if (input.customerId) {
    const customer = await prisma.customer.findFirst({
      where: {
        id: input.customerId,
        ownerId,
      },
      select: {
        id: true,
      },
    });

    return customer?.id ?? null;
  }

  const email = optionalString(input.customerEmail);
  if (!email) return null;

  const customer = await prisma.customer.findFirst({
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

function normalizeOrderItems(items: CreateOrderLineItemInput[]) {
  return items
    .map((item) => ({
      ...item,
      product: optionalString(item.product) ?? "",
      quantity: Math.max(Math.trunc(Number(item.quantity) || 0), 0),
      unitPrice: Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : 0,
    }))
    .filter((item) => item.product && item.quantity > 0);
}

async function prepareOrderItems(
  tx: Prisma.TransactionClient,
  ownerId: string,
  input: CreateOrderInput,
  existingInventoryQuantityById = new Map<string, number>(),
) {
  const normalizedItems = normalizeOrderItems(input.items);

  if (normalizedItems.length === 0) {
    throw new Error("Add at least one valid order item.");
  }

  const preparedItems = await Promise.all(
    normalizedItems.map(async (item) => {
      const inventoryItem = item.inventoryItemId
        ? await tx.inventoryItem.findFirst({
            where: {
              id: item.inventoryItemId,
              ownerId,
            },
            include: {
              category: true,
            },
          })
        : null;

      if (item.inventoryItemId && !inventoryItem) {
        throw new Error(`${item.product || "Inventory item"} was not found.`);
      }

      const unitPrice = inventoryItem ? Number(inventoryItem.unitPrice) : item.unitPrice;
      const lineTotal = item.quantity * unitPrice;
      const taxable = inventoryItem?.taxable ?? item.taxable ?? true;
      const taxRate = Number(inventoryItem?.taxRate ?? item.taxRate ?? input.taxRate ?? 0);
      const previousQuantity = inventoryItem ? (existingInventoryQuantityById.get(inventoryItem.id) ?? 0) : 0;
      const stockDecrease = item.quantity - previousQuantity;

      if (inventoryItem && stockDecrease > inventoryItem.stock) {
        throw new Error(`${inventoryItem.product} only has ${inventoryItem.stock} available.`);
      }

      return {
        inventoryItem,
        category: inventoryItem?.category?.name ?? item.category ?? null,
        lineTotal,
        product: inventoryItem?.product ?? item.product,
        quantity: item.quantity,
        sku: inventoryItem?.sku ?? item.sku ?? null,
        stockDecrease,
        taxable,
        taxRate,
        unitPrice,
      };
    }),
  );

  return preparedItems;
}

function getOrderTotals(items: Awaited<ReturnType<typeof prepareOrderItems>>, input: CreateOrderInput) {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const taxAmount = items.reduce((sum, item) => sum + (item.taxable ? item.lineTotal * (item.taxRate / 100) : 0), 0);
  const shippingAmount = input.shippingAmount ?? 0;
  const discountAmount = input.discountAmount ?? 0;
  const total = Math.max(subtotal + shippingAmount + taxAmount - discountAmount, 0);

  return {
    discountAmount,
    shippingAmount,
    subtotal,
    taxAmount,
    total,
  };
}

function orderData(
  ownerId: string,
  customerId: string | null,
  input: CreateOrderInput,
  totals: ReturnType<typeof getOrderTotals>,
) {
  return {
    ownerId,
    customerId,
    orderNumber: input.orderNumber,
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

export async function createOrderWithInventoryAdjustments(input: CreateOrderInput) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("You must be signed in to create orders.");
  }

  return prisma.$transaction(async (tx) => {
    const customerId = await resolveCustomerId(currentUser.id, input);
    const preparedItems = await prepareOrderItems(tx, currentUser.id, input);
    const totals = getOrderTotals(preparedItems, input);

    const order = await tx.order.create({
      data: {
        ...orderData(currentUser.id, customerId, input, totals),
        footerMessage: input.footerMessage ?? currentUser.orderMessageText,
      },
    });

    for (const item of preparedItems) {
      const orderItem = await tx.orderItem.create({
        data: {
          ownerId: currentUser.id,
          orderId: order.id,
          inventoryItemId: item.inventoryItem?.id ?? null,
          sku: item.sku,
          product: item.product,
          category: item.category,
          quantity: item.quantity,
          unitPrice: toDecimal(item.unitPrice),
          lineTotal: toDecimal(item.lineTotal),
          taxable: item.taxable,
          taxRate: toDecimal(item.taxRate),
        },
      });

      if (item.inventoryItem) {
        await tx.inventoryItem.update({
          where: {
            id: item.inventoryItem.id,
          },
          data: {
            stock: {
              decrement: item.stockDecrease,
            },
          },
        });
        await tx.inventoryStockMovement.create({
          data: {
            ownerId: currentUser.id,
            inventoryItemId: item.inventoryItem.id,
            orderId: order.id,
            orderItemId: orderItem.id,
            quantityChange: -item.stockDecrease,
            reason: "Order created",
            notes: order.orderNumber,
          },
        });
      }
    }

    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/inventory");

    return {
      id: order.id,
      orderNumber: order.orderNumber,
    };
  });
}

export async function updateOrderWithInventoryAdjustments(orderId: string, input: CreateOrderInput) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("You must be signed in to update orders.");
  }

  return prisma.$transaction(async (tx) => {
    const existingOrder = await tx.order.findFirst({
      where: {
        id: orderId,
        ownerId: currentUser.id,
      },
      include: {
        items: true,
      },
    });

    if (!existingOrder) {
      throw new Error("Order was not found.");
    }

    const existingInventoryQuantityById = new Map<string, number>();
    for (const item of existingOrder.items) {
      if (!item.inventoryItemId) continue;
      existingInventoryQuantityById.set(
        item.inventoryItemId,
        (existingInventoryQuantityById.get(item.inventoryItemId) ?? 0) + item.quantity,
      );
    }

    const customerId = await resolveCustomerId(currentUser.id, input);
    const preparedItems = await prepareOrderItems(tx, currentUser.id, input, existingInventoryQuantityById);
    const totals = getOrderTotals(preparedItems, input);

    await tx.orderItem.deleteMany({
      where: {
        orderId: existingOrder.id,
        ownerId: currentUser.id,
      },
    });

    const newInventoryQuantityById = new Map<string, number>();

    for (const item of preparedItems) {
      await tx.orderItem.create({
        data: {
          ownerId: currentUser.id,
          orderId: existingOrder.id,
          inventoryItemId: item.inventoryItem?.id ?? null,
          sku: item.sku,
          product: item.product,
          category: item.category,
          quantity: item.quantity,
          unitPrice: toDecimal(item.unitPrice),
          lineTotal: toDecimal(item.lineTotal),
          taxable: item.taxable,
          taxRate: toDecimal(item.taxRate),
        },
      });

      if (item.inventoryItem) {
        newInventoryQuantityById.set(
          item.inventoryItem.id,
          (newInventoryQuantityById.get(item.inventoryItem.id) ?? 0) + item.quantity,
        );
      }
    }

    const touchedInventoryIds = new Set([...existingInventoryQuantityById.keys(), ...newInventoryQuantityById.keys()]);
    for (const inventoryItemId of touchedInventoryIds) {
      const oldQuantity = existingInventoryQuantityById.get(inventoryItemId) ?? 0;
      const newQuantity = newInventoryQuantityById.get(inventoryItemId) ?? 0;
      const quantityChange = oldQuantity - newQuantity;

      if (quantityChange === 0) continue;

      await tx.inventoryItem.update({
        where: {
          id: inventoryItemId,
        },
        data: {
          stock: {
            increment: quantityChange,
          },
        },
      });
      await tx.inventoryStockMovement.create({
        data: {
          ownerId: currentUser.id,
          inventoryItemId,
          orderId: existingOrder.id,
          quantityChange,
          reason: "Order updated",
          notes: existingOrder.orderNumber,
        },
      });
    }

    const order = await tx.order.update({
      where: {
        id: existingOrder.id,
      },
      data: orderData(currentUser.id, customerId, input, totals),
    });

    revalidatePath("/dashboard/orders");
    revalidatePath(`/dashboard/orders/${order.id}/edit`);
    revalidatePath("/dashboard/inventory");

    return {
      id: order.id,
      orderNumber: order.orderNumber,
    };
  });
}

export async function updateOrderStatusesAction(
  orderId: string,
  statuses: Partial<{
    fulfillmentStatus: "Fulfilled" | "Returned" | "Unfulfilled";
    paymentStatus: "Paid" | "Pending";
  }>,
) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("You must be signed in to update orders.");
  }

  const order = await prisma.order.updateMany({
    where: {
      id: orderId,
      ownerId: currentUser.id,
    },
    data: statuses,
  });

  if (order.count === 0) {
    throw new Error("Order was not found.");
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}/edit`);

  return {
    success: true,
    message: "Order updated.",
  };
}

export async function emailOrderAction(_previousState: EmailOrderState, formData: FormData): Promise<EmailOrderState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return createEmailOrderState(false, "You must be signed in to email an order.");
  }

  const parsed = emailOrderSchema.safeParse({
    orderId: formData.get("orderId"),
  });

  if (!parsed.success) {
    return createEmailOrderState(false, parsed.error.issues[0]?.message ?? "Select an order and try again.");
  }

  const [order, googleMailAccount] = await Promise.all([
    prisma.order.findFirst({
      where: {
        id: parsed.data.orderId,
        ownerId: currentUser.id,
      },
    }),
    prisma.googleMailAccount.findUnique({
      where: {
        userId: currentUser.id,
      },
    }),
  ]);

  if (!order) {
    return createEmailOrderState(false, "Order could not be found.");
  }

  const orderTitle = order.paymentStatus === "Paid" ? "Order Receipt" : "Order Confirmation";
  const emailRecordBase = {
    ownerId: currentUser.id,
    documentType: "order" as const,
    documentId: order.id,
    documentNumber: order.orderNumber,
    documentTotal: order.total,
    recipientName: order.customerName,
    recipientEmail: order.customerEmail,
    senderEmail: googleMailAccount?.email,
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

  let subject: string | undefined;

  try {
    const documentData = await getOrderDocumentData(currentUser.id, order.id);

    if (!documentData) {
      return createEmailOrderState(false, "Order could not be found.");
    }

    const fallback = {
      html: [
        `<p>Hi ${escapeHtml(order.customerName?.trim() || "there")},</p>`,
        `<p>Your ${escapeHtml(orderTitle.toLowerCase())} <strong>${escapeHtml(order.orderNumber)}</strong> from ${escapeHtml(currentUser.companyName)} is attached as a PDF.</p>`,
        `<p><span style="color:#18181b;font-size:22px"><strong>${documentData.total}</strong></span><br><span style="color:#52525b">Order total</span></p>`,
        `<p><strong>Order date:</strong> ${format(order.orderDate, "MMM d, yyyy")}</p>`,
        "<p>Please review the attached document at your convenience. If you have any questions, reply to this email and we will be happy to help.</p>",
        `<p>Thank you,<br><strong>${escapeHtml(currentUser.companyName)}</strong></p>`,
      ].join(""),
      subject: `${orderTitle} ${order.orderNumber} from ${currentUser.companyName}`,
      text: [
        `Hi ${order.customerName?.trim() || "there"},`,
        "",
        `Your ${orderTitle.toLowerCase()} ${order.orderNumber} from ${currentUser.companyName} is attached as a PDF.`,
        `Order total: ${documentData.total}`,
        `Order date: ${format(order.orderDate, "MMM d, yyyy")}`,
        "",
        "Please review the attached document at your convenience.",
        "",
        "Thank you.",
        currentUser.companyName,
      ].join("\n"),
    };
    const submittedEmailContent = getSubmittedEmailContent(formData, fallback);
    const pdfBuffer = await renderOrderPdfBuffer(documentData);
    const refreshToken = decryptGoogleToken(googleMailAccount.refreshTokenCipher);
    const accessToken = await refreshGoogleAccessToken(refreshToken);
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
      senderEmail: googleMailAccount.email,
      subject,
      status: "success",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Order email could not be sent. Please try again.";
    const reconnectRequired = message === GMAIL_REFRESH_ERROR_MESSAGE;
    const responseMessage = reconnectRequired ? `${message} Please reconnect to continue.` : message;

    if (reconnectRequired) {
      await prisma.googleMailAccount.deleteMany({
        where: {
          userId: currentUser.id,
        },
      });
    }

    await logEmailRecord({
      ...emailRecordBase,
      senderEmail: googleMailAccount.email,
      subject,
      status: "error",
      errorMessage: message,
    });

    return createEmailOrderState(false, responseMessage, reconnectRequired);
  }

  revalidatePath("/dashboard/email-history");

  return createEmailOrderState(true, `Order sent to ${order.customerEmail}.`);
}
