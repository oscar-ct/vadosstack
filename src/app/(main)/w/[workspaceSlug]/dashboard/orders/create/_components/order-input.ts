import { isWalkInOrder, normalizeOrderChoices, WALK_IN_CUSTOMER_NAME } from "@/lib/commerce/order-customer";

import { clampOrderFooterMessage, type OrderFormValues, orderNeedsShipping } from "./data";

function parseOrderDate(value: string) {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function optionalString(value: string) {
  const text = value.trim();

  return text || null;
}

export function orderValuesToInput(order: OrderFormValues) {
  return normalizeOrderChoices({
    expectedVersion: order.expectedVersion,
    externalPaymentConfirmed: order.externalPaymentConfirmed,
    customerMode: isWalkInOrder(order) ? ("walk_in" as const) : ("customer" as const),
    deliveryMethod: orderNeedsShipping(order) ? ("delivery" as const) : ("pickup" as const),
    customerId: order.customerId ?? null,
    customerEmail: optionalString(order.customerEmail),
    customerName: isWalkInOrder(order) ? WALK_IN_CUSTOMER_NAME : order.customerName.trim(),
    customerNotes: optionalString(order.customerNotes),
    customerPhone: optionalString(order.customerPhone),
    discountAmount: Number.isFinite(order.discount) ? order.discount : 0,
    estimatedDelivery: order.deliveryRange ? parseOrderDate(order.deliveryRange) : null,
    footerMessage: clampOrderFooterMessage(order.footerMessage),
    fulfillmentStatus: order.fulfillmentStatus,
    items: order.items.map((item) => ({
      id: item.id,
      taxable: item.taxable,
      taxRate: item.taxRate,
      category: optionalString(item.category),
      inventoryItemId: item.inventoryItemId ?? null,
      product: item.product,
      description: item.description ?? null,
      unit: item.unit ?? null,
      quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
      sku: optionalString(item.sku ?? ""),
      unitPrice: Number.isFinite(item.unitPrice) ? item.unitPrice : 0,
    })),
    orderDate: parseOrderDate(order.orderDate),
    orderNumber: order.orderNumber,
    paymentMethod: optionalString(order.paymentMethod),
    paymentReference: optionalString(order.paymentReference),
    paymentStatus: order.paymentStatus,
    shippingAmount: Number.isFinite(order.shipping) ? order.shipping : 0,
    shippingCity: optionalString(order.city),
    shippingLine1: optionalString(order.streetAddress),
    shippingLine2: optionalString(order.apartment),
    shippingPostalCode: optionalString(order.zip),
    shippingService: optionalString(order.deliveryCompany),
    shippingState: optionalString(order.state),
    taxRate: Number.isFinite(order.tax) ? order.tax : 0,
    trackingNumber: optionalString(order.trackingNumber),
  });
}

export function getOrderValidationError(order: OrderFormValues) {
  if (!order.orderDate?.trim()) return "Order date is required.";
  if (!isWalkInOrder(order) && !order.customerName?.trim()) return "Customer name is required.";
  if (
    orderNeedsShipping(order) &&
    (!order.streetAddress?.trim() || !order.city?.trim() || !order.state?.trim() || !order.zip?.trim())
  ) {
    return "Shipping address is required.";
  }
  if (!order.items.length) return "Add at least one item.";

  const selectedInventoryItemIds = order.items
    .map((item) => item.inventoryItemId)
    .filter((inventoryItemId): inventoryItemId is string => Boolean(inventoryItemId));
  const hasDuplicateInventoryItem = selectedInventoryItemIds.some(
    (inventoryItemId, index) => selectedInventoryItemIds.indexOf(inventoryItemId) !== index,
  );

  if (hasDuplicateInventoryItem) {
    return "Inventory products can only be added once. Increase the quantity instead.";
  }

  const invalidItemIndex = order.items.findIndex((item) => {
    const hasProduct = Boolean(item.product?.trim());
    const hasQuantity = Number.isFinite(item.quantity) && item.quantity > 0;
    const hasPrice = Number.isFinite(item.unitPrice) && item.unitPrice >= 0;

    return !hasProduct || !hasQuantity || !hasPrice;
  });

  if (invalidItemIndex !== -1) {
    return `Item ${invalidItemIndex + 1} needs a product, quantity above 0, and a valid price.`;
  }

  return null;
}
