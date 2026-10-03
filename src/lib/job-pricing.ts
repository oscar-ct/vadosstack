export const DEFAULT_OTHER_FEES_RATE = 3.5;

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateOtherFeesAmount(subtotal: number, enabled: boolean, rate: number) {
  if (!enabled || !Number.isFinite(rate) || rate <= 0) return 0;
  return roundMoney(Math.max(0, subtotal) * (rate / 100));
}

export function calculateJobPricing(input: {
  jobType: "Residential" | "Commercial";
  laborSubtotal: number;
  materialsSubtotal: number;
  otherFeesEnabled: boolean;
  otherFeesRate: number;
  taxRate: number;
}) {
  const subtotal = input.laborSubtotal + input.materialsSubtotal;
  const taxableSubtotal = input.materialsSubtotal + (input.jobType === "Commercial" ? input.laborSubtotal : 0);
  const tax = roundMoney(taxableSubtotal * (input.taxRate / 100));
  const otherFees = calculateOtherFeesAmount(subtotal, input.otherFeesEnabled, input.otherFeesRate);

  return {
    otherFees,
    subtotal,
    tax,
    total: roundMoney(subtotal + tax + otherFees),
  };
}
