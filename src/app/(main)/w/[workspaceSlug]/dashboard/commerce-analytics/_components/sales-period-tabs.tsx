"use client";

import { useId, useOptimistic, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { LayoutGroup, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

import { type SalesView, salesViews } from "../_lib/sales-periods";

export function SalesPeriodTabs({ selected }: { selected: SalesView }) {
  const router = useRouter();
  const groupId = useId();
  const reduceMotion = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useOptimistic(selected);
  return (
    <nav aria-label="Sales reporting period" aria-busy={pending} className="flex justify-center">
      <LayoutGroup id={groupId}>
        <div className="isolate grid w-full max-w-2xl grid-cols-5 gap-1 rounded-xl bg-muted p-1">
          {salesViews.map((view) => (
            <Link
              key={view.value}
              href={`?period=${view.value}`}
              scroll={false}
              aria-current={active === view.value ? "page" : undefined}
              aria-label={view.label}
              onNavigate={(event) => {
                event.preventDefault();
                if (active === view.value) return;
                startTransition(() => {
                  setActive(view.value);
                  router.push(`?period=${view.value}`, { scroll: false });
                });
              }}
              className={cn(
                "relative flex min-h-9 min-w-0 items-center justify-center rounded-lg px-1 py-2 font-medium text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-3 sm:text-sm",
                active === view.value ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active === view.value ? (
                <motion.span
                  layoutId={reduceMotion ? undefined : "period-indicator"}
                  initial={false}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                  className="pointer-events-none absolute inset-0 -z-10 rounded-lg bg-primary shadow-sm"
                />
              ) : null}
              {view.value === "ytd" || view.value === "365" ? (
                <>
                  <span className="sm:hidden">{view.value === "ytd" ? "YTD" : "12 mo."}</span>
                  <span className="hidden sm:inline">{view.label}</span>
                </>
              ) : (
                view.label
              )}
            </Link>
          ))}
        </div>
      </LayoutGroup>
      <span role="status" className="sr-only">
        {pending ? "Updating sales metrics…" : ""}
      </span>
    </nav>
  );
}
