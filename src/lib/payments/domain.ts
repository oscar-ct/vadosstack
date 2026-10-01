export const PAYMENT_PROVIDERS = ["manual", "stripe", "paypal"] as const;
export const PAYMENT_STATUSES = [
  "created",
  "pending",
  "processing",
  "succeeded",
  "failed",
  "canceled",
  "partially_refunded",
  "refunded",
  "disputed",
] as const;
export const PAYMENT_REFUND_STATUSES = ["pending", "succeeded", "failed", "canceled"] as const;
export const PAYMENT_CONNECTION_STATUSES = ["pending", "active", "restricted", "disconnected"] as const;
export const PAYMENT_WEBHOOK_STATUSES = ["received", "processing", "processed", "failed"] as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentRefundStatus = (typeof PAYMENT_REFUND_STATUSES)[number];
export type PaymentConnectionStatus = (typeof PAYMENT_CONNECTION_STATUSES)[number];
export type PaymentWebhookStatus = (typeof PAYMENT_WEBHOOK_STATUSES)[number];

export const BALANCE_AFFECTING_PAYMENT_STATUSES = ["succeeded", "partially_refunded"] as const;

export function normalizeCurrency(value: string) {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO code.");
  return currency;
}

export function decimalMoneyToMinorUnits(value: string | number) {
  const text = String(value).trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) throw new Error("Money must have no more than two decimal places.");

  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ""] = unsigned.split(".");
  const minorUnits = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(minorUnits)) throw new Error("Money amount is too large.");
  return negative ? -minorUnits : minorUnits;
}

export function minorUnitsToDecimalMoney(value: number) {
  if (!Number.isSafeInteger(value)) throw new Error("Minor-unit amount must be a safe integer.");
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

export function getNetPaymentMinorUnits(payment: {
  amount: string | number;
  refundedAmount?: string | number | null;
  status: string;
}) {
  if (!(BALANCE_AFFECTING_PAYMENT_STATUSES as readonly string[]).includes(payment.status)) return 0;
  return Math.max(0, decimalMoneyToMinorUnits(payment.amount) - decimalMoneyToMinorUnits(payment.refundedAmount ?? 0));
}

const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  created: ["pending", "processing", "succeeded", "failed", "canceled"],
  pending: ["processing", "succeeded", "failed", "canceled"],
  processing: ["succeeded", "failed", "canceled"],
  succeeded: ["partially_refunded", "refunded", "disputed"],
  partially_refunded: ["partially_refunded", "refunded", "disputed"],
  refunded: [],
  disputed: ["succeeded", "partially_refunded", "refunded"],
  failed: [],
  canceled: [],
};

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export function canTransitionPaymentStatus(current: PaymentStatus, next: PaymentStatus) {
  return current === next || PAYMENT_STATUS_TRANSITIONS[current].includes(next);
}
