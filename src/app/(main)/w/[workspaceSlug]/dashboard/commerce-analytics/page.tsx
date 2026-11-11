import { Activity } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { getWorkspaceTimeZone } from "@/lib/business-time-server";
import { cn } from "@/lib/utils";

import { InvestmentReview } from "./_components/investment-review";
import { MetricBreakdown } from "./_components/metric-breakdown";
import { SalesCharts } from "./_components/sales-charts";
import { SalesPeriodTabs } from "./_components/sales-period-tabs";
import { type AnalyticsPeriod, analyticsPeriods, getCommerceAnalytics } from "./_lib/analytics-data";
import { type SalesView, salesViews } from "./_lib/sales-periods";

const currency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const signedCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", signDisplay: "exceptZero" }).format(value);
function Metric({
  label,
  value,
  help,
  valueClassName,
  compact = false,
  mobileHelp,
}: {
  label: string;
  value: string;
  help?: string;
  valueClassName?: string;
  compact?: boolean;
  mobileHelp?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl border bg-card", compact ? "p-3 sm:p-4" : "p-4")}>
      <p className={cn("text-muted-foreground", compact ? "min-h-8 text-xs sm:min-h-0 sm:text-sm" : "text-sm")}>
        {label}
      </p>
      <p
        className={cn(
          "mt-2 break-words font-medium tabular-nums tracking-tight",
          compact ? "text-xl sm:text-2xl" : "text-2xl",
          valueClassName,
        )}
      >
        {value}
      </p>
      {help ? (
        <p className="mt-2 text-muted-foreground text-xs">
          {mobileHelp ? (
            <>
              <span className="sm:hidden">{mobileHelp}</span>
              <span className="hidden sm:inline">{help}</span>
            </>
          ) : (
            help
          )}
        </p>
      ) : null}
    </div>
  );
}
function SalesMetrics({ data }: { data: Awaited<ReturnType<typeof getCommerceAnalytics>>["lifetime"] }) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <Metric
          compact
          mobileHelp="After discounts and refunds"
          label="Net sales"
          value={currency(data.net)}
          help="Gross − discounts − merchandise and shipping refunds; excludes tax"
        />
        <Metric
          compact
          mobileHelp="Includes shipping; excludes tax"
          label="Gross sales"
          value={currency(data.gross)}
          help="Merchandise + shipping charged, before discounts and refunds; excludes tax"
        />
        <Metric
          compact
          label="Orders"
          value={data.orders.toLocaleString()}
          mobileHelp="Includes unpaid orders"
          help="Active orders, including unpaid orders"
        />
        <Metric
          compact
          mobileHelp="Includes tax and shipping"
          label="Total refunds"
          value={currency(data.refunds)}
          help="Full completed refund, including tax and shipping"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <Metric compact label="Discounts given" value={currency(data.discounts)} />
        <div className="min-w-0 rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex min-h-8 items-start justify-between gap-1 sm:min-h-0 sm:items-center sm:gap-2">
            <p className="text-muted-foreground text-xs sm:text-sm">Units sold</p>
            <MetricBreakdown
              label="Units breakdown"
              title="Units sold and returned"
              rows={[
                ["Sold", data.sold.toLocaleString()],
                ["Returned", data.returned.toLocaleString()],
              ]}
              description="Units sold are counted before returns. Returned units are confirmed physical receipts during this period; refund-only resolutions and inventory losses are excluded."
            />
          </div>
          <p className="mt-2 break-words font-medium text-xl tabular-nums tracking-tight sm:text-2xl">
            {data.sold.toLocaleString()}
          </p>
          <p className="mt-2 text-muted-foreground text-xs">
            Before returns ·{" "}
            <span className="font-medium text-foreground">{data.returned.toLocaleString()} returned</span>
          </p>
        </div>
        <div className="min-w-0 rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex min-h-8 items-start justify-between gap-1 sm:min-h-0 sm:items-center sm:gap-2">
            <p className="text-muted-foreground text-xs sm:text-sm">Net sales tax collected</p>
            <MetricBreakdown
              label="Tax breakdown"
              title="Sales tax breakdown"
              rows={[
                ["Collected", currency(data.taxCollected)],
                ["Refunded", currency(data.taxRefunded)],
              ]}
              description="Tax from payments received, less tax returned in completed refunds. Sales tax is excluded from sales and investment position."
            />
          </div>
          <p className="mt-2 break-words font-medium text-xl tabular-nums tracking-tight sm:text-2xl">
            {currency(data.netTax)}
          </p>
          <p className="mt-2 text-muted-foreground text-xs">Tax collected − tax refunded.</p>
        </div>
        <div className="min-w-0 rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex min-h-8 items-start justify-between gap-1 sm:min-h-0 sm:items-center sm:gap-2">
            <p className="text-muted-foreground text-xs sm:text-sm">Net shipping</p>
            <MetricBreakdown
              label="Shipping breakdown"
              title="Shipping breakdown"
              rows={[
                ["Charged", currency(data.shippingCharged)],
                ["Refunded", currency(data.shippingRefunded)],
                ["Carrier expenses", currency(data.shippingExpense)],
              ]}
              description="Shipping charges and refunds are already included in sales. Carrier expenses are recorded costs less credits; missing costs are not included."
            />
          </div>
          <p
            className={cn(
              "mt-2 break-words font-medium text-xl tabular-nums tracking-tight sm:text-2xl",
              data.netShipping < 0
                ? "text-red-600 dark:text-red-400"
                : data.netShipping > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : undefined,
            )}
          >
            {signedCurrency(data.netShipping)}
          </p>
          <p className="mt-2 text-muted-foreground text-xs">
            <span className="sm:hidden">After refunds and carrier costs</span>
            <span className="hidden sm:inline">After shipping refunds and recorded carrier costs.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams?: Promise<{ period?: string }> }) {
  const auth = await getPermittedDashboardAuthorization("commerce.performance.view");
  if (!auth)
    return (
      <AuthRequiredState
        title="Sign in to view Analytics"
        description="Commerce reporting is private to this workspace."
      />
    );
  const query = await searchParams;
  const requestedPeriod = query?.period;
  const salesView: SalesView =
    requestedPeriod === "lifetime" || analyticsPeriods.includes(requestedPeriod as AnalyticsPeriod)
      ? (requestedPeriod as SalesView)
      : "30";
  const data = await getCommerceAnalytics(
    auth.workspaceId,
    salesView === "lifetime" ? "30" : salesView,
    salesView,
    await getWorkspaceTimeZone(auth.workspaceId),
  );
  const selectedSales = salesView === "lifetime" ? data.lifetime : data.recent;
  const selectedSalesLabel = salesViews.find((view) => view.value === salesView)?.label ?? "30 days";
  const investmentPosition = Math.round(data.investmentPosition * 100) / 100;
  return (
    <div className="grid min-w-0 gap-7">
      <header className="grid gap-2">
        <h1 className="flex items-center gap-2 font-medium text-xl leading-none">
          <span>Analytics</span>
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Activity className="size-4" />
          </span>
        </h1>
        <p className="text-muted-foreground text-sm">Track inventory investment, sales, and returns.</p>
      </header>
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium text-lg">Lifetime investment</h2>
          <InvestmentReview entries={data.investmentEntries} canManage={can(auth.membership, "inventory.manage")} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric
            label="Total invested"
            value={data.hasOpening ? currency(data.investment) : "Opening investment required"}
            help="Starting investment + purchases + corrections"
          />
          <Metric
            label="Investment position"
            value={data.hasOpening ? signedCurrency(investmentPosition) : "Opening investment required"}
            valueClassName={
              data.hasOpening
                ? investmentPosition < 0
                  ? "text-red-600 dark:text-red-400"
                  : investmentPosition > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : undefined
                : undefined
            }
            help="Lifetime net sales − recorded shipping expenses − total invested"
          />
        </div>
      </section>

      <section className="grid gap-3">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-medium text-lg">Sales</h2>
              <p className="text-muted-foreground text-sm">Showing {selectedSalesLabel.toLowerCase()} activity.</p>
            </div>
            {selectedSales.unknownPayments || selectedSales.unknownRefunds || selectedSales.unknownReturns ? (
              <MetricBreakdown
                label="Data quality"
                triggerLabel="Data quality"
                title="About these figures"
                rows={(
                  [
                    ["Payments with estimated splits", selectedSales.unknownPayments],
                    ["Refunds with estimated splits", selectedSales.unknownRefunds],
                    ["Damaged units without confirmed receipt", selectedSales.unknownReturns],
                  ] as Array<[string, number]>
                )
                  .filter(([, count]) => count > 0)
                  .map(([label, count]) => [label, count.toLocaleString()])}
                description={[
                  selectedSales.unknownPayments || selectedSales.unknownRefunds
                    ? "Older records saved the total paid or refunded, but not its product, tax and shipping split. Those portions are estimated from the original order. The recorded total is unchanged."
                    : "",
                  selectedSales.unknownReturns
                    ? "Damaged units without a confirmed physical receipt are excluded from units returned."
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            ) : null}
          </div>
          <SalesPeriodTabs selected={salesView} />
        </div>
        <SalesMetrics data={selectedSales} />
        <SalesCharts charts={data.charts} sales={selectedSales} />
      </section>
    </div>
  );
}
