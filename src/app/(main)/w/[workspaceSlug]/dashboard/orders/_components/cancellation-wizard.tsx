"use client";

import * as React from "react";

import { XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWorkspaceRouter } from "@/components/workspace-path-provider";
import { adjustmentCredit, cancellableQuantity, cancellationLineAmount } from "@/lib/commerce/order-cancellation";
import { formatCurrency } from "@/lib/utils";

import { cancelOrderItemsAction } from "../operations-actions";

export type CancellationItem = {
  id: string;
  product: string;
  quantity: number;
  shippedQuantity: number;
  returnedQuantity: number;
  cancelledQuantity: number;
  lineTotal: number;
  discountAmount: number;
  taxAmount: number;
};

export function CancellationWizard({
  effectiveTotal,
  items,
  open,
  onOpenChange,
  orderId,
  orderNumber,
  paid,
  refunded,
  shippingAmount,
  version,
}: {
  effectiveTotal: number;
  items: CancellationItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  paid: number;
  refunded: number;
  shippingAmount: number;
  version: number;
}) {
  const router = useWorkspaceRouter();
  const [busy, setBusy] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [quantities, setQuantities] = React.useState<Record<string, number>>({});
  const key = React.useRef(crypto.randomUUID());
  const availableItems = items
    .map((item) => ({
      ...item,
      available: cancellableQuantity({
        quantity: item.quantity,
        shippedQuantity: item.shippedQuantity,
        returnedQuantity: item.returnedQuantity,
        cancelledQuantity: item.cancelledQuantity,
      }),
    }))
    .filter((item) => item.available > 0);
  const selected = availableItems
    .map((item) => ({ item, quantity: Math.min(Math.max(quantities[item.id] ?? 0, 0), item.available) }))
    .filter((entry) => entry.quantity > 0);
  const allocation = selected.reduce(
    (sum, { item, quantity }) => ({
      merchandiseAmount:
        sum.merchandiseAmount +
        cancellationLineAmount({
          amountCents: Math.round(item.lineTotal * 100),
          quantity: item.quantity,
          previouslyResolved: item.cancelledQuantity,
          cancelling: quantity,
        }) /
          100,
      discountAmount:
        sum.discountAmount +
        cancellationLineAmount({
          amountCents: Math.round(item.discountAmount * 100),
          quantity: item.quantity,
          previouslyResolved: item.cancelledQuantity,
          cancelling: quantity,
        }) /
          100,
      taxAmount:
        sum.taxAmount +
        cancellationLineAmount({
          amountCents: Math.round(item.taxAmount * 100),
          quantity: item.quantity,
          previouslyResolved: item.cancelledQuantity,
          cancelling: quantity,
        }) /
          100,
      shippingAmount: 0,
    }),
    { merchandiseAmount: 0, discountAmount: 0, taxAmount: 0, shippingAmount: 0 },
  );
  const cancelsEverything = availableItems.every((item) => (quantities[item.id] ?? 0) === item.available);
  const shippingCredit = cancelsEverything && items.every((item) => item.shippedQuantity === 0) ? shippingAmount : 0;
  const credit = adjustmentCredit({ ...allocation, shippingAmount: shippingCredit });
  const resultingTotal = Math.max(effectiveTotal - credit, 0);
  const refundDue = Math.max(paid - refunded - resultingTotal, 0);

  function setAll() {
    setQuantities(Object.fromEntries(availableItems.map((item) => [item.id, item.available])));
  }

  async function submit() {
    if (!selected.length || !reason.trim() || busy) return;
    setBusy(true);
    try {
      await cancelOrderItemsAction({
        orderId,
        expectedVersion: version,
        submissionKey: key.current,
        reason,
        items: selected.map(({ item, quantity }) => ({ orderItemId: item.id, quantity })),
      });
      toast.success(cancelsEverything ? "Order cancelled." : "Selected items cancelled.");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message && !message.includes("Invalid `") && !message.includes(".next/")
          ? message
          : "The cancellation could not be recorded. Refresh the order and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent disableOutsideClose={busy} className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cancel items from {orderNumber}</DialogTitle>
          <DialogDescription>
            Only unfulfilled units can be cancelled. The original order remains unchanged and an auditable credit is
            recorded.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-sm">Choose quantities</p>
            <Button type="button" variant="ghost" size="sm" onClick={setAll} disabled={busy}>
              Cancel all remaining
            </Button>
          </div>
          <div className="divide-y rounded-md border">
            {availableItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-4 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{item.product}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.available} available · {item.shippedQuantity} fulfilled · {item.cancelledQuantity} already
                    cancelled
                  </p>
                </div>
                <Input
                  aria-label={`${item.product} quantity to cancel`}
                  type="number"
                  min={0}
                  max={item.available}
                  step={1}
                  value={quantities[item.id] ?? 0}
                  onChange={(event) =>
                    setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))
                  }
                  disabled={busy}
                />
              </div>
            ))}
          </div>
          <label htmlFor="cancellation-reason" className="grid gap-1.5 font-medium text-xs">
            Reason
            <Input
              id="cancellation-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Customer request, item unavailable, duplicate order…"
              maxLength={500}
              disabled={busy}
            />
          </label>
          <div className="grid gap-2 rounded-md bg-muted/50 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Order credit</span>
              <span className="font-medium tabular-nums">{formatCurrency(credit)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">New effective total</span>
              <span className="tabular-nums">{formatCurrency(resultingTotal)}</span>
            </div>
            {refundDue > 0 ? (
              <p className="border-t pt-2 text-amber-700 text-xs dark:text-amber-300">
                {formatCurrency(refundDue)} will be shown as credit owed. Record the external refund from this order
                after saving the cancellation.
              </p>
            ) : (
              <p className="border-t pt-2 text-muted-foreground text-xs">
                The credit will reduce the remaining balance. Cancelled inventory reservations are released now.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Keep order
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void submit()}
              disabled={busy || !selected.length || !reason.trim()}
            >
              <XCircle /> {busy ? "Saving…" : cancelsEverything ? "Cancel remaining order" : "Cancel selected items"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
