import type { OrderListSummary } from "./order-list-summary";
import type { ReturnRefundFormValues } from "./returns";

export type OrderResolutionRecord = {
  id: string;
  reference: string;
  date: string;
  kind: "Cancellation" | "Return" | "Mixed" | "Credit";
  refundState: string;
  refunded: number;
  requestedRefund: number;
  credit: number;
  reason: string;
  values: ReturnRefundFormValues;
};

export function resolutionStatusLabel(state: string) {
  switch (state) {
    case "succeeded":
      return "Refund completed";
    case "requested":
      return "Refund pending";
    case "partially_refunded":
      return "Partially refunded";
    case "not_required":
      return "No refund required";
    case "failed":
      return "Refund needs attention";
    case "draft":
      return "Draft";
    default:
      return "Resolution recorded";
  }
}

export function orderRecordStatus(summary: OrderListSummary, orderStatus: string) {
  if (summary.refundDue > 0) return "Refund due";
  if (summary.refunded > 0 && summary.netPaid === 0) return "Fully refunded";
  if (orderStatus === "Cancelled") return "Cancelled";
  if (summary.refunded > 0) return "Partially refunded";
  if (summary.activeUnits === 0 && summary.cancelledUnits > 0) return "Cancelled";
  if (summary.returnedUnits > 0 && summary.remainingUnits === 0 && summary.returnedUnits >= summary.activeUnits)
    return "Returned";
  return summary.hasResolutions ? "Resolution recorded" : orderStatus;
}

/** Shared table/card labels use ledger facts, rather than cached order labels. */
export function getOrderDisplayStatuses(summary: OrderListSummary, orderStatus: string) {
  const cancelled = orderStatus === "Cancelled" || (summary.activeUnits === 0 && summary.cancelledUnits > 0);
  const paid = summary.netPaid + summary.refunded;
  const payment =
    summary.refundDue > 0
      ? "Refund due"
      : summary.balance > 0
        ? paid > 0
          ? "Partially Paid"
          : "Pending"
        : summary.pendingRefund > 0 && paid > 0
          ? "Refund review"
          : paid === 0 && summary.effectiveTotal === 0
            ? cancelled
              ? null
              : "No payment required"
            : summary.paymentStatus;
  const fulfillment = cancelled
    ? null
    : summary.remainingUnits === 0 &&
        summary.hasResolutions &&
        (summary.fulfilledUnits < summary.activeUnits || summary.returnedUnits >= summary.activeUnits)
      ? "Resolved"
      : summary.fulfilledUnits >= summary.activeUnits
        ? "Fulfilled"
        : summary.fulfilledUnits > 0
          ? "Partially Fulfilled"
          : "Unfulfilled";
  return {
    cancellation: cancelled ? "Cancelled" : summary.cancelledUnits > 0 ? "Partially cancelled" : null,
    payment,
    fulfillment,
  };
}

const displayMoney = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
export function getOrderStatusCards(summary: OrderListSummary, orderStatus: string) {
  const resolved =
    orderStatus !== "Active" ||
    summary.activeUnits === 0 ||
    (summary.remainingUnits === 0 &&
      summary.hasResolutions &&
      (summary.fulfilledUnits < summary.activeUnits || summary.returnedUnits >= summary.activeUnits));
  const fullyFulfilled = summary.fulfilledUnits >= summary.activeUnits;
  const fulfillment = {
    label: resolved
      ? "Resolved"
      : fullyFulfilled
        ? "Fulfilled"
        : summary.fulfilledUnits > 0
          ? "Partially fulfilled"
          : "Unfulfilled",
    detail: resolved
      ? [
          summary.cancelledUnits > 0 ? `${summary.cancelledUnits} cancelled` : "",
          summary.returnedUnits > 0 ? `${summary.returnedUnits} returned` : "",
        ]
          .filter(Boolean)
          .join(" · ") || "No units remain to fulfill"
      : fullyFulfilled
        ? "Every active unit is fulfilled"
        : `${summary.remainingUnits} ${summary.remainingUnits === 1 ? "unit still needs" : "units still need"} fulfillment`,
    value: resolved ? "No units remaining" : `${summary.fulfilledUnits} of ${summary.activeUnits} units`,
    tone:
      resolved || fullyFulfilled
        ? ("success" as const)
        : summary.fulfilledUnits > 0
          ? ("progress" as const)
          : ("warning" as const),
    percent:
      resolved || summary.activeUnits === 0
        ? 100
        : Math.min(Math.round((summary.fulfilledUnits / summary.activeUnits) * 100), 100),
  };
  const paid = summary.netPaid + summary.refunded;
  const payment =
    summary.refundDue > 0
      ? {
          label: "Refund due",
          detail: "Remaining amount to return to the customer",
          value: displayMoney(summary.refundDue),
          tone: "warning" as const,
        }
      : summary.pendingRefund > 0 && paid > 0 && summary.balance === 0
        ? {
            label: "Refund review",
            detail: "Review the saved refund request",
            value: displayMoney(summary.pendingRefund),
            tone: "warning" as const,
          }
        : summary.balance > 0
          ? {
              label: paid > 0 ? "Partially paid" : "Payment due",
              detail: "Balance still due",
              value: displayMoney(summary.balance),
              tone: paid > 0 ? ("progress" as const) : ("warning" as const),
            }
          : {
              label:
                summary.refunded > 0 && summary.netPaid === 0
                  ? "Fully refunded"
                  : summary.refunded > 0
                    ? "Partially refunded"
                    : paid === 0
                      ? "No payment required"
                      : "Settled",
              detail:
                summary.refunded > 0
                  ? "Retained after refunds"
                  : paid === 0
                    ? "No payment was collected"
                    : "Retained from payments",
              value: displayMoney(summary.netPaid),
              tone: summary.refunded > 0 || paid === 0 ? ("neutral" as const) : ("success" as const),
            };
  return { fulfillment, payment };
}
