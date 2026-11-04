import { type Components, splitAmount } from "./allocations";
import { cents, money } from "./money";
import { CommerceError } from "./transaction";

const keys = ["merchandiseAmount", "taxAmount", "shippingAmount"] as const;
type Amount = Components["taxAmount"];
type Payment = {
  id: string;
  amount: Amount;
  merchandiseAmount: Amount | null;
  taxAmount: Amount | null;
  shippingAmount: Amount | null;
};
type Refund = {
  paymentId: string;
  amount: Amount;
  merchandiseAmount: Amount | null;
  taxAmount: Amount | null;
  shippingAmount: Amount | null;
};

export function refundablePaymentComponents(
  order: { subtotal: Amount; discountAmount: Amount; taxAmount: Amount; shippingAmount: Amount },
  payment: Payment,
  refunds: Refund[],
) {
  const source =
    payment.merchandiseAmount != null && payment.taxAmount != null && payment.shippingAmount != null
      ? payment
      : splitAmount(payment.amount, {
          merchandiseAmount: money(cents(order.subtotal) - cents(order.discountAmount)),
          taxAmount: order.taxAmount,
          shippingAmount: order.shippingAmount,
        });
  const limits = {
    merchandiseAmount: Number(source.merchandiseAmount),
    taxAmount: Number(source.taxAmount),
    shippingAmount: Number(source.shippingAmount),
  };
  const prior = refunds.filter((refund) => refund.paymentId === payment.id);
  let estimated = payment.taxAmount == null;
  for (const refund of prior) {
    const known = refund.merchandiseAmount != null && refund.taxAmount != null && refund.shippingAmount != null;
    const parts = known ? refund : splitAmount(refund.amount, limits);
    estimated ||= !known;
    for (const key of keys) limits[key] = money(Math.max(cents(limits[key]) - cents(parts[key] ?? 0), 0));
  }
  return { id: payment.id, limits, estimated };
}

/** Allocate exact component cents across original tenders without exceeding any tender. */
export function allocateRefundPayments(
  parts: Components,
  sources: Array<{ id: string; limits: Components; estimated?: boolean }>,
) {
  const remaining = Object.fromEntries(keys.map((key) => [key, cents(parts[key])])) as Record<
    (typeof keys)[number],
    number
  >;
  if (keys.some((key) => remaining[key] < 0)) throw new CommerceError("Invalid refund components.");
  const rows = sources
    .map((source) => {
      const allocated = { merchandiseAmount: 0, taxAmount: 0, shippingAmount: 0 };
      for (const key of keys) {
        const value = Math.min(remaining[key], Math.max(cents(source.limits[key]), 0));
        remaining[key] -= value;
        allocated[key] = money(value);
      }
      return {
        paymentId: source.id,
        ...allocated,
        amount: money(keys.reduce((sum, key) => sum + cents(allocated[key]), 0)),
        estimated: Boolean(source.estimated),
      };
    })
    .filter((row) => row.amount > 0);
  if (keys.some((key) => remaining[key] > 0))
    throw new CommerceError(
      "Refund exceeds the selected payments' remaining merchandise, tax, or shipping balance. Choose all original payments or review the breakdown.",
    );
  return rows;
}
