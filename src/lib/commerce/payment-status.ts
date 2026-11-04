/** Payment labels require recorded money, even when credits reduce the balance to zero. */
export function getRecordedPaymentStatus({
  paid,
  refunded,
  due,
}: {
  paid: number;
  refunded: number;
  due: number;
}): "Pending" | "Paid" | "Partially Paid" | "Refunded" | "Partially Refunded" {
  if (refunded > 0 && refunded >= paid) return "Refunded";
  if (refunded > 0) return "Partially Refunded";
  if (paid > 0 && due === 0) return "Paid";
  if (paid > 0) return "Partially Paid";
  return "Pending";
}
