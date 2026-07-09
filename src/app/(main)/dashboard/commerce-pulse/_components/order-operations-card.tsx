import Link from "next/link";

import { ArrowUpRight, CircleDollarSign, PackageOpen, RotateCcw, ShoppingCart } from "lucide-react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import type { CommercePulseData } from "../_lib/commerce-pulse-data";

export function OrderOperationsCard({ data }: { data: CommercePulseData }) {
  const totalOrders = data.kpis.totalOrders.value;
  const fulfilledCount = Math.max(0, totalOrders - data.kpis.openFulfillment.value);
  const paidCount = Math.max(0, totalOrders - data.kpis.unpaidOrders.value);
  const fulfillmentPercent = totalOrders ? Math.round((fulfilledCount / totalOrders) * 100) : 0;
  const paidPercent = totalOrders ? Math.round((paidCount / totalOrders) * 100) : 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Order Operations</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {fulfillmentPercent}% fulfilled
        </CardDescription>
        <CardAction>
          <Link aria-label="Open orders" href="/dashboard/orders">
            <ArrowUpRight className="size-4" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3">
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <PackageOpen className="size-4" />
                Fulfillment
              </span>
              <span className="font-medium tabular-nums">
                {fulfilledCount.toLocaleString()} / {totalOrders.toLocaleString()}
              </span>
            </div>
            <Progress value={fulfillmentPercent} />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <CircleDollarSign className="size-4" />
                Paid orders
              </span>
              <span className="font-medium tabular-nums">{paidPercent}%</span>
            </div>
            <Progress value={paidPercent} />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 divide-x rounded-lg border">
          <div className="grid gap-1 p-4">
            <span className="text-muted-foreground text-xs">Open fulfillment</span>
            <span className="font-medium text-2xl tabular-nums">
              {data.kpis.openFulfillment.value.toLocaleString()}
            </span>
          </div>
          <div className="grid gap-1 p-4">
            <span className="text-muted-foreground text-xs">Unpaid orders</span>
            <span className="font-medium text-2xl tabular-nums">{data.kpis.unpaidOrders.value.toLocaleString()}</span>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-muted-foreground text-sm">
            <ShoppingCart className="size-4" />
            {data.kpis.unitsSold.value.toLocaleString()} net units sold in this window.
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-muted-foreground text-sm">
            <RotateCcw className="size-4" />
            {data.kpis.returnedUnits.value.toLocaleString()} units resolved through returns.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
