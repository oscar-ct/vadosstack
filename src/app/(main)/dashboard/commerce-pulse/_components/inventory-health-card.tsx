"use client";

import { ArrowUpRight, PackageCheck, PackageX, TriangleAlert } from "lucide-react";
import { Label, Pie, PieChart } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";

import type { CommercePulseData } from "../_lib/commerce-pulse-data";

const gaugeSegmentCount = 32;

const chartConfig = {
  "in-stock": {
    label: "In stock",
    color: "var(--chart-2)",
  },
  "low-stock": {
    label: "Low stock",
    color: "var(--chart-1)",
  },
  "out-of-stock": {
    label: "Out of stock",
    color: "var(--destructive)",
  },
} satisfies ChartConfig;

function buildGaugeSegments(inStock: number, lowStock: number, outOfStock: number) {
  const total = Math.max(1, inStock + lowStock + outOfStock);
  const inStockSegments = Math.round((inStock / total) * gaugeSegmentCount);
  const lowStockSegments = Math.round((lowStock / total) * gaugeSegmentCount);

  return Array.from({ length: gaugeSegmentCount }, (_, index) => {
    const status =
      index < inStockSegments ? "in-stock" : index < inStockSegments + lowStockSegments ? "low-stock" : "out-of-stock";
    return {
      fill: `var(--color-${status})`,
      id: `segment-${index + 1}`,
      status,
      value: 1,
    };
  });
}

export function InventoryHealthCard({ data }: { data: CommercePulseData["inventory"] }) {
  const gaugeSegments = buildGaugeSegments(data.inStock, data.lowStock, data.outOfStock);
  const inventorySummary = [
    {
      icon: PackageCheck,
      label: "In stock",
      value: data.inStock,
    },
    {
      icon: TriangleAlert,
      label: "Low stock",
      value: data.lowStock,
    },
    {
      icon: PackageX,
      label: "Out",
      value: data.outOfStock,
    },
  ] as const;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Inventory</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {data.availablePercent}% available
        </CardDescription>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ChartContainer config={chartConfig} className="mx-auto h-30 w-full">
          <PieChart>
            <Pie
              cx="50%"
              cy="100%"
              cornerRadius={6}
              data={gaugeSegments}
              dataKey="value"
              endAngle={0}
              innerRadius={80}
              outerRadius={110}
              paddingAngle={2}
              startAngle={180}
              stroke="var(--card)"
              strokeWidth={1}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                        <tspan
                          className="fill-foreground font-medium text-2xl tabular-nums"
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 22}
                        >
                          {data.availablePercent}%
                        </tspan>
                        <tspan className="fill-muted-foreground text-xs" x={viewBox.cx} y={(viewBox.cy || 0) + 38}>
                          Available
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        <Separator />

        <div className="grid grid-cols-3 divide-x">
          {inventorySummary.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-3 text-center">
              <div className="grid size-9 place-items-center rounded-full bg-muted">
                <item.icon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-muted-foreground text-xs leading-none">{item.label}</div>
                <div className="font-medium text-sm tabular-nums">{item.value.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Retail value</span>
            <span className="font-medium tabular-nums">{formatCurrency(data.retailValue, { noDecimals: true })}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Cost basis</span>
            <span className="font-medium tabular-nums">{formatCurrency(data.costValue, { noDecimals: true })}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Units on hand</span>
            <span className="font-medium tabular-nums">{data.totalUnits.toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
