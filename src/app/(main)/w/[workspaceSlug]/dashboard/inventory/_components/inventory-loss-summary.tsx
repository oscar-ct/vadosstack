"use client";

import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { InventoryLoss } from "@/lib/commerce/inventory-losses";

const currency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export function InventoryLossSummary({ losses }: { losses: InventoryLoss[] }) {
  const totals = losses.reduce(
    (sum, loss) => ({
      cost: sum.cost + loss.cost,
      retail: sum.retail + loss.retail,
      units: sum.units + loss.units,
      unknown: sum.unknown + loss.unknown,
    }),
    { cost: 0, retail: 0, units: 0, unknown: 0 },
  );
  return (
    <section aria-label="Lifetime inventory losses" className="grid min-w-0 gap-3 rounded-xl border bg-muted/20 p-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Lifetime loss cost · {totals.units.toLocaleString("en-US")} units
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="-my-1 size-6" aria-label="View inventory loss breakdown">
                <Info className="size-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Lifetime inventory losses</DialogTitle>
                <DialogDescription>Damaged, lost and stolen stock across all locations.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-3">
                {(["Damage", "Lost", "Stolen"] as const).map((reason) => {
                  const loss = losses.find((entry) => entry.reason === reason);
                  return (
                    <div key={reason} className="rounded-lg bg-muted/30 p-3">
                      <h3 className="font-medium text-sm">{reason === "Damage" ? "Damaged" : reason}</h3>
                      <p className="mt-1 text-muted-foreground text-xs">
                        {(loss?.units ?? 0).toLocaleString("en-US")} units
                      </p>
                      <p className="mt-2 font-medium text-sm tabular-nums">{currency(loss?.cost ?? 0)} cost</p>
                      <p className="mt-1 text-muted-foreground text-xs tabular-nums">
                        {currency(loss?.retail ?? 0)} retail value
                      </p>
                    </div>
                  );
                })}
                <p className="text-muted-foreground text-xs sm:col-span-3">
                  Across all locations. Uses costs and prices saved when losses were recorded. Returns restocked for
                  resale are excluded.
                </p>
              </div>
              {totals.unknown > 0 ? (
                <p className="text-amber-700 text-xs dark:text-amber-400">
                  Some historical costs or retail values were not recorded. Totals include known values only.
                </p>
              ) : null}
            </DialogContent>
          </Dialog>
        </div>
        <p className="mt-1 break-words font-medium text-2xl tabular-nums">{currency(totals.cost)}</p>
      </div>
      <dl className="border-t pt-3 text-xs">
        <dt className="text-muted-foreground">Retail value lost</dt>
        <dd className="mt-1 break-words font-medium text-sm tabular-nums">{currency(totals.retail)}</dd>
      </dl>
    </section>
  );
}
