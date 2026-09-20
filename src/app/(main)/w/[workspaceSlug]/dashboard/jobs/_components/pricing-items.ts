export type PricingLineItem = {
  description: string;
  quantity?: string;
  unit?: string;
  unitPrice?: string;
  price: string;
};

export function parsePricingItems(value: string): PricingLineItem[] {
  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => ({
      description: String(item?.description ?? ""),
      quantity: item?.quantity === undefined ? undefined : String(item.quantity),
      unit: item?.unit === undefined ? undefined : String(item.unit),
      unitPrice: item?.unitPrice === undefined ? undefined : String(item.unitPrice),
      price: String(item?.price ?? ""),
    }));
  } catch {
    return [];
  }
}

export function stringifyPricingItems(items: PricingLineItem[]) {
  return JSON.stringify(
    items
      .map((item) => ({
        description: item.description.trim(),
        quantity: item.quantity?.trim() ?? "",
        unit: item.unit?.trim() ?? "",
        unitPrice: item.unitPrice?.trim() ?? "",
        price: item.price.trim(),
      }))
      .filter((item) => item.description || item.quantity || item.unit || item.unitPrice || item.price),
  );
}
