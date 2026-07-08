"use client";

import Link from "next/link";

import { format } from "date-fns";
import {
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Gauge,
  ReceiptText,
  Users,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn, formatCurrency } from "@/lib/utils";

export type CommandCenterData = {
  companyName: string;
  generatedAt: string;
  totals: {
    customers: number;
    leads: number;
    activeEmployees: number;
    jobs: number;
    activeJobs: number;
    scheduledNext30: number;
    estimates: number;
    estimateOutcomeCount: number;
    waitingEstimateValue: number;
    invoices: number;
    issuedTotal: number;
    collectedTotal: number;
    receivablesTotal: number;
    pendingTimeReviews: number;
    hoursLogged: number;
    completionRate: number;
    estimateWinRate: number;
    collectionRate: number;
  };
  monthlyFlow: Array<{
    month: string;
    billed: number;
    collected: number;
    receivable: number;
    hours: number;
  }>;
  estimateOutcomes: Array<{
    status: string;
    count: number;
    value: number;
    share: number;
  }>;
  topCustomers: Array<{
    id: string;
    name: string;
    revenue: number;
    jobs: number;
    balance: number;
    share: number;
  }>;
  jobStatus: Array<{
    status: string;
    value: number;
    amount: number;
  }>;
  serviceMix: Array<{
    category: string;
    jobs: number;
    value: number;
    share: number;
  }>;
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
    label: "Receivable",
    color: "oklch(0.69 0.18 55)",
  },
} satisfies ChartConfig;

const cashFlowLabels: Record<string, string> = {
  billed: "Billed",
  collected: "Collected",
  receivable: "Receivable",
};

const statusConfig = {
  value: {
    label: "Jobs",
  },
} satisfies ChartConfig;

const productivityConfig = {
  hours: {
    label: "Hours",
    color: "oklch(0.62 0.2 330)",
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

const estimateOutcomeConfig = {
  value: {
    label: "Value",
  },
} satisfies ChartConfig;

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
  tone,
}: {
  icon: typeof CircleDollarSign;
  label: string;
  value: string;
  detail: string;
  tone: "cyan" | "emerald" | "amber" | "rose";
}) {
  const toneClassNames = {
    amber: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300",
    cyan: "bg-cyan-500/10 text-cyan-700 ring-cyan-500/20 dark:text-cyan-300",
    emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
    rose: "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300",
  }[tone];

  return (
    <Card className="min-w-0 gap-5 shadow-xs">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="mt-2 text-2xl tabular-nums tracking-normal">{value}</CardTitle>
          </div>
          <div className={cn("grid size-10 place-items-center rounded-lg ring-1", toneClassNames)}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-xs">{detail}</p>
      </CardContent>
    </Card>
  );
}

function InsightPill({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border bg-background/70 px-3 py-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-muted-foreground text-xs">{label}</p>
        <p className="truncate font-medium text-sm tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export function CommandCenterDashboard({ data }: { data: CommandCenterData }) {
  const hasRevenueData = data.monthlyFlow.some((point) => point.billed || point.collected || point.receivable);
  const generatedAt = format(new Date(data.generatedAt), "MMM d, h:mm a");

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6">
      <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="grid gap-6 p-5 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-md">
                  Command Center
                </Badge>
                <Badge variant="secondary" className="rounded-md">
                  Live company data
                </Badge>
                <span className="text-muted-foreground text-xs">Updated {generatedAt}</span>
              </div>
              <h1 className="text-balance font-medium text-3xl leading-tight tracking-normal md:text-4xl">
                {data.companyName}
              </h1>
              <p className="mt-3 max-w-3xl text-muted-foreground text-sm leading-6">
                A single view of cash flow, work in motion, estimate momentum, customer concentration, and operational
                health across the company.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
              <Button asChild size="sm">
                <Link prefetch={false} href="/dashboard/jobs">
                  Open jobs
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link prefetch={false} href="/dashboard/estimates">
                  Review estimates
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={CircleDollarSign}
              label="Issued revenue"
              value={formatCompactCurrency(data.totals.issuedTotal)}
              detail={`${formatCompactCurrency(data.totals.collectedTotal)} collected · ${data.totals.collectionRate}% collection rate`}
              tone="emerald"
            />
            <KpiCard
              icon={ReceiptText}
              label="Open receivables"
              value={formatCompactCurrency(data.totals.receivablesTotal)}
              detail={`${data.totals.invoices} invoices tracked across the account`}
              tone="rose"
            />
            <KpiCard
              icon={Banknote}
              label="Waiting estimates"
              value={formatCompactCurrency(data.totals.waitingEstimateValue)}
              detail={`${data.totals.estimateOutcomeCount} customer-decision estimates · ${data.totals.estimateWinRate}% won value`}
              tone="cyan"
            />
            <KpiCard
              icon={Clock3}
              label="Pending reviews"
              value={String(data.totals.pendingTimeReviews)}
              detail={`${data.totals.hoursLogged.toLocaleString()} employee hours logged in the last 6 months`}
              tone="amber"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="shadow-xs xl:col-span-8">
          <CardHeader>
            <CardTitle>Cash flow runway</CardTitle>
            <CardDescription>Billed, collected, and still receivable over the last 6 months.</CardDescription>
            <CardAction>
              <Badge variant="outline" className="rounded-md">
                {formatCompactCurrency(data.totals.receivablesTotal)} open
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {hasRevenueData ? (
              <ChartContainer config={cashFlowConfig} className="h-80 w-full">
                <AreaChart data={data.monthlyFlow} margin={{ left: 0, right: 12, top: 16, bottom: 0 }}>
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
                        formatter={(value, name) => (
                          <div className="flex min-w-36 items-center justify-between gap-3">
                            <span className="text-muted-foreground">{cashFlowLabels[String(name)] ?? name}</span>
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

        <Card className="shadow-xs xl:col-span-4">
          <CardHeader>
            <CardTitle>Operating pulse</CardTitle>
            <CardDescription>How much of the business is moving cleanly.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <InsightPill icon={Users} label="Customers" value={data.totals.customers.toLocaleString()} />
              <InsightPill
                icon={BriefcaseBusiness}
                label="Active jobs"
                value={`${data.totals.activeJobs} live · ${data.totals.scheduledNext30} next 30d`}
              />
              <InsightPill
                icon={Gauge}
                label="Completed jobs"
                value={`${data.totals.completionRate}% completion rate`}
              />
              <InsightPill
                icon={CheckCircle2}
                label="Active employees"
                value={data.totals.activeEmployees.toLocaleString()}
              />
            </div>
            <Separator />
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-sm">Collection health</span>
                <span className="font-medium text-sm tabular-nums">{data.totals.collectionRate}%</span>
              </div>
              <Progress value={data.totals.collectionRate} />
              <div className="flex justify-between gap-3 text-muted-foreground text-xs">
                <span>{formatCompactCurrency(data.totals.collectedTotal)} collected</span>
                <span>{formatCompactCurrency(data.totals.receivablesTotal)} open</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="min-w-0 shadow-xs xl:col-span-5">
          <CardHeader>
            <CardTitle>Estimate decisions</CardTitle>
            <CardDescription>
              Customer-facing estimate outcomes, excluding drafts and ready-to-send work.
            </CardDescription>
            <CardAction>
              <Badge variant="outline" className="rounded-md">
                {data.totals.estimateWinRate}% won value
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-4">
            {data.estimateOutcomes.length ? (
              <>
                <ChartContainer config={estimateOutcomeConfig} className="mx-auto aspect-square h-56 max-w-56">
                  <PieChart>
                    <Pie
                      data={data.estimateOutcomes}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      nameKey="status"
                      outerRadius={84}
                      paddingAngle={3}
                    >
                      {data.estimateOutcomes.map((item) => (
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
                  {data.estimateOutcomes.map((item) => (
                    <div key={item.status} className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: estimateOutcomeColors[item.status] ?? statusColors[0] }}
                          />
                          <span className="truncate font-medium">{item.status}</span>
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {item.count.toLocaleString()} · {formatCompactCurrency(item.value)}
                        </span>
                      </div>
                      <Progress value={Math.max(5, item.share)} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState label="Sent estimates will appear here once customers are waiting, won, or lost." />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xs xl:col-span-4">
          <CardHeader>
            <CardTitle>Customer concentration</CardTitle>
            <CardDescription>Top accounts by job revenue and open balance.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topCustomers.length ? (
              <div className="grid gap-3">
                {data.topCustomers.map((customer, index) => (
                  <div key={customer.id} className="grid gap-2 rounded-md border bg-muted/20 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm">{customer.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {customer.jobs} jobs · {customer.share}% of tracked revenue
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
                    <Progress value={Math.min(100, Math.max(6, customer.share))} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="Jobs with customers will populate your customer concentration view." />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xs xl:col-span-3">
          <CardHeader>
            <CardTitle>Job status mix</CardTitle>
            <CardDescription>Current distribution across your job board.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {data.jobStatus.length ? (
              <>
                <ChartContainer config={statusConfig} className="mx-auto aspect-square h-48 max-w-48">
                  <PieChart>
                    <Pie
                      data={data.jobStatus}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      nameKey="status"
                      outerRadius={74}
                      paddingAngle={3}
                    >
                      {data.jobStatus.map((item, index) => (
                        <Cell key={item.status} fill={statusColors[index % statusColors.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="status" />} />
                  </PieChart>
                </ChartContainer>
                <div className="grid gap-2">
                  {data.jobStatus.map((item, index) => (
                    <div key={item.status} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: statusColors[index % statusColors.length] }}
                        />
                        <span className="truncate">{item.status}</span>
                      </span>
                      <span className="text-muted-foreground tabular-nums">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState label="Create jobs to see your status distribution." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="shadow-xs xl:col-span-7">
          <CardHeader>
            <CardTitle>Service mix</CardTitle>
            <CardDescription>Where job value is coming from by category.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.serviceMix.length ? (
              <div className="grid gap-3">
                {data.serviceMix.map((item) => (
                  <div key={item.category} className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{item.category}</span>
                      <span className="text-muted-foreground tabular-nums">{formatCompactCurrency(item.value)}</span>
                    </div>
                    <Progress value={Math.max(5, item.share)} />
                    <div className="flex justify-between text-muted-foreground text-xs">
                      <span>{item.jobs} jobs</span>
                      <span>{item.share}% share</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="Categorized jobs will reveal your service mix." />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xs xl:col-span-5">
          <CardHeader>
            <CardTitle>Labor trend</CardTitle>
            <CardDescription>Approved and entered hours by month.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.monthlyFlow.some((point) => point.hours) ? (
              <ChartContainer config={productivityConfig} className="h-64 w-full">
                <BarChart data={data.monthlyFlow} margin={{ left: -18, right: 4, top: 8, bottom: 0 }}>
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Gauge className="size-4" />
          Built from live customers, jobs, estimates, invoices, employees, and time requests.
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link prefetch={false} href="/dashboard/overview">
            Back to overview
          </Link>
        </Button>
      </div>
    </div>
  );
}
