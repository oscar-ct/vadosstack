"use client";

import type React from "react";

import { ArrowUpRight, DollarSign, PackageCheck, ReceiptText, RotateCcw, ShoppingBag, WalletCards } from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { cn, formatCurrency } from "@/lib/utils";

import type { CommercePulseData } from "../_lib/commerce-pulse-data";

const salesOverviewConfig = {
  grossSales: {
    label: "Gross sales",
    color: "var(--muted-foreground)",
  },
  netSales: {
    label: "Net sales",
    color: "var(--foreground)",
  },
  refunds: {
    label: "Refunds",
    color: "var(--destructive)",
  },
} satisfies ChartConfig;

type KpiMetric = {
  delta: {
    direction: "down" | "flat" | "up";
    label: string;
  };
  value: number;
};

type KpiCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  metric: KpiMetric;
  title: string;
  value: string;
};

function DeltaText({ metric }: { metric: KpiMetric }) {
  return (
    <div className="text-sm">
      <span
        className={cn(
          metric.delta.direction === "up" && "text-green-700 dark:text-green-300",
          metric.delta.direction === "down" && "text-destructive",
          metric.delta.direction === "flat" && "text-muted-foreground",
        )}
      >
        {metric.delta.label.split(" vs ")[0]}
      </span>
      {metric.delta.label.includes(" vs ") ? (
        <span className="text-muted-foreground"> vs {metric.delta.label.split(" vs ")[1]}</span>
      ) : null}
    </div>
  );
}

function KpiCard({ icon: Icon, metric, title, value }: KpiCardProps) {
  return (
    <Card className="h-full rounded-none border-0 border-border border-b ring-0 md:border-r">
      <CardHeader>
        <CardTitle className="font-normal text-sm">{title}</CardTitle>
        <CardDescription className="text-3xl text-foreground tabular-nums leading-none tracking-tight">
          {value}
        </CardDescription>
        <CardAction className="grid size-6 place-items-center rounded-sm bg-muted">
          <Icon className="size-3 text-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <DeltaText metric={metric} />
      </CardContent>
    </Card>
  );
}

function formatCurrencyTooltipValue(value: unknown) {
  return typeof value === "number" ? formatCurrency(value, { noDecimals: true }) : String(value ?? "");
}

function formatPercent(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

export function CommerceKpiStrip({ data }: { data: CommercePulseData }) {
  return (
    <div className="h-full overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 xl:col-span-12">
      <div className="grid grid-cols-1 xl:grid-cols-12">
        <div className="grid grid-cols-1 md:grid-cols-2 md:grid-rows-3 xl:col-span-5 xl:border-r">
          <KpiCard
            icon={DollarSign}
            metric={data.kpis.netSales}
            title="Net Sales"
            value={formatCurrency(data.kpis.netSales.value)}
          />
          <KpiCard
            icon={ShoppingBag}
            metric={data.kpis.grossSales}
            title="Gross Sales"
            value={formatCurrency(data.kpis.grossSales.value)}
          />
          <KpiCard
            icon={WalletCards}
            metric={data.kpis.refunds}
            title="Refunds"
            value={formatCurrency(data.kpis.refunds.value)}
          />
          <KpiCard
            icon={ReceiptText}
            metric={data.kpis.totalOrders}
            title="Total Orders"
            value={data.kpis.totalOrders.value.toLocaleString()}
          />
          <KpiCard
            icon={RotateCcw}
            metric={data.kpis.returnRate}
            title="Return Rate"
            value={formatPercent(data.kpis.returnRate.value)}
          />
          <KpiCard
            icon={PackageCheck}
            metric={data.kpis.unitsSold}
            title="Net Units Sold"
            value={data.kpis.unitsSold.value.toLocaleString()}
          />
        </div>

        <Card className="h-full rounded-none border-0 ring-0 xl:col-span-7">
          <CardHeader>
            <CardTitle className="font-normal">Sales Overview</CardTitle>
            <CardAction>
              <ArrowUpRight className="size-4" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <ChartContainer config={salesOverviewConfig} className="h-74 w-full">
              <ComposedChart
                accessibilityLayer
                data={data.salesOverview}
                margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
              >
                <CartesianGrid yAxisId="profit" vertical={false} />
                <XAxis
                  dataKey="period"
                  axisLine={false}
                  height={30}
                  interval={0}
                  minTickGap={0}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  tickMargin={8}
                />
                <YAxis yAxisId="revenue" hide />
                <YAxis yAxisId="profit" hide />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      className="w-44"
                      formatter={(value, name, item) => (
                        <>
                          <div
                            className="size-2.5 shrink-0 rounded-[2px]"
                            style={{
                              backgroundColor: item.color,
                            }}
                          />
                          <div className="flex flex-1 items-center justify-between leading-none">
                            <span className="text-muted-foreground">{String(name ?? "")}</span>
                            <span className="font-medium font-mono text-foreground tabular-nums">
                              {formatCurrencyTooltipValue(value)}
                            </span>
                          </div>
                        </>
                      )}
                    />
                  }
                  cursor={{
                    stroke: "var(--border)",
                    strokeDasharray: "4 4",
                  }}
                />
                <Bar
                  yAxisId="profit"
                  barSize={4}
                  dataKey="refunds"
                  fill="var(--color-refunds)"
                  name="Refunds"
                  opacity={0.18}
                  radius={[6, 6, 0, 0]}
                />
                <Area
                  yAxisId="revenue"
                  activeDot={{
                    fill: "var(--background)",
                    r: 4,
                    stroke: "var(--color-netSales)",
                    strokeWidth: 2,
                  }}
                  dataKey="netSales"
                  dot={false}
                  fill="none"
                  name="Net sales"
                  stroke="var(--color-netSales)"
                  strokeWidth={1.8}
                  type="linear"
                />
                <Area
                  yAxisId="revenue"
                  dataKey="grossSales"
                  dot={false}
                  fill="none"
                  name="Gross sales"
                  stroke="var(--color-grossSales)"
                  strokeDasharray="4 4"
                  strokeWidth={1.2}
                  type="linear"
                />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
