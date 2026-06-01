import Link from "next/link";

import { format, startOfToday } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Clock3,
  Gauge,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { calculateOutstandingBalance, formatCurrency, toMoneyNumber } from "@/lib/customer-billing";
import { prisma } from "@/lib/prisma";

import { CalendarPanel } from "./_components/calendar-panel";
import { type OutstandingJob, OutstandingJobs } from "./_components/outstanding-jobs";
import { type PendingTimeReview, PendingTimeReviews } from "./_components/pending-time-reviews";
import { type UpcomingJob, UpcomingJobs } from "./_components/upcoming-jobs";

type JobAttentionItem = {
  id: string;
  customerName: string;
  detail: string;
  priority: "Schedule" | "Review hold";
  status: "Unscheduled" | "On Hold";
  title: string;
};

type UpcomingTask = {
  id: string;
  customerName: string;
  location?: string;
  scheduledFor: string;
  title: string;
};

async function getUpcomingJobs(ownerId: string): Promise<UpcomingJob[]> {
  const today = startOfToday();
  const jobs = await prisma.job.findMany({
    where: {
      ownerId,
      dateBegin: {
        gte: today,
      },
      status: {
        not: "Cancelled",
      },
    },
    include: {
      customer: true,
    },
    orderBy: {
      dateBegin: "asc",
    },
    take: 6,
  });

  return jobs.map((job) => ({
    id: job.id,
    customerName: job.customer?.name ?? "Customer not assigned",
    dateBegin: job.dateBegin?.toISOString() ?? new Date().toISOString(),
    isOverdue: false,
    status: job.status,
    title: job.description,
  }));
}

async function getUpcomingTasks(ownerId: string): Promise<UpcomingTask[]> {
  const today = startOfToday();
  const tasks = await prisma.task.findMany({
    where: {
      ownerId,
      scheduledFor: {
        gte: today,
      },
      status: {
        not: "Completed",
      },
    },
    include: {
      customer: true,
    },
    orderBy: {
      scheduledFor: "asc",
    },
    take: 5,
  });

  return tasks.map((task) => ({
    id: task.id,
    customerName: task.customer?.name ?? "Task",
    location: task.location ?? undefined,
    scheduledFor: task.scheduledFor.toISOString(),
    title: task.title,
  }));
}

function UpcomingTasks({ tasks }: { tasks: UpcomingTask[] }) {
  return (
    <Card className="rounded-lg border-border bg-card shadow-sm">
      <CardHeader className="border-b pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="grid size-8 place-items-center rounded-md bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25">
              <CheckSquare className="size-4" />
            </span>
            Upcoming tasks
          </CardTitle>
          <CardDescription className="mt-1 text-xs">
            {tasks.length
              ? `${tasks.length} open scheduled ${tasks.length === 1 ? "task" : "tasks"}`
              : "No upcoming tasks"}
          </CardDescription>
        </div>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link prefetch={false} href="/dashboard/calendar">
              Calendar <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0">
        {tasks.length ? (
          tasks.map((task) => (
            <Link
              key={task.id}
              prefetch={false}
              href="/dashboard/calendar"
              className="grid min-w-0 gap-3 rounded-md border border-border bg-muted/35 p-3 transition-colors hover:bg-muted/60 sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-sm">{task.title}</div>
                <div className="truncate text-muted-foreground text-xs">{task.customerName}</div>
                {task.location ? (
                  <div className="mt-1 truncate text-muted-foreground text-xs">{task.location}</div>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                <Badge
                  variant="outline"
                  className="rounded-md border-amber-300 text-amber-700 dark:border-amber-900 dark:text-amber-400"
                >
                  {format(new Date(task.scheduledFor), "MMM d")}
                </Badge>
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
            </Link>
          ))
        ) : (
          <div className="grid min-h-36 place-items-center rounded-md border border-dashed bg-muted/20 p-6 text-center">
            <div>
              <div className="mx-auto grid size-10 place-items-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25">
                <CheckCircle2 className="size-4" />
              </div>
              <p className="mt-3 font-medium text-sm">No upcoming tasks</p>
              <p className="mt-1 text-muted-foreground text-xs">Calendar tasks will appear here.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function getOutstandingJobs(ownerId: string): Promise<OutstandingJob[]> {
  const jobs = await prisma.job.findMany({
    where: {
      ownerId,
      status: {
        not: "Cancelled",
      },
    },
    include: {
      customer: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 25,
  });

  return jobs
    .map((job) => ({
      amountPaid: toMoneyNumber(job.amountPaid?.toString()),
      id: job.id,
      balanceDue: calculateOutstandingBalance(job.status, job.finalCost?.toString(), job.amountPaid?.toString()),
      customerName: job.customer?.name ?? "Customer not assigned",
      finalCost: toMoneyNumber(job.finalCost?.toString()),
      paymentStatus: job.paymentStatus,
      title: job.description,
    }))
    .filter((job) => job.balanceDue > 0)
    .sort((a, b) => b.balanceDue - a.balanceDue)
    .slice(0, 6);
}

async function getPendingTimeReviews(ownerId: string): Promise<{
  pendingCount: number;
  reviews: PendingTimeReview[];
}> {
  const [pendingCount, requests] = await Promise.all([
    prisma.timeEntryRequest.count({
      where: {
        ownerId,
        status: "Pending",
      },
    }),
    prisma.timeEntryRequest.findMany({
      where: {
        ownerId,
        status: "Pending",
      },
      include: {
        employee: true,
      },
      orderBy: {
        requestedAt: "desc",
      },
      take: 5,
    }),
  ]);

  return {
    pendingCount,
    reviews: requests.map((request) => ({
      id: request.id,
      action: request.action,
      employeeName: request.employee.name,
      employeeNumber: request.employee.employeeNumber,
      requestedAt: request.requestedAt.toISOString(),
      workedOn: request.workedOn?.toISOString(),
    })),
  };
}

async function getJobAttention(ownerId: string): Promise<{
  items: JobAttentionItem[];
  onHoldCount: number;
  unscheduledCount: number;
}> {
  const [unscheduledJobs, onHoldJobs, unscheduledCount, onHoldCount] = await Promise.all([
    prisma.job.findMany({
      where: {
        ownerId,
        status: "Unscheduled",
      },
      include: {
        customer: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 4,
    }),
    prisma.job.findMany({
      where: {
        ownerId,
        status: "On Hold",
      },
      include: {
        customer: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 4,
    }),
    prisma.job.count({
      where: {
        ownerId,
        status: "Unscheduled",
      },
    }),
    prisma.job.count({
      where: {
        ownerId,
        status: "On Hold",
      },
    }),
  ]);

  return {
    items: [
      ...unscheduledJobs.map((job) => ({
        id: job.id,
        customerName: job.customer?.name ?? "Customer not assigned",
        detail: "Needs a scheduled date or next field-work plan.",
        priority: "Schedule" as const,
        status: "Unscheduled" as const,
        title: job.description,
      })),
      ...onHoldJobs.map((job) => ({
        id: job.id,
        customerName: job.customer?.name ?? "Customer not assigned",
        detail: "Review the blocker and decide the next step.",
        priority: "Review hold" as const,
        status: "On Hold" as const,
        title: job.description,
      })),
    ].slice(0, 6),
    onHoldCount,
    unscheduledCount,
  };
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
    notation: value >= 1000 ? "compact" : "standard",
    style: "currency",
  }).format(value);
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function OverviewSignal({
  accent,
  detail,
  href,
  icon: Icon,
  label,
  value,
}: {
  accent: "cyan" | "emerald" | "amber";
  detail: string;
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  const accentClassNames = {
    amber: {
      bar: "bg-amber-500",
      icon: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25",
    },
    cyan: {
      bar: "bg-cyan-500",
      icon: "bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/25",
    },
    emerald: {
      bar: "bg-emerald-500",
      icon: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25",
    },
  }[accent];

  return (
    <Link
      prefetch={false}
      href={href}
      className="group relative min-w-0 overflow-hidden rounded-lg border border-border bg-background p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${accentClassNames.bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div className={`grid size-9 shrink-0 place-items-center rounded-md ring-1 ${accentClassNames.icon}`}>
          <Icon className="size-4" />
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="mt-5 min-w-0">
        <div className="truncate font-semibold text-2xl text-foreground">{value}</div>
        <div className="mt-1 truncate font-medium text-muted-foreground text-xs uppercase tracking-[0.12em]">
          {label}
        </div>
        <p className="mt-2 line-clamp-2 text-muted-foreground text-sm leading-5">{detail}</p>
      </div>
    </Link>
  );
}

function FocusRow({
  href,
  icon: Icon,
  label,
  value,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-white/10 bg-white/8 p-3 text-white transition-colors hover:bg-white/12"
    >
      <div className="grid size-8 place-items-center rounded-md bg-white/12 text-white/85">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate font-medium text-sm">{label}</div>
        <div className="truncate text-white/60 text-xs">{value}</div>
      </div>
      <ArrowRight className="size-4 text-white/50" />
    </Link>
  );
}

function JobAttention({
  items,
  onHoldCount,
  unscheduledCount,
}: {
  items: JobAttentionItem[];
  onHoldCount: number;
  unscheduledCount: number;
}) {
  const total = unscheduledCount + onHoldCount;

  return (
    <Card className="rounded-lg border-border bg-card shadow-sm">
      <CardHeader className="border-b pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="grid size-8 place-items-center rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25">
              <BriefcaseBusiness className="size-4" />
            </span>
            Job attention
          </CardTitle>
          <CardDescription className="mt-1 text-xs">
            {total ? `${unscheduledCount} unscheduled · ${onHoldCount} on hold` : "No job scheduling blockers"}
          </CardDescription>
        </div>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link prefetch={false} href="/dashboard/jobs">
              Review <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0">
        {items.length ? (
          items.map((job) => (
            <Link
              key={job.id}
              prefetch={false}
              href={`/dashboard/jobs/${job.id}`}
              className="grid min-w-0 gap-3 rounded-md border border-border bg-muted/35 p-3 transition-colors hover:bg-muted/60 sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-sm">{job.title}</div>
                <div className="truncate text-muted-foreground text-xs">{job.customerName}</div>
                <div className="mt-1 text-muted-foreground text-xs">{job.detail}</div>
              </div>
              <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                <Badge
                  variant="outline"
                  className={
                    job.status === "Unscheduled"
                      ? "rounded-md border-rose-300 text-rose-700 dark:border-rose-900 dark:text-rose-400"
                      : "rounded-md border-amber-300 text-amber-700 dark:border-amber-900 dark:text-amber-400"
                  }
                >
                  {job.priority}
                </Badge>
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
            </Link>
          ))
        ) : (
          <div className="grid min-h-36 place-items-center rounded-md border border-dashed bg-muted/20 p-6 text-center">
            <div>
              <div className="mx-auto grid size-10 place-items-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25">
                <CheckCircle2 className="size-4" />
              </div>
              <p className="mt-3 font-medium text-sm">Jobs are assigned</p>
              <p className="mt-1 text-muted-foreground text-xs">Unscheduled and on-hold jobs will appear here.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view overview"
        description="Your company overview is private to your signed-in account."
      />
    );
  }

  const [upcomingJobs, upcomingTasks, outstandingJobs, pendingTimeReviews, jobAttention] = await Promise.all([
    getUpcomingJobs(currentUser.id),
    getUpcomingTasks(currentUser.id),
    getOutstandingJobs(currentUser.id),
    getPendingTimeReviews(currentUser.id),
    getJobAttention(currentUser.id),
  ]);
  const displayName = getDisplayName(currentUser).split(" ")[0];
  const outstandingTotal = outstandingJobs.reduce((total, job) => total + job.balanceDue, 0);
  const hasOperationalActivity =
    upcomingJobs.length > 0 ||
    upcomingTasks.length > 0 ||
    outstandingJobs.length > 0 ||
    pendingTimeReviews.pendingCount > 0 ||
    jobAttention.unscheduledCount > 0 ||
    jobAttention.onHoldCount > 0;
  const readinessScore = Math.max(
    48,
    100 -
      pendingTimeReviews.pendingCount * 9 -
      outstandingJobs.length * 5 -
      jobAttention.unscheduledCount * 8 -
      jobAttention.onHoldCount * 6 -
      (hasOperationalActivity ? Math.max(0, 3 - upcomingJobs.length) * 3 : 0),
  );
  const nextJob = upcomingJobs[0];
  const largestBalance = outstandingJobs[0];
  const firstReview = pendingTimeReviews.reviews[0];

  return (
    <div className="mx-auto grid w-full max-w-[1500px] gap-5">
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 p-4 sm:p-5 lg:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-border bg-muted px-2.5 py-1 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
                Overview
              </span>
              <span className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
                {format(new Date(), "EEEE, MMM d")}
              </span>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <div className="min-w-0">
                <div className="mb-3 flex items-center gap-2 text-muted-foreground text-sm">
                  <Sparkles className="size-4 text-cyan-600 dark:text-cyan-300" />
                  {getGreeting()}, {displayName}
                </div>
                <h1 className="max-w-3xl text-balance font-semibold text-3xl leading-tight">
                  {currentUser.companyName}
                  {/*command brief*/}
                </h1>
                <p className="mt-3 max-w-3xl text-muted-foreground text-sm leading-6">
                  A cleaner read on {currentUser.companyName}: employee time approvals, booked service jobs, and
                  balances that are ready to collect today.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
                <Button asChild size="sm">
                  <Link prefetch={false} href="/dashboard/time-tracking">
                    Review time
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link prefetch={false} href="/dashboard/jobs">
                    Open jobs
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-6 grid min-w-0 gap-3 md:grid-cols-3">
              <OverviewSignal
                accent="amber"
                detail={
                  pendingTimeReviews.pendingCount
                    ? "Employee requests are waiting for approval."
                    : "No employee time edits waiting."
                }
                href="/dashboard/time-tracking"
                icon={Clock3}
                label="Time queue"
                value={`${pendingTimeReviews.pendingCount} pending`}
              />
              <OverviewSignal
                accent="cyan"
                detail={
                  jobAttention.unscheduledCount || jobAttention.onHoldCount
                    ? `${jobAttention.unscheduledCount} unscheduled · ${jobAttention.onHoldCount} on hold.`
                    : nextJob
                      ? `Next: ${nextJob.title}`
                      : "Your schedule is clear for now."
                }
                href="/dashboard/jobs"
                icon={BriefcaseBusiness}
                label="Job attention"
                value={`${jobAttention.unscheduledCount + jobAttention.onHoldCount} jobs`}
              />
              <OverviewSignal
                accent="emerald"
                detail={
                  outstandingJobs.length
                    ? `${outstandingJobs.length} job balances need follow-up.`
                    : "All tracked job balances are clear."
                }
                href="/dashboard/jobs"
                icon={WalletCards}
                label="Receivables"
                value={formatCompactCurrency(outstandingTotal)}
              />
            </div>
          </div>

          <div className="border-border border-t bg-slate-950 p-4 text-white sm:p-5 lg:border-t-0 lg:border-l lg:p-6 dark:bg-black">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-white/60 text-xs uppercase tracking-[0.14em]">
                  <Gauge className="size-4" />
                  Readiness
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <span className="font-semibold text-5xl leading-none">{readinessScore}</span>
                  <span className="pb-1 text-sm text-white/50">/100</span>
                </div>
              </div>
              <div className="rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 font-medium text-emerald-200 text-xs">
                Live
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-cyan-400 to-emerald-400"
                style={{ width: `${readinessScore}%` }}
              />
            </div>
            <div className="mt-5 grid gap-2">
              <FocusRow
                href="/dashboard/time-tracking"
                icon={firstReview ? Clock3 : CheckCircle2}
                label={firstReview ? `${firstReview.employeeName} time request` : "Time requests clear"}
                value={firstReview ? `${firstReview.action} review is first in line` : "No approval queue"}
              />
              <FocusRow
                href="/dashboard/jobs"
                icon={jobAttention.items[0] ? BriefcaseBusiness : CalendarClock}
                label={
                  jobAttention.items[0] ? jobAttention.items[0].title : nextJob ? nextJob.title : "No scheduled jobs"
                }
                value={
                  jobAttention.items[0]
                    ? `${jobAttention.items[0].status} with ${jobAttention.items[0].customerName}`
                    : nextJob
                      ? `${format(new Date(nextJob.dateBegin), "MMM d")} with ${nextJob.customerName}`
                      : "Schedule is open"
                }
              />
              <FocusRow
                href="/dashboard/jobs"
                icon={WalletCards}
                label={largestBalance ? largestBalance.customerName : "Balances clear"}
                value={largestBalance ? `${formatCurrency(largestBalance.balanceDue)} outstanding` : "Nothing open"}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid min-w-0 gap-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <PendingTimeReviews pendingCount={pendingTimeReviews.pendingCount} reviews={pendingTimeReviews.reviews} />
            <JobAttention
              items={jobAttention.items}
              onHoldCount={jobAttention.onHoldCount}
              unscheduledCount={jobAttention.unscheduledCount}
            />
            <UpcomingTasks tasks={upcomingTasks} />
            <UpcomingJobs jobs={upcomingJobs} />
          </div>
          <OutstandingJobs jobs={outstandingJobs} />
        </section>

        <section className="min-w-0">
          <CalendarPanel />
        </section>
      </div>
    </div>
  );
}
