import type { InventoryLoss } from "@/lib/commerce/inventory-losses";
import type { getInventoryOnHand } from "@/lib/commerce/inventory-on-hand";

import { InventoryLossSummary } from "./inventory-loss-summary";

const currency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export function InventoryOnHandSummary({
  data,
  losses,
}: {
  data: Awaited<ReturnType<typeof getInventoryOnHand>>;
  losses: InventoryLoss[];
}) {
  return (
    <section aria-label="Inventory on hand" className="mb-6 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
          <div>
            <p className="text-muted-foreground text-xs">Units on hand</p>
            <p className="mt-1 font-medium text-2xl tabular-nums">{data.units.toLocaleString("en-US")}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Available</dt>
              <dd className="mt-1 font-medium text-sm tabular-nums">{data.available.toLocaleString("en-US")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Reserved</dt>
              <dd className="mt-1 font-medium text-sm tabular-nums">{data.reserved.toLocaleString("en-US")}</dd>
            </div>
          </dl>
        </div>
        <div className="grid min-w-0 gap-3 rounded-xl border bg-muted/20 p-4">
          <div>
            <p className="text-muted-foreground text-xs">Inventory cost</p>
            <p className="mt-1 break-words font-medium text-2xl tabular-nums">{currency(data.cost)}</p>
          </div>
          <dl className="border-t pt-3 text-xs">
            <dt className="text-muted-foreground">Retail value</dt>
            <dd className="mt-1 break-words font-medium text-sm tabular-nums">{currency(data.retail)}</dd>
          </dl>
        </div>
        <InventoryLossSummary losses={losses} />
      </div>
    </section>
  );
}
