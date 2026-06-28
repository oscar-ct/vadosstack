"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, ListChecks } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ManagerActionQueueItem } from "../../_lib/manager-action-queue";

const MANAGER_QUEUE_PAGE_SIZE = 6;

const queueSeverityClasses: Record<ManagerActionQueueItem["severity"], string> = {
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

function formatCompactCurrency(value: number) {
  const absoluteValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absoluteValue >= 1_000_000) {
    const millions = Math.round((absoluteValue / 1_000_000) * 10) / 10;
    return `${sign}$${String(millions).replace(/\.0$/, "")}M`;
  }

  if (absoluteValue >= 1000) {
    const thousands = Math.round((absoluteValue / 1000) * 10) / 10;
    return `${sign}$${String(thousands).replace(/\.0$/, "")}K`;
  }

  return `${sign}$${Math.round(absoluteValue).toLocaleString("en-US")}`;
}

function formatQueueValue(value: string | number) {
  if (typeof value === "number") {
    return formatCompactCurrency(value);
  }

  return value;
}

export function ManagerActionQueue({ items }: { items: ManagerActionQueueItem[] }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / MANAGER_QUEUE_PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const pageStart = (currentPage - 1) * MANAGER_QUEUE_PAGE_SIZE;
  const visibleItems = useMemo(() => items.slice(pageStart, pageStart + MANAGER_QUEUE_PAGE_SIZE), [items, pageStart]);
  const primaryItem = visibleItems[0];
  const secondaryItems = visibleItems.slice(1);
  const showingFrom = items.length ? pageStart + 1 : 0;
  const showingTo = pageStart + visibleItems.length;

  useEffect(() => {
    setPage((current) => Math.min(Math.max(current, 1), pageCount));
  }, [pageCount]);

  function goToPage(nextPage: number) {
    setPage(Math.min(Math.max(nextPage, 1), pageCount));
  }

  return (
    <section className="overflow-hidden rounded-lg border border-cyan-500/25 bg-card shadow-sm">
      <div className="border-cyan-500/20 border-b bg-cyan-500/5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 text-cyan-700 text-xs uppercase tracking-[0.14em] dark:text-cyan-300">
              <ListChecks className="size-4" />
              Manager action queue
            </div>
            <h2 className="font-semibold text-2xl leading-tight">What needs a decision next</h2>
            <p className="mt-2 max-w-3xl text-muted-foreground text-sm leading-6">
              Leads, time reviews, estimates, job blockers, invoice prep, and receivables collected into one working
              list.
            </p>
          </div>
          <Badge variant="outline" className="w-fit rounded-md bg-background/80">
            {items.length} {items.length === 1 ? "action" : "actions"}
          </Badge>
        </div>
      </div>

      <div
        key={currentPage}
        className="grid gap-4 p-4 transition-opacity duration-150 sm:p-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.55fr)]"
        aria-live="polite"
      >
        {primaryItem ? (
          <Link
            prefetch={false}
            href={primaryItem.href}
            className="group grid min-h-52 content-between rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-4 transition-colors hover:bg-cyan-500/15"
          >
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("rounded-md", queueSeverityClasses[primaryItem.severity])}>
                  {primaryItem.priority}
                </Badge>
                <Badge variant="secondary" className="rounded-md">
                  {primaryItem.type}
                </Badge>
              </div>
              <p className="line-clamp-2 font-semibold text-xl leading-snug">{primaryItem.title}</p>
              <p className="mt-2 line-clamp-2 text-muted-foreground text-sm">{primaryItem.detail}</p>
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <span className="font-semibold text-2xl tabular-nums">{formatQueueValue(primaryItem.value)}</span>
              <span className="grid size-9 place-items-center rounded-md bg-background/80 text-muted-foreground transition-colors group-hover:text-foreground">
                <ArrowRight className="size-4" />
              </span>
            </div>
          </Link>
        ) : (
          <div className="grid min-h-52 place-items-center rounded-lg border border-dashed bg-muted/20 p-6 text-center">
            <div>
              <div className="mx-auto grid size-10 place-items-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25">
                <CheckCircle2 className="size-4" />
              </div>
              <p className="mt-3 font-medium text-sm">No urgent actions</p>
              <p className="mt-1 text-muted-foreground text-xs">The queue will fill as work needs review.</p>
            </div>
          </div>
        )}

        <div className="grid content-start gap-2">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="font-medium text-sm">Next in line</span>
            <Badge variant="outline" className="rounded-md">
              {items.length ? `Showing ${showingFrom}-${showingTo} of ${items.length}` : "0 actions"}
            </Badge>
          </div>
          {secondaryItems.length ? (
            secondaryItems.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                prefetch={false}
                href={item.href}
                className="group grid min-w-0 gap-3 rounded-md border bg-muted/25 px-3 py-2.5 transition-colors hover:bg-muted/45 sm:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("rounded-md", queueSeverityClasses[item.severity])}>
                      {item.priority}
                    </Badge>
                    <span className="text-muted-foreground text-xs">{item.type}</span>
                  </div>
                  <p className="mt-1 truncate font-medium text-sm">{item.title}</p>
                  <p className="truncate text-muted-foreground text-xs">{item.detail}</p>
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <span className="font-medium text-xs tabular-nums">{formatQueueValue(item.value)}</span>
                  <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </Link>
            ))
          ) : (
            <div className="grid min-h-36 place-items-center rounded-md border border-dashed bg-muted/20 p-6 text-center text-muted-foreground text-sm">
              No additional actions waiting.
            </div>
          )}
        </div>
      </div>

      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-cyan-500/20 border-t bg-cyan-500/5 px-4 py-3 sm:px-5">
          <span className="text-muted-foreground text-sm tabular-nums">
            Page {currentPage} of {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="bg-background/60"
              disabled={currentPage === 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              <ChevronLeft />
              Previous
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="bg-background/60"
              disabled={currentPage === pageCount}
              onClick={() => goToPage(currentPage + 1)}
            >
              Next
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
