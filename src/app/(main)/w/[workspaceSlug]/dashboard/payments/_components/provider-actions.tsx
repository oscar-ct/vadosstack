"use client";

import { useActionState, useEffect, useState } from "react";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BadgeDollarSign,
  Check,
  CreditCard,
  ExternalLink,
  Link2Off,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Unplug,
  WalletCards,
} from "lucide-react";

import { StripeWordmark } from "@/components/stripe-wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { StripePaymentMethodReadiness, StripePaymentMethodStatus } from "@/lib/payments/stripe-payment-methods";
import { cn } from "@/lib/utils";

import {
  connectStripeAction,
  disconnectStripeAction,
  openStripeDashboardAction,
  openStripePaymentMethodsAction,
  type StripeConnectionActionState,
} from "../actions";
import { PaymentHealthPanel, type PaymentHealthPanelProps } from "./payment-health-panel";

const initialState: StripeConnectionActionState = { success: false, message: "" };

type StripeSetupExperienceProps = {
  canManage: boolean;
  configured: boolean;
  connected: boolean;
  feeLabel: string;
  health: Omit<PaymentHealthPanelProps, "manageControl">;
  paymentMethods: StripePaymentMethodReadiness | null;
  ready: boolean;
  requiresReconnect: boolean;
  returnedIncomplete: boolean;
  showReadyCelebration: boolean;
  status: string;
};

function paymentMethodStatusLabel(status: StripePaymentMethodStatus) {
  if (status === "active") return "Active";
  if (status === "pending") return "Pending";
  return "Needs activation";
}

function paymentMethodStatusClass(status: StripePaymentMethodStatus) {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200";
  }
  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200";
  }
  return "border-border bg-muted text-muted-foreground";
}

function setupState({
  configured,
  connected,
  ready,
  requiresReconnect,
}: Pick<StripeSetupExperienceProps, "configured" | "connected" | "ready" | "requiresReconnect">) {
  if (!configured) {
    return {
      button: "Setup unavailable",
      description: "Stripe needs one deployment setting before company onboarding can begin.",
      eyebrow: "Configuration needed",
      progress: 0,
      step: "0 of 3 complete",
      title: "Prepare secure online payments",
    };
  }
  if (ready) {
    return {
      button: "Manage Stripe",
      description: "Your company can accept secure USD invoice payments and receive payouts through Stripe.",
      eyebrow: "Payments are live",
      progress: 100,
      step: "3 of 3 complete",
      title: "You’re ready to get paid",
    };
  }
  if (requiresReconnect) {
    return {
      button: "Finish upgrade",
      description: "Replace the legacy connection with a full Stripe Dashboard account to enable direct payments.",
      eyebrow: "One quick upgrade",
      progress: 34,
      step: "1 of 3 complete",
      title: "Unlock invoice payments",
    };
  }
  if (connected) {
    return {
      button: "Continue setup",
      description: "Your Stripe account is connected. Finish verification to turn on payments and payouts.",
      eyebrow: "Setup in progress",
      progress: 67,
      step: "2 of 3 complete",
      title: "Almost ready to accept payments",
    };
  }
  return {
    button: "Set up now",
    description: "Connect your company’s Stripe account and give customers a polished way to pay invoices online.",
    eyebrow: "Get paid online",
    progress: 8,
    step: "Ready to begin",
    title: "Turn invoices into payments",
  };
}

function setupTone({
  configured,
  connected,
  ready,
  requiresReconnect,
}: Pick<StripeSetupExperienceProps, "configured" | "connected" | "ready" | "requiresReconnect">) {
  if (!configured) {
    return {
      button: "bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-lg shadow-rose-500/20 hover:opacity-95",
      detailIcon: "text-rose-600 dark:text-rose-300",
      eyebrow: "text-rose-700 dark:text-rose-300",
      glow: "bg-rose-400/15 dark:bg-rose-500/10",
      panel:
        "border-rose-200/80 bg-gradient-to-br from-rose-50 via-background to-orange-50 dark:border-rose-400/20 dark:from-rose-950/35 dark:via-background dark:to-orange-950/25",
      progress: "bg-gradient-to-r from-rose-600 to-orange-500 shadow-[0_0_18px_rgba(244,63,94,0.3)]",
      step: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200",
    };
  }
  if (ready) {
    return {
      button:
        "border border-emerald-300 bg-background text-emerald-700 shadow-sm hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-200 dark:hover:bg-emerald-400/10",
      detailIcon: "text-emerald-600 dark:text-emerald-300",
      eyebrow: "text-emerald-700 dark:text-emerald-300",
      glow: "bg-emerald-400/8",
      panel:
        "border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 via-background to-teal-50/70 dark:border-emerald-400/20 dark:from-emerald-950/25 dark:via-background dark:to-teal-950/20",
      progress: "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_14px_rgba(16,185,129,0.25)]",
      step: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200",
    };
  }
  if (connected || requiresReconnect) {
    return {
      button: "bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-amber-500/15 shadow-lg hover:opacity-95",
      detailIcon: "text-amber-600 dark:text-amber-300",
      eyebrow: "text-amber-700 dark:text-amber-300",
      glow: "bg-amber-400/15 dark:bg-amber-500/10",
      panel:
        "border-amber-200/80 bg-gradient-to-br from-amber-50 via-background to-orange-50 dark:border-amber-400/20 dark:from-amber-950/35 dark:via-background dark:to-orange-950/25",
      progress: "bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.24)]",
      step: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200",
    };
  }
  return {
    button: "bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg shadow-sky-500/20 hover:opacity-95",
    detailIcon: "text-sky-600 dark:text-sky-300",
    eyebrow: "text-sky-700 dark:text-sky-300",
    glow: "bg-sky-400/15 dark:bg-sky-500/10",
    panel:
      "border-sky-200/80 bg-gradient-to-br from-sky-50 via-background to-cyan-50 dark:border-sky-400/20 dark:from-sky-950/35 dark:via-background dark:to-cyan-950/25",
    progress: "bg-gradient-to-r from-sky-500 to-blue-600 shadow-[0_0_18px_rgba(14,165,233,0.35)]",
    step: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200",
  };
}

export function StripeSetupExperience(props: StripeSetupExperienceProps) {
  const {
    canManage,
    configured,
    connected,
    feeLabel,
    health,
    paymentMethods,
    ready,
    requiresReconnect,
    returnedIncomplete,
    showReadyCelebration,
    status,
  } = props;
  const reduceMotion = useReducedMotion();
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(disconnectStripeAction, initialState);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionMessageDismissed, setActionMessageDismissed] = useState(false);
  const state = setupState(props);
  const tone = setupTone(props);

  useEffect(() => {
    if (!returnedIncomplete && !showReadyCelebration) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("stripe")) return;
    url.searchParams.delete("stripe");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [returnedIncomplete, showReadyCelebration]);

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) setActionMessageDismissed(true);
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
      {ready && !showReadyCelebration ? (
        <PaymentHealthPanel
          {...health}
          manageControl={
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                Manage Stripe
              </Button>
            </DialogTrigger>
          }
        />
      ) : (
        <section
          className={cn(
            "relative isolate overflow-hidden rounded-[1.5rem] border p-5 shadow-sm transition-colors sm:p-6",
            tone.panel,
          )}
        >
          <div
            aria-hidden
            className={cn("absolute -top-20 -right-16 -z-10 size-56 rounded-full blur-3xl", tone.glow)}
          />
          <div
            aria-hidden
            className={cn(
              "absolute -bottom-24 left-1/4 -z-10 size-52 rounded-full blur-3xl",
              ready ? "bg-teal-400/8" : "bg-white/30 dark:bg-white/5",
            )}
          />

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-4">
                <span className="relative flex h-10 w-[4.5rem] shrink-0 items-center border-r pr-4">
                  <StripeWordmark className="w-full dark:hidden" variant="blurple" />
                  <StripeWordmark className="hidden w-full dark:block" variant="white" />
                  {ready ? (
                    <span className="absolute -top-0.5 right-2 grid size-4 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-background">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                </span>
                <div>
                  <p className={cn("font-semibold text-xs uppercase tracking-[0.18em]", tone.eyebrow)}>
                    {state.eyebrow}
                  </p>
                  <h2 className="mt-0.5 font-semibold text-xl tracking-tight sm:text-2xl">{state.title}</h2>
                </div>
              </div>
              <p className="mt-3 max-w-2xl text-muted-foreground text-sm leading-6">{state.description}</p>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                  <span className="font-medium">Stripe setup</span>
                  <span className="text-muted-foreground">{state.step}</span>
                </div>
                <div
                  aria-label={`Stripe setup ${state.progress}% complete`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={state.progress}
                  className="relative h-3 overflow-hidden rounded-full bg-white/80 shadow-inner ring-1 ring-black/10 dark:bg-white/10 dark:ring-white/10"
                  role="progressbar"
                >
                  <motion.div
                    className={cn("relative h-full rounded-full", tone.progress)}
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: `${state.progress}%` }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className="absolute inset-0 bg-[linear-gradient(110deg,transparent_20%,rgba(255,255,255,0.55)_45%,transparent_70%)]" />
                  </motion.div>
                </div>
              </div>
            </div>

            <DialogTrigger asChild>
              <Button
                className={cn(
                  "group h-12 shrink-0 rounded-xl px-6 transition hover:scale-[1.02] disabled:opacity-60",
                  tone.button,
                )}
                disabled={!canManage}
                size="lg"
              >
                {canManage ? state.button : "Admin access required"}
                {/*<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />*/}
              </Button>
            </DialogTrigger>
          </div>
        </section>
      )}

      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto p-0 shadow-2xl shadow-black/20 sm:max-w-xl">
        <div className="relative isolate overflow-hidden rounded-t-xl bg-gradient-to-br from-[#635BFF] via-indigo-600 to-violet-600 px-6 pt-9 pb-8 text-white sm:px-8">
          <div aria-hidden className="absolute -top-16 -right-10 -z-10 size-48 rounded-full bg-white/20 blur-3xl" />
          <div
            aria-hidden
            className="absolute -bottom-20 -left-10 -z-10 size-44 rounded-full bg-cyan-300/25 blur-3xl"
          />
          <motion.div
            className="mb-6 flex h-10 items-center"
            initial={reduceMotion ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 22 }}
          >
            <StripeWordmark className="w-24" variant="white" />
          </motion.div>
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1.5 border-white/20 bg-white/15 px-2.5 py-1 text-white hover:bg-white/15">
                <LockKeyhole className="size-3" /> Secure account connection
              </Badge>
            </div>
            <DialogTitle className="mt-2 text-2xl text-white sm:text-3xl">
              {ready ? "Stripe setup complete" : "A beautiful checkout starts here"}
            </DialogTitle>
            <DialogDescription className="max-w-md text-white/80 leading-6">
              {ready
                ? "Your Stripe connection is ready. Payments go directly to your company’s Stripe balance."
                : "Stripe guides you through identity, business, and payout details. VadosStack never stores bank or card credentials."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-6 sm:px-8">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: LockKeyhole, label: "Secure", value: "Stripe hosted" },
              { icon: BadgeDollarSign, label: "Currency", value: "USD only" },
              { icon: ShieldCheck, label: "VadosStack fee", value: feeLabel },
            ].map((item) => (
              <div className="rounded-xl border bg-muted/35 p-3" key={item.label}>
                <item.icon className={cn("size-4", tone.detailIcon)} />
                <p className="mt-2 text-muted-foreground text-xs">{item.label}</p>
                <p className="mt-0.5 font-medium text-sm">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {[
              { complete: connected, label: "Connect your company’s Stripe account" },
              { complete: ready, label: "Complete Stripe business verification" },
              { complete: ready, label: "Accept payments and receive payouts" },
            ].map((item, index) => (
              <div className="flex items-center gap-3" key={item.label}>
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border font-semibold text-xs",
                    item.complete ? "border-emerald-500 bg-emerald-500 text-white" : tone.step,
                  )}
                >
                  {item.complete ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className={cn("text-sm", item.complete && "text-muted-foreground")}>{item.label}</span>
              </div>
            ))}
          </div>

          {connected ? (
            <section className="overflow-hidden rounded-xl border bg-muted/20">
              <div className="border-b px-4 py-3">
                <h3 className="font-medium text-sm">Payment methods</h3>
                <p className="mt-0.5 text-muted-foreground text-xs">
                  Availability comes from this company’s connected Stripe account.
                </p>
              </div>
              <div className="divide-y">
                {[
                  {
                    activeLabel: null,
                    detail: "Visa, Mastercard, Amex, Discover, and other supported cards",
                    icon: CreditCard,
                    label: "Cards",
                    status: paymentMethods?.cards ?? null,
                  },
                  {
                    activeLabel: "Eligible devices",
                    detail: "Apple Pay and Google Pay appear automatically on eligible devices",
                    icon: WalletCards,
                    label: "Device wallets",
                    status: paymentMethods?.cards ?? null,
                  },
                  {
                    activeLabel: null,
                    detail: "One-time USD invoice payments through the Cash App wallet",
                    icon: Smartphone,
                    label: "Cash App Pay",
                    status: paymentMethods?.cashApp ?? null,
                  },
                ].map((item) => (
                  <div className="flex items-center gap-3 px-4 py-3" key={item.label}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-background ring-1 ring-border">
                      <item.icon className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-muted-foreground text-xs leading-5">{item.detail}</p>
                    </div>
                    {item.status ? (
                      <Badge className={cn("shrink-0 hover:bg-inherit", paymentMethodStatusClass(item.status))}>
                        {item.status === "active" && item.activeLabel
                          ? item.activeLabel
                          : paymentMethodStatusLabel(item.status)}
                      </Badge>
                    ) : (
                      <Badge className="shrink-0" variant="outline">
                        Status unavailable
                      </Badge>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-background ring-1 ring-border">
                    <Link2Off className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">Link</p>
                    <p className="text-muted-foreground text-xs leading-5">
                      Disabled to prevent unreviewed bank and financing options
                    </p>
                  </div>
                  <Badge className="shrink-0" variant="outline">
                    Disabled by VadosStack
                  </Badge>
                </div>
              </div>
              {ready ? (
                <form action={openStripePaymentMethodsAction} className="border-t p-3">
                  <Button className="w-full" size="sm" type="submit" variant="outline">
                    Open payment method settings <ExternalLink className="size-4" />
                  </Button>
                </form>
              ) : null}
            </section>
          ) : null}

          {returnedIncomplete && connected && !ready ? (
            <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-amber-950 text-sm dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
              Stripe still needs a little more information. Continue setup where you left off.
            </div>
          ) : null}

          {!configured ? (
            <div className="rounded-xl border border-rose-300/70 bg-rose-50 p-3 text-rose-950 text-sm dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-100">
              STRIPE_SECRET_KEY is not configured for this deployment. Add it before starting company onboarding.
            </div>
          ) : null}

          {requiresReconnect ? (
            <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-4 dark:border-amber-400/25 dark:bg-amber-400/10">
              <p className="font-medium text-amber-950 text-sm dark:text-amber-100">Replace the legacy connection</p>
              <p className="mt-1 text-amber-900/80 text-xs leading-5 dark:text-amber-100/75">
                Disconnect this sandbox connection first. Then reopen setup and connect a full Stripe Dashboard account.
              </p>
            </div>
          ) : null}

          <div className="grid gap-2">
            {ready ? (
              <form action={openStripeDashboardAction}>
                <Button className="h-11 w-full rounded-xl" size="lg" type="submit">
                  Open Stripe dashboard <ExternalLink className="size-4" />
                </Button>
              </form>
            ) : requiresReconnect ? (
              <form action={disconnectAction} onSubmit={() => setActionMessageDismissed(false)}>
                <Button className="h-11 w-full rounded-xl" disabled={disconnectPending} size="lg" type="submit">
                  <RefreshCw className={cn("size-4", disconnectPending && "animate-spin")} />
                  {disconnectPending ? "Preparing upgrade…" : "Disconnect legacy account"}
                </Button>
              </form>
            ) : configured ? (
              <form action={connectStripeAction}>
                <Button className={cn("h-11 w-full rounded-xl border-0", tone.button)} size="lg" type="submit">
                  {connected ? "Continue secure setup" : "Start secure setup"} <ArrowRight className="size-4" />
                </Button>
              </form>
            ) : (
              <Button className="h-11 w-full rounded-xl" disabled size="lg">
                Setup unavailable
              </Button>
            )}

            {connected && !requiresReconnect ? (
              <form action={disconnectAction} className="text-center" onSubmit={() => setActionMessageDismissed(false)}>
                <Button className="text-muted-foreground" disabled={disconnectPending} type="submit" variant="ghost">
                  <Unplug className="size-4" /> {disconnectPending ? "Disconnecting…" : "Disconnect Stripe"}
                </Button>
              </form>
            ) : null}
          </div>

          {disconnectState.message && !disconnectPending && !actionMessageDismissed ? (
            <p
              className={cn(
                "text-center text-sm",
                disconnectState.success ? "text-emerald-700 dark:text-emerald-300" : "text-destructive",
              )}
            >
              {disconnectState.message}
            </p>
          ) : null}

          <p className="text-center text-muted-foreground text-xs">
            Current connection: <span className="capitalize">{status.replaceAll("_", " ")}</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
