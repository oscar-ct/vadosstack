import { format } from "date-fns";

import { cancellableQuantity } from "@/lib/commerce/order-cancellation";
import { resolutionStatusLabel } from "@/lib/commerce/order-resolution";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

import type { OrderCompany } from "../../../create/_components/data";

export * from "@/lib/commerce/returns";

import {
  formatDateInputValue,
  formatMoney,
  getCalculatedRefundAmount,
  getCalculatedRefundStatus,
  getDefaultRefundAmount,
  getEffectiveRefundStatus,
  getReturnedItemsDiscount,
  getReturnedItemsSubtotal,
  getReturnedItemsTax,
  parseReturnDisposition,
  parseReturnRefundStatus,
  type ReturnRefundDocumentData,
  type ReturnRefundFormValues,
  type ReturnRefundItem,
} from "@/lib/commerce/returns";

function formatDisplayDate(value?: Date | null) {
  return value ? format(value, "MMM d, yyyy") : "";
}

function getLineRefund(item: ReturnRefundItem) {
  return (item.returnQuantity + item.cancelQuantity) * item.unitPrice;
}

async function loadReturnRefundContext(ownerId: string, orderId: string) {
  const [order, workspace] = await Promise.all([
    prisma.order.findFirst({
      where: {
        id: orderId,
        ownerId,
      },
      include: {
        items: {
          include: {
            adjustmentItems: { include: { adjustment: { select: { kind: true } } } },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        payments: {
          include: {
            refunds: {
              where: { status: "succeeded" },
            },
          },
          orderBy: { paidAt: "asc" },
        },
        returns: {
          include: {
            items: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        adjustments: {
          where: { kind: "Cancellation" },
          include: { items: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.workspace.findUnique({
      where: {
        id: ownerId,
      },
      include: {
        legacyOwner: {
          select: { email: true },
        },
      },
    }),
  ]);

  if (!order || !workspace) return null;

  const companyLogoSrc = await getCompanyLogoSrc(workspace.id);
  return { order, workspace, companyLogoSrc };
}

type ReturnContext = NonNullable<Awaited<ReturnType<typeof loadReturnRefundContext>>>;

function buildReturnRefundWorkspace(
  { order, workspace, companyLogoSrc }: ReturnContext,
  selectedReturnId?: string | null,
) {
  const orderId = order.id;
  const existingReturn =
    selectedReturnId === null
      ? undefined
      : selectedReturnId
        ? order.returns.find((receipt) => receipt.id === selectedReturnId)
        : order.returns[0];
  if (selectedReturnId && !existingReturn) return null;
  const previousQuantity = (id: string) =>
    order.returns
      .flatMap((receipt) => receipt.items)
      .filter((item) => item.orderItemId === id)
      .reduce((sum, item) => sum + item.returnQuantity, 0);
  const cancelledQuantity = (id: string) =>
    order.items
      .find((item) => item.id === id)
      ?.adjustmentItems.reduce((sum, item) => sum + (item.adjustment.kind === "Cancellation" ? item.quantity : 0), 0) ??
    0;
  const cityState = [order.shippingCity, order.shippingState].filter(Boolean).join(", ");
  const cityStateZip = [cityState, order.shippingPostalCode].filter(Boolean).join(" ");
  const streetLine = [order.shippingLine1, order.shippingLine2].filter(Boolean).join(", ");
  const shippingAddressLines = [streetLine, cityStateZip].filter(Boolean);
  const resolutionAdjustment = existingReturn?.submissionKey
    ? order.adjustments.find((adjustment) => adjustment.idempotencyKey === `${existingReturn.submissionKey}:cancel`)
    : undefined;
  const resolutionAdjustmentItemIds = new Set(resolutionAdjustment?.items.map((item) => item.orderItemId) ?? []);
  const resolutionReturnItemIds = new Set(existingReturn?.items.map((item) => item.orderItemId) ?? []);
  const resolutionOrderItems = order.items.filter(
    (item) => resolutionAdjustmentItemIds.has(item.id) || resolutionReturnItemIds.has(item.id),
  );
  const existingRefundPaymentId = existingReturn
    ? order.payments.find((payment) =>
        payment.refunds.some(
          (refund) => refund.orderReturnId === existingReturn.id || refund.adjustmentId === resolutionAdjustment?.id,
        ),
      )?.id
    : undefined;
  const savedRefunds = existingReturn
    ? order.payments
        .flatMap((p) => p.refunds)
        .filter((r) => r.orderReturnId === existingReturn.id || r.adjustmentId === resolutionAdjustment?.id)
    : [];
  const savedBreakdown =
    savedRefunds.length && savedRefunds.every((r) => r.taxAmount != null)
      ? {
          refundMerchandiseAmount: savedRefunds.reduce((v, r) => v + Number(r.merchandiseAmount), 0),
          refundTaxAmount: savedRefunds.reduce((v, r) => v + Number(r.taxAmount), 0),
          refundShippingAmount: savedRefunds.reduce((v, r) => v + Number(r.shippingAmount), 0),
        }
      : {};
  const paymentOptions = order.payments
    .map((payment) => ({
      amount: Number(payment.amount),
      id: payment.id,
      method: payment.method,
      reference: payment.reference,
      refundableAmount:
        Number(payment.amount) - payment.refunds.reduce((sum, refund) => sum + Number(refund.amount), 0),
    }))
    .filter((payment) => payment.refundableAmount > 0.001 || payment.id === existingRefundPaymentId);
  const company: OrderCompany = {
    address: workspace.companyAddress,
    email: workspace.companyEmail ?? workspace.legacyOwner?.email ?? "",
    logoSrc: companyLogoSrc,
    name: workspace.name,
    phone: workspace.companyPhone,
  };
  const values: ReturnRefundFormValues = existingReturn
    ? {
        returnId: existingReturn.id,
        orderVersion: order.version,
        refundState: existingReturn.refundState,
        customerEmail: order.customerEmail ?? "",
        customerName: order.customerName ?? "",
        customerNote: existingReturn.customerNote ?? "",
        customerPhone: order.customerPhone ?? "",
        internalNotes: existingReturn.internalNotes ?? "",
        items: resolutionOrderItems.map((orderItem) => {
          const returnItem = existingReturn.items.find((item) => item.orderItemId === orderItem.id);
          const adjustmentItem = resolutionAdjustment?.items.find((item) => item.orderItemId === orderItem.id);
          return {
            cancelQuantity: adjustmentItem?.quantity ?? 0,
            cancellableQuantity: adjustmentItem?.quantity ?? 0,
            category: orderItem.category ?? "",
            disposition: parseReturnDisposition(returnItem?.disposition),
            id: returnItem?.id ?? adjustmentItem?.id ?? orderItem.id,
            inventoryItemId: orderItem.inventoryItemId ?? undefined,
            orderItemId: orderItem.id,
            orderedQuantity: (returnItem?.returnQuantity ?? 0) + (adjustmentItem?.quantity ?? 0),
            product: returnItem?.product ?? orderItem.product,
            description: returnItem?.description ?? orderItem.description,
            unit: returnItem?.unit ?? orderItem.unit,
            restock: returnItem?.restock ?? false,
            returnQuantity: returnItem?.returnQuantity ?? 0,
            returnableQuantity: returnItem?.returnQuantity ?? 0,
            sku: orderItem.sku ?? "",
            taxable: orderItem.taxable,
            taxRate: Number(orderItem.taxRate),
            unitPrice: Number(returnItem?.unitPrice ?? orderItem.unitPrice),
            originalQuantity: (returnItem?.returnQuantity ?? 0) + (adjustmentItem?.quantity ?? 0),
            originalDiscountAmount:
              Number(returnItem?.discountAmount ?? 0) + Number(adjustmentItem?.discountAmount ?? 0),
            originalTaxAmount: Number(returnItem?.taxAmount ?? 0) + Number(adjustmentItem?.taxAmount ?? 0),
          };
        }),
        orderDate: formatDateInputValue(order.orderDate),
        orderNumber: order.orderNumber,
        originalDiscountAmount: Number(order.discountAmount),
        originalSubtotal: Number(order.subtotal),
        originalTaxAmount: Number(order.taxAmount),
        originalTotal: Number(order.total),
        paymentId: existingRefundPaymentId ?? "",
        reason: existingReturn.reason ?? "",
        ...savedBreakdown,
        refundAmount: savedRefunds.reduce((sum, refund) => sum + Number(refund.amount), 0),
        refundExplanation: existingReturn.refundExplanation ?? "",
        refundMethod: existingReturn.refundMethod ?? "",
        refundReference: existingReturn.refundReference ?? "",
        refundStatus: parseReturnRefundStatus(existingReturn.refundStatus),
        restockItems: existingReturn.restockItems,
        returnDate: formatDateInputValue(existingReturn.returnDate),
        returnNumber: existingReturn.returnNumber,
        returnStatus: existingReturn.returnStatus === "Returned" ? "Returned" : "Draft",
        shippingAddressLines,
      }
    : {
        orderVersion: order.version,
        refundState: "draft",
        customerEmail: order.customerEmail ?? "",
        customerName: order.customerName ?? "",
        customerNote: "Your completed resolution and refund details are included on this receipt.",
        customerPhone: order.customerPhone ?? "",
        internalNotes: "",
        items: order.items
          .map((item) => {
            const previouslyReturnedQuantity = previousQuantity(item.id);
            const previouslyCancelledQuantity = cancelledQuantity(item.id);
            const canCancel = cancellableQuantity({
              quantity: item.quantity,
              shippedQuantity: item.shippedQuantity,
              cancelledQuantity: previouslyCancelledQuantity,
              returnedQuantity: previouslyReturnedQuantity,
            });
            const canReturn = Math.max(item.shippedQuantity - previouslyReturnedQuantity, 0);

            return {
              cancelQuantity: 0,
              cancellableQuantity: canCancel,
              category: item.category ?? "",
              disposition: "Returned" as const,
              id: item.id,
              inventoryItemId: item.inventoryItemId ?? undefined,
              orderItemId: item.id,
              orderedQuantity: canCancel + canReturn,
              originalQuantity: item.quantity,
              previouslyCancelledQuantity,
              previouslyReturnedQuantity,
              originalDiscountAmount: Number(item.discountAmount),
              originalTaxAmount: Number(item.taxAmount),
              product: item.product,
              description: item.description,
              unit: item.unit,
              restock: Boolean(item.inventoryItemId),
              returnQuantity: 0,
              returnableQuantity: canReturn,
              sku: item.sku ?? "",
              taxable: item.taxable,
              taxRate: Number(item.taxRate),
              unitPrice: Number(item.unitPrice),
            };
          })
          .filter((item) => item.cancellableQuantity > 0 || item.returnableQuantity > 0),
        orderDate: formatDateInputValue(order.orderDate),
        orderNumber: order.orderNumber,
        originalDiscountAmount: Number(order.discountAmount),
        originalSubtotal: Number(order.subtotal),
        originalTaxAmount: Number(order.taxAmount),
        originalTotal: Number(order.total),
        paymentId: paymentOptions.length === 1 ? paymentOptions[0].id : "",
        reason: "",
        refundMerchandiseAmount: 0,
        refundTaxAmount: 0,
        refundShippingAmount: 0,
        refundAmount: 0,
        refundExplanation: "",
        refundMethod: order.paymentMethod ?? "",
        refundReference: "",
        refundStatus: paymentOptions.every((payment) => payment.refundableAmount <= 0) ? "No Refund" : "Full Refund",
        restockItems: true,
        returnDate: formatDateInputValue(new Date()),
        returnNumber: `${order.orderNumber}-RET-${order.returns.length + 1}`,
        returnStatus: "Draft",
        shippingAddressLines,
      };

  if (!existingReturn && values.refundStatus !== "No Refund" && values.refundStatus !== "Other") {
    values.refundStatus = getCalculatedRefundStatus(values);
    values.refundAmount = getCalculatedRefundAmount(values);
  }

  return {
    company,
    orderId,
    payments: paymentOptions,
    returnId: existingReturn?.id ?? null,
    values,
  };
}

export async function getReturnRefundWorkspaceData(ownerId: string, orderId: string, selectedReturnId?: string | null) {
  const context = await loadReturnRefundContext(ownerId, orderId);
  return context ? buildReturnRefundWorkspace(context, selectedReturnId) : null;
}

/** Load the order once when browsing multiple finalized resolutions. */
export async function getSavedReturnRefundWorkspaces(ownerId: string, orderId: string) {
  const context = await loadReturnRefundContext(ownerId, orderId);
  if (!context) return [];
  return context.order.returns
    .filter((receipt) => receipt.savedAt || receipt.returnStatus === "Returned")
    .map((receipt) => buildReturnRefundWorkspace(context, receipt.id))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

export async function getReturnRefundDocumentData(
  ownerId: string,
  orderId: string,
  returnId?: string,
): Promise<ReturnRefundDocumentData | null> {
  const data = await getReturnRefundWorkspaceData(ownerId, orderId, returnId);

  if (!data?.returnId) return null;

  const { company, values } = data;

  return {
    company,
    customerEmail: values.customerEmail || null,
    customerName: values.customerName || "Customer",
    customerNote: values.customerNote || null,
    customerPhone: values.customerPhone ? formatPhoneNumber(values.customerPhone) : null,
    items: values.items
      .filter((item) => item.returnQuantity > 0 || item.cancelQuantity > 0)
      .map((item) => ({
        category: item.category || null,
        disposition: item.disposition,
        id: item.id,
        lineRefund: formatMoney(getLineRefund(item)),
        product: item.product,
        description: item.description,
        unit: item.unit,
        returnQuantity: item.returnQuantity,
        cancelQuantity: item.cancelQuantity,
        sku: item.sku || null,
        unitPrice: formatMoney(item.unitPrice),
      })),
    orderDate: values.orderDate ? formatDisplayDate(new Date(`${values.orderDate}T12:00:00`)) : "",
    orderNumber: values.orderNumber,
    reason: values.reason || null,
    refundAmount: formatMoney(getDefaultRefundAmount(values)),
    refundDiscount: formatMoney(getReturnedItemsDiscount(values)),
    refundExplanation:
      values.refundStatus === "No Refund" || values.refundStatus === "Other" ? values.refundExplanation || null : null,
    refundMethod: values.refundMethod || null,
    refundReference: values.refundReference || null,
    refundStatus: `${getEffectiveRefundStatus(values)} · ${resolutionStatusLabel(values.refundState ?? "requested")}`,
    refundSubtotal: formatMoney(getReturnedItemsSubtotal(values)),
    refundTax: formatMoney(getReturnedItemsTax(values)),
    returnDate: values.returnDate ? formatDisplayDate(new Date(`${values.returnDate}T12:00:00`)) : "",
    returnNumber: values.returnNumber,
    shippingAddressLines: values.shippingAddressLines,
  };
}

export function sanitizeReturnReceiptFilename(value: string) {
  return `${value.replace(/[^a-z0-9-]+/gi, "-")}.pdf`;
}
