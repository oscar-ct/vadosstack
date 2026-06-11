import type { JobRow } from "./jobs-table/schema";

type BillingJob = Pick<
  JobRow,
  "amountPaid" | "customerId" | "finalCost" | "invoiceId" | "outstandingBalance" | "status"
>;

type BillingStateKind =
  | "balanceDue"
  | "cancelled"
  | "needsCustomer"
  | "needsFinalPrice"
  | "noBalance"
  | "paid"
  | "paidNotInvoiced"
  | "readyToInvoice";

export type JobBillingState = {
  amountClassName: string;
  balanceDue: number;
  canCreateInvoice: boolean;
  detail: string;
  finalCost: number;
  kind: BillingStateKind;
  label: string;
};

export function toMoneyNumber(value?: string) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatJobMoney(value: string | number | undefined) {
  return `$${toMoneyNumber(String(value ?? 0)).toFixed(2)}`;
}

export function getJobBillingState(job: BillingJob): JobBillingState {
  const balanceDue = toMoneyNumber(job.outstandingBalance);
  const finalCost = toMoneyNumber(job.finalCost);
  const amountPaid = toMoneyNumber(job.amountPaid);

  if (job.invoiceId) {
    if (finalCost <= 0) {
      return {
        amountClassName: "text-muted-foreground",
        balanceDue,
        canCreateInvoice: false,
        detail: "Invoice exists, but pricing is not set.",
        finalCost,
        kind: "needsFinalPrice",
        label: "Needs final price",
      };
    }

    if (balanceDue <= 0) {
      return {
        amountClassName: "text-emerald-700 dark:text-emerald-400",
        balanceDue,
        canCreateInvoice: false,
        detail: "Invoice is paid in full.",
        finalCost,
        kind: "paid",
        label: "Paid in full",
      };
    }

    return {
      amountClassName: "text-rose-700 dark:text-rose-400",
      balanceDue,
      canCreateInvoice: false,
      detail: `${formatJobMoney(balanceDue)} due on invoice.`,
      finalCost,
      kind: "balanceDue",
      label: "Balance due",
    };
  }

  if (job.status === "Cancelled") {
    return {
      amountClassName: "text-muted-foreground",
      balanceDue,
      canCreateInvoice: false,
      detail: "Cancelled jobs are not invoice-ready.",
      finalCost,
      kind: "cancelled",
      label: "Cancelled",
    };
  }

  if (!job.customerId) {
    return {
      amountClassName: "text-amber-700 dark:text-amber-400",
      balanceDue,
      canCreateInvoice: false,
      detail: "Add a customer before invoicing.",
      finalCost,
      kind: "needsCustomer",
      label: "Needs customer",
    };
  }

  if (finalCost <= 0) {
    return {
      amountClassName: "text-amber-700 dark:text-amber-400",
      balanceDue,
      canCreateInvoice: false,
      detail: "Add billable labor or materials.",
      finalCost,
      kind: "needsFinalPrice",
      label: "Needs final price",
    };
  }

  if (balanceDue > 0) {
    return {
      amountClassName: "text-amber-700 dark:text-amber-400",
      balanceDue,
      canCreateInvoice: true,
      detail: `${formatJobMoney(balanceDue)} due, no invoice.`,
      finalCost,
      kind: "readyToInvoice",
      label: "Ready to invoice",
    };
  }

  if (amountPaid >= finalCost) {
    return {
      amountClassName: "text-emerald-700 dark:text-emerald-400",
      balanceDue,
      canCreateInvoice: true,
      detail: `${formatJobMoney(amountPaid)} paid, no invoice.`,
      finalCost,
      kind: "paidNotInvoiced",
      label: "Paid, not invoiced",
    };
  }

  return {
    amountClassName: "text-muted-foreground",
    balanceDue,
    canCreateInvoice: false,
    detail: "No open balance.",
    finalCost,
    kind: "noBalance",
    label: "No balance",
  };
}
