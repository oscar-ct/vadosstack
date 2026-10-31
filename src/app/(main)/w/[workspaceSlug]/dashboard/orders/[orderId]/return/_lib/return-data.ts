import { format } from "date-fns";

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
  return item.returnQuantity * item.unitPrice;
}

export async function getReturnRefundWorkspaceData(ownerId: string, orderId: string, selectedReturnId?: string | null) {
  const [order, workspace] = await Promise.all([
    prisma.order.findFirst({
      where: {
        id: orderId,
        ownerId,
      },
      include: {
        items: {
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
  const cityState = [order.shippingCity, order.shippingState].filter(Boolean).join(", ");
  const cityStateZip = [cityState, order.shippingPostalCode].filter(Boolean).join(" ");
  const streetLine = [order.shippingLine1, order.shippingLine2].filter(Boolean).join(", ");
  const shippingAddressLines = [streetLine, cityStateZip].filter(Boolean);
  const orderItemsById = new Map(order.items.map((item) => [item.id, item]));
  const existingRefundPaymentId = existingReturn
    ? order.payments.find((payment) => payment.refunds.some((refund) => refund.orderReturnId === existingReturn.id))?.id
    : undefined;
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
        items: existingReturn.items.map((item) => ({
          category: item.category ?? "",
          disposition: parseReturnDisposition(item.disposition),
          id: item.id,
          inventoryItemId: item.inventoryItemId ?? undefined,
          orderItemId: item.orderItemId,
          orderedQuantity: item.orderedQuantity,
          product: item.product,
          description: item.description,
          unit: item.unit,
          restock: item.restock,
          returnQuantity: item.returnQuantity,
          sku: item.sku ?? "",
          taxable: orderItemsById.get(item.orderItemId)?.taxable ?? true,
          taxRate: Number(orderItemsById.get(item.orderItemId)?.taxRate ?? 0),
          unitPrice: Number(item.unitPrice),
          originalQuantity: item.returnQuantity || 1,
          originalDiscountAmount: Number(item.discountAmount),
          originalTaxAmount: Number(item.taxAmount),
        })),
        orderDate: formatDateInputValue(order.orderDate),
        orderNumber: order.orderNumber,
        originalDiscountAmount: Number(order.discountAmount),
        originalSubtotal: Number(order.subtotal),
        originalTaxAmount: Number(order.taxAmount),
        originalTotal: Number(order.total),
        paymentId: existingRefundPaymentId ?? "",
        reason: existingReturn.reason ?? "",
        refundAmount: Number(existingReturn.refundAmount),
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
        customerNote: "Your completed refund is included on this return receipt.",
        customerPhone: order.customerPhone ?? "",
        internalNotes: "",
        items: order.items
          .filter((item) => item.quantity > previousQuantity(item.id))
          .map((item) => ({
            category: item.category ?? "",
            disposition: "Returned",
            id: item.id,
            inventoryItemId: item.inventoryItemId ?? undefined,
            orderItemId: item.id,
            orderedQuantity: item.quantity - previousQuantity(item.id),
            originalQuantity: item.quantity,
            previouslyReturnedQuantity: previousQuantity(item.id),
            originalDiscountAmount: Number(item.discountAmount),
            originalTaxAmount: Number(item.taxAmount),
            product: item.product,
            description: item.description,
            unit: item.unit,
            restock: Boolean(item.inventoryItemId),
            returnQuantity: item.quantity - previousQuantity(item.id),
            sku: item.sku ?? "",
            taxable: item.taxable,
            taxRate: Number(item.taxRate),
            unitPrice: Number(item.unitPrice),
          })),
        orderDate: formatDateInputValue(order.orderDate),
        orderNumber: order.orderNumber,
        originalDiscountAmount: Number(order.discountAmount),
        originalSubtotal: Number(order.subtotal),
        originalTaxAmount: Number(order.taxAmount),
        originalTotal: Number(order.total),
        paymentId: paymentOptions.length === 1 ? paymentOptions[0].id : "",
        reason: "",
        refundAmount: 0,
        refundExplanation: "",
        refundMethod: order.paymentMethod ?? "",
        refundReference: "",
        refundStatus:
          order.paymentStatus === "Pending" || order.paymentStatus === "Refunded" ? "No Refund" : "Full Refund",
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
      .filter((item) => item.returnQuantity > 0)
      .map((item) => ({
        category: item.category || null,
        disposition: item.disposition,
        id: item.id,
        lineRefund: formatMoney(getLineRefund(item)),
        product: item.product,
        description: item.description,
        unit: item.unit,
        returnQuantity: item.returnQuantity,
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
    refundStatus: `${getEffectiveRefundStatus(values)} · ${values.refundState ?? "requested"}`,
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
