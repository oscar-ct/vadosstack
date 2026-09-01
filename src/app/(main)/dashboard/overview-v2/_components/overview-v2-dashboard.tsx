"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import {
  ArrowRight,
  BanknoteArrowDown,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  ListChecks,
  MessagesSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ManagerActionQueueItem } from "../../_lib/manager-action-queue";

type MoneyItem = {
  balanceDue: number;
  customerName: string;
  href: string;
  id: string;
  invoiceId?: string;
  title: string;
};

type ScheduleItem = {
  customerName: string;
  dateBegin: string;
  href: string;
  id: string;
  status: string;
  title: string;
};

type WaitingJob = {
  customerName: string;
  href: string;
  id: string;
  status: string;
  title: string;
};

type Lens = "jobs" | "money" | "now";

const BRIEFING_TIME_ZONE = "America/Chicago";

const severityDotClassNames: Record<ManagerActionQueueItem["severity"], string> = {
  amber: "bg-amber-500",
  cyan: "bg-cyan-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
};

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
    notation: value >= 1000 ? "compact" : "standard",
    style: "currency",
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatQueueValue(value: ManagerActionQueueItem["value"]) {
  return typeof value === "number" ? formatCompactCurrency(value) : value;
}

function getLiveBriefingTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BRIEFING_TIME_ZONE,
  }).format(date);
}

function getLiveGreeting(date: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: BRIEFING_TIME_ZONE,
    }).format(date),
  );

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function LensButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-2 font-medium text-xs transition-colors",
        active
          ? "bg-background text-foreground shadow-sm dark:bg-input/50"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="grid min-h-64 place-items-center border-border border-y py-10 text-center">
      <div>
        <span className="mx-auto grid size-10 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="size-5" />
        </span>
        <p className="mt-3 font-medium text-sm">{title}</p>
        <p className="mt-1 text-muted-foreground text-xs">{detail}</p>
      </div>
    </div>
  );
}

export function OverviewV2Dashboard({
  actionQueue,
  companyName,
  dateLabel,
  displayName,
  greeting,
  leadFollowUpCount,
  leadNewCount,
  moneyItems,
  onHoldCount,
  openLeadCount,
  outstandingTotal,
  scheduleItems,
  timeLabel,
  unscheduledCount,
  waitingJobs,
}: {
  actionQueue: ManagerActionQueueItem[];
  companyName: string;
  dateLabel: string;
  displayName: string;
  greeting: string;
  leadFollowUpCount: number;
  leadNewCount: number;
  moneyItems: MoneyItem[];
  onHoldCount: number;
  openLeadCount: number;
  outstandingTotal: number;
  scheduleItems: ScheduleItem[];
  timeLabel: string;
  unscheduledCount: number;
  waitingJobs: WaitingJob[];
}) {
  const [lens, setLens] = useState<Lens>("now");
  const [actionLimit, setActionLimit] = useState(5);
  const [liveGreeting, setLiveGreeting] = useState(greeting);
  const [liveTime, setLiveTime] = useState(timeLabel);
  const visibleActions = actionQueue.slice(0, actionLimit);
  const visibleMoneyItems = moneyItems.slice(0, 6);
  const firstAction = actionQueue[0];
  const attentionCount = unscheduledCount + onHoldCount;
  const largestBalance = moneyItems[0]?.balanceDue ?? 0;
  const unscheduledJobs = waitingJobs.filter((job) => job.status === "Unscheduled");
  const onHoldJobs = waitingJobs.filter((job) => job.status === "On Hold");

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setLiveTime(getLiveBriefingTime(now));
      setLiveGreeting(getLiveGreeting(now));
    }

    updateClock();
    const interval = window.setInterval(updateClock, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1500px] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="grid min-h-[calc(100svh-7rem)] lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.55fr)]">
        <aside className="relative overflow-hidden bg-gradient-to-br from-violet-700 via-indigo-700 to-blue-600 p-6 text-white sm:p-7">
          <div className="pointer-events-none absolute top-40 -right-28 size-60 rounded-full border-[44px] border-white/10" />
          <div className="pointer-events-none absolute -top-24 -left-20 size-56 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="relative flex h-full min-h-[540px] flex-col">
            <div className="mt-8 text-white/70 text-xs">{dateLabel}</div>
            <div className="mt-1 font-normal text-4xl tracking-[-0.05em]" aria-live="off">
              {liveTime}
            </div>

            <div className="mt-10 max-w-xs font-medium text-2xl leading-tight tracking-[-0.03em]">
              {liveGreeting}, {displayName}.
            </div>
            <p className="mt-3 max-w-xs text-white/75 text-sm leading-6">
              {scheduleItems.length
                ? `${scheduleItems.length} ${scheduleItems.length === 1 ? "job has" : "jobs have"} upcoming dates, ${attentionCount} ${attentionCount === 1 ? "job needs" : "jobs need"} attention, and ${leadFollowUpCount} lead ${leadFollowUpCount === 1 ? "follow-up is" : "follow-ups are"} waiting.`
                : `No upcoming jobs have dates, ${attentionCount} ${attentionCount === 1 ? "job needs" : "jobs need"} attention, and ${leadFollowUpCount} lead ${leadFollowUpCount === 1 ? "follow-up is" : "follow-ups are"} waiting.`}
            </p>

            <div className="mt-8 border-white/20 border-t pt-5">
              <div className="text-[10px] text-white/55 uppercase tracking-[0.15em]">Cash waiting</div>
              <div className="mt-2 font-medium text-3xl tracking-tight">{formatCompactCurrency(outstandingTotal)}</div>
              <div className="mt-1 text-white/60 text-xs">
                Across {moneyItems.length} open {moneyItems.length === 1 ? "balance" : "balances"}
              </div>
            </div>

            <div className="mt-7 border-white/20 border-t pt-5">
              <div className="text-[10px] text-white/55 uppercase tracking-[0.15em]">Best next move</div>
              <div className="mt-2 line-clamp-2 font-medium text-xl leading-tight">
                {firstAction?.title ?? "No urgent action"}
              </div>
              <div className="mt-2 line-clamp-2 text-white/60 text-xs leading-5">
                {firstAction
                  ? `${firstAction.priority} · ${firstAction.detail}`
                  : "The manager queue is currently clear."}
              </div>
            </div>

            <div className="mt-auto flex items-center gap-2 pt-8 text-white/65 text-xs">
              <span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_0_5px_rgba(255,255,255,0.09)]" />
              Live workspace · {actionQueue.length} open {actionQueue.length === 1 ? "decision" : "decisions"}
            </div>
          </div>
        </aside>

        <section className="min-w-0 bg-background p-5 sm:p-7">
          <div className="flex flex-col gap-5 border-border border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="mt-2 font-medium text-2xl tracking-[-0.03em] sm:text-3xl">Run the business from here.</h1>
              <p className="mt-2 text-muted-foreground text-lg">{companyName}</p>
            </div>

            <div className="flex w-fit items-center rounded-lg bg-muted p-1">
              <LensButton active={lens === "now"} onClick={() => setLens("now")}>
                Now
              </LensButton>
              <LensButton active={lens === "money"} onClick={() => setLens("money")}>
                Money
              </LensButton>
              <LensButton active={lens === "jobs"} onClick={() => setLens("jobs")}>
                Jobs
              </LensButton>
            </div>
          </div>

          {lens === "now" ? (
            <div>
              <div className="flex items-end justify-between gap-4 py-5">
                <p className="text-muted-foreground text-sm">
                  <span className="font-medium text-foreground">{visibleActions.length || "No"} moves</span>{" "}
                  {visibleActions.length ? "will clear the most operational friction." : "need attention right now."}
                </p>
                {actionQueue.length > 5 ? (
                  <button
                    type="button"
                    className="shrink-0 font-medium text-cyan-700 text-xs hover:text-cyan-900 dark:text-cyan-300 dark:hover:text-cyan-100"
                    onClick={() => setActionLimit(actionLimit > 5 ? 5 : actionQueue.length)}
                  >
                    {actionLimit > 5 ? "Show top 5" : `View all ${actionQueue.length}`}
                  </button>
                ) : (
                  <span className="shrink-0 text-muted-foreground text-xs">
                    Showing {visibleActions.length} of {actionQueue.length}
                  </span>
                )}
              </div>

              {visibleActions.length ? (
                <div className="border-border border-t">
                  {visibleActions.map((item, index) => (
                    <Link
                      key={`${item.type}-${item.id}`}
                      prefetch={false}
                      href={item.href}
                      className="group grid min-w-0 grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-border border-b py-4 transition-colors hover:bg-muted/35 sm:grid-cols-[40px_minmax(0,1fr)_auto]"
                    >
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
                          <span className={cn("size-2 rounded-full", severityDotClassNames[item.severity])} />
                          {item.type} · {item.priority}
                        </span>
                        <span className="mt-1 block truncate font-medium text-sm">{item.title}</span>
                        <span className="mt-1 block truncate text-muted-foreground text-xs">{item.detail}</span>
                      </span>
                      <span className="flex items-center gap-3 pl-2">
                        <span className="hidden max-w-24 truncate text-right font-medium text-xs sm:block">
                          {formatQueueValue(item.value)}
                        </span>
                        <span className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
                          <ArrowRight className="size-4" />
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title="The decision stream is clear" detail="New manager actions will appear here." />
              )}

              {actionLimit > 5 ? (
                <div className="flex items-center justify-between border-border border-b py-4">
                  <span className="text-muted-foreground text-xs">
                    Showing all {actionQueue.length} manager actions
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setActionLimit(5)}>
                    Show top 5
                  </Button>
                </div>
              ) : null}

              <div className="mt-5 grid border-border border-y sm:grid-cols-3">
                <Link
                  prefetch={false}
                  href="/dashboard/leads"
                  className="p-4 transition-colors hover:bg-muted/35 sm:border-r sm:border-border"
                >
                  <div className="flex items-center gap-2 font-medium text-lg">
                    <MessagesSquare className="size-4 text-cyan-600" />
                    {openLeadCount} {openLeadCount === 1 ? "lead" : "leads"}
                  </div>
                  <div className="mt-1 text-muted-foreground text-xs">
                    {leadFollowUpCount} follow-up · {leadNewCount} new
                  </div>
                </Link>
                <Link
                  prefetch={false}
                  href="/dashboard/jobs"
                  className="border-border border-t p-4 transition-colors hover:bg-muted/35 sm:border-t-0 sm:border-r"
                >
                  <div className="flex items-center gap-2 font-medium text-lg">
                    <BriefcaseBusiness className="size-4 text-rose-600" />
                    {attentionCount} need attention
                  </div>
                  <div className="mt-1 text-muted-foreground text-xs">
                    {unscheduledCount} need dates · {onHoldCount} on hold
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => setLens("money")}
                  className="border-border border-t p-4 text-left transition-colors hover:bg-muted/35 sm:border-t-0"
                >
                  <div className="flex items-center gap-2 font-medium text-lg">
                    <CircleDollarSign className="size-4 text-emerald-600" />
                    {formatCompactCurrency(outstandingTotal)}
                  </div>
                  <div className="mt-1 text-muted-foreground text-xs">Ready to collect</div>
                </button>
              </div>
            </div>
          ) : null}

          {lens === "money" ? (
            <div>
              <div className="flex items-end justify-between gap-4 py-5">
                <p className="text-muted-foreground text-sm">
                  <span className="font-medium text-foreground">{formatCurrency(outstandingTotal)}</span> is currently
                  moving toward collection.
                </p>
                <span className="shrink-0 text-muted-foreground text-xs">{moneyItems.length} balances</span>
              </div>

              {visibleMoneyItems.length ? (
                <div className="border-border border-t">
                  {visibleMoneyItems.map((item) => {
                    const width = largestBalance ? Math.max(5, (item.balanceDue / largestBalance) * 100) : 0;

                    return (
                      <Link
                        key={item.id}
                        prefetch={false}
                        href={item.href}
                        className="group grid gap-3 border-border border-b py-4 transition-colors hover:bg-muted/35 sm:grid-cols-[minmax(120px,0.55fr)_minmax(120px,1fr)_auto] sm:items-center"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-sm">{item.customerName}</span>
                          <span className="mt-1 block truncate text-muted-foreground text-xs">{item.title}</span>
                        </span>
                        <span className="h-2 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${width}%` }} />
                        </span>
                        <span className="flex items-center justify-between gap-3 sm:justify-end">
                          <span className="font-medium text-sm tabular-nums">{formatCurrency(item.balanceDue)}</span>
                          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="Balances are clear" detail="Outstanding job balances will appear here." />
              )}

              <div className="mt-5 grid border-border border-y sm:grid-cols-3">
                <div className="p-4 sm:border-r sm:border-border">
                  <div className="flex items-center gap-2 font-medium text-lg">
                    <BanknoteArrowDown className="size-4 text-emerald-600" />
                    {formatCompactCurrency(largestBalance)}
                  </div>
                  <div className="mt-1 text-muted-foreground text-xs">Largest open balance</div>
                </div>
                <div className="border-border border-t p-4 sm:border-t-0 sm:border-r">
                  <div className="font-medium text-lg">{moneyItems.length} jobs</div>
                  <div className="mt-1 text-muted-foreground text-xs">With money outstanding</div>
                </div>
                <div className="border-border border-t p-4 sm:border-t-0">
                  <div className="font-medium text-lg">{moneyItems.filter((item) => !item.invoiceId).length} ready</div>
                  <div className="mt-1 text-muted-foreground text-xs">Ready to invoice</div>
                </div>
              </div>
            </div>
          ) : null}

          {lens === "jobs" ? (
            <div>
              <div className="flex items-end justify-between gap-4 py-5">
                <p className="text-muted-foreground text-sm">
                  <span className="font-medium text-foreground">{attentionCount} jobs need attention.</span>{" "}
                  {scheduleItems.length} {scheduleItems.length === 1 ? "job has" : "jobs have"} an upcoming date.
                </p>
                <Button asChild variant="ghost" size="sm">
                  <Link prefetch={false} href="/dashboard/jobs">
                    All jobs <ArrowRight />
                  </Link>
                </Button>
              </div>

              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">Needs a date</div>
                {unscheduledJobs.length ? (
                  <div className="mt-2 border-border border-t">
                    {unscheduledJobs.map((job) => (
                      <Link
                        key={job.id}
                        prefetch={false}
                        href={job.href}
                        className="group flex items-center justify-between gap-4 border-border border-b py-4 transition-colors hover:bg-muted/35"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-sm">{job.title}</span>
                          <span className="mt-1 block truncate text-muted-foreground text-xs">{job.customerName}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 font-medium text-cyan-700 text-xs dark:text-cyan-300">
                          Choose date
                          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-muted-foreground text-sm">Every active job has a date.</p>
                )}
              </div>

              <div className="mt-6">
                <div className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">On hold</div>
                {onHoldJobs.length ? (
                  <div className="mt-2 border-border border-t">
                    {onHoldJobs.map((job) => (
                      <Link
                        key={job.id}
                        prefetch={false}
                        href={job.href}
                        className="group flex items-center justify-between gap-4 border-border border-b py-4 transition-colors hover:bg-muted/35"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-sm">{job.title}</span>
                          <span className="mt-1 block truncate text-muted-foreground text-xs">{job.customerName}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 font-medium text-amber-700 text-xs dark:text-amber-300">
                          Review next step
                          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-muted-foreground text-sm">No jobs are currently on hold.</p>
                )}
              </div>

              <div className="mt-6">
                <div className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">Upcoming by date</div>
                {scheduleItems.length ? (
                  <div className="mt-2 border-border border-t">
                    {scheduleItems.map((job) => (
                      <Link
                        key={job.id}
                        prefetch={false}
                        href={job.href}
                        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-border border-b py-4 transition-colors hover:bg-muted/35"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-sm">{job.title}</span>
                          <span className="mt-1 block truncate text-muted-foreground text-xs">
                            {job.customerName} · {job.status}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block font-medium text-sm">
                            {new Intl.DateTimeFormat("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            }).format(new Date(job.dateBegin))}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-muted-foreground text-sm">No upcoming jobs have dates yet.</p>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
