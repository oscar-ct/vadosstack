export function getPaymentDisplayMethod(payment: { method: string; provider?: string | null }) {
  if (payment.provider !== "stripe") return payment.method;
  return payment.method === "Cash App Pay" ? payment.method : "Stripe";
}

export function getPaymentDisplayReference(payment: {
  externalPaymentId?: string | null;
  provider?: string | null;
  referenceNumber?: string | null;
}) {
  const referenceNumber = payment.referenceNumber?.trim();
  if (referenceNumber) return referenceNumber;
  return payment.provider === "stripe" ? (payment.externalPaymentId?.trim() ?? null) : null;
}

export function formatPaymentReference(referenceNumber?: string | null) {
  const reference = referenceNumber?.trim();
  if (!reference || reference.length <= 6) return reference ?? null;
  return reference.slice(-6);
}
