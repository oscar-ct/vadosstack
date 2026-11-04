import { allocateCents, cents, money } from "./money";
import { CommerceError } from "./transaction";

type Value = number | string | { toString(): string };
export type Components = { merchandiseAmount: Value; taxAmount: Value; shippingAmount: Value };
export function splitAmount(amount: Value, weights: Components) {
  const parts = [weights.merchandiseAmount, weights.taxAmount, weights.shippingAmount].map((n) =>
    Math.max(0, cents(n)),
  );
  if (cents(amount) < 0 || cents(amount) > parts.reduce((a, b) => a + b, 0))
    throw new CommerceError("Amount exceeds the remaining component balance.");
  const [merchandise, tax, shipping] = allocateCents(cents(amount), parts);
  return {
    merchandiseAmount: money(merchandise),
    taxAmount: money(tax),
    shippingAmount: money(shipping),
    allocationSource: "proportional",
  };
}
export function checkComponents(amount: Value, parts: Components) {
  const values = [parts.merchandiseAmount, parts.taxAmount, parts.shippingAmount].map(cents);
  if (values.some((v) => v < 0) || values.reduce((a, b) => a + b, 0) !== cents(amount))
    throw new CommerceError("Merchandise, tax, and shipping must add up to the total amount.");
  return {
    merchandiseAmount: money(values[0]),
    taxAmount: money(values[1]),
    shippingAmount: money(values[2]),
    allocationSource: "explicit",
  };
}

export function remainingPaymentComponents(
  order: { subtotal: Value; discountAmount: Value; taxAmount: Value; shippingAmount: Value },
  payments: Array<{
    amount: Value;
    merchandiseAmount?: Value | null;
    taxAmount?: Value | null;
    shippingAmount?: Value | null;
  }>,
  refunds: Array<{
    amount: Value;
    orderReturnId?: string | null;
    merchandiseAmount?: Value | null;
    taxAmount?: Value | null;
    shippingAmount?: Value | null;
  }> = [],
  adjustments: Array<{ merchandiseAmount: Value; discountAmount: Value; taxAmount: Value; shippingAmount: Value }> = [],
) {
  const original = {
    merchandiseAmount: money(cents(order.subtotal) - cents(order.discountAmount)),
    taxAmount: Number(order.taxAmount),
    shippingAmount: Number(order.shippingAmount),
  };
  const remaining = { ...original };
  // Subtract original payment allocations before credits; legacy payments must
  // still be estimated against the original order, rather than a reduced total.
  for (const payment of payments) {
    const allocated =
      payment.taxAmount != null && payment.merchandiseAmount != null && payment.shippingAmount != null
        ? (payment as Components)
        : splitAmount(payment.amount, remaining);
    for (const key of ["merchandiseAmount", "taxAmount", "shippingAmount"] as const)
      remaining[key] = money(cents(remaining[key]) - cents(allocated[key]));
  }
  for (const adjustment of adjustments) {
    remaining.merchandiseAmount = money(
      cents(remaining.merchandiseAmount) - cents(adjustment.merchandiseAmount) + cents(adjustment.discountAmount),
    );
    remaining.taxAmount = money(cents(remaining.taxAmount) - cents(adjustment.taxAmount));
    remaining.shippingAmount = money(cents(remaining.shippingAmount) - cents(adjustment.shippingAmount));
  }
  for (const refund of refunds.filter((r) => !r.orderReturnId)) {
    const parts =
      refund.merchandiseAmount != null && refund.taxAmount != null && refund.shippingAmount != null
        ? (refund as Components)
        : splitAmount(refund.amount, original);
    for (const key of ["merchandiseAmount", "taxAmount", "shippingAmount"] as const)
      remaining[key] = money(cents(remaining[key]) + cents(parts[key]));
  }
  for (const key of ["merchandiseAmount", "taxAmount", "shippingAmount"] as const)
    remaining[key] = Math.max(remaining[key], 0);
  return remaining;
}
