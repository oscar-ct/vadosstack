import { prorate } from "./money";

export type OrderAdjustmentAmounts = {
  merchandiseAmount: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
};

/** The amount an adjustment removes from the customer's original obligation. */
export function adjustmentCreditCents(amounts: OrderAdjustmentAmounts) {
  return amounts.merchandiseAmount - amounts.discountAmount + amounts.taxAmount + amounts.shippingAmount;
}

export function adjustmentCredit(amounts: OrderAdjustmentAmounts) {
  return (
    adjustmentCreditCents({
      merchandiseAmount: Math.round(amounts.merchandiseAmount * 100),
      discountAmount: Math.round(amounts.discountAmount * 100),
      taxAmount: Math.round(amounts.taxAmount * 100),
      shippingAmount: Math.round(amounts.shippingAmount * 100),
    }) / 100
  );
}

/**
 * Cancellation applies only to units which have not been fulfilled or otherwise
 * resolved. Legacy returns do not record whether each unit had been shipped,
 * so resolved units are treated as shipped first, matching inventory summaries.
 */
export function cancellableQuantity(input: {
  quantity: number;
  shippedQuantity: number;
  cancelledQuantity: number;
  returnedQuantity: number;
}) {
  return Math.max(
    0,
    input.quantity - input.cancelledQuantity - Math.max(input.shippedQuantity, input.returnedQuantity),
  );
}

/** Allocate a line's original cents without losing the final rounding remainder. */
export function cancellationLineAmount(input: {
  amountCents: number;
  quantity: number;
  previouslyResolved: number;
  cancelling: number;
}) {
  if (
    !Number.isSafeInteger(input.amountCents) ||
    input.amountCents < 0 ||
    !Number.isSafeInteger(input.quantity) ||
    input.quantity <= 0 ||
    !Number.isSafeInteger(input.previouslyResolved) ||
    input.previouslyResolved < 0 ||
    !Number.isSafeInteger(input.cancelling) ||
    input.cancelling < 0 ||
    input.previouslyResolved + input.cancelling > input.quantity
  )
    throw new Error("Invalid cancellation allocation.");
  return (
    prorate(input.amountCents, input.previouslyResolved + input.cancelling, input.quantity) -
    prorate(input.amountCents, input.previouslyResolved, input.quantity)
  );
}
