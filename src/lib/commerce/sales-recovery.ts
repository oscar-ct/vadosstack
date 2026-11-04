import { Prisma } from "@prisma/client";

/** Expenses are signed: carrier credits reduce the recorded expense. */
export function calculateNetShipping(charged: number, refunded: number, expense: number) {
  return new Prisma.Decimal(charged).minus(refunded).minus(expense).toDecimalPlaces(2).toNumber();
}

/** Reported sales include customer shipping charges, but exclude tax and carrier costs. */
export function calculateReportedSales(
  merchandiseGross: number,
  discounts: number,
  merchandiseRefunds: number,
  shippingCharged: number,
  shippingRefunded: number,
) {
  const gross = new Prisma.Decimal(merchandiseGross).plus(shippingCharged);
  return {
    gross: gross.toDecimalPlaces(2).toNumber(),
    net: gross.minus(discounts).minus(merchandiseRefunds).minus(shippingRefunded).toDecimalPlaces(2).toNumber(),
  };
}

/** Shipping revenue is already in net sales; deduct only recorded carrier expenses here. */
export function calculateInvestmentPosition(netSales: number, shippingExpense: number, investment: number) {
  return new Prisma.Decimal(netSales).minus(shippingExpense).minus(investment).toDecimalPlaces(2).toNumber();
}
