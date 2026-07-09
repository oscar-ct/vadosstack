import { ArrowUpRight } from "lucide-react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";

import type { CommercePulseData } from "../_lib/commerce-pulse-data";

const categoryColors = ["var(--chart-3)", "var(--chart-2)", "var(--chart-1)"] as const;

export function TopProductsCard({ data }: { data: CommercePulseData["topProducts"] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Top Products</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {data.topShare}% of net sales
        </CardDescription>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div aria-label="Sales by category" className="flex h-2 gap-1 overflow-hidden bg-muted" role="img">
            {data.categories.length ? (
              data.categories.map((category, index) => (
                <div
                  aria-hidden="true"
                  key={category.name}
                  className="rounded-md"
                  style={{
                    backgroundColor: categoryColors[index] ?? "var(--muted-foreground)",
                    width: `${Math.max(category.share, 4)}%`,
                  }}
                />
              ))
            ) : (
              <div aria-hidden="true" className="w-full rounded-md bg-muted-foreground/20" />
            )}
          </div>

          <div className="flex flex-wrap gap-4">
            {data.categories.map((category, index) => (
              <div className="flex items-center gap-1" key={category.name}>
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: categoryColors[index] ?? "var(--muted-foreground)" }}
                />
                <span className="text-muted-foreground text-xs">{category.name}</span>
              </div>
            ))}
            {!data.categories.length ? (
              <span className="text-muted-foreground text-xs">No product sales yet</span>
            ) : null}
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-3">
          <div className="text-muted-foreground text-xs">Products</div>
          <div className="text-muted-foreground text-xs">Share</div>
          <div className="text-muted-foreground text-xs">Net Sales</div>

          {data.items.length ? (
            data.items.map((product) => (
              <div className="contents text-sm" key={`${product.name}-${product.category}`}>
                <div className="min-w-0">
                  <div className="truncate font-medium">{product.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {product.category} · {product.quantity.toLocaleString()} net sold
                    {product.returnedQuantity ? ` · ${product.returnedQuantity.toLocaleString()} returned` : ""}
                  </div>
                </div>
                <div className="self-center text-muted-foreground tabular-nums">{product.share}%</div>
                <div className="self-center font-medium tabular-nums">
                  {formatCurrency(product.revenue, { noDecimals: true })}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 rounded-lg border bg-muted/30 px-3 py-6 text-center text-muted-foreground text-sm">
              Product rankings will appear after orders are created.
            </div>
          )}
        </div>

        <Separator />

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-sm">Top Returned Products</span>
            <span className="text-muted-foreground text-xs">By refund value</span>
          </div>
          {data.returnedItems.length ? (
            data.returnedItems.map((product) => (
              <div
                className="flex items-center justify-between gap-3 text-sm"
                key={`${product.name}-${product.category}`}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{product.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {product.category} · {product.returnedQuantity.toLocaleString()} resolved
                  </div>
                </div>
                <div className="font-medium tabular-nums">
                  {formatCurrency(product.returnRevenue, { noDecimals: true })}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border bg-muted/30 px-3 py-4 text-center text-muted-foreground text-sm">
              Returned product trends will appear after returns are saved.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
