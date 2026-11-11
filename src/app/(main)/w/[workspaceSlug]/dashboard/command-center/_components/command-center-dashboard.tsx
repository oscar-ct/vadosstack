"use client";

import { type ReactNode, useId, useState } from "react";

import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { Activity, ArrowRight } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { BusinessDateTime } from "@/components/business-time";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getEmployeeAccent } from "@/lib/employee-colors";
import { cn, formatCurrency } from "@/lib/utils";

import { DashboardNavigationLink } from "../../_components/dashboard-navigation-loader";
import { MetricBreakdown } from "../../commerce-analytics/_components/metric-breakdown";

export type CommandCenterData = {
  companyName: string;
  generatedAt: string;
  permissions: { invoices: boolean; jobs: boolean; time: boolean; estimates: boolean };
  reportingPeriods: Record<
    string,
    {
      label: string;
      range: string;
      monthlyFlow: Array<{ month: string; billed: number; collected: number; receivable: number; hours: number }>;
      jobStatus: Array<{ status: string; value: number; amount: number }>;
      outstanding: number;
      overdue: number;
      overdueInvoices: number;
      taxBilled: number;
      feesBilled: number;
      labor: number;
      materials: number;
      taxCollected: number;
      uninvoicedPayments: number;
      invoices: number;
      jobs: number;
      completedJobs: number;
      residentialJobs: number;
      commercialJobs: number;
      unscheduledJobs: number;
      hours: number;
      billed: number;
      collected: number;
      payments: number;
      estimateWinRate: number;
      estimateOutcomes: Array<{
        status: string;
        count: number;
        value: number;
        share: number;
      }>;
      topCustomers: Array<{
        id: string;
        customerId: string | null;
        name: string;
        revenue: number;
        invoices: number;
        balance: number;
        share: number;
      }>;
      employeeHours: Array<{
        id: string;
        name: string;
        active: boolean;
        accentColor: string;
        hours: number;
        share: number;
      }>;
    }
  >;
};

const cashFlowConfig = {
  billed: {
    label: "Billed",
    color: "oklch(0.58 0.18 232)",
  },
  collected: {
    label: "Collected",
    color: "oklch(0.62 0.17 150)",
  },
  receivable: {
    label: "Open balance",
    color: "oklch(0.69 0.18 55)",
  },
} satisfies ChartConfig;

const cashFlowLabels: Record<string, string> = {
  billed: "Billed",
  collected: "Collected",
  receivable: "Open balance",
};

const productivityConfig = {
  hours: {
    label: "Hours",
    color: "oklch(0.62 0.2 330)",
  },
} satisfies ChartConfig;

const estimateOutcomeConfig = {
  value: {
    label: "Value",
  },
} satisfies ChartConfig;

const statusColors = [
  "oklch(0.62 0.17 150)",
  "oklch(0.58 0.18 232)",
  "oklch(0.69 0.18 55)",
  "oklch(0.62 0.2 330)",
  "oklch(0.58 0.2 275)",
  "oklch(0.52 0.14 25)",
];

const jobStatusColors: Record<string, string> = {
  Completed: "oklch(0.62 0.17 150)",
  Scheduled: "oklch(0.58 0.18 232)",
  Unscheduled: "oklch(0.58 0.03 250)",
  "On Hold": "oklch(0.69 0.18 55)",
  Cancelled: "oklch(0.58 0.22 25)",
};

const estimateOutcomeColors: Record<string, string> = {
  "Waiting on Customer": "oklch(0.58 0.18 232)",
  Won: "oklch(0.62 0.17 150)",
  Lost: "oklch(0.62 0.2 330)",
};

function formatCompactCurrency(value: number) {
  return formatCurrency(value, {
    maximumFractionDigits: value >= 1000 ? 0 : 2,
    minimumFractionDigits: 0,
  });
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="grid min-h-44 place-items-center rounded-md border border-dashed bg-muted/20 px-4 text-center text-muted-foreground text-sm">
      {label}
    </div>
  );
}

const currency = (value: number) => formatCurrency(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function KpiCard({
  label,
  value,
  detail,
  valueClassName,
  valueDetail,
  children,
  info,
}: {
  label: string;
  value: string;
  detail: string;
  valueClassName?: string;
  valueDetail?: string;
  children?: ReactNode;
  info?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-3 sm:p-4">
      <div className="flex min-h-8 items-start justify-between gap-1 sm:min-h-0 sm:items-center">
        <p className="text-muted-foreground text-xs sm:text-sm">{label}</p>
        {info}
      </div>
      <p className={cn("mt-2 break-words font-medium text-xl tabular-nums tracking-tight sm:text-2xl", valueClassName)}>
        {value}
        {valueDetail ? (
          <span className="ml-2 inline-block text-muted-foreground text-xs tracking-normal">{valueDetail}</span>
        ) : null}
      </p>
      <p className="mt-2 text-muted-foreground text-xs">{detail}</p>
      {children}
    </div>
  );
}

function ShareBar({ color, label, value }: { color: string; label: string; value: number }) {
  const safeValue = Math.min(100, Math.max(0, value));

  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
    >
      <div className="h-full rounded-full" style={{ backgroundColor: color, width: `${safeValue}%` }} />
    </div>
  );
}

export function CommandCenterDashboard({
  data,
  initialPeriod = "ytd",
}: {
  data: CommandCenterData;
  initialPeriod?: string;
}) {
  const [period, setPeriod] = useState(data.reportingPeriods[initialPeriod] ? initialPeriod : "ytd");
  const groupId = useId();
  const reduceMotion = useReducedMotion();
  const reportingPeriod = data.reportingPeriods[period];
  const billedAdjustments =
    Math.round(
      (reportingPeriod.billed -
        reportingPeriod.labor -
        reportingPeriod.materials -
        reportingPeriod.taxBilled -
        reportingPeriod.feesBilled) *
        100,
    ) / 100;
  const topEmployees = reportingPeriod.employeeHours.slice(0, 5);
  const otherEmployees = reportingPeriod.employeeHours.slice(5);
  const employeeHourRows: Array<[string, string, string?]> = topEmployees.map((employee) => [
    employee.name + (employee.active ? "" : " (inactive)"),
    `${employee.hours.toLocaleString(undefined, { maximumFractionDigits: 2 })} h`,
    employee.id,
  ]);
  if (otherEmployees.length)
    employeeHourRows.push([
      `Others (${otherEmployees.length})`,
      `${otherEmployees.reduce((sum, employee) => sum + employee.hours, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} h`,
      "others",
    ]);
  employeeHourRows.push([
    "Total",
    `${reportingPeriod.hours.toLocaleString(undefined, { maximumFractionDigits: 2 })} h`,
    "total",
  ]);
  const cashFlowData = reportingPeriod.monthlyFlow;
  const laborTrendData = reportingPeriod.monthlyFlow;
  const years = Object.keys(data.reportingPeriods)
    .filter((key) => /^\d{4}$/.test(key))
    .sort()
    .reverse();
  function changePeriod(value: string) {
    setPeriod(value);
    const url = new URL(window.location.href);
    url.searchParams.set("period", value);
    window.history.replaceState(null, "", url.toString());
  }
  const hasRevenueData = cashFlowData.some((point) => point.billed || point.collected || point.receivable);
  const generatedAt = <BusinessDateTime value={data.generatedAt} pattern="MMM d, h:mm a" />;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 p-4 md:p-0">
      <section className="grid gap-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-medium text-xl">Performance</h1>
            <span className="grid size-8 place-items-center rounded-lg bg-muted">
              <Activity className="size-4 text-muted-foreground" />
            </span>
          </div>
          <p className="mt-1 text-muted-foreground text-sm">Invoices, collections, jobs, and employee hours.</p>
        </div>
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <LayoutGroup id={groupId}>
              <fieldset
                aria-label="Reporting period"
                className="isolate grid w-full max-w-lg grid-cols-4 gap-1 rounded-xl bg-muted p-1 sm:w-auto sm:min-w-96"
              >
                {[
                  ["ytd", "YTD"],
                  ["6", "6 months"],
                  ["12", "12 months"],
                  ["all", "All time"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={period === key}
                    onClick={() => changePeriod(key)}
                    className={cn(
                      "relative min-h-9 rounded-lg px-2 py-2 font-medium text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
                      period === key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {period === key && (
                      <motion.span
                        initial={false}
                        layoutId={reduceMotion ? undefined : "performance-period"}
                        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                        className="pointer-events-none absolute inset-0 -z-10 rounded-lg bg-primary shadow-sm"
                      />
                    )}
                    {label}
                  </button>
                ))}
              </fieldset>
            </LayoutGroup>
            <Select value={/^\d{4}$/.test(period) ? period : ""} onValueChange={changePeriod}>
              <SelectTrigger aria-label="Calendar year" className="h-9 min-w-32">
                <SelectValue placeholder="Calendar year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p aria-live="polite" className="text-center text-muted-foreground text-xs">
            {reportingPeriod.label} · {reportingPeriod.range}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
          {data.permissions.invoices && (
            <>
              <KpiCard
                label="Total billed"
                value={currency(reportingPeriod.billed)}
                detail="Invoices issued in this period; includes tax and fees."
                info={
                  <MetricBreakdown
                    label="Total billed breakdown"
                    title="Total billed"
                    rows={[
                      ["Labor", currency(reportingPeriod.labor)],
                      ["Materials", currency(reportingPeriod.materials)],
                      ["Sales tax billed", currency(reportingPeriod.taxBilled)],
                      ["Other fees", currency(reportingPeriod.feesBilled)],
                      ...(billedAdjustments
                        ? [["Unreconciled difference", currency(billedAdjustments)] as [string, string]]
                        : []),
                      ["Total billed", currency(reportingPeriod.billed)],
                    ]}
                    description="Invoices issued in this period, including unpaid invoices. Tax billed differs from tax collected. An unreconciled difference means saved invoice totals do not match their recorded components."
                  />
                }
              />
              <KpiCard
                label="Collected"
                value={currency(reportingPeriod.collected)}
                detail="Invoice payments received in this period."
                valueClassName={reportingPeriod.collected > 0 ? "text-emerald-600 dark:text-emerald-400" : undefined}
                info={
                  <MetricBreakdown
                    label="Collection details"
                    title="Payments received"
                    rows={[
                      ["Invoice payments", String(reportingPeriod.payments)],
                      ["Sales tax collected", currency(reportingPeriod.taxCollected)],
                      ["Uninvoiced deposits", currency(reportingPeriod.uninvoicedPayments)],
                    ]}
                    description="Includes applied deposits using their original payment date; excludes uninvoiced deposits. Sales tax is allocated proportionally using the current invoice total and tax. Invoice edits can update tax allocations in earlier periods. Processing fees do not reduce collections."
                  />
                }
              >
                <p className="mt-2 text-muted-foreground text-xs">
                  Includes <span className="font-medium text-foreground">{currency(reportingPeriod.taxCollected)}</span>{" "}
                  sales tax.
                </p>
              </KpiCard>
              <KpiCard
                label="Outstanding"
                value={currency(reportingPeriod.outstanding)}
                detail="Balance today on invoices issued in this period."
                valueClassName={reportingPeriod.outstanding > 0 ? "text-red-600 dark:text-red-400" : undefined}
              />
              <KpiCard
                label="Invoices"
                value={reportingPeriod.invoices.toLocaleString()}
                detail="Issued during this period."
                info={
                  <MetricBreakdown
                    label="Invoice details"
                    title="Invoices"
                    rows={[
                      ["Issued", reportingPeriod.invoices.toLocaleString()],
                      ["Overdue", reportingPeriod.overdueInvoices.toLocaleString()],
                      ["Overdue balance", currency(reportingPeriod.overdue)],
                      [
                        "Average invoice",
                        currency(reportingPeriod.invoices ? reportingPeriod.billed / reportingPeriod.invoices : 0),
                      ],
                    ]}
                    description="Overdue is the past-due portion of Outstanding, using each invoice's saved due date. Due today is not overdue. Average invoice includes tax and fees."
                  />
                }
              >
                <p
                  className={cn(
                    "mt-2 text-xs",
                    reportingPeriod.overdueInvoices > 0
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-muted-foreground",
                  )}
                >
                  {reportingPeriod.overdueInvoices.toLocaleString()} overdue
                </p>
              </KpiCard>
            </>
          )}
          {data.permissions.jobs && (
            <KpiCard
              label="Jobs"
              value={reportingPeriod.jobs.toLocaleString()}
              valueDetail={`${reportingPeriod.completedJobs.toLocaleString()} completed`}
              detail="By scheduled start date."
              info={
                <MetricBreakdown
                  label="Job count details"
                  title="Job dates and types"
                  rows={[
                    ["Completed", String(reportingPeriod.completedJobs)],
                    ["Residential", String(reportingPeriod.residentialJobs)],
                    ["Commercial", String(reportingPeriod.commercialJobs)],
                    [
                      period === "all" ? "Unscheduled included" : "Unscheduled excluded",
                      String(reportingPeriod.unscheduledJobs),
                    ],
                  ]}
                  description="Each job is counted once by scheduled start date, including cancelled jobs. Completed counts jobs in this group whose current status is Completed, regardless of when they were finished. Unscheduled jobs appear only in All time."
                />
              }
            >
              <p className="mt-3 text-muted-foreground text-xs">
                {reportingPeriod.residentialJobs} residential · {reportingPeriod.commercialJobs} commercial
              </p>
            </KpiCard>
          )}
          {data.permissions.time && (
            <KpiCard
              label="Employee hours"
              value={`${reportingPeriod.hours.toLocaleString(undefined, { maximumFractionDigits: 2 })} h`}
              detail="Logged hours by date worked."
              info={
                <MetricBreakdown
                  label="Employee hours breakdown"
                  title="Employee hours"
                  rows={employeeHourRows}
                  description={
                    reportingPeriod.employeeHours.length
                      ? "Top five employees by hours in this reporting period. Additional employees are grouped under Others. Includes inactive employees; the full list is available below."
                      : "No employee hours were logged during this reporting period."
                  }
                />
              }
            />
          )}
        </div>
        <p className="text-right text-muted-foreground text-xs">Updated {generatedAt}</p>
      </section>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle>Cash flow</CardTitle>
          <CardDescription>Invoice issue dates and payment dates within the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          {hasRevenueData ? (
            <ChartContainer config={cashFlowConfig} className="h-64 w-full sm:h-80">
              <AreaChart data={cashFlowData} margin={{ left: 0, right: 12, top: 16, bottom: 0 }}>
                <defs>
                  <linearGradient id="billedFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-billed)" stopOpacity={0.26} />
                    <stop offset="95%" stopColor="var(--color-billed)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="collectedFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-collected)" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="var(--color-collected)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis
                  width={68}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => `$${Number(value) / 1000}k`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, item) => (
                        <div className="flex min-w-36 items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <span
                              className="size-2.5 shrink-0 rounded-sm"
                              style={{ backgroundColor: item.color }}
                              aria-hidden="true"
                            />
                            {cashFlowLabels[String(name)] ?? name}
                          </span>
                          <span className="font-medium font-mono tabular-nums">
                            {formatCompactCurrency(Number(value))}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Area
                  dataKey="billed"
                  type="monotone"
                  fill="url(#billedFill)"
                  stroke="var(--color-billed)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="collected"
                  type="monotone"
                  fill="url(#collectedFill)"
                  stroke="var(--color-collected)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="receivable"
                  type="monotone"
                  fill="transparent"
                  stroke="var(--color-receivable)"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <EmptyState label="Create invoices to light up the cash-flow trend." />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 min-[1200px]:grid-cols-12">
        <Card className="min-w-0 shadow-xs min-[1200px]:col-span-5">
          <CardHeader className="max-sm:has-data-[slot=card-action]:grid-cols-1">
            <CardTitle>Estimate decisions</CardTitle>
            <CardDescription>
              Current waiting pipeline plus decisions recorded during the selected period.
            </CardDescription>
            <CardAction className="flex items-center gap-1 max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-3 max-sm:mt-2 max-sm:justify-self-start">
              <Badge variant="outline" className="rounded-md">
                {reportingPeriod.estimateWinRate}% of decided value won
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-4">
            {reportingPeriod.estimateOutcomes.some((item) => item.count > 0) ? (
              <>
                <ChartContainer config={estimateOutcomeConfig} className="mx-auto aspect-square h-52 max-w-52">
                  <PieChart>
                    <Pie
                      data={reportingPeriod.estimateOutcomes}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      nameKey="status"
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {reportingPeriod.estimateOutcomes.map((item) => (
                        <Cell key={item.status} fill={estimateOutcomeColors[item.status] ?? statusColors[0]} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, _name, item) => (
                            <div className="grid min-w-40 gap-1">
                              <span className="font-medium">{item.payload.status}</span>
                              <span className="text-muted-foreground text-xs">
                                {item.payload.count.toLocaleString()} estimates · {formatCompactCurrency(Number(value))}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                  </PieChart>
                </ChartContainer>
                <div className="grid min-w-0 gap-3">
                  {reportingPeriod.estimateOutcomes.map((item) => (
                    <div key={item.status} className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: estimateOutcomeColors[item.status] ?? statusColors[0] }}
                          />
                          <span className="truncate font-medium">{item.status}</span>
                          {item.status === "Waiting on Customer" && (
                            <Badge variant="secondary" className="h-5 shrink-0 rounded-md px-1.5 text-[10px]">
                              Current
                            </Badge>
                          )}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {item.count.toLocaleString()} · {formatCompactCurrency(item.value)}
                        </span>
                      </div>
                      <ShareBar
                        color={estimateOutcomeColors[item.status] ?? statusColors[0]}
                        label={`${item.status}: ${item.share}% of estimate value`}
                        value={item.share}
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState label="Waiting estimates and recorded decisions will appear here." />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xs min-[1200px]:col-span-4">
          <CardHeader>
            <CardTitle>Customer concentration</CardTitle>
            <CardDescription>Top accounts by invoiced value during the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            {reportingPeriod.topCustomers.length ? (
              <div className="grid gap-3">
                {reportingPeriod.topCustomers.map((customer, index) => (
                  <div key={customer.id} className="grid gap-2 rounded-md border bg-muted/20 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {customer.customerId ? (
                          <DashboardNavigationLink
                            href={`/dashboard/customers/${customer.customerId}`}
                            prefetch={false}
                            className="group inline-flex max-w-full items-center gap-1 font-medium text-sm hover:underline"
                          >
                            <span className="truncate">{customer.name}</span>
                            <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                          </DashboardNavigationLink>
                        ) : (
                          <p className="truncate font-medium text-sm">{customer.name}</p>
                        )}
                        <p className="text-muted-foreground text-xs">
                          {customer.invoices} {customer.invoices === 1 ? "invoice" : "invoices"} · {customer.share}% of
                          billed value
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-md tabular-nums">
                        #{index + 1}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span>{formatCompactCurrency(customer.revenue)}</span>
                      <span className="text-muted-foreground">
                        {customer.balance ? `${formatCompactCurrency(customer.balance)} open` : "No open balance"}
                      </span>
                    </div>
                    <Progress value={customer.share} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label={"No invoices issued during this period."} />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xs min-[1200px]:col-span-3">
          <CardHeader>
            <CardTitle>Job status mix</CardTitle>
            <CardDescription>
              {period === "all"
                ? "Current statuses of all jobs, including unscheduled jobs."
                : "Current statuses of jobs starting in the selected period."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {reportingPeriod.jobStatus.some((item) => item.value > 0) ? (
              <div className="grid gap-3">
                {reportingPeriod.jobStatus.map((item) => {
                  const totalJobs = reportingPeriod.jobStatus.reduce((total, status) => total + status.value, 0);
                  const share = totalJobs ? Math.round((item.value / totalJobs) * 100) : 0;
                  const color = jobStatusColors[item.status] ?? "oklch(0.58 0.03 250)";

                  return (
                    <div key={item.status} className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate font-medium">{item.status}</span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          {item.value} · {formatCompactCurrency(item.amount)}
                        </span>
                      </div>
                      <ShareBar color={color} label={`${item.status}: ${share}% of jobs`} value={share} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState label="Create jobs to see your status distribution." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 min-[1200px]:grid-cols-12">
        <Card className="shadow-xs min-[1200px]:col-span-7">
          <CardHeader>
            <CardTitle>Employee hours</CardTitle>
            <CardDescription>
              Share of logged hours during the selected period, including inactive employees.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reportingPeriod.employeeHours.length ? (
              <div className="grid gap-3">
                {reportingPeriod.employeeHours.map((employee) => {
                  const accent = getEmployeeAccent(employee.accentColor, employee.id);

                  return (
                    <div key={employee.id} className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={cn("size-2.5 shrink-0 rounded-full", accent.dot)} aria-hidden="true" />
                          <span className="truncate font-medium">{employee.name}</span>
                          {!employee.active && (
                            <Badge variant="secondary" className="h-5 shrink-0 rounded-md px-1.5 text-[10px]">
                              Inactive
                            </Badge>
                          )}
                        </span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          {employee.hours.toLocaleString()}h
                        </span>
                      </div>
                      <div
                        className="h-2 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-label={`${employee.name}: ${employee.share}% of logged hours`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={employee.share}
                      >
                        <div
                          className={cn("h-full rounded-full", accent.fill)}
                          style={{ width: `${employee.share}%` }}
                        />
                      </div>
                      <span className="text-right text-muted-foreground text-xs">{employee.share}% of total</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState label="Employee time entries will build the hours breakdown." />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xs min-[1200px]:col-span-5">
          <CardHeader>
            <CardTitle>Labor trend</CardTitle>
            <CardDescription>Approved and entered hours during the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            {laborTrendData.some((point) => point.hours) ? (
              <ChartContainer config={productivityConfig} className="h-64 w-full">
                <BarChart data={laborTrendData} margin={{ left: -18, right: 4, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="hours" fill="var(--color-hours)" radius={6} />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyState label="Employee time entries will build the labor trend." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
