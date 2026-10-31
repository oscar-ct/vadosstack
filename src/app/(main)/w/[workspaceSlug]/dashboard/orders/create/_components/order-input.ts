import { z } from "zod";

import { isWalkInOrder, normalizeOrderChoices, WALK_IN_CUSTOMER_NAME } from "@/lib/commerce/order-customer";
import { amountSchema, quantitySchema, taxRateSchema } from "@/lib/commerce/validation";

import { clampOrderFooterMessage, getOrderSubtotal, type OrderFormValues, orderNeedsShipping } from "./data";
import type { OrderStep } from "./order-steps";

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
    overrideTaxRate: order.overrideTaxRate,
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
      priceOverride: item.priceOverride,
      priceOverrideReason: item.priceOverrideReason,
      expectedCatalogUnitPrice: item.catalogUnitPrice,
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

function getCustomerValidationError(order: OrderFormValues) {
  if (!isWalkInOrder(order) && !order.customerName?.trim()) return "Customer name is required.";
  if (
    orderNeedsShipping(order) &&
    (!order.streetAddress?.trim() || !order.city?.trim() || !order.state?.trim() || !order.zip?.trim())
  ) {
    return "Shipping address is required.";
  }
  if (order.customerEmail?.trim() && !z.email().safeParse(order.customerEmail.trim()).success)
    return "Enter a valid customer email or leave it blank.";
  return null;
}

function getItemsValidationError(order: OrderFormValues) {
  if (!order.items.length) return "Add at least one item.";
  if (order.items.some((item) => item.priceOverride && !item.priceOverrideReason?.trim())) {
    return "Enter a reason for each price override.";
  }

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
    const hasQuantity = quantitySchema.safeParse(item.quantity).success;
    const hasPrice = amountSchema.safeParse(item.unitPrice).success;

    return !hasProduct || !hasQuantity || !hasPrice;
  });

  if (invalidItemIndex !== -1) {
    return `Item ${invalidItemIndex + 1} needs a product, whole-number quantity above 0, and a valid price.`;
  }

  return null;
}

function getReviewValidationError(order: OrderFormValues, creating: boolean) {
  if (!order.orderDate?.trim()) return "Order date is required.";
  if (!taxRateSchema.safeParse(order.tax).success)
    return "Enter a tax rate from 0 to 100 with at most two decimal places.";
  if (!amountSchema.safeParse(order.discount).success) return "Enter a valid discount amount.";
  if (order.discount > getOrderSubtotal(order)) return "Discount cannot exceed the merchandise subtotal.";
  if (orderNeedsShipping(order) && !amountSchema.safeParse(order.shipping).success)
    return "Enter a valid shipping amount.";
  if (creating && order.paymentStatus === "Paid" && (!order.externalPaymentConfirmed || !order.paymentMethod?.trim()))
    return "Confirm that payment was received and enter its payment method, or choose Pending.";
  return null;
}

export function getOrderStepValidationError(order: OrderFormValues, step: OrderStep, creating = false) {
  if (step === "customer") return getCustomerValidationError(order);
  if (step === "items") return getItemsValidationError(order);
  return getReviewValidationError(order, creating);
}

export function getOrderValidationError(order: OrderFormValues) {
  return getCustomerValidationError(order) ?? getItemsValidationError(order) ?? getReviewValidationError(order, false);
}
