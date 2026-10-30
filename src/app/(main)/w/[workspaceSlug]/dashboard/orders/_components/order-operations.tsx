"use client";

import * as React from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceLink as Link, useWorkspaceRouter } from "@/components/workspace-path-provider";
import { formatCurrency } from "@/lib/utils";

import {
  cancelOrderAction,
  recordOrderPaymentAction,
  recordOrderRefundAction,
  shipOrderItemsAction,
} from "../operations-actions";

export type OrderOperationsData = {
  id: string;
  version: number;
  total: number;
  orderStatus: string;
  reservationExpiresAt: string | null;
  items: Array<{ id: string; product: string; quantity: number; shippedQuantity: number }>;
  payments: Array<{ id: string; amount: number; method: string; reference: string | null; source: string }>;
  refunds: Array<{
    id: string;
    paymentId: string;
    orderReturnId: string | null;
    amount: number;
    method: string;
    reference: string | null;
  }>;
  returns: Array<{ id: string; returnNumber: string; refundAmount: number; refundState: string }>;
  shipments: Array<{ id: string; carrier: string | null; trackingNumber: string | null; shippedAt: string }>;
};

const selectClass = "h-9 w-full rounded-md border bg-background px-3 text-sm";

export function OrderOperations({
  order,
  canManageMoney,
  canShip,
  canManageReturns,
}: {
  order: OrderOperationsData;
  canManageMoney: boolean;
  canShip: boolean;
  canManageReturns: boolean;
}) {
  const router = useWorkspaceRouter();
  const [busy, setBusy] = React.useState(false);
  const attempts = React.useRef(new Map<string, { signature: string; key: string }>());
  const paid = order.payments.reduce((sum, entry) => sum + entry.amount, 0);
  const refunded = order.refunds.reduce((sum, entry) => sum + entry.amount, 0);
  const unlinkedRefunds = order.refunds
    .filter((entry) => !entry.orderReturnId)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const due = Math.max(order.total - paid + unlinkedRefunds, 0);
  const active = order.orderStatus === "Active";
  const unshipped = order.items.filter((item) => item.quantity > item.shippedQuantity);

  function submission(operation: string, payload: unknown) {
    const signature = JSON.stringify(payload);
    let attempt = attempts.current.get(operation);
    if (!attempt || attempt.signature !== signature) {
      attempt = { signature, key: crypto.randomUUID() };
      attempts.current.set(operation, attempt);
    }
    return { orderId: order.id, expectedVersion: order.version, submissionKey: attempt.key };
  }

  async function run(operation: string, work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      attempts.current.delete(operation);
      toast.success("Order updated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Order could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  function moneyFields(form: HTMLFormElement) {
    const data = new FormData(form);
    return {
      amount: Number(data.get("amount")),
      method: String(data.get("method") ?? ""),
      reference: String(data.get("reference") ?? ""),
      externalConfirmed: data.get("confirmed") === "on",
    };
  }

  return (
    <section className="grid gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="font-medium">Order operations · {order.orderStatus}</h2>
          <p className="text-muted-foreground text-sm">
            Received {formatCurrency(paid)} · Refunded {formatCurrency(refunded)} · Balance due {formatCurrency(due)}
          </p>
          {order.reservationExpiresAt ? (
            <p className="text-muted-foreground text-xs">
              Unpaid stock hold expires {new Date(order.reservationExpiresAt).toLocaleDateString()}.
            </p>
          ) : null}
        </div>
        {active && canShip && !order.returns.length && order.items.every((item) => item.shippedQuantity === 0) ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => run("cancel", () => cancelOrderAction(submission("cancel", { version: order.version })))}
          >
            Cancel unshipped order
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground text-sm">
        Payments and refunds below record transactions completed outside VadosStack. Issue any card refund through your
        payment provider first, then record its reference here.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {canManageMoney && active && due > 0.001 ? (
          <form
            className="grid gap-2 rounded-lg border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const fields = moneyFields(event.currentTarget);
              void run("payment", () => recordOrderPaymentAction({ ...submission("payment", fields), ...fields }));
            }}
          >
            <h3 className="font-medium text-sm">Record payment received</h3>
            <Input
              aria-label="Payment amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              max={due.toFixed(2)}
              defaultValue={due.toFixed(2)}
              required
            />
            <Input
              aria-label="Payment method"
              name="method"
              placeholder="Method, e.g. cash or bank transfer"
              required
              maxLength={100}
            />
            <Input
              aria-label="Payment reference"
              name="reference"
              placeholder="External transaction reference"
              maxLength={200}
            />
            <label className="flex gap-2 text-sm">
              <input type="checkbox" name="confirmed" required />
              Payment has been received externally.
            </label>
            <Button disabled={busy}>Record payment</Button>
          </form>
        ) : null}
        {canManageMoney && paid - refunded > 0.001 ? (
          <form
            className="grid gap-2 rounded-lg border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const fields = {
                ...moneyFields(event.currentTarget),
                paymentId: String(data.get("paymentId")),
                returnId: String(data.get("returnId") ?? "") || undefined,
              };
              void run("refund", () => recordOrderRefundAction({ ...submission("refund", fields), ...fields }));
            }}
          >
            <h3 className="font-medium text-sm">Record refund issued</h3>
            <select aria-label="Original payment" className={selectClass} name="paymentId" required>
              {order.payments
                .filter(
                  (entry) =>
                    entry.amount -
                      order.refunds
                        .filter((refund) => refund.paymentId === entry.id)
                        .reduce((sum, refund) => sum + refund.amount, 0) >
                    0.001,
                )
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.method} · {formatCurrency(entry.amount)} · {entry.reference ?? entry.id}
                  </option>
                ))}
            </select>
            <select aria-label="Return for refund" className={selectClass} name="returnId">
              <option value="">Order adjustment / cancellation</option>
              {order.returns
                .filter(
                  (receipt) => receipt.refundState === "requested" || receipt.refundState === "partially_refunded",
                )
                .map((receipt) => (
                  <option key={receipt.id} value={receipt.id}>
                    {receipt.returnNumber} · requested {formatCurrency(receipt.refundAmount)}
                  </option>
                ))}
            </select>
            <Input
              aria-label="Refund amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              max={(paid - refunded).toFixed(2)}
              required
            />
            <Input aria-label="Refund method" name="method" placeholder="Refund method" required maxLength={100} />
            <Input
              aria-label="Refund reference"
              name="reference"
              placeholder="External refund reference"
              required
              maxLength={200}
            />
            <label className="flex gap-2 text-sm">
              <input type="checkbox" name="confirmed" required />
              Refund has completed externally.
            </label>
            <Button disabled={busy}>Record refund</Button>
          </form>
        ) : null}
      </div>
      {active && canShip && !order.returns.length && unshipped.length ? (
        <form
          className="grid gap-3 rounded-lg border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const fields = {
              carrier: String(data.get("carrier") ?? ""),
              trackingNumber: String(data.get("trackingNumber") ?? ""),
              items: unshipped
                .map((item) => ({ orderItemId: item.id, quantity: Number(data.get(item.id)) }))
                .filter((item) => item.quantity > 0),
            };
            void run("ship", () => shipOrderItemsAction({ ...submission("ship", fields), ...fields }));
          }}
        >
          <h3 className="font-medium text-sm">Record shipment or pickup</h3>
          {unshipped.map((item) => (
            <label
              key={item.id}
              htmlFor={`ship-${item.id}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              {item.product} · {item.quantity - item.shippedQuantity} remaining
              <Input
                className="w-28"
                id={`ship-${item.id}`}
                aria-label={`Ship ${item.product}`}
                name={item.id}
                type="number"
                min="0"
                max={item.quantity - item.shippedQuantity}
                step="1"
                defaultValue="0"
              />
            </label>
          ))}
          <div className="grid gap-2 sm:grid-cols-2">
            <Input name="carrier" aria-label="Carrier or pickup" placeholder="Carrier or pickup" maxLength={100} />
            <Input name="trackingNumber" aria-label="Tracking number" placeholder="Tracking number" maxLength={200} />
          </div>
          <Button disabled={busy}>Record shipment</Button>
        </form>
      ) : null}
      {order.payments.length ? (
        <div className="grid gap-1 text-sm">
          <h3 className="font-medium">Payment history</h3>
          {order.payments.map((entry) => (
            <p key={entry.id}>
              {formatCurrency(entry.amount)} received · {entry.method} · {entry.reference ?? "No reference"}
              {entry.source === "legacy" ? " · migrated opening balance" : ""}
            </p>
          ))}
          {order.refunds.map((entry) => (
            <p key={entry.id}>
              {formatCurrency(entry.amount)} refunded · {entry.method} · {entry.reference ?? "No reference"}
            </p>
          ))}
        </div>
      ) : null}
      {order.shipments.length ? (
        <div className="grid gap-1 text-sm">
          <h3 className="font-medium">Shipment history</h3>
          {order.shipments.map((entry) => (
            <p key={entry.id}>
              {new Date(entry.shippedAt).toLocaleDateString()} · {entry.carrier || "Pickup"} ·{" "}
              {entry.trackingNumber || "No tracking number"}
            </p>
          ))}
        </div>
      ) : null}
      {canManageReturns ? (
        <div className="flex flex-wrap gap-3 text-sm">
          {order.returns.map((receipt) => (
            <Link
              className="underline"
              key={receipt.id}
              href={`/dashboard/orders/${order.id}/return?returnId=${receipt.id}`}
            >
              {receipt.returnNumber} · {receipt.refundState.replaceAll("_", " ")}
            </Link>
          ))}
          {active ? (
            <Link className="underline" href={`/dashboard/orders/${order.id}/return?new=1`}>
              Start a new return
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
