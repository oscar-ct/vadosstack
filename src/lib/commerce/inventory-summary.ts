export type InventoryStockOverview = {
  totalAvailable: number;
  totalReserved: number;
  archivedAvailable: number;
  locations: { location: string; available: number; reserved: number; archivedAvailable: number }[];
};

type BalanceRecord = {
  productId: string;
  stock: number;
  itemStatus: string;
  locationId: string | null;
  location: { name: string } | null;
  orderItems: { quantity: number; shippedQuantity: number; returnItems: { returnQuantity: number }[] }[];
};

export function summarizeInventoryStock(records: BalanceRecord[]) {
  const products = new Map<string, InventoryStockOverview>();
  const locationMaps = new Map<string, Map<string, InventoryStockOverview["locations"][number]>>();
  for (const record of records) {
    const overview = products.get(record.productId) ?? {
      totalAvailable: 0,
      totalReserved: 0,
      archivedAvailable: 0,
      locations: [],
    };
    products.set(record.productId, overview);
    const locations = locationMaps.get(record.productId) ?? new Map();
    locationMaps.set(record.productId, locations);
    const key = record.locationId ?? "unassigned";
    let location = locations.get(key);
    if (!location) {
      location = { location: record.location?.name ?? "Unassigned", available: 0, reserved: 0, archivedAvailable: 0 };
      locations.set(key, location);
      overview.locations.push(location);
    }
    const reserved = record.orderItems.reduce((total, line) => {
      const resolved = line.returnItems.reduce((sum, entry) => sum + entry.returnQuantity, 0);
      // Returns can resolve shipped or unshipped units; count shipped units first to avoid subtracting them twice.
      return total + Math.max(0, line.quantity - Math.max(line.shippedQuantity, resolved));
    }, 0);
    const archived = record.itemStatus === "Inactive" ? record.stock : 0;
    overview.totalAvailable += record.stock;
    overview.totalReserved += reserved;
    overview.archivedAvailable += archived;
    location.available += record.stock;
    location.reserved += reserved;
    location.archivedAvailable += archived;
  }
  for (const overview of products.values()) overview.locations.sort((a, b) => a.location.localeCompare(b.location));
  return products;
}
