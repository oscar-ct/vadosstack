import type { InventoryItem } from "./inventory-table";

export function InventoryStockSummary({ item, compact = false }: { item: InventoryItem; compact?: boolean }) {
  const overview = item.stockOverview;
  if (!overview) return null;
  const breakdown = (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="px-2 pb-2 font-medium">Location</th>
            <th className="px-2 pb-2 text-right font-medium">Available</th>
            <th className="px-2 pb-2 text-right font-medium">Reserved</th>
          </tr>
        </thead>
        <tbody>
          {overview.locations.map((location) => (
            <tr
              key={location.location}
              className={location.location === item.location ? "bg-muted/60" : "border-b last:border-0"}
              aria-current={location.location === item.location ? "true" : undefined}
            >
              <td className="px-2 py-2.5">
                <span className="break-words">{location.location}</span>
                {location.location === item.location ? (
                  <span className="ml-2 text-muted-foreground">· Selected</span>
                ) : null}
              </td>
              <td className="px-2 py-2.5 text-right font-medium tabular-nums">{location.available}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{location.reserved}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <section aria-label="Stock across locations" className="grid gap-4 rounded-xl border bg-muted/15 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-sm">Stock across locations</h3>
        <span className="text-muted-foreground text-xs">
          This record: <strong className="font-medium text-foreground tabular-nums">{item.stock}</strong> available
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-muted-foreground text-xs">Total available</dt>
          <dd className="mt-1 font-semibold text-2xl tabular-nums">{overview.totalAvailable}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Reserved for orders</dt>
          <dd className="mt-1 font-semibold text-2xl tabular-nums">{overview.totalReserved}</dd>
        </div>
      </dl>
      {compact ? (
        <details className="border-t pt-3">
          <summary className="cursor-pointer font-medium text-xs">
            Stock by location ({overview.locations.length})
          </summary>
          <div className="mt-3">{breakdown}</div>
        </details>
      ) : (
        breakdown
      )}
      <p className="text-muted-foreground text-xs">
        Available stock excludes reservations.{" "}
        {compact ? "Stock is managed through Adjust stock." : "The selected location is highlighted."}
      </p>
      {overview.archivedAvailable > 0 ? (
        <p className="text-muted-foreground text-xs">
          Includes {overview.archivedAvailable} units in archived records, unavailable for new orders.
        </p>
      ) : null}
    </section>
  );
}
