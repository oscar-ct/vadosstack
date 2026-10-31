export type StockAdjustmentKind = "Receive" | "Count" | "Damage" | "Lost" | "Stolen" | "Transfer";

export function previewStockAdjustment(kind: StockAdjustmentKind, available: number, quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity < (kind === "Count" ? 0 : 1) || quantity > 1_000_000) {
    return {
      valid: false as const,
      error:
        kind === "Count"
          ? "Enter the final available count, from 0 to 1,000,000."
          : "Enter a whole number of units, from 1 to 1,000,000.",
    };
  }
  const change = kind === "Count" ? quantity - available : kind === "Receive" ? quantity : -quantity;
  if (available + change < 0)
    return { valid: false as const, error: `Only ${available} units are available. Reduce the quantity.` };
  return { valid: true as const, available, change, after: available + change };
}

type TransferItem = {
  id: string;
  productId: string;
  product: string;
  unit: string;
  cost: number | string | { toString(): string };
  location: string | null;
  itemStatus: string;
};

export function isMatchingTransferDestination(source: TransferItem, destination: TransferItem) {
  return (
    destination.id !== source.id &&
    destination.itemStatus === "Active" &&
    destination.location !== source.location &&
    destination.productId === source.productId &&
    destination.unit === source.unit &&
    Number(destination.cost) === Number(source.cost)
  );
}
