/** Shared by the order form and the transaction-locked update action. */
export type OrderEditPolicy = {
  financialLocked: boolean;
  addressLocked: boolean;
  deliveryDateLocked: boolean;
  reason: string | null;
};

export function getOrderEditPolicy(order: {
  orderStatus: string;
  fulfillmentStatus: string;
  payments: readonly unknown[];
  shipments: readonly unknown[];
  returns: readonly unknown[];
  adjustments: readonly unknown[];
  refunds: readonly unknown[];
  items?: readonly { shippedQuantity: number }[];
}): OrderEditPolicy {
  const cancelled = order.orderStatus !== "Active";
  const fulfillmentRecorded =
    order.shipments.length > 0 ||
    Boolean(order.items?.some((item) => item.shippedQuantity > 0)) ||
    order.fulfillmentStatus === "Fulfilled" ||
    order.fulfillmentStatus === "Partially Fulfilled";
  const reason = cancelled
    ? "This order is cancelled."
    : order.payments.length > 0
      ? "This order has recorded payments."
      : fulfillmentRecorded
        ? "This order has fulfillment history."
        : order.returns.length > 0 || order.adjustments.length > 0 || order.refunds.length > 0
          ? "This order has cancellation, return, or credit history."
          : null;
  return {
    financialLocked: reason !== null,
    addressLocked: cancelled || fulfillmentRecorded,
    deliveryDateLocked: cancelled || order.fulfillmentStatus === "Fulfilled",
    reason,
  };
}
