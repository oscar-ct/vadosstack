"use client";
import * as React from "react";

import { format } from "date-fns";
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";

import { BusinessDateTime, useBusinessTimeZone } from "@/components/business-time";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkspaceLink } from "@/components/workspace-path-provider";
import { addCalendarDays, businessDateKey, businessDayStart, formatBusinessDate } from "@/lib/business-time";
import { type StockHistoryEntry, type StockHistoryFilter, stockHistoryChangeTone } from "@/lib/commerce/stock-history";
import { cn } from "@/lib/utils";

import { getInventoryStockHistoryAction } from "../history-actions";

const reasonLabels: Record<string, string> = {
  Receive: "Stock received",
  Count: "Count corrected",
  Damage: "Damaged",
  Lost: "Lost",
  Stolen: "Stolen",
  Transfer: "Transfer",
  Return: "Returned to stock",
  "Order reserved": "Order reserved",
  "Order created": "Order reserved",
  "Order updated": "Order adjusted",
  "Order line removed": "Order item removed",
  "Order cancellation": "Cancellation released",
  "Location changed": "Location changed",
  "Migration reconciliation": "Starting balance",
};
const filterOptions: Array<[StockHistoryFilter, string]> = [
  ["activity", "All activity"],
  ["orders", "Order activity"],
  ["Return", "Returns"],
  ["Order cancellation", "Cancellations"],
  ["Receive", "Stock received"],
  ["Count", "Stock counts"],
  ["Damage", "Damage"],
  ["Lost", "Losses"],
  ["Stolen", "Theft"],
  ["Transfer", "Transfers"],
  ["Location changed", "Location changes"],
  ["Migration reconciliation", "Starting balances"],
];
function HistoryEntry({ entry }: { entry: StockHistoryEntry }) {
  const timeZone = useBusinessTimeZone();
  const imported = entry.reason === "Migration reconciliation";
  const tone = stockHistoryChangeTone(entry.reason, entry.quantityChange);
  const change =
    entry.reason === "Location changed"
      ? "Unchanged"
      : imported
        ? "Baseline"
        : entry.quantityChange === 0
          ? "0"
          : `${entry.quantityChange > 0 ? "+" : ""}${entry.quantityChange.toLocaleString()}`;
  const location = entry.locationChange
    ? `${entry.locationChange.from} → ${entry.locationChange.to}`
    : (entry.recordedLocation ?? "Location not recorded");
  return (
    <li className="min-w-0 border-b last:border-b-0">
      <details className="group">
        <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_1rem] items-start gap-x-3 gap-y-2 rounded-md px-3 py-3 transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[minmax(0,1fr)_6rem_7rem_1rem] [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <h4 className="break-words font-medium text-sm leading-5">{entry.product}</h4>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs leading-5">
              <span className="font-medium text-foreground/80">{reasonLabels[entry.reason] ?? entry.reason}</span>
              <time dateTime={entry.createdAt} title={formatBusinessDate(entry.createdAt, "PPP p", timeZone)}>
                {<BusinessDateTime value={new Date(entry.createdAt)} pattern={"p"} />}
              </time>
              <span className="break-words">{location}</span>
              {entry.order ? (
                <WorkspaceLink
                  href={`/dashboard/orders/${entry.order.id}/edit`}
                  className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline focus-visible:underline"
                >
                  {entry.order.orderNumber}
                  <ArrowUpRight className="size-3" />
                  <span className="sr-only">Open order</span>
                </WorkspaceLink>
              ) : null}
            </div>
          </div>
          <span
            className={cn(
              "pt-0.5 text-right font-medium text-sm tabular-nums",
              tone === "loss"
                ? "text-destructive"
                : tone === "increase"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : tone === "neutral"
                    ? "text-blue-700 dark:text-blue-400"
                    : tone === "correction"
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-muted-foreground",
            )}
          >
            <span className="sr-only">Change: </span>
            {change}
            <span className="ml-1 text-xs md:hidden">
              {!imported && entry.reason !== "Location changed"
                ? Math.abs(entry.quantityChange) === 1
                  ? "unit"
                  : "units"
                : ""}
            </span>
          </span>
          <span className="col-span-2 flex items-center gap-1 text-muted-foreground text-xs md:col-span-1 md:col-start-auto md:block md:pt-0.5 md:text-right md:text-sm">
            <span className="md:sr-only">Available after: </span>
            <span className="font-medium text-foreground tabular-nums">
              {entry.balanceAfter?.toLocaleString() ?? "Not recorded"}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className="col-start-3 row-start-1 mt-1 size-4 text-muted-foreground transition-transform group-open:rotate-180 md:col-start-4"
          />
          <span className="sr-only">Expand details for {entry.product}</span>
        </summary>
        <div className="mx-3 mb-3 grid gap-3 rounded-lg bg-muted/40 p-3 text-xs">
          <dl className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Recorded by</dt>
              <dd className="mt-0.5">{entry.actorName ?? (imported ? "System import" : "Not recorded")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Recorded at</dt>
              <dd className="mt-0.5">{<BusinessDateTime value={new Date(entry.createdAt)} pattern={"PPP p"} />}</dd>
            </div>
            {entry.sku ? (
              <div>
                <dt className="text-muted-foreground">SKU</dt>
                <dd className="mt-0.5 break-words">{entry.sku}</dd>
              </div>
            ) : null}
            {entry.recordedCategory ? (
              <div>
                <dt className="text-muted-foreground">Recorded category</dt>
                <dd className="mt-0.5">{entry.recordedCategory}</dd>
              </div>
            ) : null}
            {entry.recordedUnit ? (
              <div>
                <dt className="text-muted-foreground">Recorded unit</dt>
                <dd className="mt-0.5">{entry.recordedUnit}</dd>
              </div>
            ) : null}
          </dl>
          {entry.recordedDescription ? (
            <p className="whitespace-pre-wrap break-words">{entry.recordedDescription}</p>
          ) : null}
          {entry.notes ? (
            <div>
              <p className="text-muted-foreground">Reference or reason</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{entry.notes}</p>
            </div>
          ) : null}
          {imported ? (
            <p className="text-muted-foreground">
              Imported to reconcile stock already recorded when tracking started. This did not add or remove physical
              units.
            </p>
          ) : null}
          {entry.labelSource !== "event" ? (
            <p className="text-muted-foreground">
              {entry.labelSource === "current"
                ? "Original item details were not recorded. The name and SKU identify the current inventory record."
                : "The name comes from the saved order; other event-time details were not recorded."}
            </p>
          ) : null}
          {!entry.recordedLocation && !entry.locationChange ? (
            <p className="text-muted-foreground">
              Current record location: {entry.currentLocation}. Its location at the time was not recorded.
            </p>
          ) : null}
          {entry.locationChange ? (
            <p className="text-muted-foreground">Location names are resolved from current settings.</p>
          ) : null}
        </div>
      </details>
    </li>
  );
}

type DateRange = "all" | "today" | "7" | "30" | "custom";
function dateBounds(range: DateRange, from: string, to: string, timeZone: string) {
  if (range === "all") return {};
  const today = businessDateKey(new Date(), timeZone);
  const first = range === "custom" ? from : addCalendarDays(today, range === "today" ? 0 : 1 - Number(range));
  const last = range === "custom" ? to : today;
  return {
    from: first ? businessDayStart(first, timeZone).toISOString() : undefined,
    until: last ? businessDayStart(addCalendarDays(last, 1), timeZone).toISOString() : undefined,
  };
}

const selectClass = "h-9 min-w-0 w-full rounded-lg border bg-background px-2.5 text-sm";
export function StockHistory({
  open,
  onOpenChange: setOpen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const timeZone = useBusinessTimeZone();
  const id = React.useId();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [draftQuery, setDraftQuery] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<StockHistoryFilter>("activity");
  const [locationId, setLocationId] = React.useState("");
  const [range, setRange] = React.useState<DateRange>("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [pageSize, setPageSize] = React.useState<10 | 25 | 50>(10);
  const [page, setPage] = React.useState(1);
  const [reload, setReload] = React.useState(0);
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getInventoryStockHistoryAction>> | null>(null);
  const [locations, setLocations] = React.useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit retries and identical searches reload results.
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    getInventoryStockHistoryAction({
      page,
      pageSize,
      query,
      filter,
      locationId,
      ...dateBounds(range, from, to, timeZone),
    })
      .then((result) => {
        if (active) {
          setData(result);
          setLocations(result.locations);
        }
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
  }, [open, page, pageSize, query, filter, locationId, range, from, to, reload, timeZone]);
  const groups = React.useMemo(() => {
    const days = new Map<string, StockHistoryEntry[]>();
    for (const entry of data?.entries ?? []) {
      const day = businessDateKey(new Date(entry.createdAt), timeZone);
      const items = days.get(day) ?? [];
      items.push(entry);
      days.set(day, items);
    }
    return [...days.entries()];
  }, [data, timeZone]);
  const filtered = query !== "" || filter !== "activity" || locationId !== "" || range !== "all";
  function reset() {
    setDraftQuery("");
    setQuery("");
    setFilter("activity");
    setLocationId("");
    setRange("all");
    setFrom("");
    setTo("");
    setPage(1);
    setReload((value) => value + 1);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        allowAutoFocus
        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[85svh] sm:max-h-[900px] sm:w-[calc(100vw-3rem)] sm:max-w-4xl sm:rounded-xl"
      >
        <DialogHeader className="shrink-0 gap-1 border-b px-4 py-4 pr-12 sm:px-5">
          <DialogTitle>Stock history</DialogTitle>
          <DialogDescription>Track stock changes across your inventory locations.</DialogDescription>
        </DialogHeader>
        <form
          className="grid shrink-0 gap-3 border-b px-4 py-3 sm:px-5"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            if (range === "custom") {
              setFrom(String(formData.get("historyFrom") ?? ""));
              setTo(String(formData.get("historyThrough") ?? ""));
            }
            setQuery(draftQuery.trim());
            setPage(1);
            setReload((value) => value + 1);
          }}
        >
          <div className="flex gap-2">
            <Label htmlFor={`${id}-search`} className="sr-only">
              Search history
            </Label>
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
              />
              <Input
                id={`${id}-search`}
                className="pl-9"
                value={draftQuery}
                maxLength={200}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder="Search product, SKU, order, or reference…"
              />
            </div>
            <Button type="submit" variant="outline" size="sm" className="h-9">
              Search
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="grid gap-1">
              <Label htmlFor={`${id}-activity`} className="text-xs">
                Activity
              </Label>
              <select
                id={`${id}-activity`}
                value={filter}
                className={selectClass}
                onChange={(event) => {
                  setFilter(event.target.value as StockHistoryFilter);
                  setPage(1);
                }}
              >
                {filterOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`${id}-location`} className="text-xs">
                Recorded location
              </Label>
              <select
                id={`${id}-location`}
                value={locationId}
                className={selectClass}
                onChange={(event) => {
                  setLocationId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All locations</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
                <option value="unassigned">Unassigned</option>
                <option value="unknown">Not recorded</option>
              </select>
            </div>
            <div className="col-span-2 flex min-w-0 items-end gap-2 sm:col-span-1">
              <div className="grid min-w-0 flex-1 gap-1">
                <Label htmlFor={`${id}-date`} className="text-xs">
                  Date
                </Label>
                <select
                  id={`${id}-date`}
                  value={range}
                  className={selectClass}
                  onChange={(event) => {
                    setRange(event.target.value as DateRange);
                    setPage(1);
                  }}
                >
                  <option value="all">Any time</option>
                  <option value="today">Today</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="custom">Custom dates</option>
                </select>
              </div>
              {filtered ? (
                <Button variant="ghost" type="button" size="sm" className="h-9 px-2" onClick={reset}>
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
          {range === "custom" ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label className="text-xs" htmlFor={`${id}-from`}>
                  From
                </Label>
                <Input
                  id={`${id}-from`}
                  type="date"
                  name="historyFrom"
                  value={from}
                  onInput={(event) => {
                    setFrom(event.currentTarget.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs" htmlFor={`${id}-to`}>
                  Through
                </Label>
                <Input
                  id={`${id}-to`}
                  type="date"
                  name="historyThrough"
                  value={to}
                  onInput={(event) => {
                    setTo(event.currentTarget.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          ) : null}
        </form>
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 sm:px-3"
          aria-busy={loading}
        >
          {loading ? (
            <p role="status" className="py-10 text-center text-muted-foreground text-sm">
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
            <>
              <div className="sticky top-0 z-10 hidden grid-cols-[minmax(0,1fr)_6rem_7rem_1rem] gap-3 border-b bg-background px-3 py-2 text-muted-foreground text-xs md:grid">
                <span>Product & activity</span>
                <span className="text-right">Change</span>
                <span className="text-right">Available after</span>
                <span />
              </div>
              {groups.map(([day, entries]) => {
                const date = new Date(`${day}T12:00:00`);
                return (
                  <section key={day} aria-label={format(date, "PPP")}>
                    <h3 className="px-3 pt-3 pb-1 font-medium text-muted-foreground text-xs">
                      {day === businessDateKey(new Date(), timeZone)
                        ? "Today"
                        : day === addCalendarDays(businessDateKey(new Date(), timeZone), -1)
                          ? "Yesterday"
                          : format(date, "EEE, MMM d, yyyy")}
                    </h3>
                    <ul>
                      {entries.map((entry) => (
                        <HistoryEntry key={entry.id} entry={entry} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </>
          ) : (
            <div className="grid justify-items-center gap-2 px-4 py-10 text-center">
              <SlidersHorizontal className="size-5 text-muted-foreground" />
              <p className="text-sm">No stock changes found</p>
              <p className="text-muted-foreground text-xs">
                {filtered
                  ? "Try a different search or clear your filters."
                  : "Stock changes will appear here when inventory activity is recorded."}
              </p>
              {filtered ? (
                <Button type="button" variant="outline" size="sm" onClick={reset}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          )}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t bg-background px-4 py-3 sm:px-5">
          <p role="status" className="text-muted-foreground text-xs">
            {data
              ? data.total
                ? `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total}`
                : "0 entries"
              : "Stock history"}
          </p>
          <div className="flex items-center gap-2">
            <Label htmlFor={`${id}-size`} className="sr-only sm:not-sr-only sm:text-xs">
              Rows
            </Label>
            <select
              id={`${id}-size`}
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value) as 10 | 25 | 50);
                setPage(1);
              }}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-muted-foreground text-xs">
              {data?.page ?? 1} / {data?.pageCount ?? 1}
            </span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8"
              aria-label="Previous page"
              disabled={loading || !data || data.page <= 1}
              onClick={() => {
                if (data) setPage(data.page - 1);
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8"
              aria-label="Next page"
              disabled={loading || !data || data.page >= data.pageCount}
              onClick={() => {
                if (data) setPage(data.page + 1);
              }}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
