"use client";
import * as React from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWorkspaceRouter } from "@/components/workspace-path-provider";

import { recordShippingExpenseAction } from "../actions";
export function ShippingExpenseRecorder({ orderId }: { orderId: string }) {
  const [open, setOpen] = React.useState(false),
    [busy, setBusy] = React.useState(false);
  const router = useWorkspaceRouter();
  const id = React.useId();
  const attempt = React.useRef<{ signature: string; key: string } | null>(null);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Record shipping expense
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent disableOutsideClose={busy}>
          <DialogHeader>
            <DialogTitle>Actual shipping expense</DialogTitle>
            <DialogDescription>
              Record what you paid the carrier, separately from the shipping charge on the customer's receipt.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const data = new FormData(e.currentTarget);
              const fields = {
                orderId,
                kind: String(data.get("kind")) as "Outbound" | "ReturnLabel" | "CarrierCredit",
                amount: Number(data.get("amount")),
                reference: String(data.get("reference")),
                notes: String(data.get("notes")),
                incurredDate: String(data.get("date")),
                confirmed: data.get("confirmed") === "on",
              };
              const signature = JSON.stringify(fields);
              if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
              setBusy(true);
              try {
                await recordShippingExpenseAction({ ...fields, submissionKey: attempt.current.key });
                attempt.current = null;
                toast.success("Shipping expense recorded.");
                setOpen(false);
                router.refresh();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Expense could not be saved.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="grid gap-1 text-sm">
              Type
              <select name="kind" className="rounded-lg border bg-background p-2" disabled={busy}>
                <option value="Outbound">Outbound shipping cost</option>
                <option value="ReturnLabel">Return label cost</option>
                <option value="CarrierCredit">Carrier refund / credit</option>
              </select>
            </label>
            <label htmlFor={`${id}-amount`} className="grid gap-1 text-sm">
              Amount ($)
              <Input
                id={`${id}-amount`}
                name="amount"
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                required
                disabled={busy}
              />
            </label>
            <label htmlFor={`${id}-date`} className="grid gap-1 text-sm">
              Expense date (UTC)
              <Input
                id={`${id}-date`}
                name="date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
                disabled={busy}
              />
            </label>
            <label htmlFor={`${id}-reference`} className="grid gap-1 text-sm">
              Carrier / label reference
              <Input id={`${id}-reference`} name="reference" maxLength={200} disabled={busy} />
            </label>
            <label htmlFor={`${id}-notes`} className="grid gap-1 text-sm">
              Reason or notes
              <Input id={`${id}-notes`} name="notes" maxLength={1000} required disabled={busy} />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input name="confirmed" type="checkbox" required disabled={busy} />
              This carrier charge or credit actually occurred. This does not refund the customer.
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? "Recording…" : "Record expense"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
