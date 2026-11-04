"use client";

import { useState } from "react";

import { useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { buildSalesWaterfall } from "@/lib/commerce/analytics-charts";

import type { getCommerceAnalytics } from "../_lib/analytics-data";

type Analytics = Awaited<ReturnType<typeof getCommerceAnalytics>>;
const currency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const compact = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
const config = {
  net: { label: "Net sales", color: "var(--primary)" },
  gross: { label: "Gross sales", color: "var(--chart-2)" },
};

export function SalesCharts({ charts, sales }: { charts: Analytics["charts"]; sales: Analytics["lifetime"] }) {
  const [showGross, setShowGross] = useState(false);
  const reduceMotion = useReducedMotion();
  const breakdown = buildSalesWaterfall(sales);
  const largestAmount = Math.max(...breakdown.map((row) => Math.abs(row.amount)), 1);
  const dateLabel = (value: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: charts.trend.unit === "year" ? undefined : "short",
      day: charts.trend.unit === "day" || charts.trend.unit === "week" ? "numeric" : undefined,
      year: charts.trend.unit === "month" || charts.trend.unit === "year" ? "2-digit" : undefined,
    }).format(new Date(`${value}T00:00:00Z`));
  return (
    <div className="mt-3 grid min-w-0 gap-4">
      <Card className="min-w-0">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <CardTitle className="font-normal">Sales over time</CardTitle>
              <CardDescription>
                {charts.trend.unit === "day"
                  ? "Daily"
                  : charts.trend.unit === "week"
                    ? "Weekly"
                    : charts.trend.unit === "month"
                      ? "Monthly"
                      : "Yearly"}{" "}
                sales · includes shipping, excludes tax
              </CardDescription>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-muted-foreground text-xs">
              <input
                type="checkbox"
                checked={showGross}
                onChange={(event) => setShowGross(event.target.checked)}
                className="size-4 accent-primary"
              />
              Compare gross sales
            </label>
          </div>
        </CardHeader>
        <CardContent className="min-w-0">
          <ChartContainer config={config} className="h-72 w-full">
            <LineChart
              accessibilityLayer
              data={charts.trend.points}
              margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickFormatter={dateLabel} minTickGap={24} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={compact} width={64} tickLine={false} axisLine={false} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Tooltip
                labelFormatter={(value) => dateLabel(String(value))}
                formatter={(value, name) => [currency(Number(value)), name === "gross" ? "Gross sales" : "Net sales"]}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--popover-foreground)",
                }}
              />
              <Line
                type="linear"
                dataKey="net"
                stroke="var(--color-net)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={!reduceMotion}
                animationDuration={250}
              />
              {showGross ? (
                <Line
                  type="linear"
                  dataKey="gross"
                  stroke="var(--color-gross)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  isAnimationActive={!reduceMotion}
                  animationDuration={250}
                />
              ) : null}
            </LineChart>
          </ChartContainer>
          <div className="mt-3 flex flex-wrap gap-4 text-muted-foreground text-xs">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="w-4 border-primary border-t-2" />
              Net sales
            </span>
            {showGross ? (
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="w-4 border-t-2 border-dashed"
                  style={{ borderColor: "var(--chart-2)" }}
                />
                Gross sales
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-muted-foreground text-xs">
            Orders use their order date; refunds reduce sales on their refund date. Empty periods show zero.
          </p>
        </CardContent>
      </Card>
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="font-normal">Top products</CardTitle>
            <CardDescription>Top five by net merchandise sales · shipping excluded</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            {charts.products.length ? (
              <>
                <ChartContainer config={config} className="h-64 w-full">
                  <BarChart
                    accessibilityLayer
                    layout="vertical"
                    data={charts.products}
                    margin={{ left: 0, right: 12, top: 8, bottom: 4 }}
                  >
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" tickFormatter={compact} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="product"
                      width={105}
                      tickLine={false}
                      axisLine={false}
                      tick={({ x, y, payload }) => (
                        <text x={x} y={y} dy="0.35em" textAnchor="end" fill="var(--muted-foreground)" fontSize={11}>
                          {String(payload.value).length > 17 ? `${String(payload.value).slice(0, 16)}…` : payload.value}
                        </text>
                      )}
                    />
                    <ReferenceLine x={0} stroke="var(--border)" />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                      content={({ active, payload }) => {
                        const row = payload?.[0]?.payload;
                        return active && row ? (
                          <div className="max-w-64 rounded-lg border bg-popover p-3 text-popover-foreground text-xs shadow-md">
                            <p className="break-words font-medium">{row.product}</p>
                            <p className="mt-2">Net merchandise sales: {currency(row.net)}</p>
                            <p className="mt-1">
                              {row.sold} sold · {row.returned} returned
                            </p>
                          </div>
                        ) : null;
                      }}
                    />
                    <Bar
                      dataKey="net"
                      fill="var(--color-net)"
                      radius={4}
                      maxBarSize={28}
                      isAnimationActive={!reduceMotion}
                      animationDuration={250}
                    />
                  </BarChart>
                </ChartContainer>
                <ul className="mt-3 grid gap-2 text-xs">
                  {charts.products.map((product) => (
                    <li key={product.key} className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words">
                        {product.product}
                        <span className="mt-0.5 block text-muted-foreground">
                          {product.sold.toLocaleString()} sold · {product.returned.toLocaleString()} returned
                        </span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">{currency(product.net)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg bg-muted/30 px-6 text-center text-muted-foreground text-sm">
                No product activity in this period.
              </div>
            )}
            <p className="mt-3 text-muted-foreground text-xs">
              Sold units are before returns. Refunds are attributed to returned items when known; other refunds are
              split proportionally. Locations of the same product are combined.
            </p>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="font-normal">Sales breakdown</CardTitle>
            <CardDescription>How merchandise and shipping become net sales</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <dl className="grid gap-5">
              {breakdown.map((row) => (
                <div key={row.label} className={row.kind === "total" ? "border-t pt-4" : undefined}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <dt className={row.kind === "total" ? "font-medium" : "text-muted-foreground"}>{row.label}</dt>
                    <dd
                      className={`shrink-0 font-medium tabular-nums ${row.kind === "deduction" ? "text-red-600 dark:text-red-400" : ""}`}
                    >
                      {currency(row.amount)}
                    </dd>
                  </div>
                  <div aria-hidden="true" className="h-2 overflow-hidden rounded-sm bg-muted">
                    <div
                      className="h-full"
                      style={{
                        width: `${(Math.abs(row.amount) / largestAmount) * 100}%`,
                        backgroundColor:
                          row.kind === "deduction"
                            ? "var(--destructive)"
                            : row.kind === "total"
                              ? "var(--primary)"
                              : "var(--chart-2)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-muted-foreground text-xs">
              Bar lengths compare amount sizes. Red marks deductions.
            </p>
            <p className="mt-3 text-muted-foreground text-xs">
              Tax and carrier expenses are excluded from sales. The final total matches the net sales card above.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
