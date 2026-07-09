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

import {
  getCalculatedRefundAmount,
  getCalculatedRefundStatus,
  getReturnRefundDocumentData,
  parseReturnDisposition,
  parseReturnRefundStatus,
  type ReturnRefundFormValues,
  sanitizeReturnReceiptFilename,
} from "./_lib/return-data";
import { renderReturnReceiptPdfBuffer } from "./_lib/return-pdf";

export type SaveReturnRefundResult =
  | {
      id: string;
      success: true;
    }
  | {
      message: string;
      success: false;
    };

type EmailReturnReceiptState = {
  message: string;
  reconnectRequired?: boolean;
  submittedAt?: number;
  success: boolean;
};

const emailReturnReceiptSchema = z.object({
  orderId: z.string().trim().min(1, "Order is required."),
});
const REFUND_EXPLANATION_MAX_LENGTH = 80;

function createEmailReturnReceiptState(
  success: boolean,
  message: string,
  reconnectRequired = false,
): EmailReturnReceiptState {
  return {
    message,
    reconnectRequired,
    submittedAt: Date.now(),
    success,
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

function parseDate(value: string) {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function optionalString(value: string) {
  const text = value.trim();

  return text || null;
}

function getLineRefund(quantity: number, unitPrice: number) {
  return new Prisma.Decimal((quantity * unitPrice).toFixed(2));
}

function getValidationError(input: ReturnRefundFormValues) {
  if (!input.returnDate) return "Return date is required.";
  if (!input.items.some((item) => item.returnQuantity > 0)) return "Choose at least one item to resolve.";

  const invalidItem = input.items.find(
    (item) =>
      item.returnQuantity < 0 || item.returnQuantity > item.orderedQuantity || !Number.isFinite(item.returnQuantity),
  );

  if (invalidItem) return `${invalidItem.product} has an invalid return quantity.`;
  if (input.refundStatus === "Other" && (!Number.isFinite(input.refundAmount) || input.refundAmount < 0)) {
    return "Enter a custom refund amount.";
  }
  if (input.refundExplanation.length > REFUND_EXPLANATION_MAX_LENGTH) {
    return `Refund explanation must be ${REFUND_EXPLANATION_MAX_LENGTH} characters or less.`;
  }

  return null;
}

export async function saveReturnRefundAction(
  orderId: string,
  input: ReturnRefundFormValues,
): Promise<SaveReturnRefundResult> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      message: "You must be signed in to save a return.",
      success: false,
    };
  }

  const validationError = getValidationError(input);

  if (validationError) {
    return {
      message: validationError,
      success: false,
    };
  }

  try {
    const savedReturn = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          ownerId: currentUser.id,
        },
        include: {
          items: true,
          returns: {
            include: {
              items: true,
            },
            take: 1,
          },
        },
      });

      if (!order) {
        throw new Error("Order could not be found.");
      }

      const orderItemsById = new Map(order.items.map((item) => [item.id, item]));
      const existingReturn = order.returns[0];
      const existingItemsByOrderItemId = new Map(existingReturn?.items.map((item) => [item.orderItemId, item]) ?? []);
      const normalizedItems = input.items.map((item) => {
        const orderItem = orderItemsById.get(item.orderItemId);
        const returnQuantity = orderItem ? Math.max(0, Math.min(item.returnQuantity, orderItem.quantity)) : 0;

        return {
          ...item,
          orderedQuantity: orderItem?.quantity ?? item.orderedQuantity,
          returnQuantity,
          taxable: orderItem?.taxable ?? item.taxable,
          taxRate: Number(orderItem?.taxRate ?? item.taxRate ?? 0),
          unitPrice: Number(orderItem?.unitPrice ?? item.unitPrice),
        };
      });
      const refundCalculationValues: ReturnRefundFormValues = {
        ...input,
        items: normalizedItems,
        originalDiscountAmount: Number(order.discountAmount),
        originalSubtotal: Number(order.subtotal),
        originalTaxAmount: Number(order.taxAmount),
        originalTotal: Number(order.total),
      };
      const requestedRefundStatus = parseReturnRefundStatus(input.refundStatus);
      const refundStatus =
        requestedRefundStatus === "No Refund" || requestedRefundStatus === "Other"
          ? requestedRefundStatus
          : getCalculatedRefundStatus(refundCalculationValues);
      const refundAmount =
        refundStatus === "No Refund"
          ? 0
          : refundStatus === "Other"
            ? input.refundAmount
            : getCalculatedRefundAmount(refundCalculationValues);
      const refundExplanation =
        refundStatus === "No Refund" || refundStatus === "Other"
          ? optionalString(input.refundExplanation.slice(0, REFUND_EXPLANATION_MAX_LENGTH))
          : null;
      const returnDate = parseDate(input.returnDate);
      const returnRecord = existingReturn
        ? await tx.orderReturn.update({
            where: {
              id: existingReturn.id,
            },
            data: {
              customerNote: optionalString(input.customerNote),
              internalNotes: optionalString(input.internalNotes),
              reason: optionalString(input.reason),
              refundAmount: new Prisma.Decimal(refundAmount.toFixed(2)),
              refundExplanation,
              refundMethod: optionalString(input.refundMethod),
              refundReference: optionalString(input.refundReference),
              refundStatus,
              restockItems: input.restockItems,
              returnDate,
              returnStatus: "Returned",
              savedAt: existingReturn.savedAt ?? new Date(),
            },
          })
        : await tx.orderReturn.create({
            data: {
              customerNote: optionalString(input.customerNote),
              internalNotes: optionalString(input.internalNotes),
              orderId: order.id,
              ownerId: currentUser.id,
              reason: optionalString(input.reason),
              refundAmount: new Prisma.Decimal(refundAmount.toFixed(2)),
              refundExplanation,
              refundMethod: optionalString(input.refundMethod),
              refundReference: optionalString(input.refundReference),
              refundStatus,
              restockItems: input.restockItems,
              returnDate,
              returnNumber: input.returnNumber,
              returnStatus: "Returned",
              savedAt: new Date(),
            },
          });

      const touchedInventoryIds = new Set<string>();

      for (const item of input.items) {
        const orderItem = orderItemsById.get(item.orderItemId);

        if (!orderItem) continue;

        const returnQuantity = Math.max(0, Math.min(item.returnQuantity, orderItem.quantity));
        const existingItem = existingItemsByOrderItemId.get(orderItem.id);
        const disposition = parseReturnDisposition(item.disposition);
        const shouldRestock =
          disposition === "Returned" && input.restockItems && item.restock && Boolean(orderItem.inventoryItemId);
        const previousRestockedQuantity =
          existingItem?.inventoryItemId && existingItem.restock ? existingItem.returnQuantity : 0;
        const nextRestockedQuantity = shouldRestock ? returnQuantity : 0;
        const restockDelta = nextRestockedQuantity - previousRestockedQuantity;

        if (existingItem) {
          await tx.orderReturnItem.update({
            where: {
              id: existingItem.id,
            },
            data: {
              category: orderItem.category,
              disposition,
              inventoryItemId: orderItem.inventoryItemId,
              orderedQuantity: orderItem.quantity,
              product: orderItem.product,
              restock: shouldRestock,
              returnQuantity,
              sku: orderItem.sku,
              unitPrice: orderItem.unitPrice,
              lineRefund: getLineRefund(returnQuantity, Number(orderItem.unitPrice)),
            },
          });
        } else {
          await tx.orderReturnItem.create({
            data: {
              category: orderItem.category,
              disposition,
              inventoryItemId: orderItem.inventoryItemId,
              lineRefund: getLineRefund(returnQuantity, Number(orderItem.unitPrice)),
              orderItemId: orderItem.id,
              orderReturnId: returnRecord.id,
              orderedQuantity: orderItem.quantity,
              ownerId: currentUser.id,
              product: orderItem.product,
              restock: shouldRestock,
              returnQuantity,
              sku: orderItem.sku,
              unitPrice: orderItem.unitPrice,
            },
          });
        }

        if (orderItem.inventoryItemId && restockDelta !== 0) {
          touchedInventoryIds.add(orderItem.inventoryItemId);
          await tx.inventoryItem.update({
            where: {
              id: orderItem.inventoryItemId,
            },
            data: {
              stock: {
                increment: restockDelta,
              },
            },
          });
          await tx.inventoryStockMovement.create({
            data: {
              inventoryItemId: orderItem.inventoryItemId,
              notes: `${returnRecord.returnNumber} for ${order.orderNumber}`,
              orderId: order.id,
              orderItemId: orderItem.id,
              ownerId: currentUser.id,
              quantityChange: restockDelta,
              reason: "Return",
            },
          });
        }
      }

      return returnRecord;
    });

    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/inventory");
    revalidatePath(`/dashboard/orders/${orderId}/edit`);
    revalidatePath(`/dashboard/orders/${orderId}/return`);

    return {
      id: savedReturn.id,
      success: true,
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Return could not be saved.",
      success: false,
    };
  }
}

export async function emailReturnReceiptAction(
  _previousState: EmailReturnReceiptState,
  formData: FormData,
): Promise<EmailReturnReceiptState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return createEmailReturnReceiptState(false, "You must be signed in to email a return receipt.");
  }

  const parsed = emailReturnReceiptSchema.safeParse({
    orderId: formData.get("orderId"),
  });

  if (!parsed.success) {
    return createEmailReturnReceiptState(
      false,
      parsed.error.issues[0]?.message ?? "Select a return receipt and try again.",
    );
  }

  const [orderReturn, googleMailAccount] = await Promise.all([
    prisma.orderReturn.findFirst({
      where: {
        orderId: parsed.data.orderId,
        ownerId: currentUser.id,
      },
      include: {
        order: true,
      },
    }),
    prisma.googleMailAccount.findUnique({
      where: {
        userId: currentUser.id,
      },
    }),
  ]);

  if (!orderReturn) {
    return createEmailReturnReceiptState(false, "Return receipt could not be found.");
  }

  const emailRecordBase = {
    documentId: orderReturn.orderId,
    documentNumber: orderReturn.returnNumber,
    documentTotal: orderReturn.refundAmount,
    documentType: "return-receipt" as const,
    ownerId: currentUser.id,
    recipientEmail: orderReturn.order.customerEmail,
    recipientName: orderReturn.order.customerName,
    senderEmail: googleMailAccount?.email,
  };

  if (!orderReturn.order.customerEmail) {
    await logEmailRecord({
      ...emailRecordBase,
      errorMessage: "Add an email address to this customer before sending the return receipt.",
      status: "error",
    });

    return createEmailReturnReceiptState(
      false,
      "Add an email address to this customer before sending the return receipt.",
    );
  }

  if (!googleMailAccount) {
    await logEmailRecord({
      ...emailRecordBase,
      errorMessage: "Connect Gmail before emailing return receipts.",
      status: "error",
    });

    return createEmailReturnReceiptState(false, "Connect Gmail before emailing return receipts.", true);
  }

  let subject: string | undefined;

  try {
    const documentData = await getReturnRefundDocumentData(currentUser.id, parsed.data.orderId);

    if (!documentData) {
      return createEmailReturnReceiptState(false, "Return receipt could not be found.");
    }

    const fallback = {
      html: [
        `<p>Hi ${escapeHtml(orderReturn.order.customerName?.trim() || "there")},</p>`,
        `<p>Your return receipt <strong>${escapeHtml(orderReturn.returnNumber)}</strong> from ${escapeHtml(currentUser.companyName)} is attached as a PDF.</p>`,
        `<p><span style="color:#18181b;font-size:22px"><strong>${documentData.refundAmount}</strong></span><br><span style="color:#52525b">Refund amount</span></p>`,
        `<p><strong>Return date:</strong> ${escapeHtml(format(orderReturn.returnDate, "MMM d, yyyy"))}</p>`,
        "<p>Please keep this for your records. If you have any questions, reply to this email and we will be happy to help.</p>",
        `<p>Thank you,<br><strong>${escapeHtml(currentUser.companyName)}</strong></p>`,
      ].join(""),
      subject: `Return Receipt ${orderReturn.returnNumber} from ${currentUser.companyName}`,
      text: [
        `Hi ${orderReturn.order.customerName?.trim() || "there"},`,
        "",
        `Your return receipt ${orderReturn.returnNumber} from ${currentUser.companyName} is attached as a PDF.`,
        `Refund amount: ${documentData.refundAmount}`,
        `Return date: ${format(orderReturn.returnDate, "MMM d, yyyy")}`,
        "",
        "Please keep this for your records.",
        "",
        "Thank you.",
        currentUser.companyName,
      ].join("\n"),
    };
    const submittedEmailContent = getSubmittedEmailContent(formData, fallback);
    const pdfBuffer = await renderReturnReceiptPdfBuffer(documentData);
    const refreshToken = decryptGoogleToken(googleMailAccount.refreshTokenCipher);
    const accessToken = await refreshGoogleAccessToken(refreshToken);
    subject = submittedEmailContent.subject;

    await sendGmailMessage(accessToken, {
      attachments: [
        {
          content: pdfBuffer,
          contentType: "application/pdf",
          filename: sanitizeReturnReceiptFilename(orderReturn.returnNumber),
        },
      ],
      from: googleMailAccount.email,
      html: submittedEmailContent.html,
      subject: submittedEmailContent.subject,
      text: submittedEmailContent.text,
      to: orderReturn.order.customerEmail,
    });

    await logEmailRecord({
      ...emailRecordBase,
      senderEmail: googleMailAccount.email,
      status: "success",
      subject,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Return receipt email could not be sent. Please try again.";
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
      errorMessage: message,
      senderEmail: googleMailAccount.email,
      status: "error",
      subject,
    });

    return createEmailReturnReceiptState(false, responseMessage, reconnectRequired);
  }

  revalidatePath("/dashboard/email-history");

  return createEmailReturnReceiptState(true, `Return receipt sent to ${orderReturn.order.customerEmail}.`);
}
