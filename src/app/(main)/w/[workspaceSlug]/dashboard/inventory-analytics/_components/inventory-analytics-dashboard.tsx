"use client";

import type React from "react";

import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  PackageCheck,
  PackageMinus,
  PackageOpen,
  ReceiptText,
  TrendingUp,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";

import type { InventoryAnalyticsData } from "../_lib/inventory-analytics-data";

const flowConfig = {
  received: { label: "Received", color: "var(--chart-2)" },
  sold: { label: "Committed to orders", color: "var(--chart-1)" },
  returned: { label: "Restocked", color: "var(--chart-3)" },
  shrinkage: { label: "Inventory loss", color: "var(--destructive)" },
} satisfies ChartConfig;

const lossConfig = {
  units: { label: "Units", color: "var(--destructive)" },
} satisfies ChartConfig;

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  valueClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="font-normal text-muted-foreground text-sm">{label}</CardTitle>
          <span className="grid size-7 place-items-center rounded-md bg-muted">
            <Icon className="size-3.5" />
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-1">
        <p className={`font-medium text-2xl tabular-nums tracking-tight ${valueClassName ?? ""}`}>{value}</p>
        <p className="text-muted-foreground text-xs">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function InventoryAnalyticsDashboard({ data }: { data: InventoryAnalyticsData }) {
  return (
    <div className="grid gap-4">
      <section aria-labelledby="inventory-position-heading" className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="inventory-position-heading" className="font-medium text-base">
              Current inventory position
            </h2>
            <p className="text-muted-foreground text-xs">
              Live inventory cost and all-time recorded gross profit; these values are not limited by the period.
            </p>
          </div>
          <p className="text-muted-foreground text-xs">
            {data.current.activeItems.toLocaleString()} active records · {data.current.lowStock} low ·{" "}
            {data.current.outOfStock} out
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Boxes}
            label="Units on hand"
            value={data.current.totalUnits.toLocaleString()}
            detail={
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span>Retail value</span>
                <strong className="font-medium text-violet-700 tabular-nums dark:text-violet-300">
                  {formatCurrency(data.current.retailValue)}
                </strong>
              </span>
            }
          />
          <MetricCard
            icon={CircleDollarSign}
            label="Inventory cost"
            value={formatCurrency(data.current.costValue)}
            detail="Cost still tied up in available stock"
            valueClassName="text-sky-700 dark:text-sky-300"
          />
          <MetricCard
            icon={ReceiptText}
            label="Recorded gross profit"
            value={formatCurrency(data.current.recordedGrossProfit)}
            detail={
              data.current.profitHasUnknownCosts
                ? "All-time inventory profit; some historical costs are unavailable"
                : "All-time inventory sales less refunds and item cost"
            }
            valueClassName={
              data.current.recordedGrossProfit >= 0
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-red-700 dark:text-red-300"
            }
          />
          <MetricCard
            icon={TrendingUp}
            label="Net inventory position"
            value={formatCurrency(data.current.netPosition)}
            detail={
              data.current.netPosition >= 0
                ? "Recorded profit above the cost still tied up in stock"
                : `${formatCurrency(Math.abs(data.current.netPosition))} more profit needed to cover inventory cost`
            }
            valueClassName={
              data.current.netPosition >= 0
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-red-700 dark:text-red-300"
            }
          />
        </div>
      </section>

      <section aria-labelledby="inventory-activity-heading" className="grid gap-3">
        <div>
          <h2 id="inventory-activity-heading" className="font-medium text-base">
            {data.periodLabel} activity
          </h2>
          <p className="text-muted-foreground text-xs">
            Received cost is quantity received at the unit cost saved with each movement—not supplier payments.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            icon={PackageOpen}
            label="Received cost"
            value={formatCurrency(data.activity.receivedCost)}
            detail={`${data.activity.receivedUnits.toLocaleString()} units received`}
          />
          <MetricCard
            icon={PackageCheck}
            label="Committed to orders"
            value={data.activity.committedUnits.toLocaleString()}
            detail={`${formatCurrency(data.activity.committedCost)} recorded cost`}
          />
          <MetricCard
            icon={PackageOpen}
            label="Restocked"
            value={data.activity.restockedUnits.toLocaleString()}
            detail="Returned units added back"
          />
          <MetricCard
            icon={PackageMinus}
            label="Inventory loss"
            value={formatCurrency(data.activity.shrinkageCost)}
            detail={`${data.activity.shrinkageUnits.toLocaleString()} units, including return losses`}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Included return loss"
            value={formatCurrency(data.activity.returnLossCost)}
            detail={`${data.activity.returnLossUnits.toLocaleString()} returned units within total loss`}
          />
          <MetricCard
            icon={CircleDollarSign}
            label="Net unit change"
            value={(
              data.activity.receivedUnits +
              data.activity.restockedUnits -
              data.activity.committedUnits -
              data.activity.stockAdjustmentLossUnits
            ).toLocaleString()}
            detail="Inflow less order commitments and stock adjustments"
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Inventory flow</CardTitle>
            <CardDescription>
              Units received, committed to active orders, restocked, and removed during the selected period.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={flowConfig} className="h-72 w-full">
              <BarChart accessibilityLayer data={data.flow} margin={{ left: -20, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="period" axisLine={false} tickLine={false} tickMargin={8} minTickGap={20} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="received" fill="var(--color-received)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sold" fill="var(--color-sold)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="returned" fill="var(--color-returned)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="shrinkage" fill="var(--color-shrinkage)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory loss</CardTitle>
            <CardDescription>Manual adjustments plus damaged or lost return outcomes.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ChartContainer config={lossConfig} className="h-48 w-full">
              <BarChart accessibilityLayer data={data.lossByReason} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="reason" axisLine={false} tickLine={false} width={58} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="units" fill="var(--color-units)" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ChartContainer>
            <div className="grid divide-y text-sm">
              {data.lossByReason.map((row) => (
                <div key={row.reason} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                  <span className="text-muted-foreground">{row.reason}</span>
                  <span className="text-right tabular-nums">
                    <strong className="font-medium">{row.units.toLocaleString()} units</strong>
                    <span className="ml-2 text-muted-foreground">{formatCurrency(row.cost)}</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory value by product</CardTitle>
          <CardDescription>
            Top active products by current cost basis, including selected-period losses.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {data.breakdown.length ? (
            <table className="w-full min-w-200 text-sm">
              <thead className="border-b text-left text-muted-foreground text-xs">
                <tr>
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 font-medium">Category / location</th>
                  <th className="pb-3 text-right font-medium">Units</th>
                  <th className="pb-3 text-right font-medium">Cost value</th>
                  <th className="pb-3 text-right font-medium">Retail value</th>
                  <th className="pb-3 text-right font-medium">Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.breakdown.map((row) => (
                  <tr key={row.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{row.product}</p>
                      <p className="text-muted-foreground text-xs">{row.sku || "No SKU"}</p>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {row.category} · {row.location}
                    </td>
                    <td className="py-3 text-right tabular-nums">{row.units.toLocaleString()}</td>
                    <td className="py-3 text-right tabular-nums">{formatCurrency(row.costValue)}</td>
                    <td className="py-3 text-right tabular-nums">{formatCurrency(row.retailValue)}</td>
                    <td className="py-3 text-right tabular-nums">
                      {row.lossUnits.toLocaleString()} · {formatCurrency(row.lossCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-10 text-center text-muted-foreground text-sm">No inventory matches these filters.</p>
          )}
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs">
        Inventory loss includes recorded Damage, Lost, and Stolen stock movements and non-restocked damaged or lost
        returns. Historical values use the unit cost saved with each event.
      </p>
    </div>
  );
}
