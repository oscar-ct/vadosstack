"use client";

import * as React from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceRouter } from "@/components/workspace-path-provider";
import { cn } from "@/lib/utils";

import { getOrderFulfillmentAction, shipOrderItemsAction } from "../operations-actions";

type FulfillmentOrder = Awaited<ReturnType<typeof getOrderFulfillmentAction>>;

export function FulfillmentWizard({
  orderId,
  open,
  onOpenChange,
  initialOrder,
}: {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialOrder?: FulfillmentOrder;
}) {
  const router = useWorkspaceRouter();
  const [order, setOrder] = React.useState<FulfillmentOrder | null>(initialOrder ?? null);
  const [error, setError] = React.useState("");
  const [step, setStep] = React.useState(0);
  const [partial, setPartial] = React.useState(false);
  const [quantities, setQuantities] = React.useState<Record<string, string>>(() =>
    Object.fromEntries((initialOrder?.items ?? []).map((item) => [item.id, String(item.remaining)])),
  );
  const [carrier, setCarrier] = React.useState("");
  const [tracking, setTracking] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const attempt = React.useRef<{ signature: string; key: string } | null>(null);
  const saving = React.useRef(false);
  const id = React.useId();
  const initialOrderRef = React.useRef(initialOrder);
  initialOrderRef.current = initialOrder;

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const initial = initialOrderRef.current;
    setOrder(initial ?? null);
    setQuantities(Object.fromEntries((initial?.items ?? []).map((item) => [item.id, String(item.remaining)])));
    setError("");
    setStep(0);
    setPartial(false);
    setCarrier("");
    setTracking("");
    attempt.current = null;
    getOrderFulfillmentAction(orderId)
      .then((result) => {
        if (cancelled) return;
        if (initial && result.version === initial.version) return;
        setOrder(result);
        setQuantities(Object.fromEntries(result.items.map((item) => [item.id, String(item.remaining)])));
        if (initial) {
          setStep(0);
          setPartial(false);
          setError("This order changed. Review the updated remaining quantities before continuing.");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setOrder(null);
          setError(reason instanceof Error ? reason.message : "Could not load the order.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  const items =
    order?.items.map((item) => ({
      ...item,
      selected: partial ? Number(quantities[item.id]) : item.remaining,
    })) ?? [];
  const valid =
    items.length > 0 &&
    items.every(
      (item) =>
        (!partial || quantities[item.id]?.trim() !== "") &&
        Number.isInteger(item.selected) &&
        item.selected >= 0 &&
        item.selected <= item.remaining,
    ) &&
    items.some((item) => item.selected > 0);
  const remaining = items.reduce((total, item) => total + item.remaining - item.selected, 0);

  async function submit() {
    if (!order || !valid || saving.current) return;
    const fields = {
      carrier: carrier.trim(),
      trackingNumber: tracking.trim(),
      items: items
        .filter((item) => item.selected > 0)
        .map((item) => ({ orderItemId: item.id, quantity: item.selected })),
    };
    const signature = JSON.stringify({ version: order.version, ...fields });
    if (!attempt.current || attempt.current.signature !== signature)
      attempt.current = { signature, key: crypto.randomUUID() };
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await shipOrderItemsAction({
        orderId: order.id,
        expectedVersion: order.version,
        submissionKey: attempt.current.key,
        ...fields,
      });
      toast.success("Fulfillment recorded.");
      onOpenChange(false);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Fulfillment could not be recorded.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent
        allowAutoFocus
        disableOutsideClose={busy}
        showCloseButton={!busy}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[min(34rem,90svh)] sm:max-h-[90svh] sm:w-[calc(100vw-3rem)] sm:max-w-2xl sm:rounded-xl"
      >
        <DialogHeader className="shrink-0 gap-3 border-b px-5 py-4 pr-12 sm:px-6">
          <DialogTitle>Record fulfillment{order ? ` · ${order.orderNumber}` : ""}</DialogTitle>
          <DialogDescription>Record items shipped or picked up by the customer.</DialogDescription>
          <ol aria-label="Fulfillment steps" className="flex items-center gap-3 text-xs">
            {["Items", "Details", "Review"].map((label, index) => (
              <li
                key={label}
                aria-current={step === index ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5",
                  step === index ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border tabular-nums",
                    step === index && "border-foreground bg-foreground text-background",
                  )}
                >
                  {index + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {error ? (
            <p role="alert" className="mb-4 text-destructive text-sm">
              {error}
            </p>
          ) : null}
          {!order && !error ? <p className="text-muted-foreground">Loading order…</p> : null}
          {order && step === 0 ? (
            <div className="grid gap-4">
              <h3 className="font-semibold">Which items are being fulfilled?</h3>
              <label className="flex items-start gap-2 rounded-lg border p-3">
                <input type="radio" name={`${id}-mode`} checked={!partial} onChange={() => setPartial(false)} />{" "}
                <span>
                  <span className="block font-medium">All remaining items</span>
                  <span className="text-muted-foreground text-xs">Fulfill every remaining item and quantity.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-lg border p-3">
                <input type="radio" name={`${id}-mode`} checked={partial} onChange={() => setPartial(true)} />{" "}
                <span>
                  <span className="block font-medium">Only some items</span>
                  <span className="text-muted-foreground text-xs">
                    Choose how many of each item are being fulfilled now.
                  </span>
                </span>
              </label>
              <div className="grid gap-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 p-3">
                    <div className="min-w-0">
                      <p className="break-words font-medium">{item.product}</p>
                      <p className="text-muted-foreground text-xs">{item.remaining} remaining</p>
                    </div>
                    {partial ? (
                      <Input
                        aria-label={`Quantity to fulfill: ${item.product}`}
                        className="w-24 shrink-0"
                        type="number"
                        min="0"
                        max={item.remaining}
                        step="1"
                        value={quantities[item.id] ?? ""}
                        onChange={(event) =>
                          setQuantities((current) => ({ ...current, [item.id]: event.target.value }))
                        }
                      />
                    ) : (
                      <span className="shrink-0 text-sm">Qty {item.remaining}</span>
                    )}
                  </div>
                ))}
              </div>
              {partial && !valid ? (
                <p className="text-destructive text-xs">
                  Enter a whole quantity for each item, from zero up to the amount remaining. Select at least one item.
                </p>
              ) : null}
            </div>
          ) : null}
          {order && step === 1 ? (
            <div className="grid gap-4">
              <h3 className="font-semibold">Fulfillment details</h3>
              <p className="text-muted-foreground text-sm">Both fields are optional.</p>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-carrier`}>Carrier or pickup</Label>
                  <Input
                    id={`${id}-carrier`}
                    placeholder="UPS, pickup…"
                    maxLength={100}
                    value={carrier}
                    onChange={(event) => setCarrier(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-tracking`}>Tracking number</Label>
                  <Input
                    id={`${id}-tracking`}
                    placeholder="Optional"
                    maxLength={200}
                    value={tracking}
                    onChange={(event) => setTracking(event.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}
          {order && step === 2 ? (
            <div className="grid gap-4">
              <h3 className="font-semibold">Review fulfillment</h3>
              <div className="grid gap-2">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 rounded-md bg-muted/40 p-3">
                    <span className="break-words">{item.product}</span>
                    <span className="shrink-0">
                      {item.selected} of {item.remaining}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground text-sm">
                {remaining
                  ? `${remaining} ${remaining === 1 ? "unit will" : "units will"} remain unfulfilled.`
                  : "All remaining items will be fulfilled."}
              </p>
              <p className="text-muted-foreground text-sm">
                Carrier or pickup: {carrier.trim() || "Not provided"}
                <br />
                Tracking number: {tracking.trim() || "Not provided"}
              </p>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 justify-between gap-3 border-t px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => (step ? setStep(step - 1) : onOpenChange(false))}
          >
            {step ? "Back" : "Cancel"}
          </Button>
          {order ? (
            <Button
              type="button"
              disabled={busy || !valid}
              onClick={() => (step < 2 ? setStep(step + 1) : void submit())}
            >
              {busy ? "Saving…" : step === 2 ? "Record fulfillment" : step === 1 ? "Review fulfillment" : "Continue"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
