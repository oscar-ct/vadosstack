import type { Prisma } from "@prisma/client";

export type StockHistoryFilter =
  | "activity"
  | "Receive"
  | "Count"
  | "Damage"
  | "Lost"
  | "Stolen"
  | "Transfer"
  | "Location changed"
  | "Migration reconciliation";

export function parseLocationChange(notes: string | null) {
  const match = notes?.replace(/ \[[a-f0-9]{64}\]$/, "").match(/^(\S+) -> (\S+)$/);
  return match ? { from: match[1], to: match[2] } : null;
}

type Movement = {
  id: string;
  itemSnapshot: Prisma.JsonValue;
  snapshotSource: string;
  quantityChange: number;
  balanceAfter: number | null;
  reason: string;
  notes: string | null;
  createdAt: Date;
  inventoryItem: { product: string; sku: string | null; location: { name: string } | null };
};

export function formatStockHistoryEntry(movement: Movement, locations: Map<string, string>) {
  const snapshot =
    movement.itemSnapshot && typeof movement.itemSnapshot === "object" && !Array.isArray(movement.itemSnapshot)
      ? movement.itemSnapshot
      : {};
  const stringValue = (key: string) => (typeof snapshot[key] === "string" ? (snapshot[key] as string) : null);
  const savedProduct = stringValue("product");
  const labelSource = savedProduct ? (movement.snapshotSource === "event" ? "event" : "saved_order") : "current";
  const locationChange = movement.reason === "Location changed" ? parseLocationChange(movement.notes) : null;
  const resolveLocation = (id: string) =>
    id === "Unassigned" ? "Unassigned" : (locations.get(id) ?? "Former location (name unavailable)");
  return {
    id: movement.id,
    product: savedProduct ?? movement.inventoryItem.product,
    sku: savedProduct ? stringValue("sku") : movement.inventoryItem.sku,
    labelSource,
    recordedDescription: stringValue("description"),
    recordedUnit: stringValue("unit"),
    recordedCategory: stringValue("category"),
    recordedLocation:
      movement.snapshotSource === "event" && "location" in snapshot ? (stringValue("location") ?? "Unassigned") : null,
    currentLocation: movement.inventoryItem.location?.name ?? "Unassigned",
    quantityChange: movement.quantityChange,
    balanceAfter: movement.balanceAfter,
    reason: movement.reason,
    // Location IDs remain in the immutable original; only their presentation is resolved.
    locationChange: locationChange
      ? { from: resolveLocation(locationChange.from), to: resolveLocation(locationChange.to) }
      : null,
    notes: locationChange ? null : (movement.notes?.replace(/ \[[a-f0-9]{64}\]$/, "") ?? null),
    createdAt: movement.createdAt.toISOString(),
  };
}

export type StockHistoryEntry = ReturnType<typeof formatStockHistoryEntry>;
