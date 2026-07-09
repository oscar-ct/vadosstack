import { format } from "date-fns";

import { getCompanyLogoSrc } from "@/lib/company-logo";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

import type { OrderCompany } from "../../../create/_components/data";

export type ReturnRefundStatus = "Full Refund" | "No Refund" | "Other" | "Partial Refund";
export type ReturnDisposition = "Damaged" | "Lost" | "No physical return" | "Returned";
export type ReturnStatus = "Draft" | "Returned";

export type ReturnRefundItem = {
  category: string;
  disposition: ReturnDisposition;
  id: string;
  inventoryItemId?: string;
  orderItemId: string;
  orderedQuantity: number;
  product: string;
  restock: boolean;
  returnQuantity: number;
  sku: string;
  taxable: boolean;
  taxRate: number;
  unitPrice: number;
};

export type ReturnRefundFormValues = {
  customerEmail: string;
  customerName: string;
  customerNote: string;
  customerPhone: string;
  internalNotes: string;
  items: ReturnRefundItem[];
  orderDate: string;
  orderNumber: string;
  originalDiscountAmount: number;
  originalSubtotal: number;
  originalTaxAmount: number;
  originalTotal: number;
  reason: string;
  refundAmount: number;
  refundExplanation: string;
  refundMethod: string;
  refundReference: string;
  refundStatus: ReturnRefundStatus;
  restockItems: boolean;
  returnDate: string;
  returnNumber: string;
  returnStatus: ReturnStatus;
  shippingAddressLines: string[];
};

export type ReturnRefundDocumentData = {
  company: OrderCompany;
  customerEmail: string | null;
  customerName: string;
  customerPhone: string | null;
  customerNote: string | null;
  items: Array<{
    category: string | null;
    disposition: ReturnDisposition;
    id: string;
    lineRefund: string;
    product: string;
    returnQuantity: number;
    sku: string | null;
    unitPrice: string;
  }>;
  orderDate: string;
  orderNumber: string;
  reason: string | null;
  refundAmount: string;
  refundDiscount: string;
  refundExplanation: string | null;
  refundMethod: string | null;
  refundReference: string | null;
  refundStatus: string;
  refundSubtotal: string;
  refundTax: string;
  returnDate: string;
  returnNumber: string;
  shippingAddressLines: string[];
};

export function formatMoney(value: number | string | { toString: () => string }) {
  return `$${Number(value.toString()).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

export function formatDateInputValue(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export function parseReturnRefundStatus(value: string): ReturnRefundStatus {
  if (value === "Full Refund" || value === "Partial Refund" || value === "Other") return value;
  return "No Refund";
}

export function parseReturnDisposition(value: string | null | undefined): ReturnDisposition {
  if (value === "Damaged" || value === "Lost" || value === "No physical return") return value;
  return "Returned";
}

export function getReturnDispositionLabel(disposition: ReturnDisposition) {
  if (disposition === "Damaged") return "Damaged, not restocked";
  if (disposition === "Lost") return "Lost, not received";
  if (disposition === "No physical return") return "Refunded without physical return";
  return "Returned";
}

function formatDisplayDate(value?: Date | null) {
  return value ? format(value, "MMM d, yyyy") : "";
}

function getReturnNumber(orderNumber: string) {
  return `${orderNumber}-RET`;
}

function getLineRefund(item: ReturnRefundItem) {
  const quantity = Number.isFinite(item.returnQuantity) ? item.returnQuantity : 0;
  const unitPrice = Number.isFinite(item.unitPrice) ? item.unitPrice : 0;

  return quantity * unitPrice;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getReturnedItemsSubtotal(values: ReturnRefundFormValues) {
  return roundMoney(values.items.reduce((total, item) => total + getLineRefund(item), 0));
}

export function getReturnedItemsTax(values: ReturnRefundFormValues) {
  return roundMoney(
    values.items.reduce((total, item) => {
      if (!item.taxable) return total;

      const taxRate = Number.isFinite(item.taxRate) ? item.taxRate : 0;

      return total + getLineRefund(item) * (taxRate / 100);
    }, 0),
  );
}

export function getReturnedItemsDiscount(values: ReturnRefundFormValues) {
  if (!Number.isFinite(values.originalSubtotal) || values.originalSubtotal <= 0) return 0;
  if (!Number.isFinite(values.originalDiscountAmount) || values.originalDiscountAmount <= 0) return 0;

  const subtotalRatio = Math.min(getReturnedItemsSubtotal(values) / values.originalSubtotal, 1);

  return roundMoney(values.originalDiscountAmount * subtotalRatio);
}

export function getCalculatedRefundStatus(values: ReturnRefundFormValues): ReturnRefundStatus {
  const totalReturnedQuantity = values.items.reduce((total, item) => total + item.returnQuantity, 0);
  const allItemsReturned = values.items.every((item) => item.returnQuantity >= item.orderedQuantity);

  if (totalReturnedQuantity <= 0) return "No Refund";
  if (allItemsReturned) return "Full Refund";

  return "Partial Refund";
}

export function getCalculatedRefundAmount(values: ReturnRefundFormValues) {
  if (getCalculatedRefundStatus(values) === "No Refund") return 0;

  return roundMoney(
    Math.max(getReturnedItemsSubtotal(values) + getReturnedItemsTax(values) - getReturnedItemsDiscount(values), 0),
  );
}

export function getDefaultRefundAmount(values: ReturnRefundFormValues) {
  if (values.refundStatus === "No Refund") return 0;

  if (values.refundStatus === "Other") {
    return Number.isFinite(values.refundAmount) ? values.refundAmount : 0;
  }

  return getCalculatedRefundAmount(values);
}

export function getEffectiveRefundStatus(values: ReturnRefundFormValues) {
  if (values.refundStatus === "No Refund" || values.refundStatus === "Other") return values.refundStatus;

  return getCalculatedRefundStatus(values);
}

export async function getReturnRefundWorkspaceData(ownerId: string, orderId: string) {
  const [order, owner] = await Promise.all([
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
        returns: {
          include: {
            items: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
          take: 1,
        },
      },
    }),
    prisma.user.findUnique({
      where: {
        id: ownerId,
      },
    }),
  ]);

  if (!order || !owner) return null;

  const companyLogoSrc = await getCompanyLogoSrc(owner.id);
  const existingReturn = order.returns[0];
  const cityState = [order.shippingCity, order.shippingState].filter(Boolean).join(", ");
  const cityStateZip = [cityState, order.shippingPostalCode].filter(Boolean).join(" ");
  const streetLine = [order.shippingLine1, order.shippingLine2].filter(Boolean).join(", ");
  const shippingAddressLines = [streetLine, cityStateZip].filter(Boolean);
  const orderItemsById = new Map(order.items.map((item) => [item.id, item]));
  const company: OrderCompany = {
    address: owner.companyAddress,
    email: owner.companyEmail ?? owner.email,
    logoSrc: companyLogoSrc,
    name: owner.companyName,
    phone: owner.companyPhone,
  };
  const values: ReturnRefundFormValues = existingReturn
    ? {
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
          restock: item.restock,
          returnQuantity: item.returnQuantity,
          sku: item.sku ?? "",
          taxable: orderItemsById.get(item.orderItemId)?.taxable ?? true,
          taxRate: Number(orderItemsById.get(item.orderItemId)?.taxRate ?? 0),
          unitPrice: Number(item.unitPrice),
        })),
        orderDate: formatDateInputValue(order.orderDate),
        orderNumber: order.orderNumber,
        originalDiscountAmount: Number(order.discountAmount),
        originalSubtotal: Number(order.subtotal),
        originalTaxAmount: Number(order.taxAmount),
        originalTotal: Number(order.total),
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
        customerEmail: order.customerEmail ?? "",
        customerName: order.customerName ?? "",
        customerNote: "Refunds may take 3-5 business days to appear depending on the payment provider.",
        customerPhone: order.customerPhone ?? "",
        internalNotes: "",
        items: order.items.map((item) => ({
          category: item.category ?? "",
          disposition: "Returned",
          id: item.id,
          inventoryItemId: item.inventoryItemId ?? undefined,
          orderItemId: item.id,
          orderedQuantity: item.quantity,
          product: item.product,
          restock: Boolean(item.inventoryItemId),
          returnQuantity: item.quantity,
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
        reason: "",
        refundAmount: 0,
        refundExplanation: "",
        refundMethod: order.paymentMethod ?? "",
        refundReference: "",
        refundStatus: "Full Refund",
        restockItems: true,
        returnDate: formatDateInputValue(new Date()),
        returnNumber: getReturnNumber(order.orderNumber),
        returnStatus: "Draft",
        shippingAddressLines,
      };

  if (values.refundStatus !== "No Refund" && values.refundStatus !== "Other") {
    values.refundStatus = getCalculatedRefundStatus(values);
    values.refundAmount = getCalculatedRefundAmount(values);
  }

  return {
    company,
    orderId,
    returnId: existingReturn?.id ?? null,
    values,
  };
}

export async function getReturnRefundDocumentData(
  ownerId: string,
  orderId: string,
): Promise<ReturnRefundDocumentData | null> {
  const data = await getReturnRefundWorkspaceData(ownerId, orderId);

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
    refundStatus: getEffectiveRefundStatus(values),
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
