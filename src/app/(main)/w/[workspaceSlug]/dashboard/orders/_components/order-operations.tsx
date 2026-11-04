"use client";

import * as React from "react";

import { Banknote, PackageCheck, RotateCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";

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
import { adjustmentCredit, cancellableQuantity } from "@/lib/commerce/order-cancellation";
import type { OrderListSummary } from "@/lib/commerce/order-list-summary";
import { getOrderStatusCards, resolutionStatusLabel } from "@/lib/commerce/order-resolution";
import { cn, formatCurrency } from "@/lib/utils";

import { ShippingExpenseRecorder } from "../../commerce-analytics/_components/shipping-expense-recorder";
import {
  recordOrderCreditRefundAction,
  recordOrderPaymentAction,
  recordOrderRefundAction,
  reverseLatestOrderShipmentAction,
} from "../operations-actions";
import { FulfillmentWizard } from "./fulfillment-wizard";
import { OrderHistoryButton } from "./order-history-button";
import { ShippingExpenseHistory, type ShippingExpenseHistoryEntry } from "./shipping-expense-history";

export type OrderOperationsData = {
  summary: OrderListSummary;
  id: string;
  deliveryMethod: "delivery" | "pickup";
  orderNumber: string;
  version: number;
  total: number;
  orderStatus: string;
  reservationExpiresAt: string | null;
  items: Array<{
    id: string;
    product: string;
    quantity: number;
    shippedQuantity: number;
    returnedQuantity: number;
    cancelledQuantity: number;
    lineTotal: number;
    discountAmount: number;
    taxAmount: number;
  }>;
  shippingAmount: number;
  adjustments: Array<{
    id: string;
    kind: string;
    merchandiseAmount: number;
    discountAmount: number;
    taxAmount: number;
    shippingAmount: number;
    reason: string;
    effectiveAt: string;
    items: Array<{
      id: string;
      product: string;
      quantity: number;
      grossAmount: number;
      discountAmount: number;
      taxAmount: number;
    }>;
  }>;
  shippingExpenses: ShippingExpenseHistoryEntry[];
  payments: Array<{ id: string; amount: number; method: string; reference: string | null; source: string }>;
  refunds: Array<{
    id: string;
    paymentId: string;
    orderReturnId: string | null;
    adjustmentId: string | null;
    amount: number;
    method: string;
    reference: string | null;
    batchKey: string;
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
  resolutionBrowser = false,
}: {
  order: OrderOperationsData;
  canManageMoney: boolean;
  canShip: boolean;
  canManageReturns: boolean;
  resolutionBrowser?: boolean;
}) {
  const router = useWorkspaceRouter();
  const [busy, setBusy] = React.useState(false);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = React.useState(false);
  const [adjustmentHistoryOpen, setAdjustmentHistoryOpen] = React.useState(false);
  const [fulfillmentHistoryOpen, setFulfillmentHistoryOpen] = React.useState(false);
  const [undoFulfillmentOpen, setUndoFulfillmentOpen] = React.useState(false);
  const [fulfillmentOpen, setFulfillmentOpen] = React.useState(false);
  const [creditRefundAmount, setCreditRefundAmount] = React.useState<string | null>(null);
  const attempts = React.useRef(new Map<string, { signature: string; key: string }>());
  const paid = order.payments.reduce((sum, entry) => sum + entry.amount, 0);
  const refunded = order.refunds.reduce((sum, entry) => sum + entry.amount, 0);
  const refundGroups = [
    ...order.refunds
      .reduce((groups, refund) => {
        const current = groups.get(refund.batchKey) ?? {
          batchKey: refund.batchKey,
          amount: 0,
          method: refund.method,
          reference: refund.reference,
          entries: 0,
        };
        current.amount += refund.amount;
        current.entries += 1;
        groups.set(refund.batchKey, current);
        return groups;
      }, new Map<
        string,
        { batchKey: string; amount: number; method: string; reference: string | null; entries: number }
      >())
      .values(),
  ];
  const credited = order.adjustments.reduce((sum, entry) => sum + adjustmentCredit(entry), 0);
  const effectiveTotal = Math.max(order.total - credited, 0);
  const due = Math.max(effectiveTotal - paid, 0);
  const creditOwed = Math.max(paid - refunded - effectiveTotal, 0);
  const availableAdjustments = order.adjustments
    .map((adjustment) => ({
      ...adjustment,
      available: Math.max(
        adjustmentCredit(adjustment) -
          order.refunds
            .filter((refund) => refund.adjustmentId === adjustment.id)
            .reduce((sum, refund) => sum + refund.amount, 0),
        0,
      ),
    }))
    .filter((adjustment) => adjustment.available > 0.001);
  const availableCreditTotal = availableAdjustments.reduce((sum, adjustment) => sum + adjustment.available, 0);
  const maxCreditRefund = Math.min(paid - refunded, creditOwed, availableCreditTotal);
  const requestedCreditRefund = creditRefundAmount === null ? maxCreditRefund : Number(creditRefundAmount || 0);
  let allocationRemaining = Math.max(Math.round(requestedCreditRefund * 100), 0);
  const creditAllocations = availableAdjustments
    .map((adjustment) => {
      const amount = Math.min(allocationRemaining, Math.round(adjustment.available * 100));
      allocationRemaining -= amount;
      return { ...adjustment, refundAmount: amount / 100 };
    })
    .filter((adjustment) => adjustment.refundAmount > 0);
  const active = order.orderStatus === "Active";
  const unshipped = order.items
    .map((item) => ({
      ...item,
      remaining: cancellableQuantity(item),
    }))
    .filter((item) => item.remaining > 0);
  const pendingReturns = order.returns.filter(
    (receipt) => receipt.refundState === "requested" || receipt.refundState === "partially_refunded",
  );
  const canRecordRefund =
    canManageMoney && paid - refunded > 0.001 && (pendingReturns.length > 0 || creditOwed > 0.001);
  const canRecordPayment = canManageMoney && active && due > 0.001;
  const canRecordFulfillment = active && canShip && unshipped.length > 0;
  const activeShipments = order.shipments.filter((shipment) => !shipment.reversal);
  const latestActiveShipment = activeShipments.at(-1);
  const canUndoFulfillment = active && canShip && !order.returns.length && Boolean(latestActiveShipment);
  const canCancel = active && canShip && unshipped.length > 0;
  const hasReturnableItems = order.items.some((item) => item.shippedQuantity > item.returnedQuantity);
  const fulfilledUnits = order.summary.fulfilledUnits;
  const cards = getOrderStatusCards(order.summary, order.orderStatus);
  const fulfillmentState = cards.fulfillment;
  const fulfillmentPercent = cards.fulfillment.percent;
  const paymentState = cards.payment;
  const shippingCost = order.shippingExpenses.reduce((sum, entry) => sum + entry.amount, 0);
  const requiresShipping = order.deliveryMethod !== "pickup";
  const shippingStarted = fulfilledUnits > 0 || order.shipments.length > 0;
  const shippingState = !requiresShipping
    ? { detail: "Customer pickup does not require carrier cost", label: "Not required", tone: "success" as const }
    : order.shippingExpenses.length
      ? {
          detail: `Customer charged ${formatCurrency(order.shippingAmount)} · ${order.shippingExpenses.length} expense ${order.shippingExpenses.length === 1 ? "entry" : "entries"}`,
          label: "Cost recorded",
          tone: "success" as const,
        }
      : shippingStarted
        ? { detail: "Fulfillment has started without a carrier cost", label: "Cost missing", tone: "warning" as const }
        : {
            detail: "Record the carrier cost when fulfillment begins",
            label: "Not recorded yet",
            tone: "neutral" as const,
          };

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
      <div className="grid gap-3 lg:grid-cols-3">
        <StatusCard
          detail={fulfillmentState.detail}
          history={<OrderHistoryButton label="Fulfillment history" onClick={() => setFulfillmentHistoryOpen(true)} />}
          label="Fulfillment"
          status={fulfillmentState.label}
          tone={fulfillmentState.tone}
          value={fulfillmentState.value}
        >
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                fulfillmentState.tone === "success"
                  ? "bg-emerald-600"
                  : fulfillmentState.tone === "progress"
                    ? "bg-blue-600"
                    : "bg-amber-500",
              )}
              style={{ width: `${fulfillmentPercent}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1 empty:hidden">
            {canRecordFulfillment ? (
              <Button type="button" size="sm" onClick={() => setFulfillmentOpen(true)}>
                <PackageCheck /> Record fulfillment
              </Button>
            ) : null}
            {active && (canCancel || (canManageReturns && hasReturnableItems)) ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/orders/${order.id}/return?new=1`}>
                  <RotateCcw /> Resolve items
                </Link>
              </Button>
            ) : null}
            {!resolutionBrowser && canManageReturns && order.returns.length ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm">
                    <RotateCcw /> Resolutions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {order.returns.map((receipt) => (
                    <DropdownMenuItem key={receipt.id} asChild>
                      <Link href={`/dashboard/orders/${order.id}/return?returnId=${receipt.id}`}>
                        {receipt.returnNumber} · {resolutionStatusLabel(receipt.refundState)}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </StatusCard>

        <StatusCard
          detail={paymentState.detail}
          history={<OrderHistoryButton label="Payment history" onClick={() => setPaymentHistoryOpen(true)} />}
          label="Payment & refunds"
          status={paymentState.label}
          tone={paymentState.tone}
          value={paymentState.value}
        >
          <dl className="grid grid-cols-2 gap-3 text-xs tabular-nums">
            <div className="grid gap-1">
              <dt className="opacity-70">Collected</dt>
              <dd className="font-medium">{formatCurrency(paid)}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="opacity-70">Refunded</dt>
              <dd className="font-medium">{formatCurrency(refunded)}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2 pt-1 empty:hidden">
            {canRecordPayment ? (
              <Button type="button" size="sm" onClick={() => setPaymentOpen(true)}>
                <Banknote /> Record payment
              </Button>
            ) : null}
            {canRecordRefund ? (
              <Button type="button" size="sm" onClick={() => setRefundOpen(true)}>
                <RotateCcw />
                {creditOwed > 0.001 ? `Refund ${formatCurrency(creditOwed)}` : "Complete refund"}
              </Button>
            ) : null}
            {credited > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdjustmentHistoryOpen(true)}>
                {order.adjustments.length} credit adjustment{order.adjustments.length === 1 ? "" : "s"}
              </Button>
            ) : null}
          </div>
        </StatusCard>

        <StatusCard
          detail={shippingState.detail}
          history={<ShippingExpenseHistory orderNumber={order.orderNumber} entries={order.shippingExpenses} />}
          label="Shipping cost"
          status={shippingState.label}
          tone={shippingState.tone}
          value={requiresShipping ? formatCurrency(shippingCost) : "Pickup"}
        >
          <p className="text-xs">Customer shipping charge {formatCurrency(order.shippingAmount)}</p>
          <div className="flex flex-wrap gap-2 pt-1 empty:hidden">
            {canManageMoney && requiresShipping ? <ShippingExpenseRecorder orderId={order.id} /> : null}
          </div>
        </StatusCard>
      </div>
      {order.reservationExpiresAt ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800 text-xs dark:bg-amber-950 dark:text-amber-300">
          Unpaid stock is held until {new Date(order.reservationExpiresAt).toLocaleDateString()}.
        </p>
      ) : null}
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
            remaining: item.remaining,
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
            <DialogTitle>{creditOwed > 0.001 ? "Record customer refund" : "Complete pending refund"}</DialogTitle>
            <DialogDescription>
              {creditOwed > 0.001
                ? "Record money already returned to the customer against this order credit."
                : "Complete a refund created by the return workflow."}
            </DialogDescription>
          </DialogHeader>
          {canRecordRefund && refundOpen ? (
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
                if (fields.returnId)
                  void run("return-refund", () =>
                    recordOrderRefundAction({ ...submission("return-refund", fields), ...fields }),
                  );
                else
                  void run("credit-refund", () =>
                    recordOrderCreditRefundAction({ ...submission("credit-refund", fields), ...fields }),
                  );
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
                {pendingReturns.length ? (
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
                ) : null}
                <OperationField label="Amount" htmlFor="operation-refund-amount">
                  {pendingReturns.length ? (
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
                  ) : (
                    <Input
                      id="operation-refund-amount"
                      aria-label="Refund amount"
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={maxCreditRefund.toFixed(2)}
                      value={creditRefundAmount ?? maxCreditRefund.toFixed(2)}
                      onChange={(event) => setCreditRefundAmount(event.target.value)}
                      required
                    />
                  )}
                </OperationField>
                {!pendingReturns.length ? (
                  <div className="grid gap-2 rounded-md bg-muted/50 p-3 sm:col-span-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">Applied automatically</span>
                      <span className="text-muted-foreground">
                        {creditAllocations.length} credit source{creditAllocations.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="divide-y">
                      {creditAllocations.map((adjustment) => (
                        <div key={adjustment.id} className="flex items-center justify-between gap-4 py-1.5 text-xs">
                          <span className="min-w-0 truncate text-muted-foreground">{adjustment.reason}</span>
                          <span className="shrink-0 font-medium tabular-nums">
                            {formatCurrency(adjustment.refundAmount)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Credits are applied oldest first. Enter a smaller amount to record a partial refund.
                    </p>
                  </div>
                ) : null}
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
            <DialogTitle>Correct latest fulfillment</DialogTitle>
            <DialogDescription>
              Use this only to correct an incorrectly recorded fulfillment. The latest fulfillment will return to
              unfulfilled without changing inventory or customer finances.
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
                  placeholder="What was recorded incorrectly?"
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
                Correct fulfillment record
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
              {refundGroups.map((entry) => (
                <p key={entry.batchKey} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{formatCurrency(entry.amount)}</span> refunded ·{" "}
                  {entry.method} · {entry.reference ?? "No reference"}
                  {entry.entries > 1 ? ` · allocated across ${entry.entries} credits` : ""}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No payments recorded.</p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={adjustmentHistoryOpen} onOpenChange={setAdjustmentHistoryOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cancellation and credit history</DialogTitle>
            <DialogDescription>
              Append-only changes to the original order. The original quantities and prices remain preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[...order.adjustments].reverse().map((adjustment) => {
              const credit = adjustmentCredit(adjustment);
              return (
                <article key={adjustment.id} className="grid gap-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {adjustment.kind === "Cancellation" ? "Items cancelled" : adjustment.kind}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {new Date(adjustment.effectiveAt).toLocaleString()} · {adjustment.reason}
                      </p>
                    </div>
                    <p className="font-semibold tabular-nums">-{formatCurrency(credit)}</p>
                  </div>
                  <div className="divide-y rounded-md bg-muted/40 px-3">
                    {adjustment.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                        <span className="min-w-0 truncate">{item.product}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {item.quantity} cancelled · -
                          {formatCurrency(item.grossAmount - item.discountAmount + item.taxAmount)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                    <HistoryAmount label="Merchandise" value={adjustment.merchandiseAmount} />
                    <HistoryAmount label="Discount restored" value={adjustment.discountAmount} />
                    <HistoryAmount label="Tax" value={adjustment.taxAmount} />
                    <HistoryAmount label="Shipping" value={adjustment.shippingAmount} />
                  </div>
                </article>
              );
            })}
          </div>
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
                    {entry.reversal ? " · Corrected" : ""}
                  </p>
                  {entry.reversal ? (
                    <p className="text-xs">
                      Corrected {new Date(entry.reversal.reversedAt).toLocaleDateString()} · {entry.reversal.reason}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-muted-foreground text-sm">No fulfillment recorded for this order.</p>
          )}
          {canUndoFulfillment && latestActiveShipment ? (
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-sm">Was the latest fulfillment recorded incorrectly?</p>
                <p className="text-muted-foreground text-xs">
                  Correct the record without creating a cancellation, return, credit, or inventory movement.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => {
                  setFulfillmentHistoryOpen(false);
                  setUndoFulfillmentOpen(true);
                }}
              >
                <Undo2 /> Correct latest fulfillment
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StatusCard({
  children,
  detail,
  history,
  label,
  status,
  tone,
  value,
}: {
  children: React.ReactNode;
  detail: string;
  history: React.ReactNode;
  label: string;
  status: string;
  tone: "neutral" | "progress" | "success" | "warning";
  value: string;
}) {
  const toneClasses = {
    neutral:
      "border-slate-200 bg-slate-50/80 text-slate-950 dark:border-slate-800 dark:bg-slate-950/45 dark:text-slate-50",
    progress: "border-blue-200 bg-blue-50/80 text-blue-950 dark:border-blue-900 dark:bg-blue-950/45 dark:text-blue-50",
    success:
      "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/45 dark:text-emerald-50",
    warning:
      "border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900 dark:bg-amber-950/45 dark:text-amber-50",
  } satisfies Record<typeof tone, string>;

  return (
    <article className={cn("flex min-h-44 flex-col gap-3 rounded-xl border p-3.5 sm:min-h-48", toneClasses[tone])}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-xs uppercase tracking-wide opacity-70">{label}</p>
          <p className="mt-1 font-semibold text-base">{status}</p>
        </div>
        {history}
      </div>
      <div>
        <p className="font-semibold text-xl tabular-nums tracking-tight">{value}</p>
        <p className="mt-1 text-xs opacity-70">{detail}</p>
      </div>
      <div className="mt-auto grid gap-2">{children}</div>
    </article>
  );
}

function HistoryAmount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{formatCurrency(value)}</p>
    </div>
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
