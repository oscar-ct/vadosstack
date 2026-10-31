"use client";

import * as React from "react";

import { Banknote, MoreHorizontal, PackageCheck, RotateCcw, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { WorkspaceLink as Link, useWorkspaceRouter } from "@/components/workspace-path-provider";
import { formatCurrency } from "@/lib/utils";

import {
  cancelOrderAction,
  recordOrderPaymentAction,
  recordOrderRefundAction,
  reverseLatestOrderShipmentAction,
} from "../operations-actions";
import { FulfillmentWizard } from "./fulfillment-wizard";

export type OrderOperationsData = {
  id: string;
  orderNumber: string;
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
  shipments: Array<{
    id: string;
    carrier: string | null;
    trackingNumber: string | null;
    shippedAt: string;
    reversal: { reason: string; reversedAt: string } | null;
  }>;
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
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = React.useState(false);
  const [fulfillmentHistoryOpen, setFulfillmentHistoryOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [undoFulfillmentOpen, setUndoFulfillmentOpen] = React.useState(false);
  const [fulfillmentOpen, setFulfillmentOpen] = React.useState(false);
  const attempts = React.useRef(new Map<string, { signature: string; key: string }>());
  const paid = order.payments.reduce((sum, entry) => sum + entry.amount, 0);
  const refunded = order.refunds.reduce((sum, entry) => sum + entry.amount, 0);
  const unlinkedRefunds = order.refunds
    .filter((entry) => !entry.orderReturnId)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const due = Math.max(order.total - paid + unlinkedRefunds, 0);
  const active = order.orderStatus === "Active";
  const unshipped = order.items.filter((item) => item.quantity > item.shippedQuantity);
  const pendingReturns = order.returns.filter(
    (receipt) => receipt.refundState === "requested" || receipt.refundState === "partially_refunded",
  );
  const canCompletePendingRefund = canManageMoney && paid - refunded > 0.001 && pendingReturns.length > 0;
  const canRecordPayment = canManageMoney && active && due > 0.001;
  const canRecordFulfillment = active && canShip && !order.returns.length && unshipped.length > 0;
  const activeShipments = order.shipments.filter((shipment) => !shipment.reversal);
  const latestActiveShipment = activeShipments.at(-1);
  const canUndoFulfillment = active && canShip && !order.returns.length && Boolean(latestActiveShipment);
  const canCancel =
    active && canShip && !order.returns.length && order.items.every((item) => item.shippedQuantity === 0);

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
      setPaymentOpen(false);
      setRefundOpen(false);
      setUndoFulfillmentOpen(false);
      setCancelOpen(false);
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
    <section className="grid gap-3" aria-label="Order actions and summary">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-muted-foreground text-sm">
        <Badge
          variant="outline"
          className={
            active
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
              : undefined
          }
        >
          {order.orderStatus}
        </Badge>
        <span>Received {formatCurrency(paid)}</span>
        <span>Refunded {formatCurrency(refunded)}</span>
        <span className={due > 0.001 ? "font-medium text-foreground" : undefined}>
          Balance due {formatCurrency(due)}
        </span>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => setPaymentHistoryOpen(true)}
        >
          Payment history
        </Button>
      </div>
      {order.reservationExpiresAt ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800 text-xs dark:bg-amber-950 dark:text-amber-300">
          Unpaid stock is held until {new Date(order.reservationExpiresAt).toLocaleDateString()}.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {canRecordFulfillment ? (
          <Button type="button" size="sm" onClick={() => setFulfillmentOpen(true)}>
            <PackageCheck /> Record fulfillment
          </Button>
        ) : null}
        {canRecordPayment ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>
            <Banknote /> Record payment
          </Button>
        ) : null}
        {canManageReturns && active ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/orders/${order.id}/return?new=1`}>
              <RotateCcw /> Start return
            </Link>
          </Button>
        ) : null}
        {canCompletePendingRefund ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setRefundOpen(true)}>
            <RotateCcw />
            Complete pending refund
          </Button>
        ) : null}
        {canUndoFulfillment || canCancel || order.shipments.length || (canManageReturns && order.returns.length) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <MoreHorizontal /> More actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {order.shipments.length ? (
                <DropdownMenuItem onSelect={() => setFulfillmentHistoryOpen(true)}>
                  Fulfillment history
                </DropdownMenuItem>
              ) : null}
              {canManageReturns
                ? order.returns.map((receipt) => (
                    <DropdownMenuItem key={receipt.id} asChild>
                      <Link href={`/dashboard/orders/${order.id}/return?returnId=${receipt.id}`}>
                        {receipt.returnNumber} · {receipt.refundState.replaceAll("_", " ")}
                      </Link>
                    </DropdownMenuItem>
                  ))
                : null}
              {canUndoFulfillment ? (
                <DropdownMenuItem onSelect={() => setUndoFulfillmentOpen(true)}>
                  <Undo2 /> Undo fulfillment
                </DropdownMenuItem>
              ) : null}
              {canCancel ? (
                <DropdownMenuItem variant="destructive" onSelect={() => setCancelOpen(true)}>
                  <XCircle /> Cancel order
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <FulfillmentWizard
        orderId={order.id}
        open={fulfillmentOpen}
        onOpenChange={setFulfillmentOpen}
        initialOrder={{
          id: order.id,
          orderNumber: order.orderNumber,
          version: order.version,
          items: unshipped.map((item) => ({
            id: item.id,
            product: item.product,
            remaining: item.quantity - item.shippedQuantity,
          })),
        }}
      />
      <Dialog
        open={paymentOpen}
        onOpenChange={(open) => {
          if (!busy) setPaymentOpen(open);
        }}
      >
        <DialogContent allowAutoFocus disableOutsideClose={busy} className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>For payments already received outside VadosStack.</DialogDescription>
          </DialogHeader>
          {canRecordPayment ? (
            <form
              className="grid content-start gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const fields = moneyFields(event.currentTarget);
                void run("payment", () => recordOrderPaymentAction({ ...submission("payment", fields), ...fields }));
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <OperationField label="Amount" htmlFor="operation-payment-amount">
                  <Input
                    id="operation-payment-amount"
                    aria-label="Payment amount"
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={due.toFixed(2)}
                    defaultValue={due.toFixed(2)}
                    required
                  />
                </OperationField>
                <OperationField label="Method" htmlFor="operation-payment-method">
                  <Input
                    id="operation-payment-method"
                    aria-label="Payment method"
                    name="method"
                    placeholder="Cash, check, bank transfer…"
                    required
                    maxLength={100}
                  />
                </OperationField>
                <OperationField label="Reference" htmlFor="operation-payment-reference" className="sm:col-span-2">
                  <Input
                    id="operation-payment-reference"
                    aria-label="Payment reference"
                    name="reference"
                    placeholder="External transaction reference"
                    maxLength={200}
                  />
                </OperationField>
              </div>
              <label className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm">
                <input className="mt-0.5" type="checkbox" name="confirmed" required />I confirm this payment was
                received externally.
              </label>
              <Button size="sm" className="justify-self-end" disabled={busy}>
                Record payment
              </Button>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={refundOpen}
        onOpenChange={(open) => {
          if (!busy) setRefundOpen(open);
        }}
      >
        <DialogContent allowAutoFocus disableOutsideClose={busy} className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Complete pending refund</DialogTitle>
            <DialogDescription>Complete a refund created by the previous return workflow.</DialogDescription>
          </DialogHeader>
          {canCompletePendingRefund && refundOpen ? (
            <form
              className="grid content-start gap-4"
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
              <div className="grid gap-3 sm:grid-cols-2">
                <OperationField label="Original payment" htmlFor="operation-refund-payment" className="sm:col-span-2">
                  <select
                    id="operation-refund-payment"
                    aria-label="Original payment"
                    className={selectClass}
                    name="paymentId"
                    required
                  >
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
                          {entry.method} · {formatCurrency(entry.amount)}
                          {entry.reference ? ` · ${entry.reference}` : ""}
                        </option>
                      ))}
                  </select>
                </OperationField>
                <OperationField label="Pending return" htmlFor="operation-refund-return">
                  <select
                    id="operation-refund-return"
                    aria-label="Pending return for refund"
                    className={selectClass}
                    name="returnId"
                  >
                    {pendingReturns.map((receipt) => (
                      <option key={receipt.id} value={receipt.id}>
                        {receipt.returnNumber} · requested {formatCurrency(receipt.refundAmount)}
                      </option>
                    ))}
                  </select>
                </OperationField>
                <OperationField label="Amount" htmlFor="operation-refund-amount">
                  <Input
                    id="operation-refund-amount"
                    aria-label="Refund amount"
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={(paid - refunded).toFixed(2)}
                    required
                  />
                </OperationField>
                <OperationField label="Method" htmlFor="operation-refund-method">
                  <Input
                    id="operation-refund-method"
                    aria-label="Refund method"
                    name="method"
                    placeholder="Refund method"
                    required
                    maxLength={100}
                  />
                </OperationField>
                <OperationField label="Reference" htmlFor="operation-refund-reference">
                  <Input
                    id="operation-refund-reference"
                    aria-label="Refund reference"
                    name="reference"
                    placeholder="External refund reference"
                    required
                    maxLength={200}
                  />
                </OperationField>
              </div>
              <label className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm">
                <input className="mt-0.5" type="checkbox" name="confirmed" required />I confirm this refund completed
                externally.
              </label>
              <Button size="sm" className="justify-self-end" disabled={busy}>
                Complete refund
              </Button>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={undoFulfillmentOpen}
        onOpenChange={(open) => {
          if (!busy) setUndoFulfillmentOpen(open);
        }}
      >
        <DialogContent allowAutoFocus disableOutsideClose={busy} className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Undo latest fulfillment</DialogTitle>
            <DialogDescription>
              Restore the latest fulfillment to unfulfilled. Inventory will not be changed.
            </DialogDescription>
          </DialogHeader>
          {canUndoFulfillment && undoFulfillmentOpen && latestActiveShipment ? (
            <form
              className="grid content-start gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const fields = { reason: String(new FormData(event.currentTarget).get("reason") ?? "") };
                void run("undo-fulfillment", () =>
                  reverseLatestOrderShipmentAction({
                    ...submission("undo-fulfillment", fields),
                    ...fields,
                  }),
                );
              }}
            >
              <p className="text-muted-foreground text-sm">
                Fulfillment recorded {new Date(latestActiveShipment.shippedAt).toLocaleDateString()}.
              </p>
              <OperationField label="Reason" htmlFor="operation-fulfillment-reversal-reason">
                <Input
                  id="operation-fulfillment-reversal-reason"
                  name="reason"
                  placeholder="Why is this fulfillment being undone?"
                  maxLength={500}
                  required
                />
              </OperationField>
              <p className="text-muted-foreground text-xs">
                This restores the order quantities to unfulfilled and keeps an audit entry. It does not create a return
                or restock inventory.
              </p>
              <Button size="sm" variant="outline" className="justify-self-end" disabled={busy}>
                <Undo2 />
                Undo fulfillment
              </Button>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={paymentHistoryOpen} onOpenChange={setPaymentHistoryOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Payment history</DialogTitle>
            <DialogDescription>Payments and refunds recorded for this order.</DialogDescription>
          </DialogHeader>
          {order.payments.length ? (
            <div className="grid content-start gap-2 text-sm">
              {order.payments.map((entry) => (
                <p key={entry.id} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{formatCurrency(entry.amount)}</span> received ·{" "}
                  {entry.method} · {entry.reference ?? "No reference"}
                  {entry.source === "legacy" ? " · migrated opening balance" : ""}
                </p>
              ))}
              {order.refunds.map((entry) => (
                <p key={entry.id} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{formatCurrency(entry.amount)}</span> refunded ·{" "}
                  {entry.method} · {entry.reference ?? "No reference"}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No payments recorded.</p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={fulfillmentHistoryOpen} onOpenChange={setFulfillmentHistoryOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Fulfillment history</DialogTitle>
            <DialogDescription>Fulfillments recorded for this order.</DialogDescription>
          </DialogHeader>
          {order.shipments.length ? (
            <div className="grid content-start gap-2 text-sm">
              {order.shipments.map((entry) => (
                <div key={entry.id} className="grid gap-0.5 text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">
                      {new Date(entry.shippedAt).toLocaleDateString()}
                    </span>{" "}
                    · {entry.carrier || "Pickup"} · {entry.trackingNumber || "No tracking number"}
                    {entry.reversal ? " · Undone" : ""}
                  </p>
                  {entry.reversal ? (
                    <p className="text-xs">
                      Undone {new Date(entry.reversal.reversedAt).toLocaleDateString()} · {entry.reversal.reason}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={cancelOpen}
        onOpenChange={(open) => {
          if (!busy) setCancelOpen(open);
        }}
      >
        <DialogContent disableOutsideClose={busy}>
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>
              {paid - refunded > 0.001
                ? "Refund the remaining payment before cancelling this order."
                : "This cancels the order and returns its items to inventory. This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setCancelOpen(false)}>
              Keep order
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || paid - refunded > 0.001}
              onClick={() =>
                void run("cancel", () => cancelOrderAction(submission("cancel", { version: order.version })))
              }
            >
              {busy ? "Cancelling…" : "Cancel order"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function OperationField({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className={`grid min-w-0 gap-1.5 font-medium text-xs ${className ?? ""}`}>
      {label}
      {children}
    </label>
  );
}
