"use client";

import { type ReactNode, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OrderResolutionRecord } from "@/lib/commerce/order-resolution";
import { resolutionStatusLabel } from "@/lib/commerce/order-resolution";
import { getReturnDispositionLabel } from "@/lib/commerce/returns";
import { cn, formatCurrency } from "@/lib/utils";

import { ReturnRefundPreview } from "../[orderId]/return/_components/return-preview";
import type { OrderCompany } from "../create/_components/data";

export function OrderResolutionPanel({
  actions,
  receiptActions,
  company,
  orderId,
  records,
  selectedId,
  onSelect,
}: {
  actions?: Record<string, ReactNode>;
  receiptActions?: Record<string, ReactNode>;
  company: OrderCompany;
  orderId: string;
  records: OrderResolutionRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const selected = records.find((record) => record.id === selectedId) ?? records[0];
  if (!selected) return null;
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.56fr)_minmax(380px,0.44fr)]">
      <section className="grid min-w-0 gap-5 rounded-xl border bg-card p-4" aria-label="Resolution details">
        <div className="grid gap-1">
          <h2 className="font-medium text-base">{records.length === 1 ? "Resolution details" : "Resolutions"}</h2>
          <p className="text-muted-foreground text-sm">Recorded cancellations, returns, and refunds for this order.</p>
        </div>
        {records.length > 1 ? (
          <fieldset className="grid gap-2" aria-label="Choose a resolution">
            {records.map((record) => (
              <button
                key={record.id}
                type="button"
                aria-pressed={record.id === selected.id}
                onClick={() => onSelect(record.id)}
                className={cn(
                  "grid min-w-0 gap-1 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  record.id === selected.id && "border-primary bg-primary/5",
                )}
              >
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="font-medium">{record.reference}</span>
                  <span className="text-muted-foreground text-xs">{record.date.slice(0, 10)}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {record.kind === "Mixed" ? "Cancellation & return" : record.kind}
                  </span>
                  <span>{resolutionStatusLabel(record.refundState)}</span>
                </span>
              </button>
            ))}
          </fieldset>
        ) : null}
        <div className={cn("grid gap-4", records.length > 1 && "border-t pt-4")}>
          <p className="text-muted-foreground text-xs">
            {selected.date.slice(0, 10)} · {selected.kind === "Mixed" ? "Cancellation & return" : selected.kind}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-sm" aria-live="polite">
              {selected.reference}
            </h3>
            <Badge variant="outline">{resolutionStatusLabel(selected.refundState)}</Badge>
          </div>
          {selected.reason ? (
            <div className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Reason</span>
              <p className="whitespace-pre-wrap break-words">{selected.reason}</p>
            </div>
          ) : null}
          {selected.values.items.length ? (
            <ul className="divide-y rounded-lg border px-3">
              {selected.values.items
                .filter((item) => item.cancelQuantity > 0 || item.returnQuantity > 0)
                .map((item) => (
                  <li key={item.id} className="grid gap-1 py-3 text-sm">
                    <span className="font-medium">{item.product}</span>
                    {item.sku ? <span className="text-muted-foreground text-xs">{item.sku}</span> : null}
                    <span className="text-muted-foreground text-xs">
                      {item.cancelQuantity > 0 ? `${item.cancelQuantity} cancelled` : ""}
                      {item.cancelQuantity > 0 && item.returnQuantity > 0 ? " · " : ""}
                      {item.returnQuantity > 0
                        ? `${item.returnQuantity} ${getReturnDispositionLabel(item.disposition).toLowerCase()}`
                        : ""}
                    </span>
                  </li>
                ))}
            </ul>
          ) : null}
          <dl className="grid gap-2 rounded-lg bg-muted/40 p-3 text-sm tabular-nums">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Resolved value</dt>
              <dd>{formatCurrency(selected.credit)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Refunded</dt>
              <dd>{formatCurrency(selected.refunded)}</dd>
            </div>
            {selected.requestedRefund > selected.refunded ? (
              <div className="flex items-center justify-between gap-3 text-amber-700">
                <dt>Refund pending</dt>
                <dd>{formatCurrency(selected.requestedRefund - selected.refunded)}</dd>
              </div>
            ) : null}
          </dl>
          {receiptActions?.[selected.id]}
          {selected.values.refundMethod ? (
            <p className="text-muted-foreground text-xs">
              Refund method: {selected.values.refundMethod}
              {selected.values.refundReference ? ` · ${selected.values.refundReference}` : ""}
            </p>
          ) : null}
        </div>
      </section>
      <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start" aria-label="Resolution preview">
        <Button
          type="button"
          variant="outline"
          className="h-auto w-full justify-between p-4 xl:hidden"
          aria-expanded={previewOpen}
          onClick={() => setPreviewOpen((open) => !open)}
        >
          Resolution preview<span className="text-muted-foreground text-xs">{previewOpen ? "Hide" : "Show"}</span>
        </Button>
        <div className={cn(previewOpen ? "mt-3 block" : "hidden", "xl:mt-0 xl:block")}>
          {selected.kind === "Credit" ? (
            <div className="grid gap-4 rounded-xl border bg-card p-6">
              <h2 className="font-medium text-base">Credit summary</h2>
              <p className="text-sm">{selected.reference}</p>
              <p className="text-muted-foreground text-sm">{selected.reason}</p>
              <p className="font-medium text-2xl tabular-nums">{formatCurrency(selected.credit)}</p>
            </div>
          ) : (
            <ReturnRefundPreview
              key={selected.id}
              emailAction={actions?.[selected.id]}
              actionsDisabled={false}
              company={company}
              orderId={orderId}
              values={selected.values}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
