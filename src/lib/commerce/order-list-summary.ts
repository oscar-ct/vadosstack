import { cents, money } from "./money";
import { adjustmentCreditCents, cancellableQuantity } from "./order-cancellation";
import { getRecordedPaymentStatus } from "./payment-status";

type Amount = number | string | { toString(): string };
type ListOrder = {
  orderStatus: string;
  total: Amount;
  reservationExpiresAt: Date | null;
  payments: { amount: Amount }[];
  refunds: { amount: Amount; orderReturnId: string | null }[];
  adjustments: {
    kind: string;
    merchandiseAmount: Amount;
    discountAmount: Amount;
    taxAmount: Amount;
    shippingAmount: Amount;
  }[];
  returns: { id: string; refundAmount: Amount; refundState: string }[];
  items: {
    quantity: number;
    shippedQuantity: number;
    adjustmentItems: { quantity: number; adjustment: { kind: string } }[];
    returnItems: { orderReturnId: string; returnQuantity: number; disposition: string }[];
    physicalReturnItems: { receivedQuantity: number; receipt: { orderReturnId: string | null } }[];
  }[];
};

/** Read-only projection of all resolution and money records for an order list. */
export function getOrderListSummary(order: ListOrder, now = Date.now()) {
  const paid = order.payments.reduce((sum, payment) => sum + cents(payment.amount), 0);
  const refunded = order.refunds.reduce((sum, refund) => sum + cents(refund.amount), 0);
  const credited = order.adjustments.reduce(
    (sum, adjustment) =>
      sum +
      adjustmentCreditCents({
        merchandiseAmount: cents(adjustment.merchandiseAmount),
        discountAmount: cents(adjustment.discountAmount),
        taxAmount: cents(adjustment.taxAmount),
        shippingAmount: cents(adjustment.shippingAmount),
      }),
    0,
  );
  const effectiveTotal = Math.max(cents(order.total) - credited, 0);
  const balance = Math.max(effectiveTotal - paid, 0);
  const creditOwed = Math.max(paid - refunded - effectiveTotal, 0);
  // Older return requests may predate adjustment records. Include their remaining
  // refund obligation, subtracting actual refunds linked to each request.
  const pendingRefund = order.returns.reduce((sum, resolution) => {
    if (!["requested", "partially_refunded"].includes(resolution.refundState)) return sum;
    const completed = order.refunds
      .filter((refund) => refund.orderReturnId === resolution.id)
      .reduce((total, refund) => total + cents(refund.amount), 0);
    return sum + Math.max(cents(resolution.refundAmount) - completed, 0);
  }, 0);
  const returnCredits = order.adjustments
    .filter((entry) => entry.kind === "ReturnCredit")
    .reduce(
      (sum, entry) =>
        sum +
        adjustmentCreditCents({
          merchandiseAmount: cents(entry.merchandiseAmount),
          discountAmount: cents(entry.discountAmount),
          taxAmount: cents(entry.taxAmount),
          shippingAmount: cents(entry.shippingAmount),
        }),
      0,
    );
  // Return credits may cover the same saved refund request. Cancellation credits
  // and older return requests are distinct obligations and must both be visible.
  const overlappingCredit = Math.min(creditOwed, pendingRefund, Math.max(returnCredits, 0));
  const refundDue = Math.min(Math.max(paid - refunded, 0), creditOwed + pendingRefund - overlappingCredit);
  let orderedUnits = 0;
  let cancelledUnits = 0;
  let fulfilledUnits = 0;
  let returnedUnits = 0;
  let remainingUnits = 0;
  for (const item of order.items) {
    const cancelled = Math.min(
      item.quantity,
      item.adjustmentItems.reduce(
        (sum, entry) => sum + (entry.adjustment.kind === "Cancellation" ? entry.quantity : 0),
        0,
      ),
    );
    const resolved = item.returnItems.reduce((sum, entry) => sum + entry.returnQuantity, 0);
    const receiptReturns = new Set(item.physicalReturnItems.map((entry) => entry.receipt.orderReturnId));
    // Legacy sellable returns recorded receipt implicitly. A new physical receipt
    // takes precedence so a single return never counts twice. Refund-only, lost,
    // and unconfirmed damaged resolutions do not count as received stock.
    const legacyReceived = item.returnItems
      .filter((entry) => entry.disposition === "Returned" && !receiptReturns.has(entry.orderReturnId))
      .reduce((sum, entry) => sum + entry.returnQuantity, 0);
    orderedUnits += item.quantity;
    cancelledUnits += cancelled;
    fulfilledUnits += Math.min(item.shippedQuantity, Math.max(item.quantity - cancelled, 0));
    returnedUnits += legacyReceived + item.physicalReturnItems.reduce((sum, entry) => sum + entry.receivedQuantity, 0);
    remainingUnits += cancellableQuantity({
      quantity: item.quantity,
      shippedQuantity: item.shippedQuantity,
      cancelledQuantity: cancelled,
      returnedQuantity: resolved,
    });
  }
  const activeUnits = Math.max(orderedUnits - cancelledUnits, 0);
  const holdExpiresAt = order.reservationExpiresAt?.getTime();
  const holdState =
    order.orderStatus === "Active" &&
    remainingUnits > 0 &&
    paid === 0 &&
    fulfilledUnits === 0 &&
    holdExpiresAt != null &&
    Number.isFinite(holdExpiresAt)
      ? holdExpiresAt <= now
        ? ("expired" as const)
        : holdExpiresAt - now <= 86400000
          ? ("expiring" as const)
          : null
      : null;
  const nextAction =
    refundDue > 0
      ? ("Refund customer" as const)
      : order.orderStatus === "Cancelled"
        ? ("Cancelled" as const)
        : balance > 0
          ? ("Collect payment" as const)
          : pendingRefund > 0 && paid > 0
            ? ("Complete refund" as const)
            : remainingUnits > 0
              ? ("Fulfill items" as const)
              : ("Complete" as const);
  return {
    paymentStatus: getRecordedPaymentStatus({ paid, refunded, due: balance }),
    effectiveTotal: money(effectiveTotal),
    balance: money(balance),
    netPaid: money(paid - refunded),
    creditOwed: money(creditOwed),
    refundDue: money(refundDue),
    refunded: money(refunded),
    credited: money(credited),
    pendingRefund: money(pendingRefund),
    orderedUnits,
    activeUnits,
    cancelledUnits,
    fulfilledUnits,
    returnedUnits,
    remainingUnits,
    resolutionCount: order.returns.length,
    hasResolutions: order.returns.length > 0 || order.adjustments.length > 0,
    hasReturnActivity: order.items.some((item) => item.returnItems.length > 0 || item.physicalReturnItems.length > 0),
    reservationExpiresAt: order.reservationExpiresAt?.toISOString() ?? null,
    holdState,
    nextAction,
  };
}
export type OrderListSummary = ReturnType<typeof getOrderListSummary>;
