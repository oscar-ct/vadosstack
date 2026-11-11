import { decimalMoneyToMinorUnits, getNetPaymentMinorUnits } from "./domain";

type Money = { toString(): string } | string | number;

export type TaxAllocationPayment = {
  id: string;
  jobId: string;
  paidOn: Date;
  createdAt: Date;
  amount: Money;
  refundedAmount: Money;
  status: string;
};

export type TaxAllocationInvoice = {
  id: string;
  jobId: string;
  finalCost: Money;
  materialTaxAmount: Money;
};

/**
 * The current invoice supplies one tax ratio for all of its payments. Amendments
 * therefore recalculate earlier allocations, including earlier reporting years.
 * Allocate the complete payment history before filtering dates: cumulative cent
 * rounding reconciles a fully paid invoice and caps overpayments at invoice tax.
 */
export function allocatePaymentSalesTax(payments: TaxAllocationPayment[], invoices: TaxAllocationInvoice[]) {
  const result = new Map<string, number>();
  const invoiceByJob = new Map(invoices.map((invoice) => [invoice.jobId, invoice]));
  const groups = new Map<string, { paid: number; tax: number }>();
  const ordered = [...payments].sort(
    (a, b) =>
      a.paidOn.getTime() - b.paidOn.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
  for (const payment of ordered) {
    result.set(payment.id, 0);
    const invoice = invoiceByJob.get(payment.jobId);
    if (!invoice) continue;
    const total = Math.max(0, decimalMoneyToMinorUnits(invoice.finalCost.toString()));
    const tax = Math.min(total, Math.max(0, decimalMoneyToMinorUnits(invoice.materialTaxAmount.toString())));
    if (total <= 0 || tax <= 0) continue;
    const net = getNetPaymentMinorUnits({
      amount: payment.amount.toString(),
      refundedAmount: payment.refundedAmount.toString(),
      status: payment.status,
    });
    const current = groups.get(invoice.id) ?? { paid: 0, tax: 0 };
    const paid = Math.min(total, current.paid + net);
    // BigInt keeps multiplication exact even for large valid currency amounts.
    const allocated = Number((BigInt(paid) * BigInt(tax) + BigInt(Math.floor(total / 2))) / BigInt(total));
    result.set(payment.id, allocated - current.tax);
    groups.set(invoice.id, { paid, tax: allocated });
  }
  return result;
}
