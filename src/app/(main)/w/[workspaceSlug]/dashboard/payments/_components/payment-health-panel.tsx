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
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/60 dark:bg-emerald-950/15">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-9 w-[4.75rem] shrink-0 items-center border-r pr-4">
            <StripeWordmark className="w-full dark:hidden" variant="blurple" />
            <StripeWordmark className="hidden w-full dark:block" variant="white" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-sm">Payments are live</p>
              <Badge className="gap-1 border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700/60 dark:bg-emerald-900/50 dark:text-emerald-200">
                <CheckCircle2 className="size-3" /> Connected
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {lastProcessedAt
                ? `System healthy · Last event processed ${new Date(lastProcessedAt).toLocaleString()}.`
                : "Payment system healthy · No processing issues detected."}
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <form action={syncAction}>
              <Button type="submit" size="sm" variant="outline" disabled={syncing}>
                {syncing ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                Sync with Stripe
              </Button>
            </form>
            {manageControl}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300/80 bg-amber-50/55 p-4 dark:border-amber-900/70 dark:bg-amber-950/15">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-9 w-[4.75rem] shrink-0 items-center border-amber-300/70 border-r pr-4 dark:border-amber-800/70">
            <StripeWordmark className="w-full dark:hidden" variant="blurple" />
            <StripeWordmark className="hidden w-full dark:block" variant="white" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-sm">Stripe is connected</p>
              <Badge className="gap-1 border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-900/50 dark:text-amber-100">
                <AlertTriangle className="size-3" /> Attention needed
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {issueCount} payment {issueCount === 1 ? "item needs" : "items need"} attention. Retry events below or
              sync with Stripe.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {!!webhookIssues.length && <Badge variant="outline">{webhookIssues.length} webhook events</Badge>}
              {!!failedRefunds && <Badge variant="outline">{failedRefunds} failed refunds</Badge>}
              {!!openDisputes && <Badge variant="outline">{openDisputes} open disputes</Badge>}
            </div>
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <form action={syncAction}>
              <Button type="submit" size="sm" variant="outline" disabled={syncing || retrying}>
                {syncing ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                Sync with Stripe
              </Button>
            </form>
            {manageControl}
          </div>
        )}
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
