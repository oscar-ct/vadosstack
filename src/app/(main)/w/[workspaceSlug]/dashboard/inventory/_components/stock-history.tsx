"use client";

import * as React from "react";

import { History, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StockHistoryEntry, StockHistoryFilter } from "@/lib/commerce/stock-history";
import { cn } from "@/lib/utils";

import { getInventoryStockHistoryAction } from "../history-actions";

const reasonLabels: Record<string, string> = {
  Receive: "Stock received",
  Count: "Stock count",
  Damage: "Damaged stock removed",
  Lost: "Lost stock removed",
  Stolen: "Stolen stock removed",
  Transfer: "Stock transferred",
  "Location changed": "Location updated",
  "Migration reconciliation": "Imported starting balance",
};

function HistoryEntry({ entry }: { entry: StockHistoryEntry }) {
  const imported = entry.reason === "Migration reconciliation";
  const locationOnly = entry.reason === "Location changed";
  const changeLabel = imported
    ? "Starting balance"
    : locationOnly
      ? "Stock unchanged"
      : entry.quantityChange === 0
        ? "No quantity change"
        : `${entry.quantityChange > 0 ? "+" : ""}${entry.quantityChange} ${Math.abs(entry.quantityChange) === 1 ? "unit" : "units"}`;
  return (
    <li className="grid min-w-0 gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h3 className="break-words font-medium text-sm">{entry.product}</h3>
          {entry.sku ? <p className="break-words text-muted-foreground text-xs">{entry.sku}</p> : null}
        </div>
        <span
          className={cn(
            "shrink-0 font-medium text-xs tabular-nums",
            !imported && !locationOnly && entry.quantityChange > 0
              ? "text-emerald-700 dark:text-emerald-400"
              : !imported && !locationOnly && entry.quantityChange < 0
                ? "text-destructive"
                : "text-muted-foreground",
          )}
        >
          {changeLabel}
        </span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-2 text-xs">
        <div className="grid gap-1">
          <p className="font-medium">{reasonLabels[entry.reason] ?? entry.reason}</p>
          <time dateTime={entry.createdAt} className="text-muted-foreground">
            {new Date(entry.createdAt).toLocaleString()}
          </time>
        </div>
        <div className="grid gap-1 sm:text-right">
          <span className="text-muted-foreground">Available afterward</span>
          <strong className="font-medium tabular-nums">{entry.balanceAfter ?? "Not recorded"}</strong>
        </div>
      </div>
      {entry.locationChange ? (
        <div className="grid gap-1 rounded-lg bg-muted/50 px-3 py-2">
          <p className="break-words text-sm">
            {entry.locationChange.from} → {entry.locationChange.to}
          </p>
          <p className="text-muted-foreground text-xs">Resolved using current location names.</p>
        </div>
      ) : entry.recordedLocation ? (
        <p className="text-muted-foreground text-xs">Recorded location: {entry.recordedLocation}</p>
      ) : null}
      {entry.notes && !imported ? (
        <p className="line-clamp-2 break-words text-muted-foreground text-xs">{entry.notes}</p>
      ) : null}
      <div className="grid gap-2">
        {entry.labelSource !== "event" ? (
          <span className="justify-self-start rounded-md bg-muted px-2 py-1 text-muted-foreground text-xs">
            {entry.labelSource === "current" ? "Current item name" : "Saved order name"}
          </span>
        ) : null}
        <details className="min-w-0 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Details</summary>
          <div className="mt-2 grid gap-2 text-muted-foreground">
            {entry.labelSource === "current" ? (
              <p>
                The original item details were not captured for this older entry. The product and SKU above identify the
                current inventory record.
              </p>
            ) : entry.labelSource === "saved_order" ? (
              <p>The item label comes from its saved order. Other event-time item details were not captured.</p>
            ) : (
              <p>The item label and location were saved when this event was recorded.</p>
            )}
            {!entry.recordedLocation && !entry.locationChange ? (
              <p>Current record location: {entry.currentLocation}. The event-time location was not recorded.</p>
            ) : null}
            {entry.recordedUnit || entry.recordedCategory || entry.recordedDescription ? (
              <dl className="grid gap-2">
                {entry.recordedUnit ? (
                  <div>
                    <dt className="font-medium text-foreground">Recorded unit</dt>
                    <dd>{entry.recordedUnit}</dd>
                  </div>
                ) : null}
                {entry.recordedCategory ? (
                  <div>
                    <dt className="font-medium text-foreground">Recorded category</dt>
                    <dd>{entry.recordedCategory}</dd>
                  </div>
                ) : null}
                {entry.recordedDescription ? (
                  <div>
                    <dt className="font-medium text-foreground">Recorded description</dt>
                    <dd className="whitespace-pre-wrap break-words">{entry.recordedDescription}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            {imported ? (
              <p>
                This entry aligned older history with stock already recorded when tracking started. It did not add or
                remove physical units.
              </p>
            ) : null}
            {entry.notes ? (
              <div>
                <p className="font-medium text-foreground">Reference or reason</p>
                <p className="mt-1 whitespace-pre-wrap break-words">{entry.notes}</p>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </li>
  );
}

export function StockHistory() {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [draftQuery, setDraftQuery] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<StockHistoryFilter>("activity");
  const [page, setPage] = React.useState(1);
  const [reload, setReload] = React.useState(0);
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getInventoryStockHistoryAction>> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry and resubmitting an unchanged search intentionally reload the server results.
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    getInventoryStockHistoryAction({ page, query, filter })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((failure) => {
        if (active) setError(failure instanceof Error ? failure.message : "Stock history could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, page, query, filter, reload]);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setData(null);
          setLoading(true);
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <History className="size-4" />
          Stock history
        </Button>
      </DialogTrigger>
      <DialogContent
        allowAutoFocus
        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[85svh] sm:max-h-[900px] sm:w-[calc(100vw-3rem)] sm:max-w-3xl sm:rounded-xl"
      >
        <DialogHeader className="shrink-0 gap-2 border-b px-5 py-4 pr-12 sm:px-6">
          <DialogTitle>Stock history</DialogTitle>
          <DialogDescription>
            Recorded changes across all inventory locations. Imported starting balances have a separate filter.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid shrink-0 gap-3 border-b px-5 py-4 sm:px-6"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(draftQuery.trim());
            setPage(1);
            setReload((value) => value + 1);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-search`}>Search history</Label>
            <div className="flex gap-2">
              <Input
                id={`${id}-search`}
                value={draftQuery}
                maxLength={200}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder="Product, SKU, or reference…"
              />
              <Button type="submit" variant="outline" aria-label="Search stock history">
                <Search className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor={`${id}-type`}>Activity</Label>
            <select
              id={`${id}-type`}
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as StockHistoryFilter);
                setPage(1);
              }}
              className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-2.5 text-sm"
            >
              <option value="activity">All activity</option>
              <option value="Receive">Stock received</option>
              <option value="Count">Stock counts</option>
              <option value="Damage">Damaged stock removed</option>
              <option value="Lost">Lost stock removed</option>
              <option value="Stolen">Stolen stock removed</option>
              <option value="Transfer">Transfers</option>
              <option value="Location changed">Location changes</option>
              <option value="Migration reconciliation">Imported starting balances</option>
            </select>
          </div>
        </form>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6" aria-busy={loading}>
          {loading ? (
            <p role="status" className="py-8 text-center text-muted-foreground text-sm">
              Loading stock history…
            </p>
          ) : error ? (
            <div role="alert" className="grid justify-items-center gap-3 py-8">
              <p className="text-destructive text-sm">{error}</p>
              <Button type="button" variant="outline" onClick={() => setReload((value) => value + 1)}>
                Retry
              </Button>
            </div>
          ) : data?.entries.length ? (
            <ul className="grid gap-3">
              {data.entries.map((entry) => (
                <HistoryEntry key={entry.id} entry={entry} />
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-muted-foreground text-sm">No stock history matches this search.</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-background px-5 py-4 sm:px-6">
          <p role="status" className="text-muted-foreground text-xs">
            {data
              ? `${data.total} ${data.total === 1 ? "entry" : "entries"} · Page ${data.page} of ${data.pageCount}`
              : "Stock history"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading || !data || data.page <= 1}
              onClick={() => {
                if (data) setPage(data.page - 1);
              }}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading || !data || data.page >= data.pageCount}
              onClick={() => {
                if (data) setPage(data.page + 1);
              }}
            >
              Next
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
