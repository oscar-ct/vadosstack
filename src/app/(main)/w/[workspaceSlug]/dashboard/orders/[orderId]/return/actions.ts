"use server";

import { format } from "date-fns";
import { z } from "zod";

import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { checkComponents, splitAmount } from "@/lib/commerce/allocations";
import { getOrderBalance, refreshOrderPaymentStatus, requireVersion } from "@/lib/commerce/ledger";
import { allocateCents, cents, money, prorate } from "@/lib/commerce/money";
import { createCancellationAdjustment } from "@/lib/commerce/order-adjustments";
import { adjustmentCreditCents, cancellableQuantity } from "@/lib/commerce/order-cancellation";
import { allocateRefundPayments, refundablePaymentComponents } from "@/lib/commerce/refund-allocation";
import { adjustStock, CommerceError, commerceTransaction, lockOrder } from "@/lib/commerce/transaction";
import {
  amountSchema,
  CommerceInputError,
  parseCommerceInput,
  submissionKeySchema,
  taxRateSchema,
} from "@/lib/commerce/validation";
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

import {
  getReturnRefundDocumentData,
  type ReturnRefundFormValues,
  sanitizeReturnReceiptFilename,
} from "./_lib/return-data";
import { renderReturnReceiptPdfBuffer } from "./_lib/return-pdf";
import { createHash } from "node:crypto";

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

class ReturnActionError extends CommerceError {}

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

function optionalString(value: string) {
  const text = value.trim();

  return text || null;
}

const returnInputSchema = z
  .object({
    returnId: z.string().optional(),
    submissionKey: submissionKeySchema,
    orderVersion: z.number().int().positive(),
    customerEmail: z.string().max(500),
    customerName: z.string().max(500),
    customerPhone: z.string().max(100),
    customerNote: z.string().max(5000),
    internalNotes: z.string().max(5000),
    reason: z.string().max(5000),
    orderDate: z.string(),
    orderNumber: z.string(),
    originalDiscountAmount: amountSchema,
    originalSubtotal: amountSchema,
    originalTaxAmount: amountSchema,
    originalTotal: amountSchema,
    paymentId: z.string().max(200),
    refundMerchandiseAmount: amountSchema.optional(),
    refundTaxAmount: amountSchema.optional(),
    refundShippingAmount: amountSchema.optional(),
    refundAmount: amountSchema,
    refundExplanation: z.string().max(80),
    refundMethod: z.string().max(100),
    refundReference: z.string().max(200),
    refundStatus: z.enum(["Full Refund", "Partial Refund", "No Refund", "Other"]),
    refundState: z.string().optional(),
    restockItems: z.boolean(),
    returnDate: z.iso.date(),
    returnNumber: z.string().max(100),
    returnStatus: z.enum(["Draft", "Returned"]),
    shippingAddressLines: z.array(z.string()),
    items: z
      .array(
        z
          .object({
            id: z.string(),
            orderItemId: z.string().min(1),
            inventoryItemId: z.string().optional(),
            category: z.string(),
            product: z.string(),
            description: z.string().max(5000).nullish(),
            unit: z.string().max(40).nullish(),
            sku: z.string(),
            physicallyReceived: z.boolean().optional(),
            disposition: z.enum(["Returned", "Damaged", "Lost", "No physical return"]),
            cancelQuantity: z.number().int().min(0).max(1000000),
            cancellableQuantity: z.number().int().min(0).max(1000000),
            orderedQuantity: z.number().int().min(0),
            returnQuantity: z.number().int().min(0).max(1000000),
            returnableQuantity: z.number().int().min(0).max(1000000),
            restock: z.boolean(),
            unitPrice: amountSchema,
            taxable: z.boolean(),
            taxRate: taxRateSchema,
            originalDiscountAmount: amountSchema.optional(),
            originalTaxAmount: amountSchema.optional(),
            originalQuantity: z.number().int().positive().optional(),
            previouslyCancelledQuantity: z.number().int().min(0).optional(),
            previouslyReturnedQuantity: z.number().int().min(0).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(250),
  })
  .strict();

export async function saveReturnRefundAction(
  orderId: string,
  rawInput: ReturnRefundFormValues,
): Promise<SaveReturnRefundResult> {
  const authorization = await getPermittedDashboardAuthorization("orders.view");
  if (!authorization) return { message: "You do not have permission to view orders.", success: false };
  const workspaceId = authorization.workspaceId;
  try {
    const input = parseCommerceInput(returnInputSchema, rawInput);
    const submissionHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const savedReturn = await commerceTransaction(async (tx) => {
      await lockOrder(tx, workspaceId, orderId);
      const previous = await tx.orderReturn.findUnique({
        where: { ownerId_submissionKey: { ownerId: workspaceId, submissionKey: input.submissionKey } },
      });
      if (previous) {
        if (previous.orderId !== orderId || previous.submissionHash !== submissionHash)
          throw new ReturnActionError("Submission key already used for a different return.");
        return previous;
      }
      if (input.returnId)
        throw new ReturnActionError("Saved returns are final. Start another return for additional items.");
      const order = await tx.order.findFirstOrThrow({
        where: { id: orderId, ownerId: workspaceId },
        include: {
          items: {
            include: {
              adjustmentItems: { include: { adjustment: { select: { kind: true } } } },
            },
          },
          payments: { include: { refunds: { where: { status: "succeeded" } } } },
          returns: { include: { items: true } },
          physicalReturns: { include: { items: true } },
        },
      });
      requireVersion(order.version, input.orderVersion);
      if (order.orderStatus !== "Active") throw new ReturnActionError("Cancelled orders cannot be returned.");
      if (new Set(input.items.map((item) => item.orderItemId)).size !== input.items.length)
        throw new ReturnActionError("Each return line must be unique.");
      const cancellationLines = input.items
        .filter((item) => item.cancelQuantity > 0)
        .map((item) => {
          const original = order.items.find((entry) => entry.id === item.orderItemId);
          if (!original) throw new ReturnActionError("Resolution item does not belong to this order.");
          const alreadyCancelled = original.adjustmentItems.reduce(
            (sum, entry) => sum + (entry.adjustment.kind === "Cancellation" ? entry.quantity : 0),
            0,
          );
          const alreadyReturned = order.returns
            .flatMap((receipt) => receipt.items)
            .filter((entry) => entry.orderItemId === original.id)
            .reduce((sum, entry) => sum + entry.returnQuantity, 0);
          const available = cancellableQuantity({
            quantity: original.quantity,
            shippedQuantity: original.shippedQuantity,
            cancelledQuantity: alreadyCancelled,
            returnedQuantity: alreadyReturned,
          });
          if (item.cancelQuantity > available)
            throw new ReturnActionError(`${original.product} only has ${available} unfulfilled units to cancel.`);
          return { orderItemId: original.id, quantity: item.cancelQuantity };
        });
      if (cancellationLines.length && !can(authorization.membership, "orders.update"))
        throw new ReturnActionError("You do not have permission to cancel order items.");
      const lines = input.items
        .map((item) => {
          const original = order.items.find((entry) => entry.id === item.orderItemId);
          if (!original) throw new ReturnActionError("Return item does not belong to this order.");
          const alreadyReturned = order.returns
            .flatMap((receipt) => receipt.items)
            .filter((entry) => entry.orderItemId === original.id)
            .reduce((sum, entry) => sum + entry.returnQuantity, 0);
          const alreadyCancelled = original.adjustmentItems.reduce(
            (sum, entry) => sum + (entry.adjustment.kind === "Cancellation" ? entry.quantity : 0),
            0,
          );
          const resolvedBeforeReturn = alreadyReturned + alreadyCancelled + item.cancelQuantity;
          if (item.returnQuantity > original.shippedQuantity - alreadyReturned)
            throw new ReturnActionError(
              `${original.product} exceeds the fulfilled quantity remaining to return. Cancel unfulfilled units from the order instead.`,
            );
          const quantity = item.returnQuantity;
          const received =
            item.disposition === "Returned" || (item.disposition === "Damaged" && item.physicallyReceived === true);
          const priorReceived = order.physicalReturns
            .flatMap((r) => r.items)
            .filter((r) => r.orderItemId === original.id)
            .reduce((sum, r) => sum + r.receivedQuantity, 0);
          const legacyReceived = order.returns
            .filter(
              (r) =>
                !order.physicalReturns.some(
                  (p) => p.orderReturnId === r.id && p.items.some((i) => i.orderItemId === original.id),
                ),
            )
            .flatMap((r) => r.items)
            .filter((r) => r.orderItemId === original.id && r.disposition === "Returned")
            .reduce((sum, r) => sum + r.returnQuantity, 0);
          if (received && quantity > original.shippedQuantity - priorReceived - legacyReceived)
            throw new ReturnActionError("Physical return quantity exceeds fulfilled units not already received.");
          const discountAmount = money(
            prorate(cents(original.discountAmount), resolvedBeforeReturn + quantity, original.quantity) -
              prorate(cents(original.discountAmount), resolvedBeforeReturn, original.quantity),
          );
          const taxAmount = money(
            prorate(cents(original.taxAmount), resolvedBeforeReturn + quantity, original.quantity) -
              prorate(cents(original.taxAmount), resolvedBeforeReturn, original.quantity),
          );
          const grossAmount = money(
            prorate(cents(original.lineTotal), resolvedBeforeReturn + quantity, original.quantity) -
              prorate(cents(original.lineTotal), resolvedBeforeReturn, original.quantity),
          );
          return {
            original,
            received,
            quantity,
            disposition: item.disposition,
            restock:
              item.disposition === "Returned" &&
              input.restockItems &&
              item.restock &&
              Boolean(original.inventoryItemId),
            discountAmount,
            taxAmount,
            calculatedRefund: Math.max(cents(grossAmount) - cents(discountAmount) + cents(taxAmount), 0),
          };
        })
        .filter((line) => line.quantity > 0);
      if (lines.length && !can(authorization.membership, "orders.returns.manage"))
        throw new ReturnActionError("You do not have permission to return fulfilled items.");
      if (!lines.length && !cancellationLines.length)
        throw new ReturnActionError("Choose at least one item to cancel or return.");
      const cancellationAdjustment = cancellationLines.length
        ? await createCancellationAdjustment(tx, {
            ownerId: workspaceId,
            orderId,
            lines: cancellationLines,
            reason: input.reason.trim() || "Item resolution",
            idempotencyKey: `${input.submissionKey}:cancel`,
            actorUserId: authorization.principal.user.id,
          })
        : null;
      const cancellationCredit = cancellationAdjustment
        ? adjustmentCreditCents({
            merchandiseAmount: cents(cancellationAdjustment.merchandiseAmount),
            discountAmount: cents(cancellationAdjustment.discountAmount),
            taxAmount: cents(cancellationAdjustment.taxAmount),
            shippingAmount: cents(cancellationAdjustment.shippingAmount),
          })
        : 0;
      if (cancellationAdjustment) {
        await recordAuthorizationAuditEvent(
          {
            workspaceId,
            actorUserId: authorization.principal.user.id,
            membershipId: authorization.membership.id,
            action: "order.items.cancel",
            targetType: "OrderAdjustment",
            targetId: cancellationAdjustment.id,
            metadata: { orderId, source: "item_resolution" },
          },
          tx,
        );
      }
      const returnCredit = lines.reduce((sum, line) => sum + line.calculatedRefund, 0);
      const calculatedAmount = cancellationCredit + returnCredit;
      const refundAmount =
        input.refundStatus === "No Refund"
          ? 0
          : input.refundStatus === "Other"
            ? cents(input.refundAmount)
            : calculatedAmount;
      const balance = await getOrderBalance(tx, workspaceId, orderId);
      const committedRefunds = order.returns.reduce((sum, receipt) => sum + cents(receipt.refundAmount), 0);
      const unlinkedRefunds = balance.refunds
        .filter((refund) => !refund.orderReturnId)
        .reduce((sum, refund) => sum + cents(refund.amount), 0);
      if (refundAmount > Math.max(balance.paid - committedRefunds - unlinkedRefunds, 0))
        throw new ReturnActionError(
          "Requested refund exceeds the paid balance available after previous returns and refunds.",
        );
      const refundPayments = refundAmount
        ? order.payments.filter((entry) => input.paymentId === "all" || entry.id === input.paymentId)
        : [];
      if (refundAmount && !can(authorization.membership, "orders.payments.manage"))
        throw new ReturnActionError("You do not have permission to record the completed refund.");
      if (refundAmount && !refundPayments.length)
        throw new ReturnActionError("Choose the original payments for this refund.");
      if (refundAmount && !input.refundMethod.trim()) throw new ReturnActionError("Refund method is required.");
      const refundStatus =
        input.refundStatus === "No Refund" || input.refundStatus === "Other"
          ? input.refundStatus
          : input.items.every(
                (item) =>
                  item.cancelQuantity + item.returnQuantity >= item.cancellableQuantity + item.returnableQuantity,
              )
            ? "Full Refund"
            : "Partial Refund";
      const normalTax =
        lines.reduce((sum, line) => sum + cents(line.taxAmount), 0) +
        (cancellationAdjustment ? cents(cancellationAdjustment.taxAmount) : 0);
      const normalShipping = cancellationAdjustment ? cents(cancellationAdjustment.shippingAmount) : 0;
      const normalMerchandise = Math.max(calculatedAmount - normalTax - normalShipping, 0);
      const components =
        input.refundStatus === "Other" && refundAmount > 0
          ? checkComponents(money(refundAmount), {
              merchandiseAmount: input.refundMerchandiseAmount ?? -1,
              taxAmount: input.refundTaxAmount ?? -1,
              shippingAmount: input.refundShippingAmount ?? -1,
            })
          : checkComponents(money(refundAmount), {
              merchandiseAmount: refundAmount ? money(normalMerchandise) : 0,
              taxAmount: refundAmount ? money(normalTax) : 0,
              shippingAmount: refundAmount ? money(normalShipping) : 0,
            });
      const refundedMoney = balance.refunds;
      if (refundedMoney.some((r) => r.taxAmount == null) && input.refundStatus === "Other")
        throw new ReturnActionError(
          "A previous refund has an unknown breakdown. Review it before recording a custom component refund.",
        );
      const caps = {
        merchandiseAmount: Number(order.subtotal) - Number(order.discountAmount),
        taxAmount: Number(order.taxAmount),
        shippingAmount: Number(order.shippingAmount),
      };
      for (const key of ["merchandiseAmount", "taxAmount", "shippingAmount"] as const) {
        const used = refundedMoney.reduce((sum, r) => sum + (r[key] == null ? 0 : cents(r[key] ?? 0)), 0);
        if (cents(components[key]) + used > cents(caps[key]))
          throw new ReturnActionError("Refund exceeds the remaining order component balance.");
      }
      const [cancellationRefundAmount = 0, returnRefundAmount = 0] = allocateCents(refundAmount, [
        cancellationCredit,
        returnCredit,
      ]);
      const allocatedRefunds = allocateCents(
        returnRefundAmount,
        lines.map((line) => line.calculatedRefund),
      );
      const returnRecord = await tx.orderReturn.create({
        data: {
          ownerId: workspaceId,
          orderId,
          returnNumber: `${order.orderNumber}-RET-${order.returns.length + 1}`,
          submissionKey: input.submissionKey,
          submissionHash,
          returnStatus: "Returned",
          savedAt: new Date(),
          returnDate: new Date(`${input.returnDate}T12:00:00Z`),
          customerNote: optionalString(input.customerNote),
          internalNotes: optionalString(input.internalNotes),
          reason: optionalString(input.reason),
          refundAmount: money(returnRefundAmount),
          refundStatus,
          refundState: refundAmount ? "succeeded" : "not_required",
          refundExplanation: optionalString(input.refundExplanation),
          refundMethod: refundAmount
            ? input.paymentId === "all"
              ? [...new Set(refundPayments.map((payment) => payment.method))].join(", ")
              : input.refundMethod.trim()
            : null,
          refundReference: refundAmount ? optionalString(input.refundReference) : null,
          restockItems: input.restockItems,
        },
      });
      const physicalReceipt = lines.some((line) => line.received && line.quantity > 0)
        ? await tx.orderReturnReceipt.create({
            data: {
              ownerId: workspaceId,
              orderId,
              orderReturnId: returnRecord.id,
              receivedAt: new Date(`${input.returnDate}T12:00:00Z`),
              actorUserId: authorization.principal.user.id,
              idempotencyKey: input.submissionKey ?? returnRecord.id,
              notes: optionalString(input.reason),
            },
          })
        : null;
      for (const [index, line] of lines.entries()) {
        const original = line.original;
        await tx.orderReturnItem.create({
          data: {
            ownerId: workspaceId,
            orderReturnId: returnRecord.id,
            orderItemId: original.id,
            inventoryItemId: original.inventoryItemId,
            sku: original.sku,
            product: original.product,
            description: original.description,
            unit: original.unit,
            category: original.category,
            orderedQuantity: original.quantity,
            returnQuantity: line.quantity,
            disposition: line.disposition,
            restock: line.restock,
            unitPrice: original.unitPrice,
            unitCost: original.unitCost,
            discountAmount: line.discountAmount,
            taxAmount: line.taxAmount,
            lineRefund: money(allocatedRefunds[index]),
          },
        });
        if (line.restock && original.inventoryItemId)
          await adjustStock(tx, {
            ownerId: workspaceId,
            inventoryItemId: original.inventoryItemId,
            quantityChange: line.quantity,
            reason: "Return",
            notes: returnRecord.returnNumber,
            orderId,
            orderItemId: original.id,
            actorUserId: authorization.principal.user.id,
          });
        if (physicalReceipt && line.received) {
          const stockMovement = line.restock
            ? await tx.inventoryStockMovement.findFirstOrThrow({
                where: {
                  ownerId: workspaceId,
                  orderItemId: original.id,
                  reason: "Return",
                  notes: returnRecord.returnNumber,
                },
                orderBy: { createdAt: "desc" },
              })
            : null;
          await tx.orderReturnReceiptItem.create({
            data: {
              ownerId: workspaceId,
              receiptId: physicalReceipt.id,
              orderItemId: original.id,
              inventoryItemId: original.inventoryItemId,
              stockMovementId: stockMovement?.id,
              receivedQuantity: line.quantity,
              restockedQuantity: line.restock ? line.quantity : 0,
              condition: line.disposition === "Damaged" ? "Damaged" : "Sellable",
              unitCost: original.unitCost,
              retailUnitPrice: original.unitPrice,
              evidence: { product: original.product, sku: original.sku },
            },
          });
        }
      }
      if (refundPayments.length && refundAmount) {
        const limits = refundPayments.map((payment) => ({
          ...refundablePaymentComponents(order, payment, balance.refunds),
          payment,
        }));
        const originalParts = { ...components };
        const cancellationParts =
          input.refundStatus === "Other"
            ? splitAmount(money(cancellationRefundAmount), originalParts)
            : {
                merchandiseAmount: money(
                  cancellationCredit -
                    (cancellationAdjustment
                      ? cents(cancellationAdjustment.taxAmount) + cents(cancellationAdjustment.shippingAmount)
                      : 0),
                ),
                taxAmount: cancellationAdjustment ? Number(cancellationAdjustment.taxAmount) : 0,
                shippingAmount: cancellationAdjustment ? Number(cancellationAdjustment.shippingAmount) : 0,
              };
        const returnParts = {
          merchandiseAmount: money(cents(components.merchandiseAmount) - cents(cancellationParts.merchandiseAmount)),
          taxAmount: money(cents(components.taxAmount) - cents(cancellationParts.taxAmount)),
          shippingAmount: money(cents(components.shippingAmount) - cents(cancellationParts.shippingAmount)),
        };
        const sources = [
          {
            amount: cancellationRefundAmount,
            parts: cancellationParts,
            adjustmentId: cancellationAdjustment?.id,
            returnId: undefined,
            suffix: "cancel",
          },
          {
            amount: returnRefundAmount,
            parts: returnParts,
            adjustmentId: undefined,
            returnId: returnRecord.id,
            suffix: "return",
          },
        ];
        for (const source of sources) {
          if (!source.amount) continue;
          const allocated = allocateRefundPayments(source.parts, limits);
          for (const row of allocated) {
            const payment = refundPayments.find((entry) => entry.id === row.paymentId);
            const refund = await tx.orderRefund.create({
              data: {
                ownerId: workspaceId,
                orderId,
                paymentId: row.paymentId,
                adjustmentId: source.adjustmentId,
                orderReturnId: source.returnId,
                amount: row.amount,
                merchandiseAmount: row.merchandiseAmount,
                taxAmount: row.taxAmount,
                shippingAmount: row.shippingAmount,
                allocationSource: row.estimated ? "estimated" : "explicit",
                method:
                  input.paymentId === "all"
                    ? (payment?.method ?? input.refundMethod.trim())
                    : input.refundMethod.trim(),
                reference: optionalString(input.refundReference),
                idempotencyKey: `${input.submissionKey}:${source.suffix}:${row.paymentId}`,
                actorUserId: authorization.principal.user.id,
              },
            });
            const remaining = limits.find((entry) => entry.id === row.paymentId);
            if (remaining)
              for (const key of ["merchandiseAmount", "taxAmount", "shippingAmount"] as const)
                remaining.limits[key] = money(cents(remaining.limits[key]) - cents(row[key]));
            await recordAuthorizationAuditEvent(
              {
                workspaceId,
                actorUserId: authorization.principal.user.id,
                membershipId: authorization.membership.id,
                action: "order.refund.record",
                targetType: "OrderRefund",
                targetId: refund.id,
                metadata: { orderId, amount: row.amount, orderReturnId: source.returnId },
              },
              tx,
            );
          }
        }
      }
      await tx.order.update({
        where: { id: orderId },
        data: { version: { increment: 1 }, ...(balance.paid > 0 ? { reservationExpiresAt: null } : {}) },
      });
      await refreshOrderPaymentStatus(tx, workspaceId, orderId);
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "order.return.save",
          targetType: "OrderReturn",
          targetId: returnRecord.id,
          metadata: { orderId },
        },
        tx,
      );
      return returnRecord;
    });
    for (const path of [
      "/dashboard/commerce-analytics",
      "/dashboard/orders",
      "/dashboard/inventory",
      `/dashboard/orders/${orderId}/edit`,
      `/dashboard/orders/${orderId}/return`,
    ])
      revalidateWorkspacePath(authorization.membership.workspaceSlug, path);
    return { id: savedReturn.id, success: true };
  } catch (error) {
    console.error("Return save failed.", error);
    return {
      message:
        error instanceof CommerceError || error instanceof CommerceInputError
          ? error.message
          : "Return could not be saved. Please try again.",
      success: false,
    };
  }
}

export async function emailReturnReceiptAction(
  returnId: string | null,
  _previousState: EmailReturnReceiptState,
  formData: FormData,
): Promise<EmailReturnReceiptState> {
  const authorization = await getPermittedDashboardAuthorization("email.send");

  if (!authorization || !can(authorization.membership, "orders.view")) {
    return createEmailReturnReceiptState(false, "You do not have permission to email return receipts.");
  }
  const workspaceId = authorization.workspaceId;

  const parsed = emailReturnReceiptSchema.safeParse({
    orderId: formData.get("orderId"),
  });

  if (!parsed.success) {
    return createEmailReturnReceiptState(
      false,
      parsed.error.issues[0]?.message ?? "Select a return receipt and try again.",
    );
  }

  const [orderReturn, googleMailAccount, workspace] = await Promise.all([
    prisma.orderReturn.findFirst({
      where: {
        orderId: parsed.data.orderId,
        ...(returnId ? { id: returnId } : {}),
        ownerId: workspaceId,
      },
      include: {
        order: true,
      },
    }),
    prisma.googleMailAccount.findUnique({
      where: {
        workspaceId,
      },
    }),
    prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      select: {
        name: true,
      },
    }),
  ]);

  if (!orderReturn || !workspace) {
    return createEmailReturnReceiptState(false, "Return receipt could not be found.");
  }

  const emailRecordBase = {
    documentId: orderReturn.orderId,
    documentNumber: orderReturn.returnNumber,
    documentTotal: orderReturn.refundAmount,
    documentType: "return-receipt" as const,
    ownerId: workspaceId,
    recipientEmail: orderReturn.order.customerEmail,
    recipientName: orderReturn.order.customerName,
    senderEmail: googleMailAccount?.email,
    sentByUserId: authorization.principal.user.id,
    sentByName: authorization.principal.user.name,
    sentByEmail: authorization.principal.user.email,
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

  let bodyText: string | undefined;
  let subject: string | undefined;

  try {
    const documentData = await getReturnRefundDocumentData(workspaceId, parsed.data.orderId, orderReturn.id);

    if (!documentData) {
      return createEmailReturnReceiptState(false, "Return receipt could not be found.");
    }

    const fallback = {
      html: [
        `<p>Hi ${escapeHtml(orderReturn.order.customerName?.trim() || "there")},</p>`,
        `<p>Your return receipt <strong>${escapeHtml(orderReturn.returnNumber)}</strong> from ${escapeHtml(workspace.name)} is attached as a PDF.</p>`,
        `<p><span style="color:#18181b;font-size:22px"><strong>${documentData.refundAmount}</strong></span><br><span style="color:#52525b">Requested refund amount</span></p>`,
        `<p><strong>Return date:</strong> ${escapeHtml(format(orderReturn.returnDate, "MMM d, yyyy"))}</p>`,
        "<p>Please keep this for your records. If you have any questions, reply to this email and we will be happy to help.</p>",
        `<p>Thank you,<br><strong>${escapeHtml(workspace.name)}</strong></p>`,
      ].join(""),
      subject: `Return Receipt ${orderReturn.returnNumber} from ${workspace.name}`,
      text: [
        `Hi ${orderReturn.order.customerName?.trim() || "there"},`,
        "",
        `Your return receipt ${orderReturn.returnNumber} from ${workspace.name} is attached as a PDF.`,
        `Requested refund amount: ${documentData.refundAmount}`,
        `Return date: ${format(orderReturn.returnDate, "MMM d, yyyy")}`,
        "",
        "Please keep this for your records.",
        "",
        "Thank you.",
        workspace.name,
      ].join("\n"),
    };
    const submittedEmailContent = getSubmittedEmailContent(formData, fallback);
    const pdfBuffer = await renderReturnReceiptPdfBuffer(documentData);
    const refreshToken = decryptGoogleToken(googleMailAccount.refreshTokenCipher);
    const accessToken = await refreshGoogleAccessToken(refreshToken);
    bodyText = submittedEmailContent.text;
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
      bodyText,
      senderEmail: googleMailAccount.email,
      status: "success",
      subject,
    });
    await recordAuthorizationAuditEvent({
      workspaceId,
      actorUserId: authorization.principal.user.id,
      membershipId: authorization.membership.id,
      action: "order.return.send",
      targetType: "OrderReturn",
      targetId: orderReturn.id,
      metadata: { orderId: orderReturn.orderId },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Return receipt email could not be sent. Please try again.";
    const reconnectRequired = message === GMAIL_REFRESH_ERROR_MESSAGE;
    const responseMessage = reconnectRequired
      ? `${message} Please reconnect to continue.`
      : "Return receipt email could not be sent. Please try again.";
    console.error("Return receipt email failed.", error);

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
      errorMessage: message,
      senderEmail: googleMailAccount.email,
      status: "error",
      subject,
    });

    return createEmailReturnReceiptState(false, responseMessage, reconnectRequired);
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/email-history");

  return createEmailReturnReceiptState(true, `Return receipt sent to ${orderReturn.order.customerEmail}.`);
}
