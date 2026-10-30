// Integer cents and basis points are shared by the editor, persistence, and returns.
export function cents(value: number | string | { toString(): string }): number {
  const number = Number(value.toString());
  if (!Number.isFinite(number) || Math.abs(number) > 1_000_000_000) throw new Error("Invalid money amount.");
  return Math.round((number + Math.sign(number) * Number.EPSILON) * 100);
}

export function money(value: number): number {
  return value / 100;
}

export function prorate(amount: number, quantity: number, originalQuantity: number): number {
  if (originalQuantity <= 0) return 0;
  return Number(
    (BigInt(amount) * BigInt(quantity) * BigInt(2) + BigInt(originalQuantity)) / (BigInt(2) * BigInt(originalQuantity)),
  );
}

// Largest-remainder allocation keeps the sum exact, even for one-cent discounts.
export function allocateCents(amount: number, weights: number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!total) return weights.map(() => 0);
  const rows = weights.map((weight, index) => {
    const numerator = BigInt(amount) * BigInt(weight);
    return { index, value: Number(numerator / BigInt(total)), remainder: numerator % BigInt(total) };
  });
  let remainder = amount - rows.reduce((sum, row) => sum + row.value, 0);
  for (const row of [...rows].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  )) {
    if (remainder-- <= 0) break;
    row.value++;
  }
  return rows.map((row) => row.value);
}

export type PricingLine = { quantity: number; unitPrice: number; taxable?: boolean; taxRate?: number };

export function calculateOrderTotals(items: PricingLine[], shipping = 0, discount = 0, defaultTaxRate = 0) {
  const gross = items.map(
    (item) =>
      cents(Number.isFinite(item.unitPrice) ? Math.max(item.unitPrice, 0) : 0) *
      (Number.isFinite(item.quantity) ? Math.max(Math.trunc(item.quantity), 0) : 0),
  );
  const subtotal = gross.reduce((sum, value) => sum + value, 0);
  const discountAmount = Math.min(Math.max(cents(Number.isFinite(discount) ? discount : 0), 0), subtotal);
  const discounts = allocateCents(discountAmount, gross);
  const lines = items.map((item, index) => {
    const rate = Number.isFinite(item.taxRate ?? defaultTaxRate) ? (item.taxRate ?? defaultTaxRate) : 0;
    const taxableCents = gross[index] - discounts[index];
    const tax =
      item.taxable === false
        ? 0
        : Number((BigInt(taxableCents) * BigInt(Math.round(rate * 100)) + BigInt(5000)) / BigInt(10000));
    return { lineTotal: money(gross[index]), discountAmount: money(discounts[index]), taxAmount: money(tax) };
  });
  const taxAmount = lines.reduce((sum, line) => sum + cents(line.taxAmount), 0);
  const shippingAmount = cents(Number.isFinite(shipping) ? shipping : 0);
  return {
    lines,
    subtotal: money(subtotal),
    discountAmount: money(discountAmount),
    taxAmount: money(taxAmount),
    shippingAmount: money(shippingAmount),
    total: money(subtotal - discountAmount + taxAmount + shippingAmount),
  };
}
