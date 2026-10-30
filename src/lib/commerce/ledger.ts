import type { Prisma } from "@prisma/client";

import { cents } from "./money";
import { CommerceError } from "./transaction";

export async function getOrderBalance(tx: Prisma.TransactionClient, ownerId: string, orderId: string) {
  const [order, payments, refunds] = await Promise.all([
    tx.order.findFirstOrThrow({ where: { id: orderId, ownerId } }),
    tx.orderPayment.findMany({ where: { orderId, ownerId } }),
    tx.orderRefund.findMany({ where: { orderId, ownerId, status: "succeeded" } }),
  ]);
  const paid = payments.reduce((sum, entry) => sum + cents(entry.amount), 0);
  const refunded = refunds.reduce((sum, entry) => sum + cents(entry.amount), 0);
  const unlinkedRefunds = refunds
    .filter((entry) => !entry.orderReturnId)
    .reduce((sum, entry) => sum + cents(entry.amount), 0);
  return {
    order,
    payments,
    refunds,
    paid,
    refunded,
    refundable: paid - refunded,
    due: Math.max(cents(order.total) - paid + unlinkedRefunds, 0),
  };
}

export async function refreshOrderPaymentStatus(tx: Prisma.TransactionClient, ownerId: string, orderId: string) {
  const balance = await getOrderBalance(tx, ownerId, orderId);
  const linkedRefunds = balance.refunds
    .filter((entry) => entry.orderReturnId)
    .reduce((sum, entry) => sum + cents(entry.amount), 0);
  const paymentStatus =
    balance.refunded > 0 && balance.refundable === 0
      ? "Refunded"
      : linkedRefunds > 0
        ? "Partially Refunded"
        : balance.due === 0
          ? "Paid"
          : balance.refundable > 0
            ? "Partially Paid"
            : "Pending";
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
