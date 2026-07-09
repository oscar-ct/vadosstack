export interface OrderLineItem {
  category: string;
  id: string;
  inventoryItemId?: string;
  product: string;
  quantity: number;
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

export type OrderPaymentStatus = "Paid" | "Pending";
export type OrderFulfillmentStatus = "Fulfilled" | "Unfulfilled";

export interface OrderFormValues {
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
  paymentStatus: "Paid",
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

export function getOrderSubtotal(order: OrderFormValues) {
  return order.items.reduce((subtotal, item) => subtotal + getLineAmount(item), 0);
}

export function getOrderTaxAmount(order: OrderFormValues) {
  const taxRate = Number.isFinite(order.tax) ? order.tax : 0;

  return getOrderSubtotal(order) * (taxRate / 100);
}

export function getOrderTotal(order: OrderFormValues) {
  const shipping = Number.isFinite(order.shipping) ? order.shipping : 0;
  const tax = getOrderTaxAmount(order);
  const discount = Number.isFinite(order.discount) ? order.discount : 0;

  return Math.max(getOrderSubtotal(order) + shipping + tax - discount, 0);
}
