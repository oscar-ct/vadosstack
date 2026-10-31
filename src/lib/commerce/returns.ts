import type { OrderCompany } from "@/app/(main)/w/[workspaceSlug]/dashboard/orders/create/_components/data";
import { cents, money, prorate } from "@/lib/commerce/money";

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
  description?: string | null;
  unit?: string | null;
  restock: boolean;
  returnQuantity: number;
  sku: string;
  taxable: boolean;
  taxRate: number;
  unitPrice: number;
  originalDiscountAmount?: number;
  originalTaxAmount?: number;
  originalQuantity?: number;
  previouslyReturnedQuantity?: number;
};

export type ReturnRefundFormValues = {
  returnId?: string;
  submissionKey?: string;
  orderVersion?: number;
  refundState?: string;
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
  paymentId: string;
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
    description?: string | null;
    unit?: string | null;
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

function allocatedReturnAmount(item: ReturnRefundItem, value: number) {
  const originalQuantity = item.originalQuantity ?? item.orderedQuantity;
  const previous = item.previouslyReturnedQuantity ?? 0;
  const quantity = Math.max(Math.trunc(Number.isFinite(item.returnQuantity) ? item.returnQuantity : 0), 0);
  return money(
    prorate(cents(value), previous + quantity, originalQuantity) - prorate(cents(value), previous, originalQuantity),
  );
}

export function getReturnedItemsTax(values: ReturnRefundFormValues) {
  return roundMoney(
    values.items.reduce(
      (sum, item) =>
        sum +
        (item.originalTaxAmount !== undefined
          ? allocatedReturnAmount(item, item.originalTaxAmount)
          : item.taxable
            ? getLineRefund(item) * (item.taxRate / 100)
            : 0),
      0,
    ),
  );
}

export function getReturnedItemsDiscount(values: ReturnRefundFormValues) {
  return roundMoney(
    values.items.reduce(
      (sum, item) =>
        sum +
        (item.originalDiscountAmount !== undefined
          ? allocatedReturnAmount(item, item.originalDiscountAmount)
          : values.originalSubtotal > 0
            ? (getLineRefund(item) / values.originalSubtotal) * values.originalDiscountAmount
            : 0),
      0,
    ),
  );
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
  if (values.returnId) return values.refundAmount;
  if (values.refundStatus === "No Refund") return 0;

  if (values.refundStatus === "Other") {
    return Number.isFinite(values.refundAmount) ? values.refundAmount : 0;
  }

  return getCalculatedRefundAmount(values);
}

export function getEffectiveRefundStatus(values: ReturnRefundFormValues) {
  if (values.returnId) return values.refundStatus;
  if (values.refundStatus === "No Refund" || values.refundStatus === "Other") return values.refundStatus;

  return getCalculatedRefundStatus(values);
}
