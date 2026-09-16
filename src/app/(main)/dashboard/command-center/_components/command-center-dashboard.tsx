"use client";

import { useState } from "react";

import { format } from "date-fns";
import { ArrowRight, Banknote, BriefcaseBusiness, CircleDollarSign, ReceiptText } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { getEmployeeAccent } from "@/lib/employee-colors";
import { cn, formatCurrency } from "@/lib/utils";

import { DashboardNavigationLink } from "../../_components/dashboard-navigation-loader";

export type CommandCenterData = {
  companyName: string;
  generatedAt: string;
  totals: {
    openJobs: number;
    openWorkValue: number;
    waitingEstimateCount: number;
    waitingEstimateValue: number;
    invoices: number;
    receivablesTotal: number;
    collectionRate: number;
  };
  monthlyFlow: Array<{
    month: string;
    billed: number;
    collected: number;
    receivable: number;
    hours: number;
  }>;
  jobStatus: Array<{
    status: string;
    value: number;
    amount: number;
  }>;
  reportingPeriods: Record<
    6 | 12,
    {
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

function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
  href,
  linkLabel,
  tone,
}: {
  icon: typeof CircleDollarSign;
  label: string;
  value: string;
  detail: string;
  href?: string;
  linkLabel?: string;
  tone: "cyan" | "emerald" | "amber" | "rose";
}) {
  const toneClassNames = {
    amber: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300",
    cyan: "bg-cyan-500/10 text-cyan-700 ring-cyan-500/20 dark:text-cyan-300",
    emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
    rose: "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300",
  }[tone];

  return (
    <Card className="min-w-0 gap-3 shadow-xs" size="sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="mt-2 text-xl tabular-nums tracking-normal sm:text-2xl">{value}</CardTitle>
          </div>
          <div className={cn("hidden size-9 place-items-center rounded-lg ring-1 sm:grid", toneClassNames)}>
            <Icon className="size-4.5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        <p className="text-muted-foreground text-xs">{detail}</p>
        {href && linkLabel && (
          <Button asChild variant="link" size="sm" className="h-auto w-fit p-0 text-xs">
            <DashboardNavigationLink href={href} prefetch={false}>
              {linkLabel}
              <ArrowRight className="size-3.5" />
            </DashboardNavigationLink>
          </Button>
        )}
      </CardContent>
    </Card>
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

export function CommandCenterDashboard({ data }: { data: CommandCenterData }) {
  const [reportingMonths, setReportingMonths] = useState<6 | 12>(6);
  const reportingPeriod = data.reportingPeriods[reportingMonths];
  const cashFlowData = data.monthlyFlow.slice(-reportingMonths);
  const laborTrendData = data.monthlyFlow.slice(-reportingMonths);
  const hasRevenueData = cashFlowData.some((point) => point.billed || point.collected || point.receivable);
  const generatedAt = format(new Date(data.generatedAt), "MMM d, h:mm a");

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6">
      <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="grid gap-6 p-5 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="max-w-full truncate rounded-md">
                  Business Performance
                </Badge>
                <span className="text-muted-foreground text-xs">Updated {generatedAt}</span>
              </div>
              <h1 className="text-balance font-medium text-2xl leading-tight tracking-normal">{data.companyName}</h1>
              <p className="mt-3 max-w-3xl text-muted-foreground text-sm leading-6">
                Financial performance, estimate outcomes, customer concentration, and workforce activity.
              </p>
            </div>
            <div className="grid gap-1.5 lg:justify-items-end">
              <span className="font-medium text-muted-foreground text-xs">Reporting period</span>
              <fieldset className="inline-flex w-fit rounded-md border bg-background p-0.5">
                <legend className="sr-only">Reporting period</legend>
                {([6, 12] as const).map((months) => (
                  <Button
                    key={months}
                    type="button"
                    variant={reportingMonths === months ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-3 text-xs"
                    aria-label={`Show the last ${months} months`}
                    aria-pressed={reportingMonths === months}
                    onClick={() => setReportingMonths(months)}
                  >
                    {months}M
                  </Button>
                ))}
              </fieldset>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 min-[1200px]:grid-cols-4">
            <KpiCard
              icon={CircleDollarSign}
              label={`Collected · ${reportingMonths} months`}
              value={formatCompactCurrency(reportingPeriod.collected)}
              detail={`${reportingPeriod.payments} ${reportingPeriod.payments === 1 ? "payment" : "payments"} · ${formatCompactCurrency(reportingPeriod.billed)} billed`}
              tone="emerald"
            />
            <KpiCard
              icon={ReceiptText}
              label="Current open receivables"
              value={formatCompactCurrency(data.totals.receivablesTotal)}
              detail={`${data.totals.invoices} invoices total · ${data.totals.collectionRate}% collected all time`}
              href="/dashboard/invoices"
              linkLabel="Review invoices"
              tone="rose"
            />
            <KpiCard
              icon={Banknote}
              label="Current waiting estimates"
              value={formatCompactCurrency(data.totals.waitingEstimateValue)}
              detail={`${data.totals.waitingEstimateCount} awaiting a customer decision`}
              href="/dashboard/estimates"
              linkLabel="Review estimates"
              tone="cyan"
            />
            <KpiCard
              icon={BriefcaseBusiness}
              label="Current open work value"
              value={formatCompactCurrency(data.totals.openWorkValue)}
              detail={`${data.totals.openJobs} ${data.totals.openJobs === 1 ? "open job" : "open jobs"} · excludes completed and cancelled`}
              href="/dashboard/jobs"
              linkLabel="View jobs"
              tone="amber"
            />
          </div>
        </div>
      </section>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle>Cash flow</CardTitle>
          <CardDescription>Last {reportingMonths} months by invoice issue date and payment date.</CardDescription>
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
              Current waiting pipeline plus decisions recorded during the last {reportingMonths} months.
            </CardDescription>
            <CardAction className="flex items-center gap-1 max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-3 max-sm:mt-2 max-sm:justify-self-start">
              <Badge variant="outline" className="rounded-md">
                {reportingPeriod.estimateWinRate}% of decided value won
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-4">
            {reportingPeriod.estimateOutcomes.length ? (
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
            <CardDescription>Top accounts by invoiced value over the last {reportingMonths} months.</CardDescription>
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
              <EmptyState label={`Invoices will populate this view for the last ${reportingMonths} months.`} />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xs min-[1200px]:col-span-3">
          <CardHeader>
            <CardTitle>Job status mix</CardTitle>
            <CardDescription>Current distribution across your job board.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {data.jobStatus.length ? (
              <div className="grid gap-3">
                {data.jobStatus.map((item) => {
                  const totalJobs = data.jobStatus.reduce((total, status) => total + status.value, 0);
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
              Share of logged hours over the last {reportingMonths} months, including inactive employees.
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
            <CardDescription>Approved and entered hours over the last {reportingMonths} months.</CardDescription>
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
