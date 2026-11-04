import type { Prisma } from "@prisma/client";

import { cents } from "./money";
import { adjustmentCreditCents } from "./order-cancellation";
import { getRecordedPaymentStatus } from "./payment-status";
import { CommerceError } from "./transaction";

export async function getOrderBalance(tx: Prisma.TransactionClient, ownerId: string, orderId: string) {
  const [order, payments, refunds, adjustments] = await Promise.all([
    tx.order.findFirstOrThrow({ where: { id: orderId, ownerId } }),
    tx.orderPayment.findMany({ where: { orderId, ownerId } }),
    tx.orderRefund.findMany({ where: { orderId, ownerId, status: "succeeded" } }),
    tx.orderAdjustment.findMany({
      where: { orderId, ownerId },
      orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const paid = payments.reduce((sum, entry) => sum + cents(entry.amount), 0);
  const refunded = refunds.reduce((sum, entry) => sum + cents(entry.amount), 0);
  const credited = adjustments.reduce(
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
  const effectiveTotal = Math.max(cents(order.total) - credited, 0);
  const due = Math.max(effectiveTotal - paid, 0);
  const creditOwed = Math.max(paid - refunded - effectiveTotal, 0);
  return {
    order,
    payments,
    refunds,
    adjustments,
    paid,
    refunded,
    credited,
    effectiveTotal,
    // Amount of recorded cash that has not already been returned. This remains
    // useful when choosing a source payment for an authorized refund.
    refundable: Math.max(paid - refunded, 0),
    creditOwed,
    due,
  };
}

export async function refreshOrderPaymentStatus(tx: Prisma.TransactionClient, ownerId: string, orderId: string) {
  const balance = await getOrderBalance(tx, ownerId, orderId);
  const paymentStatus = getRecordedPaymentStatus({ paid: balance.paid, refunded: balance.refunded, due: balance.due });
  const paymentMethod = [...new Set(balance.payments.map((entry) => entry.method))].join(", ") || null;
  const paymentReference =
    balance.payments
      .map((entry) => entry.reference)
      .filter(Boolean)
      .join(", ") || null;
  await tx.order.update({ where: { id: orderId }, data: { paymentStatus, paymentMethod, paymentReference } });
  return balance;
}

export function requireVersion(actual: number, expected: number | undefined) {
  if (expected !== actual) throw new CommerceError("This record changed since you opened it. Refresh before saving.");
}
