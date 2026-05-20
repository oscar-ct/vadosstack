export type PricingLineItem = {
  description: string;
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
        price: item.price.trim(),
      }))
      .filter((item) => item.description || item.price),
  );
}
