"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceLink as Link } from "@/components/workspace-path-provider";
import type { InventoryVisibility } from "@/lib/commerce/inventory-filter";

export function CommerceIndexControls({
  path,
  query,
  page,
  total,
  pageSize = 50,
  inventoryVisibility,
  showSearch = true,
}: {
  path: string;
  query: string;
  page: number;
  total: number;
  pageSize?: number;
  inventoryVisibility?: InventoryVisibility;
  showSearch?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (!showSearch && pages === 1 && !query) return null;
  const href = (number: number) => {
    const params = new URLSearchParams({ q: query, page: String(number) });
    if (inventoryVisibility) params.set("visibility", inventoryVisibility);
    return `${path}?${params}`;
  };
  return (
    <div className="mb-4 grid gap-3">
      {showSearch ? (
        <form className="flex flex-wrap items-center gap-2" method="get">
          <div className="flex min-w-0 flex-1 basis-64 gap-2">
            <Input
              key={query}
              name="q"
              aria-label="Search all records"
              placeholder="Search all records by name, number, or SKU"
              defaultValue={query}
              maxLength={200}
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="outline">
              Search all
            </Button>
          </div>
          {inventoryVisibility ? (
            <select
              key={inventoryVisibility}
              name="visibility"
              aria-label="Inventory visibility"
              defaultValue={inventoryVisibility}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm sm:w-auto"
            >
              <option value="active">Active records</option>
              <option value="archived">Archived records</option>
              <option value="all">All records</option>
            </select>
          ) : null}
        </form>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-sm">
        <p>
          {total} matching records · Page {page} of {pages}. Table filters and exports apply to this page.
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={href(page - 1)}>Previous page</Link>
            </Button>
          ) : null}
          {page < pages ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={href(page + 1)}>Next page</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
