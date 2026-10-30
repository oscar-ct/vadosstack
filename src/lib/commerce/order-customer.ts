export const WALK_IN_CUSTOMER_NAME = "Walk-in customer";
export type OrderCustomerMode = "customer" | "walk_in";
export type OrderDeliveryMethod = "pickup" | "delivery";

type CustomerChoice = { customerMode?: OrderCustomerMode; customerId?: string | null; customerName?: string | null };
export function isWalkInOrder(order: CustomerChoice) {
  if (order.customerMode) return order.customerMode === "walk_in";
  return !order.customerId && order.customerName?.trim().toLowerCase() === WALK_IN_CUSTOMER_NAME.toLowerCase();
}

export function hasOrderShipping(order: {
  deliveryMethod?: OrderDeliveryMethod;
  shippingLine1?: string | null;
  shippingLine2?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPostalCode?: string | null;
  shippingService?: string | null;
  trackingNumber?: string | null;
  estimatedDelivery?: unknown;
  shippingAmount?: number;
}) {
  if (order.deliveryMethod) return order.deliveryMethod === "delivery";
  return [
    order.shippingLine1,
    order.shippingLine2,
    order.shippingCity,
    order.shippingState,
    order.shippingPostalCode,
    order.shippingService,
    order.trackingNumber,
    order.estimatedDelivery,
    (order.shippingAmount ?? 0) > 0,
  ].some((value) => (typeof value === "string" ? Boolean(value.trim()) : Boolean(value)));
}

export function normalizeOrderChoices<
  T extends CustomerChoice & {
    deliveryMethod?: OrderDeliveryMethod;
    shippingAmount?: number;
    shippingLine1?: string | null;
    shippingLine2?: string | null;
    shippingCity?: string | null;
    shippingState?: string | null;
    shippingPostalCode?: string | null;
    shippingService?: string | null;
    trackingNumber?: string | null;
    estimatedDelivery?: Date | null;
  },
>(input: T): T {
  return {
    ...input,
    ...(isWalkInOrder(input) ? { customerId: null, customerName: WALK_IN_CUSTOMER_NAME } : {}),
    ...(input.deliveryMethod === "pickup"
      ? {
          shippingAmount: 0,
          shippingLine1: null,
          shippingLine2: null,
          shippingCity: null,
          shippingState: null,
          shippingPostalCode: null,
          shippingService: null,
          trackingNumber: null,
          estimatedDelivery: null,
        }
      : {}),
  };
}
