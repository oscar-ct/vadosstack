"use client";

import { type ReactNode, useActionState, useEffect } from "react";

import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { StripeWordmark } from "@/components/stripe-wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { type PaymentHealthActionState, reconcileStripePaymentsAction, retryStripeWebhookAction } from "../actions";

type WebhookIssue = {
  attemptCount: number;
  eventType: string;
  id: string;
  lastError: string | null;
  nextAttemptAt: string | null;
  receivedAt: string;
  status: string;
};

const initialState: PaymentHealthActionState = { success: false, message: "" };

function useActionToast(state: PaymentHealthActionState) {
  useEffect(() => {
    if (!state.message) return;
    if (state.success) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);
}

export type PaymentHealthPanelProps = {
  canManage: boolean;
  closeControl?: ReactNode;
  failedRefunds: number;
  healthy: boolean;
  issueCount: number;
  lastProcessedAt: string | null;
  manageControl?: ReactNode;
  openDisputes: number;
  webhookIssues: WebhookIssue[];
};

export function PaymentHealthPanel({
  canManage,
  closeControl,
  failedRefunds,
  healthy,
  issueCount,
  lastProcessedAt,
  manageControl,
  openDisputes,
  webhookIssues,
}: PaymentHealthPanelProps) {
  const [syncState, syncAction, syncing] = useActionState(reconcileStripePaymentsAction, initialState);
  const [retryState, retryAction, retrying] = useActionState(retryStripeWebhookAction, initialState);
  useActionToast(syncState);
  useActionToast(retryState);

  if (healthy) {
    return (
      <div className="relative isolate overflow-hidden rounded-[1.5rem] border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-background to-teal-50 p-5 shadow-sm sm:p-6 dark:border-emerald-400/20 dark:from-emerald-950/30 dark:via-background dark:to-teal-950/20">
        <div aria-hidden className="absolute -top-20 -right-16 -z-10 size-56 rounded-full bg-emerald-400/12 blur-3xl" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-14 w-24 shrink-0 items-center rounded-xl border border-emerald-200/70 bg-white px-3 shadow-sm">
              <StripeWordmark className="w-full" variant="blurple" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-emerald-700 text-xs uppercase tracking-[0.18em] dark:text-emerald-300">
                Stripe provider
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-xl tracking-tight sm:text-2xl">Payments are live</h2>
                <Badge className="gap-1 border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700/60 dark:bg-emerald-900/50 dark:text-emerald-200">
                  <CheckCircle2 className="size-3" /> Connected
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-muted-foreground text-sm leading-6">
                Stripe is connected and ready to accept online invoice payments and receive payouts.
              </p>
            </div>
          </div>
          {canManage || closeControl != null ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {canManage ? (
                <>
                  <form action={syncAction}>
                    <Button disabled={syncing} size="sm" type="submit" variant="outline">
                      {syncing ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                      Sync with Stripe
                    </Button>
                  </form>
                  {manageControl}
                </>
              ) : null}
              {closeControl}
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-200/60 bg-white/70 p-3 dark:border-emerald-400/15 dark:bg-white/5">
            <p className="text-muted-foreground text-xs">Connection</p>
            <p className="mt-1 font-medium text-emerald-700 text-sm dark:text-emerald-300">Active</p>
          </div>
          <div className="rounded-xl border border-emerald-200/60 bg-white/70 p-3 dark:border-emerald-400/15 dark:bg-white/5">
            <p className="text-muted-foreground text-xs">Payment processing</p>
            <p className="mt-1 font-medium text-emerald-700 text-sm dark:text-emerald-300">Healthy</p>
          </div>
          <div className="rounded-xl border border-emerald-200/60 bg-white/70 p-3 dark:border-emerald-400/15 dark:bg-white/5">
            <p className="text-muted-foreground text-xs">Last Stripe activity</p>
            <p className="mt-1 truncate font-medium text-sm">
              {lastProcessedAt ? new Date(lastProcessedAt).toLocaleString() : "No events received yet"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate overflow-hidden rounded-[1.5rem] border border-amber-300/80 bg-gradient-to-br from-amber-50 via-background to-orange-50 p-5 shadow-sm sm:p-6 dark:border-amber-900/70 dark:from-amber-950/30 dark:via-background dark:to-orange-950/20">
      <div aria-hidden className="absolute -top-20 -right-16 -z-10 size-56 rounded-full bg-amber-400/15 blur-3xl" />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-14 w-24 shrink-0 items-center rounded-xl border border-amber-300/70 bg-white px-3 shadow-sm">
            <StripeWordmark className="w-full" variant="blurple" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-amber-700 text-xs uppercase tracking-[0.18em] dark:text-amber-300">
              Stripe provider
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-xl tracking-tight sm:text-2xl">Stripe needs attention</h2>
              <Badge className="gap-1 border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-900/50 dark:text-amber-100">
                <AlertTriangle className="size-3" /> Attention needed
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-muted-foreground text-sm leading-6">
              {issueCount} payment {issueCount === 1 ? "item needs" : "items need"} attention. Retry events below or
              sync with Stripe.
            </p>
          </div>
        </div>
        {canManage || closeControl != null ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canManage ? (
              <>
                <form action={syncAction}>
                  <Button disabled={syncing || retrying} size="sm" type="submit" variant="outline">
                    {syncing ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                    Sync with Stripe
                  </Button>
                </form>
                {manageControl}
              </>
            ) : null}
            {closeControl}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-300/60 bg-white/70 p-3 dark:border-amber-400/15 dark:bg-white/5">
          <p className="text-muted-foreground text-xs">Webhook events</p>
          <p className="mt-1 font-medium text-sm">{webhookIssues.length}</p>
        </div>
        <div className="rounded-xl border border-amber-300/60 bg-white/70 p-3 dark:border-amber-400/15 dark:bg-white/5">
          <p className="text-muted-foreground text-xs">Failed refunds</p>
          <p className="mt-1 font-medium text-sm">{failedRefunds}</p>
        </div>
        <div className="rounded-xl border border-amber-300/60 bg-white/70 p-3 dark:border-amber-400/15 dark:bg-white/5">
          <p className="text-muted-foreground text-xs">Open disputes</p>
          <p className="mt-1 font-medium text-sm">{openDisputes}</p>
        </div>
      </div>

      {!!webhookIssues.length && (
        <div className="mt-4 divide-y overflow-hidden rounded-lg border bg-background/80">
          {webhookIssues.map((issue) => (
            <div key={issue.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">{issue.eventType}</span>
                  <Badge variant="outline" className="capitalize">
                    {issue.status}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {issue.attemptCount} {issue.attemptCount === 1 ? "attempt" : "attempts"}
                  </span>
                </div>
                <p className="mt-1 truncate text-muted-foreground text-xs">
                  {issue.lastError ?? "Processing was interrupted before completion."}
                </p>
              </div>
              {canManage && (
                <form action={retryAction}>
                  <input type="hidden" name="eventId" value={issue.id} />
                  <Button type="submit" size="sm" variant="outline" disabled={retrying || syncing}>
                    {retrying ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}
                    Retry
                  </Button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
