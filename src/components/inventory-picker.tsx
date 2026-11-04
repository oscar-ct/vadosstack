"use client";

import * as React from "react";

import { Check, ChevronsUpDown, LoaderCircle, PackageSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn, formatCurrency } from "@/lib/utils";

export type InventoryPickerItem = {
  id: string;
  product: string;
  sku: string;
  category: string;
  location: string;
  stock: number;
  unitPrice: number;
};

export function InventoryPicker<T extends InventoryPickerItem>({
  id,
  items,
  selected,
  onSelect,
  disabled,
  open,
  onOpenChange,
  onCustomItem,
  unavailableReason,
  showPrice = true,
  loadItems,
}: {
  id?: string;
  items: T[];
  selected?: T;
  onSelect: (item: T) => void;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomItem?: () => void;
  unavailableReason?: (item: T) => string | undefined;
  showPrice?: boolean;
  loadItems?: (query: string, page: number) => Promise<{ items: T[]; hasMore: boolean }>;
}) {
  const mobile = useIsMobile();
  const [query, setQuery] = React.useState("");
  const [remote, setRemote] = React.useState<T[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [retry, setRetry] = React.useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry deliberately reruns the failed request.
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setPage(1);
      return;
    }
    if (!loadItems) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      void loadItems(query, page)
        .then((result) => {
          if (cancelled) return;
          setRemote((previous) => (page === 1 ? result.items : [...previous, ...result.items]));
          setHasMore(result.hasMore);
        })
        .catch(() => {
          if (!cancelled) setError("Inventory could not be loaded. Please try again.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, page, loadItems, retry]);

  const trigger = (
    <Button
      id={id}
      type="button"
      variant="outline"
      role="combobox"
      aria-label="Select inventory product"
      aria-expanded={open}
      disabled={disabled}
      className="h-auto min-h-9 w-full min-w-0 justify-between gap-2 bg-background px-2.5 py-1.5 font-normal text-base md:text-sm"
    >
      <span className="min-w-0 text-left">
        <span className={cn("block truncate", !selected && "text-muted-foreground")}>
          {selected?.product || "Select product"}
        </span>
        {selected ? (
          <span className="block truncate text-muted-foreground text-xs">
            {selected.location} · {selected.stock} available
          </span>
        ) : null}
      </span>
      <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
    </Button>
  );
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const visibleItems = loadItems
    ? remote
    : items.filter((entry) => {
        const text = `${entry.product} ${entry.sku} ${entry.category} ${entry.location}`.toLocaleLowerCase();
        return terms.every((term) => text.includes(term));
      });
  const showCustomItem = onCustomItem && terms.every((term) => "custom item".includes(term));
  const results = (
    <Command shouldFilter={false} className="min-h-0 flex-1 rounded-none!">
      <CommandInput
        aria-label="Search inventory"
        maxLength={200}
        placeholder="Search product, SKU, or location…"
        value={query}
        onValueChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        className="text-base md:text-sm"
      />
      <CommandList
        className={cn(
          "overscroll-contain",
          mobile
            ? "max-h-none min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]"
            : "max-h-[min(18rem,calc(var(--radix-popover-content-available-height)-3rem))]",
        )}
      >
        {!loading && !error ? <CommandEmpty>No inventory items found.</CommandEmpty> : null}
        <CommandGroup>
          {showCustomItem ? (
            <CommandItem value="Custom item" onSelect={onCustomItem} className="min-h-14 gap-2 py-3 md:py-2">
              <PackageSearch className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">Custom item</div>
                <div className="text-muted-foreground text-xs">One-off item, not saved in inventory</div>
              </div>
            </CommandItem>
          ) : null}
          {visibleItems.map((item) => {
            const reason = unavailableReason?.(item);
            return (
              <CommandItem
                key={item.id}
                value={item.id}
                keywords={[item.product, item.sku, item.category, item.location]}
                disabled={Boolean(reason) || Boolean(loadItems && loading)}
                onSelect={() => {
                  onSelect(item);
                  onOpenChange(false);
                }}
                className="min-h-16 items-start gap-2 py-3 md:min-h-14 md:py-2"
              >
                <PackageSearch className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words font-medium leading-snug">{item.product}</span>
                    {showPrice ? (
                      <span className="hidden shrink-0 text-xs tabular-nums md:block">
                        {formatCurrency(item.unitPrice)}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-x-1 text-muted-foreground text-xs">
                    <span className="max-w-40 truncate" title={item.sku}>
                      {item.sku || "No SKU"}
                    </span>
                    <span>· {item.location}</span>
                    <span className="hidden md:inline">· {reason ?? `${item.stock} available`}</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs md:hidden">
                    <span className={cn(reason ? "text-muted-foreground" : "text-foreground")}>
                      {reason ?? `${item.stock} available`}
                    </span>
                    {showPrice ? (
                      <span className="font-medium tabular-nums">{formatCurrency(item.unitPrice)}</span>
                    ) : null}
                  </div>
                </div>
                {selected?.id === item.id ? <Check className="mt-0.5 size-4 shrink-0" /> : null}
              </CommandItem>
            );
          })}
        </CommandGroup>
        {loading ? (
          <p role="status" className="flex items-center justify-center gap-2 p-4 text-muted-foreground text-sm">
            <LoaderCircle className="size-4 animate-spin" />
            Loading inventory…
          </p>
        ) : null}
        {error ? (
          <div role="alert" className="grid gap-2 p-3 text-sm">
            <p>{error}</p>
            <Button type="button" variant="outline" onClick={() => setRetry((value) => value + 1)}>
              Try again
            </Button>
          </div>
        ) : null}
        {loadItems && hasMore && !loading && !error ? (
          <Button type="button" variant="ghost" className="my-1 w-full" onClick={() => setPage((value) => value + 1)}>
            Load more products
          </Button>
        ) : null}
      </CommandList>
    </Command>
  );
  if (mobile)
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          className="h-[min(90dvh,48rem)]! max-h-[90dvh] gap-0 rounded-t-2xl p-0"
          onCloseAutoFocus={() => document.getElementById(id ?? "")?.focus()}
        >
          <SheetHeader className="shrink-0 border-b pr-12">
            <SheetTitle>Select product</SheetTitle>
            <SheetDescription>Choose an inventory item and location.</SheetDescription>
          </SheetHeader>
          {results}
        </SheetContent>
      </Sheet>
    );
  return (
    <Popover modal open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[var(--radix-popover-content-available-height)] w-[max(24rem,var(--radix-popover-trigger-width))] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
      >
        {results}
      </PopoverContent>
    </Popover>
  );
}
