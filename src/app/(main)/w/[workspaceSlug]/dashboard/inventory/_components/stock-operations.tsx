"use client";

import * as React from "react";

import { ArrowRight, ArrowRightLeft, ClipboardCheck, PackageMinus, PackagePlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceRouter } from "@/components/workspace-path-provider";
import { previewStockAdjustment, type StockAdjustmentKind } from "@/lib/commerce/stock-adjustment";
import { cn } from "@/lib/utils";

import { adjustInventoryStockAction, getStockTransferLocationsAction } from "../stock-actions";
import type { InventoryItem } from "./inventory-table";
import { StockHistory } from "./stock-history";

const actions = {
  Receive: {
    title: "Add stock",
    description: "Record a delivery",
    quantityLabel: "Units received",
    help: "Add this quantity to the available stock.",
    note: "e.g. Supplier delivery #1042",
    icon: PackagePlus,
  },
  Count: {
    title: "Correct count",
    description: "Set the final available count",
    quantityLabel: "New available count",
    help: "Enter the final number available for new orders. Exclude units already reserved for open orders.",
    note: "e.g. Shelf count confirmed one available monitor",
    icon: ClipboardCheck,
  },
  Damage: {
    title: "Remove damaged stock",
    description: "Subtract unusable units",
    quantityLabel: "Units to remove",
    help: "Remove this many damaged or unusable units from available stock.",
    note: "e.g. Two units damaged in storage",
    icon: PackageMinus,
  },
  Transfer: {
    title: "Move stock",
    description: "Move units to another location",
    quantityLabel: "Units to move",
    help: "Subtract units here and add them to the destination below.",
    note: "e.g. Moved from storage to the showroom",
    icon: ArrowRightLeft,
  },
} as const;

const kinds: StockAdjustmentKind[] = ["Receive", "Count", "Damage", "Transfer"];

type TransferDestination = Awaited<ReturnType<typeof getStockTransferLocationsAction>>[number];
type AdjustmentPayload = Omit<Parameters<typeof adjustInventoryStockAction>[0], "submissionKey">;
type AdjustmentReview = {
  payload: AdjustmentPayload;
  product: string;
  location: string;
  before: number;
  after: number;
  change: number;
  destination?: TransferDestination;
};

const steps = ["Action", "Details", "Review"] as const;

export function StockOperations({ items }: { items: InventoryItem[] }) {
  const router = useWorkspaceRouter();
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const saving = React.useRef(false);
  const [itemId, setItemId] = React.useState("");
  const [kind, setKind] = React.useState<StockAdjustmentKind>("Receive");
  const [quantity, setQuantity] = React.useState("");
  const [destinationId, setDestinationId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [review, setReview] = React.useState<AdjustmentReview | null>(null);
  const attempt = React.useRef<{ signature: string; key: string } | null>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const item = items.find((entry) => entry.id === itemId);
  const config = actions[kind];
  const [transferLookup, setTransferLookup] = React.useState<{
    itemId: string;
    items: TransferDestination[];
    loading: boolean;
    error: string;
  }>({ itemId: "", items: [], loading: false, error: "" });
  const lookupVersion = React.useRef(0);
  const destinations = transferLookup.itemId === itemId ? transferLookup.items : [];
  const destination = destinations.find((entry) => entry.id === destinationId);
  const preview = item && quantity.trim() ? previewStockAdjustment(kind, item.stock, Number(quantity)) : null;
  const detailsValid = Boolean(
    item?.updatedAt &&
      preview?.valid &&
      notes.trim() &&
      (kind !== "Transfer" ||
        (destination && !destination.ambiguous && !transferLookup.loading && !transferLookup.error)),
  );
  const staleReview = Boolean(review && item?.updatedAt !== review.payload.expectedUpdatedAt);
  const selectClass =
    "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

  function begin(selectedId = "") {
    if (saving.current) return;
    lookupVersion.current++;
    setItemId(selectedId);
    setKind("Receive");
    setQuantity("");
    setDestinationId("");
    setNotes("");
    setError("");
    setReview(null);
    setTransferLookup({ itemId: "", items: [], loading: false, error: "" });
    setStep(0);
    setOpen(true);
  }

  React.useEffect(() => {
    function openAdjustment(event: Event) {
      const selectedId = (event as CustomEvent<{ itemId: string }>).detail?.itemId;
      if (!items.some((entry) => entry.id === selectedId) || saving.current) return;
      lookupVersion.current++;
      setItemId(selectedId);
      setKind("Receive");
      setQuantity("");
      setDestinationId("");
      setNotes("");
      setError("");
      setReview(null);
      setTransferLookup({ itemId: "", items: [], loading: false, error: "" });
      setStep(0);
      setOpen(true);
    }
    window.addEventListener("inventory:adjust-stock", openAdjustment);
    return () => window.removeEventListener("inventory:adjust-stock", openAdjustment);
  }, [items]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Step changes intentionally refocus the heading for keyboard and screen reader navigation.
  React.useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => heading.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, step]);

  async function loadDestinations(sourceId: string) {
    const version = ++lookupVersion.current;
    setTransferLookup({ itemId: sourceId, items: [], loading: true, error: "" });
    try {
      const options = await getStockTransferLocationsAction(sourceId);
      if (version === lookupVersion.current)
        setTransferLookup({ itemId: sourceId, items: options, loading: false, error: "" });
    } catch (failure) {
      if (version === lookupVersion.current)
        setTransferLookup({
          itemId: sourceId,
          items: [],
          loading: false,
          error: failure instanceof Error ? failure.message : "Destinations could not be loaded.",
        });
    }
  }

  function changeKind(next: StockAdjustmentKind) {
    lookupVersion.current++;
    setKind(next);
    setQuantity("");
    setDestinationId("");
    setReview(null);
    setError("");
    if (next === "Transfer" && itemId) void loadDestinations(itemId);
  }

  function changeItem(next: string) {
    lookupVersion.current++;
    setItemId(next);
    setQuantity("");
    setDestinationId("");
    setNotes("");
    setReview(null);
    setError("");
    if (kind === "Transfer" && next) void loadDestinations(next);
  }

  function reviewDetails() {
    if (!detailsValid || !item?.updatedAt || !preview?.valid) return;
    setReview({
      payload: {
        inventoryItemId: item.id,
        expectedUpdatedAt: item.updatedAt,
        kind,
        quantity: Number(quantity),
        ...(kind === "Transfer" ? { destinationLocationId: destinationId } : {}),
        notes: notes.trim(),
      },
      product: item.product,
      location: item.location,
      before: preview.available,
      after: preview.after,
      change: preview.change,
      ...(kind === "Transfer" && destination ? { destination: { ...destination } } : {}),
    });
    setError("");
    setStep(2);
  }

  async function saveReview() {
    if (saving.current || !review || (staleReview && !error)) return;
    const signature = JSON.stringify(review.payload);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      // Submit exactly the reviewed values. The server rechecks version, availability,
      // destination eligibility, and idempotency in one transaction.
      await adjustInventoryStockAction({ ...review.payload, submissionKey: attempt.current.key });
      attempt.current = null;
      const resultLabel = {
        Receive: "Stock added",
        Count: "Count saved",
        Damage: "Damaged stock removed",
        Transfer: "Stock moved",
      }[review.payload.kind];
      const message = `${resultLabel} for ${review.product}.`;
      setSuccess(message);
      toast.success(message);
      setOpen(false);
      setReview(null);
      setQuantity("");
      setDestinationId("");
      setNotes("");
      lookupVersion.current++;
      router.refresh();
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Stock could not be updated.";
      setError(message);
      toast.error(message);
      router.refresh();
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const unitWord = review?.payload.quantity === 1 ? "unit" : "units";
  const confirmation = review
    ? review.payload.kind === "Count"
      ? `Set available stock to ${review.payload.quantity.toLocaleString()}`
      : review.payload.kind === "Receive"
        ? `Add ${review.payload.quantity.toLocaleString()} ${unitWord}`
        : review.payload.kind === "Damage"
          ? `Remove ${review.payload.quantity.toLocaleString()} damaged ${unitWord}`
          : `Move ${review.payload.quantity.toLocaleString()} ${unitWord}`
    : "Confirm adjustment";

  return (
    <section className="mb-5 grid gap-3" aria-label="Stock adjustments and history">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
        <div className="grid gap-1">
          <h2 className="font-medium text-sm">Stock activity</h2>
          <p className="text-muted-foreground text-xs">Adjust inventory or review recorded stock changes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StockHistory />
          <Button type="button" size="sm" onClick={() => begin()} disabled={!items.length}>
            Adjust stock
          </Button>
        </div>
      </div>
      {success ? (
        <p role="status" className="text-emerald-700 text-sm dark:text-emerald-400">
          {success}
        </p>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (saving.current) return;
          setOpen(next);
          if (!next) lookupVersion.current++;
        }}
      >
        <DialogContent
          allowAutoFocus
          disableOutsideClose={busy}
          showCloseButton={!busy}
          className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[90svh] sm:w-[calc(100vw-3rem)] sm:max-w-2xl sm:rounded-xl"
        >
          <DialogHeader className="shrink-0 gap-3 border-b px-5 py-4 pr-12 sm:px-6">
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>
              {step === 0
                ? "Choose the product, location, and what changed."
                : step === 1
                  ? "Enter the quantity and a reference for this adjustment."
                  : "Check the balances before recording this change."}
            </DialogDescription>
            <ol aria-label="Adjustment steps" className="flex items-center gap-3 text-xs">
              {steps.map((label, index) => (
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
            {step > 0 && item ? (
              <div className="grid gap-1 rounded-lg bg-muted/50 px-3 py-2">
                <p className="break-words font-medium text-foreground text-sm">{item.product}</p>
                <p className="break-words text-xs">
                  {item.sku || "No SKU"} · {item.location} · {step === 2 && review ? review.before : item.stock}{" "}
                  available
                </p>
              </div>
            ) : null}
          </DialogHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (saving.current) return;
              if (step === 0 && item?.updatedAt) setStep(1);
              else if (step === 1) reviewDetails();
              else if (step === 2) void saveReview();
            }}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
              <fieldset disabled={busy} className="grid min-w-0 gap-5 disabled:opacity-70">
                <h3 ref={heading} tabIndex={-1} className="font-semibold text-base outline-none">
                  {step === 0 ? "What changed?" : step === 1 ? config.title : "Review adjustment"}
                </h3>
                {step === 0 ? (
                  <>
                    <div className="grid min-w-0 gap-2">
                      <Label htmlFor={`${id}-product`}>Product and current location</Label>
                      <select
                        id={`${id}-product`}
                        name="itemId"
                        className={selectClass}
                        value={itemId}
                        onChange={(event) => changeItem(event.target.value)}
                        required
                      >
                        <option value="">Choose a product…</option>
                        {items.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.product} · {entry.sku || "No SKU"} · {entry.location}
                          </option>
                        ))}
                      </select>
                      <p className="text-muted-foreground text-xs">
                        {item
                          ? `${item.stock} available${item.itemStatus === "Inactive" ? " · Archived record" : ""}`
                          : "Products shown are from the current inventory page."}
                      </p>
                    </div>
                    <fieldset className="grid gap-2">
                      <legend className="mb-2 font-medium text-sm">Action</legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {kinds.map((choice) => {
                          const option = actions[choice];
                          const Icon = option.icon;
                          return (
                            <div key={choice} className="relative">
                              <input
                                className="peer sr-only"
                                type="radio"
                                id={`${id}-${choice}`}
                                name="stock-action"
                                value={choice}
                                checked={kind === choice}
                                onChange={() => changeKind(choice)}
                              />
                              <label
                                htmlFor={`${id}-${choice}`}
                                className="flex h-full cursor-pointer items-start gap-2 rounded-lg border p-3 peer-checked:border-foreground peer-checked:bg-muted/60 peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                              >
                                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <span className="grid gap-1">
                                  <span className="font-medium text-sm">{option.title}</span>
                                  <span className="text-muted-foreground text-xs">{option.description}</span>
                                </span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </fieldset>
                  </>
                ) : null}
                {step === 1 ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor={`${id}-quantity`}>{config.quantityLabel}</Label>
                      <Input
                        id={`${id}-quantity`}
                        name="quantity"
                        type="number"
                        min={kind === "Count" ? 0 : 1}
                        max={1_000_000}
                        step="1"
                        value={quantity}
                        onChange={(event) => {
                          setQuantity(event.target.value);
                          setReview(null);
                          setError("");
                        }}
                        aria-describedby={`${id}-quantity-help`}
                        aria-invalid={preview && !preview.valid ? true : undefined}
                        required
                        placeholder={kind === "Count" ? "Final available total" : "Number of units"}
                      />
                      <p id={`${id}-quantity-help`} className="text-muted-foreground text-xs">
                        {config.help}
                      </p>
                      {preview && !preview.valid ? (
                        <p role="alert" className="text-destructive text-sm">
                          {preview.error}
                        </p>
                      ) : null}
                    </div>
                    {kind === "Transfer" ? (
                      <div className="grid gap-2">
                        <Label htmlFor={`${id}-destination`}>Move to</Label>
                        <select
                          id={`${id}-destination`}
                          name="destinationLocationId"
                          className={selectClass}
                          value={destinationId}
                          onChange={(event) => {
                            setDestinationId(event.target.value);
                            setReview(null);
                            setError("");
                          }}
                          required
                          disabled={!item || transferLookup.loading || !destinations.length}
                        >
                          <option value="">
                            {transferLookup.loading ? "Loading destinations…" : "Choose a destination…"}
                          </option>
                          {destinations.map((entry) => (
                            <option key={entry.id} value={entry.id} disabled={entry.ambiguous}>
                              {entry.location}
                              {entry.ambiguous
                                ? " · Duplicate items need review"
                                : entry.createsItem
                                  ? " · New location for this product"
                                  : ` · ${entry.stock} available`}
                            </option>
                          ))}
                        </select>
                        <p className="text-muted-foreground text-xs">
                          {transferLookup.error
                            ? transferLookup.error
                            : transferLookup.loading
                              ? "Loading other locations…"
                              : destinations.length
                                ? "Choose a destination location. We will create its inventory record if needed."
                                : "No other locations are available. Add a location under Manage first."}
                        </p>
                        {transferLookup.error ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (item) void loadDestinations(item.id);
                            }}
                          >
                            Retry destinations
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="grid gap-2">
                      <Label htmlFor={`${id}-notes`}>
                        Reference or reason <span className="font-normal text-muted-foreground">(required)</span>
                      </Label>
                      <Input
                        id={`${id}-notes`}
                        name="notes"
                        value={notes}
                        onChange={(event) => {
                          setNotes(event.target.value);
                          setReview(null);
                          setError("");
                        }}
                        placeholder={config.note}
                        maxLength={1000}
                        required
                      />
                    </div>
                  </>
                ) : null}
                {step === 2 && review ? (
                  <>
                    <p className="text-muted-foreground text-sm">
                      {actions[review.payload.kind].title} · {review.payload.quantity.toLocaleString()} {unitWord}
                      {review.payload.kind === "Count" ? " available after counting" : ""}
                    </p>
                    <div className="grid gap-3 rounded-xl border bg-muted/30 p-4">
                      <h4 className="font-medium text-sm">{review.location}</h4>
                      <p className="text-muted-foreground text-xs">Available stock · before → after</p>
                      <p className="flex items-center gap-3 text-2xl tabular-nums">
                        <span className="text-muted-foreground">{review.before}</span>
                        <ArrowRight className="size-5" aria-label="changes to" />
                        <strong>{review.after}</strong>
                      </p>
                      {review.payload.kind === "Count" ? (
                        <p className="text-muted-foreground text-xs">
                          {review.change === 0
                            ? "This matches the current count. Saving records that you checked it."
                            : `The final available total will be ${review.after}. This ${review.change > 0 ? "adds" : "removes"} ${Math.abs(review.change)} ${Math.abs(review.change) === 1 ? "unit" : "units"} to match your count.`}
                        </p>
                      ) : null}
                    </div>
                    {review.destination ? (
                      <>
                        <div className="grid gap-3 rounded-xl border bg-muted/30 p-4">
                          <h4 className="font-medium text-sm">{review.destination.location}</h4>
                          <p className="text-muted-foreground text-xs">Available stock · before → after</p>
                          <p className="flex items-center gap-3 text-2xl tabular-nums">
                            <span className="text-muted-foreground">{review.destination.stock}</span>
                            <ArrowRight className="size-5" aria-label="changes to" />
                            <strong>{review.destination.stock + review.payload.quantity}</strong>
                          </p>
                        </div>
                        {review.destination.createsItem ? (
                          <p className="rounded-lg border border-dashed p-3 text-sm">
                            This move creates an inventory record at {review.destination.location} with the same product
                            details and a unique SKU.
                          </p>
                        ) : null}
                        <p className="text-muted-foreground text-sm">Your total stock stays the same.</p>
                      </>
                    ) : null}
                    <div className="grid gap-1">
                      <h4 className="font-medium text-sm">Reference or reason</h4>
                      <p className="whitespace-pre-wrap break-words text-muted-foreground text-sm">
                        {review.payload.notes}
                      </p>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Balances are rechecked when saving. This adjustment is recorded in stock history.
                    </p>
                    {staleReview ? (
                      <p role="alert" className="text-destructive text-sm">
                        Stock changed while you were reviewing.{" "}
                        {error
                          ? "Retrying checks whether this same adjustment was already recorded. Otherwise, go back to Details and review the updated balances."
                          : "Go back to Details and review the updated balances."}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </fieldset>
            </div>
            {error ? (
              <p role="alert" className="shrink-0 border-t px-5 py-3 text-destructive text-sm">
                {error}
              </p>
            ) : null}
            <div className="grid shrink-0 grid-cols-2 items-center gap-2 border-t bg-background px-5 py-4 sm:flex sm:px-6">
              <Button
                type="button"
                variant="outline"
                className="sm:mr-auto"
                disabled={busy}
                onClick={() => {
                  if (!saving.current) {
                    lookupVersion.current++;
                    setOpen(false);
                  }
                }}
              >
                Cancel
              </Button>
              {step > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setStep(step - 1);
                    setReview(null);
                    setError("");
                  }}
                >
                  Back
                </Button>
              ) : null}
              <Button
                type="submit"
                className={cn("h-auto min-h-9 whitespace-normal text-center", step > 0 && "col-span-2")}
                disabled={
                  busy ||
                  (step === 0 ? !item?.updatedAt : step === 1 ? !detailsValid : !review || (staleReview && !error))
                }
              >
                {busy ? "Saving…" : step === 0 ? "Continue" : step === 1 ? "Review adjustment" : confirmation}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
