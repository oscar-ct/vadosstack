"use client";

import * as React from "react";

import { CheckCircle2 } from "lucide-react";

import { BusinessDateTime } from "@/components/business-time";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceRouter } from "@/components/workspace-path-provider";
import { validateInvestmentCorrection } from "@/lib/commerce/investment-correction";

import { correctInventoryInvestmentAction } from "../actions";

type Entry = {
  id: string;
  kind: string;
  amount: string;
  originalAmount: string;
  estimated: boolean;
  date: string;
  notes: string | null;
  evidence: unknown;
  corrections: { id: string; amount: string; notes: string | null; date: string }[];
};
type Result = Extract<Awaited<ReturnType<typeof correctInventoryInvestmentAction>>, { status: "saved" }>;
const currency = (value: string | number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
const date = (value: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(value),
  );
const timestamp = (value: string) => <BusinessDateTime value={value} />;
const changeLabel = (value: number) => `${value < 0 ? "Decrease" : "Increase"} of ${currency(Math.abs(value))}`;

export function InvestmentReview({ entries, canManage }: { entries: Entry[]; canManage: boolean }) {
  const router = useWorkspaceRouter();
  const id = React.useId();
  const opening = entries.find((entry) => entry.kind === "Opening");
  const [managerOpen, setManagerOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Entry | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [step, setStep] = React.useState<"edit" | "review" | "complete">("edit");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState<Result | null>(null);
  const [touched, setTouched] = React.useState(false);
  const saving = React.useRef(false);
  const attempt = React.useRef<{ signature: string; key: string } | null>(null);
  const validation = validateInvestmentCorrection(amount, selected?.amount ?? "0", reason);
  const valid =
    validation.value !== null && !validation.unchanged && !validation.amountError && !validation.reasonError;
  const isOpening = selected?.kind === "Opening";
  const label = isOpening ? "starting investment" : "purchase total";
  const latest = opening?.corrections.slice().sort((a, b) => b.date.localeCompare(a.date))[0];

  const wizardHeading = React.useRef<HTMLHeadingElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Step changes intentionally focus the updated wizard heading.
  React.useEffect(() => {
    if (!managerOpen && !selected && !historyOpen) return;
    const frame = requestAnimationFrame(() => wizardHeading.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [managerOpen, selected, historyOpen, step]);

  function begin(entry: Entry) {
    if (saving.current) return;
    setSaved(null);
    setSelected(entry);
    setHistoryOpen(false);
    setStep("edit");
    setAmount(entry.amount);
    setReason("");
    setError("");
    setTouched(false);
    attempt.current = null;
  }
  function close() {
    if (!saving.current) {
      setSelected(null);
      setManagerOpen(false);
      setHistoryOpen(false);
    }
  }
  async function save() {
    if (saving.current || !selected || !valid || step !== "review" || validation.value === null) return;
    const fields = {
      entryId: selected.id,
      expectedAmount: selected.amount,
      correctedAmount: validation.value,
      reason: reason.trim(),
    };
    const signature = JSON.stringify(fields);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await correctInventoryInvestmentAction({ ...fields, submissionKey: attempt.current.key });
      if (result.status === "unchanged") {
        setError(`Nothing was saved. The ${label} is already ${currency(result.amount)}.`);
        setStep("edit");
        return;
      }
      setSaved(result);
      setStep("complete");
      attempt.current = null;
      router.refresh();
    } catch (failure) {
      router.refresh();
      setError(
        failure instanceof Error
          ? failure.message
          : "We couldn't confirm the save. Retry to check this same correction safely.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setManagerOpen(true)}>
        {canManage ? "Manage investment" : "Investment details"}
      </Button>

      <Dialog
        open={managerOpen || Boolean(selected) || historyOpen}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          disableOutsideClose={busy}
          showCloseButton={!busy}
          className={
            historyOpen ? "max-h-[90svh] overflow-y-auto sm:max-w-2xl" : "max-h-[90svh] overflow-y-auto sm:max-w-lg"
          }
          allowAutoFocus
        >
          <DialogHeader>
            <DialogTitle ref={wizardHeading} tabIndex={-1} className="outline-none">
              {historyOpen
                ? "Investment history"
                : !selected
                  ? "Manage investment"
                  : step === "complete"
                    ? "Change saved"
                    : step === "review"
                      ? `Review ${label} change`
                      : `Change ${label}`}
            </DialogTitle>
            <DialogDescription>
              {historyOpen
                ? "Saved amounts, purchases, and changes. Latest 100 starting/purchase records."
                : !selected
                  ? "Review or correct recorded inventory spending."
                  : step === "complete"
                    ? "Your investment totals have been updated."
                    : step === "review"
                      ? "Check the amounts below. Nothing is saved until you confirm."
                      : `Enter the full correct ${label}, not the amount to add or subtract.`}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <ol aria-label="Investment change steps" className="flex flex-wrap gap-4 border-b pb-3 text-xs">
              {(["edit", "review", "complete"] as const).map((value, index) => (
                <li
                  key={value}
                  aria-current={step === value ? "step" : undefined}
                  className={step === value ? "font-medium" : "text-muted-foreground"}
                >
                  {index + 1}. {value === "edit" ? "Amount" : value === "review" ? "Review" : "Saved"}
                </li>
              ))}
            </ol>
          ) : null}
          {!selected && !historyOpen ? (
            <section aria-label="Starting investment" className="grid gap-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="grid min-w-0 gap-1">
                  <h3 className="font-medium">Starting investment</h3>
                  <p className="text-muted-foreground text-sm">
                    Inventory spending before purchase tracking began{opening ? ` on ${date(opening.date)}` : ""}.
                  </p>
                  <p className="mt-1 font-semibold text-xl tabular-nums">
                    {opening ? currency(opening.amount) : "Not set up yet"}
                  </p>
                  {opening ? (
                    <p className="text-muted-foreground text-xs">
                      {latest ? (
                        <>Last updated {timestamp(latest.date)}</>
                      ) : (
                        "Saved starting estimate · calculated from existing records"
                      )}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {opening && canManage ? (
                    <Button size="sm" variant="outline" onClick={() => begin(opening)}>
                      Change starting amount
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
                    Investment history
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                New purchases are added automatically. Change this starting amount only to fix earlier spending; it does
                not change stock quantities or item costs.
              </p>
              {saved ? (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-900 text-sm dark:bg-emerald-950 dark:text-emerald-100"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-medium">
                      Saved successfully: {saved.entryId === opening?.id ? "starting investment" : "purchase total"} is{" "}
                      {currency(saved.amount)}.
                    </p>
                    <p className="mt-1 text-xs">
                      Previously {currency(saved.previousAmount)} · {changeLabel(Number(saved.change))} ·{" "}
                      {timestamp(saved.recordedAt)}
                    </p>
                  </div>
                </div>
              ) : null}
              {opening ? (
                <details className="rounded-lg bg-muted/30 p-3">
                  <summary className="cursor-pointer text-sm">How was the starting estimate calculated?</summary>
                  <OpeningBreakdown entry={opening} />
                </details>
              ) : null}
            </section>
          ) : null}
          {selected && step === "edit" ? (
            <form
              className="grid gap-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                setTouched(true);
                if (valid) {
                  setError("");
                  setStep("review");
                }
              }}
            >
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-muted-foreground text-xs">Currently saved</p>
                <p className="mt-1 font-semibold text-xl tabular-nums">{currency(selected?.amount ?? "0")}</p>
              </div>
              <div className="grid gap-2">
                <label htmlFor={`${id}-amount`} className="font-medium text-sm">
                  New {label} ($)
                </label>
                <Input
                  id={`${id}-amount`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError("");
                  }}
                  onBlur={() => setTouched(true)}
                  aria-invalid={Boolean(touched && validation.amountError)}
                  aria-describedby={`${id}-amount-help`}
                  disabled={busy}
                />
                <p
                  id={`${id}-amount-help`}
                  className={
                    touched && validation.amountError ? "text-destructive text-xs" : "text-muted-foreground text-xs"
                  }
                >
                  {touched && validation.amountError
                    ? validation.amountError
                    : validation.unchanged
                      ? "This matches the saved amount. Enter a different total to make a change."
                      : validation.value !== null && selected
                        ? changeLabel(validation.value - Number(selected.amount))
                        : "For example, enter 40000.00 if the correct total is $40,000."}
                </p>
              </div>
              <div className="grid gap-2">
                <label htmlFor={`${id}-reason`} className="font-medium text-sm">
                  Why are you changing it? (required)
                </label>
                <Textarea
                  id={`${id}-reason`}
                  value={reason}
                  maxLength={1000}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setError("");
                  }}
                  placeholder="For example: added a purchase receipt missing from the estimate"
                  aria-describedby={`${id}-reason-help`}
                  disabled={busy}
                />
                <p id={`${id}-reason-help`} className="text-muted-foreground text-xs">
                  This explanation will be saved in investment history.
                </p>
              </div>
              {error ? (
                <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
                  {error}
                </p>
              ) : null}
              <p className="text-muted-foreground text-xs">Nothing has been saved yet.</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!valid || busy}>
                  Review change
                </Button>
              </div>
            </form>
          ) : null}
          {step === "review" && selected && validation.value !== null ? (
            <div className="grid gap-4">
              <dl className="grid gap-3 rounded-lg border p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt>Currently saved</dt>
                  <dd className="tabular-nums">{currency(selected.amount)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>New {label}</dt>
                  <dd className="font-semibold tabular-nums">{currency(validation.value)}</dd>
                </div>
                <div className="border-t pt-3 font-medium">
                  {changeLabel(validation.value - Number(selected.amount))}
                </div>
              </dl>
              <div>
                <p className="font-medium text-sm">Your explanation</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground text-sm">{reason.trim()}</p>
              </div>
              <p className="text-muted-foreground text-xs">
                Lifetime inventory investment changes by the same amount. Stock quantities and item costs stay the same.
                The previous amount remains in history.
              </p>
              {error ? (
                <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setStep("edit");
                    setError("");
                  }}
                >
                  Back
                </Button>
                <Button disabled={busy} onClick={save}>
                  {busy ? "Saving…" : "Confirm and save"}
                </Button>
              </div>
            </div>
          ) : null}
          {selected && step === "complete" && saved ? (
            <div className="grid gap-4" role="status">
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                <CheckCircle2 className="mb-2 size-6" aria-hidden="true" />
                <p className="font-medium">
                  Your {label} is now {currency(saved.amount)}.
                </p>
                <p className="mt-2 text-sm">
                  Previously {currency(saved.previousAmount)} · {changeLabel(Number(saved.change))}
                </p>
                <p className="mt-2 text-xs">Saved {timestamp(saved.recordedAt)}</p>
              </div>
              <Button onClick={close}>Done</Button>
            </div>
          ) : null}
          {historyOpen ? (
            <div className="grid gap-4">
              {" "}
              <div className="grid gap-3">
                {entries.map((entry) => (
                  <div key={entry.id} className="grid gap-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-sm">
                        {entry.kind === "Opening" ? "Starting investment" : "Inventory purchase"} ·{" "}
                        {currency(entry.amount)}
                      </p>
                      {canManage ? (
                        <Button size="sm" variant="outline" onClick={() => begin(entry)}>
                          {entry.kind === "Opening" ? "Change starting amount" : "Correct purchase total"}
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Recorded {date(entry.date)} · Original amount {currency(entry.originalAmount)}
                    </p>
                    {entry.kind !== "Opening" && entry.notes ? (
                      <p className="break-words text-sm">{entry.notes}</p>
                    ) : null}
                    {entry.corrections
                      .slice()
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((c) => (
                        <div key={c.id} className="border-t pt-2 text-sm">
                          <p>
                            {changeLabel(Number(c.amount))} · {timestamp(c.date)}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{c.notes}</p>
                        </div>
                      ))}
                  </div>
                ))}
                {!entries.length ? <p className="text-muted-foreground text-sm">No investment records yet.</p> : null}
              </div>
              <Button variant="outline" onClick={() => setHistoryOpen(false)}>
                Back
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function OpeningBreakdown({ entry }: { entry: Entry }) {
  if (!entry.evidence || typeof entry.evidence !== "object" || Array.isArray(entry.evidence))
    return <p className="mt-3 text-muted-foreground text-sm">Original calculation details were not recorded.</p>;
  const values = entry.evidence as Record<string, unknown>;
  const rows = [
    ["Inventory held when tracking began", "currentInventoryCost"],
    ["Recorded cost of items already sold, after restocked returns", "consumedInventoryCost"],
    ["Recorded inventory losses", "stockLossCost"],
  ] as const;
  const missing = Number(values.unknownHistoricalCosts ?? 0);
  return (
    <div className="mt-3 grid gap-3">
      <dl className="grid gap-2 text-sm">
        {rows.map(([label, key]) => (
          <div key={key} className="flex flex-wrap justify-between gap-2">
            <dt className="min-w-0 flex-1">{label}</dt>
            <dd className="tabular-nums">
              {Number.isFinite(Number(values[key])) ? currency(Number(values[key])) : "Unknown"}
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-2 border-t pt-2 font-medium">
          <dt>Original starting estimate</dt>
          <dd>{currency(entry.originalAmount)}</dd>
        </div>
      </dl>
      {missing > 0 ? (
        <p className="text-amber-700 text-xs dark:text-amber-300">
          {missing} older record(s) have no saved cost. If you know the missing spending, include it when changing the
          starting amount.
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        This is the original estimate. Your later changes are listed in Investment history.
      </p>
    </div>
  );
}
