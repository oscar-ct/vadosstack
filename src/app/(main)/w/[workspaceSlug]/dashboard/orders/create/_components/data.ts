import { calculateOrderTotals } from "@/lib/commerce/money";
import type { fulfillmentStatuses, paymentStatuses } from "@/lib/commerce/validation";

export interface OrderLineItem {
  description?: string | null;
  unit?: string | null;
  category: string;
  id: string;
  inventoryItemId?: string;
  product: string;
  quantity: number;
  taxable?: boolean;
  taxRate?: number;
  sku?: string;
  unitPrice: number;
}

export interface OrderCustomerAddress {
  apartment: string;
  city: string;
  id: string;
  label: string;
  state: string;
  streetAddress: string;
  zip: string;
}

export interface OrderCustomer {
  addresses: OrderCustomerAddress[];
  email: string;
  id: string;
  name: string;
  phone: string;
}

export interface OrderCompany {
  address: string | null;
  email: string | null;
  logoSrc: string;
  name: string;
  phone: string | null;
}

export type OrderPaymentStatus = (typeof paymentStatuses)[number];
export type OrderFulfillmentStatus = (typeof fulfillmentStatuses)[number];

export interface OrderFormValues {
  expectedVersion?: number;
  externalPaymentConfirmed?: boolean;
  persistedTotals?: { signature: string; subtotal: number; taxAmount: number; total: number };
  apartment: string;
  city: string;
  customerEmail: string;
  customerName: string;
  customerNotes: string;
  customerPhone: string;
  deliveryRange: string;
  deliveryCompany: string;
  discount: number;
  footerMessage: string;
  fulfillmentStatus: OrderFulfillmentStatus;
  items: OrderLineItem[];
  orderDate: string;
  orderNumber: string;
  paymentMethod: string;
  paymentReference: string;
  paymentStatus: OrderPaymentStatus;
  shipping: number;
  state: string;
  streetAddress: string;
  tax: number;
  trackingNumber: string;
  zip: string;
}

export const defaultOrderTaxRate = 8.25;
export const defaultOrderFooterMessage =
  "Thank you for your order. We appreciate your business and will keep you updated if anything changes.";
export const orderFooterMaxLength = 180;
export const orderFooterMaxLines = 3;
export const ORDER_RECEIPT_PAPER_WIDTH = 560;
export const ORDER_RECEIPT_PAPER_HEIGHT = 980;
export const ORDER_RECEIPT_PAPER_SCALE = 1;

export function clampOrderFooterMessage(value: string) {
  const lines = value.replace(/\r\n/g, "\n").split("\n").slice(0, orderFooterMaxLines);

  return lines.join("\n").slice(0, orderFooterMaxLength);
}

export const blankOrderValues: OrderFormValues = {
  orderNumber: "",
  orderDate: "",
  deliveryRange: "",
  deliveryCompany: "",
  customerName: "",
  customerNotes: "",
  customerPhone: "",
  customerEmail: "",
  streetAddress: "",
  apartment: "",
  city: "",
  state: "",
  zip: "",
  paymentMethod: "",
  paymentReference: "",
  shipping: 0,
  tax: defaultOrderTaxRate,
  trackingNumber: "",
  discount: 0,
  paymentStatus: "Pending",
  fulfillmentStatus: "Unfulfilled",
  footerMessage: defaultOrderFooterMessage,
  items: [
    {
      id: "blank-item",
      category: "",
      product: "",
      quantity: 1,
      sku: "",
      unitPrice: 0,
    },
  ],
};

export function formatOrderNumberFromCount(count: number) {
  return `ORD-${Math.max(count, 0).toString().padStart(4, "0")}`;
}

export function getLineAmount(item?: OrderLineItem) {
  if (!item) return 0;

  const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
  const unitPrice = Number.isFinite(item.unitPrice) ? item.unitPrice : 0;

  return quantity * unitPrice;
}

export function pricingSignature(order: Pick<OrderFormValues, "items" | "shipping" | "discount">) {
  return JSON.stringify([
    order.items.map((item) => [
      item.id,
      item.inventoryItemId,
      item.quantity,
      item.unitPrice,
      item.taxable,
      item.taxRate,
    ]),
    order.shipping,
    order.discount,
  ]);
}

function totals(order: OrderFormValues) {
  if (order.persistedTotals?.signature === pricingSignature(order)) return order.persistedTotals;
  return calculateOrderTotals(order.items, order.shipping, order.discount, order.tax);
}

export function getOrderSubtotal(order: OrderFormValues) {
  return totals(order).subtotal;
}
export function getOrderTaxAmount(order: OrderFormValues) {
  return totals(order).taxAmount;
}
export function getOrderTotal(order: OrderFormValues) {
  return totals(order).total;
}
