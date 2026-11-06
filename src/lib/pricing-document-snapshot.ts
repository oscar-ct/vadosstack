import {
  type PricingLineItem,
  parsePricingItems,
} from "@/app/(main)/w/[workspaceSlug]/dashboard/jobs/_components/pricing-items";

// Older invoice records contain only a materials array. New snapshots save both
// ordered collections together in the existing JSON text column.
export function stringifyInvoiceLines<T>(laborItems: PricingLineItem[], materials: T[]) {
  return JSON.stringify({ version: 1, laborItems, materials });
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

export function invoiceLaborRows(value: string, legacyLabor: string): PricingLineItem[] {
  try {
    const parsed = JSON.parse(value);
    if (parsed?.version === 1 && Array.isArray(parsed.laborItems))
      return parsePricingItems(JSON.stringify(parsed.laborItems));
  } catch {
    /* Legacy or malformed snapshot; use the existing compatibility path. */
  }
  return parsePricingItems(legacyLabor);
}
