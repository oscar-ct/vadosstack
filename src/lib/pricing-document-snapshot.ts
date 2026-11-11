import {
  type PricingLineItem,
  parsePricingItems,
} from "@/app/(main)/w/[workspaceSlug]/dashboard/jobs/_components/pricing-items";
import { decimalMoneyToMinorUnits } from "@/lib/payments/domain";

type MoneyValue = string | number | { toString(): string };

export class InvoiceSnapshotError extends Error {}

// Older invoice records contain only a materials array. New snapshots save both
// ordered collections together in the existing JSON text column.
export function stringifyInvoiceLines<T>(laborItems: PricingLineItem[], materials: T[]) {
  return JSON.stringify({ version: 1, laborItems, materials });
}

// Invoice writers must validate the saved lines against the amount they bill.
// A legacy job can have a flat labor charge without a detailed labor list.
export function createInvoiceLineSnapshot<T>(laborItems: PricingLineItem[], materials: T[], laborCost: MoneyValue) {
  const amount = decimalMoneyToMinorUnits(laborCost.toString());
  const rows = laborItems.length ? laborItems : amount ? [{ description: "Labor", price: laborCost.toString() }] : [];
  const lineTotal = rows.reduce((total, row) => total + decimalMoneyToMinorUnits(row.price || "0"), 0);
  if (lineTotal !== amount) {
    throw new InvoiceSnapshotError(
      "The labor lines do not match the saved labor total. Review and save the job pricing before updating the invoice.",
    );
  }
  return stringifyInvoiceLines(rows, materials);
}

export function invoiceMaterialRows(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed
      : parsed?.version === 1 && Array.isArray(parsed.materials)
        ? parsed.materials
        : [];
  } catch {
    return [];
  }
}

export function invoiceLaborRows(value: string, savedLaborCost: MoneyValue): PricingLineItem[] {
  try {
    const parsed = JSON.parse(value);
    if (parsed?.version === 1 && Array.isArray(parsed.laborItems))
      return parsePricingItems(JSON.stringify(parsed.laborItems));
  } catch {
    /* Never reconstruct an issued document from mutable job data. */
  }
  return Number(savedLaborCost.toString()) === 0
    ? []
    : [{ description: "Labor (original line details not recorded)", price: savedLaborCost.toString() }];
}
