"use client";

import * as React from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";

import { OrderHistoryButton } from "./order-history-button";

export type ShippingExpenseHistoryEntry = {
  id: string;
  kind: string;
  amount: number;
  date: string;
  reference: string | null;
  notes: string;
};
const labels: Record<string, string> = {
  Outbound: "Outbound shipping",
  ReturnLabel: "Return label",
  CarrierCredit: "Carrier credit",
};

export function ShippingExpenseHistory({
  orderNumber,
  entries,
}: {
  orderNumber: string;
  entries: ShippingExpenseHistoryEntry[];
}) {
  const [open, setOpen] = React.useState(false);
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  return (
    <>
      <OrderHistoryButton label="Shipping expense history" onClick={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85svh] flex-col sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Shipping expenses · {orderNumber}</DialogTitle>
            <DialogDescription>
              Carrier charges and credits recorded for this order. Customer shipping charges are separate.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-sm">
            <span>Recorded cost after credits</span>
            <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
          </div>
          <div className="min-h-0 overflow-y-auto">
            {entries.length ? (
              <ul className="grid gap-3">
                {entries.map((entry) => (
                  <li key={entry.id} className="grid gap-2 rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{labels[entry.kind] ?? entry.kind}</p>
                        <p className="mt-1 text-muted-foreground text-xs">{entry.date.slice(0, 10)} (UTC)</p>
                      </div>
                      <p className="font-medium tabular-nums">{formatCurrency(entry.amount)}</p>
                    </div>
                    {entry.reference ? (
                      <p className="break-words text-muted-foreground text-xs">Reference: {entry.reference}</p>
                    ) : null}
                    <p className="whitespace-pre-wrap break-words text-muted-foreground text-xs">{entry.notes}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-5 text-center text-muted-foreground text-sm">
                No shipping expenses recorded for this order. Use “Record shipping expense” after paying a carrier.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
