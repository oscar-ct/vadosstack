"use client";

import * as React from "react";

import { format } from "date-fns";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWorkspaceRouter } from "@/components/workspace-path-provider";

import { getReturnReceiptAction, receiveReturnedItemsAction } from "../return-receipt-actions";

type Receipt = Awaited<ReturnType<typeof getReturnReceiptAction>>;
export function ReceiveReturnedItems({ orderId, returnId }: { orderId: string; returnId: string }) {
  const router = useWorkspaceRouter();
  const [open, setOpen] = React.useState(false);
  const [receipt, setReceipt] = React.useState<Receipt | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const key = React.useRef("");
  const formId = React.useId();
  const pending = receipt?.items.filter((item) => item.remaining > 0) ?? [];
  async function show() {
    setOpen(true);
    setBusy(true);
    setError("");
    setReceipt(null);
    key.current = crypto.randomUUID();
    try {
      setReceipt(await getReturnReceiptAction(orderId, returnId));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load returned items.");
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !receipt) return;
    const data = new FormData(event.currentTarget);
    const items = pending
      .map((item) => ({
        orderItemId: item.orderItemId,
        quantity: Number(data.get(`quantity:${item.orderItemId}`)),
        condition: data.get(`damaged:${item.orderItemId}`) === "on" ? ("Damaged" as const) : ("Sellable" as const),
        restock: data.get(`restock:${item.orderItemId}`) === "on",
      }))
      .filter((item) => item.quantity > 0);
    if (!items.length) {
      setError("Enter the quantities physically received.");
      return;
    }
    if (data.get("confirmed") !== "on") {
      setError("Confirm physical receipt before recording it.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await receiveReturnedItemsAction({
        orderId,
        returnId,
        expectedVersion: receipt.version,
        submissionKey: key.current,
        receivedDate: String(data.get("receivedDate")),
        notes: String(data.get("notes")),
        confirmed: true,
        items,
      });
      toast.success("Returned items received. Stock and return history updated.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Receipt could not be recorded.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={show}>
        <PackageCheck className="size-4" />
        Receive returned items
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Receive returned items</DialogTitle>
            <DialogDescription>
              Record goods that arrived after this resolution. Refunds and saved item details stay unchanged.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          {!receipt ? (
            <p className="text-muted-foreground text-sm">
              {busy ? "Loading returned items…" : "Close and reopen to try again."}
            </p>
          ) : !pending.length ? (
            <div className="grid gap-2 text-sm">
              <p>All items in this resolution have already been received.</p>
              {receipt.items.map((item) => (
                <p key={item.orderItemId} className="text-muted-foreground">
                  {item.product} · {item.received} received
                </p>
              ))}
            </div>
          ) : (
            <form
              onSubmit={save}
              className="grid gap-4"
              onChange={() => {
                key.current = crypto.randomUUID();
              }}
            >
              <fieldset disabled={busy} className="grid gap-4">
                {pending.map((item) => (
                  <section key={item.orderItemId} className="grid gap-3 rounded-lg border p-3">
                    <div>
                      <p className="font-medium text-sm">{item.product}</p>
                      <p className="text-muted-foreground text-xs">
                        {item.remaining} awaiting receipt · {item.received} already received
                      </p>
                    </div>
                    <label htmlFor={`${formId}-${item.orderItemId}`} className="grid gap-1 text-sm">
                      Quantity received
                      <Input
                        id={`${formId}-${item.orderItemId}`}
                        name={`quantity:${item.orderItemId}`}
                        type="number"
                        min={0}
                        max={item.remaining}
                        step={1}
                        defaultValue={0}
                        required
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        name={`damaged:${item.orderItemId}`}
                        type="checkbox"
                        onChange={(event) => {
                          const restock = event.currentTarget.form?.elements.namedItem(
                            `restock:${item.orderItemId}`,
                          ) as HTMLInputElement | null;
                          if (restock) {
                            restock.disabled = event.currentTarget.checked;
                            if (event.currentTarget.checked) restock.checked = false;
                          }
                        }}
                      />
                      Received damaged
                    </label>
                    {item.inventoryItemId ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input name={`restock:${item.orderItemId}`} type="checkbox" defaultChecked />
                        Add sellable units back to available stock
                      </label>
                    ) : null}
                  </section>
                ))}
                <label htmlFor={`${formId}-date`} className="grid gap-1 text-sm">
                  Received date
                  <Input
                    type="date"
                    id={`${formId}-date`}
                    name="receivedDate"
                    defaultValue={format(new Date(), "yyyy-MM-dd")}
                    required
                  />
                </label>
                <label htmlFor={`${formId}-note`} className="grid gap-1 text-sm">
                  Receipt note
                  <Input
                    id={`${formId}-note`}
                    name="notes"
                    placeholder="Package or receipt reference"
                    maxLength={1000}
                    required
                  />
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input name="confirmed" type="checkbox" required className="mt-1" />I physically received these items
                  and checked their condition.
                </label>
              </fieldset>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Recording…" : "Record receipt"}
                </Button>
              </div>
            </form>
          )}
          {receipt?.receipts.length ? (
            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Physical receipt history</summary>
              <ul className="mt-3 grid gap-3">
                {receipt.receipts.map((entry) => (
                  <li key={entry.id}>
                    <p>
                      {entry.date} · {entry.received} received · {entry.restocked} restocked
                    </p>
                    <p className="break-words text-muted-foreground text-xs">{entry.notes}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
