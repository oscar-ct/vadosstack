export const investmentAmountLimit = 1_000_000_000_000;

/** Draft values stay strings so clearing or mistyping an amount never changes financial state. */
export function validateInvestmentCorrection(amount: string, currentAmount: string, reason: string) {
  if (!amount.trim())
    return { amountError: "Enter the total amount you want to use.", reasonError: null, unchanged: false, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()))
    return {
      amountError: "Use a positive dollar amount or 0, with up to two decimal places.",
      reasonError: null,
      unchanged: false,
      value: null,
    };
  const value = Number(amount);
  if (!Number.isFinite(value) || value > investmentAmountLimit)
    return {
      amountError: "Enter an amount no greater than $1,000,000,000,000.",
      reasonError: null,
      unchanged: false,
      value: null,
    };
  const unchanged = Math.round(value * 100) === Math.round(Number(currentAmount) * 100);
  return {
    value,
    unchanged,
    amountError: null,
    reasonError: !reason.trim()
      ? "Briefly explain why you are changing this amount."
      : reason.trim().length > 1000
        ? "Keep the explanation under 1,000 characters."
        : null,
  };
}
