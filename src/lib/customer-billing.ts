export const JOB_PAYMENT_STATUS_OPTIONS = ["Pending Payment", "Partial Payment", "Paid in Full"] as const;

export const CUSTOMER_BILLING_STATUS_OPTIONS = ["Outstanding Balance", "No Balance"] as const;

export type JobPaymentStatus = (typeof JOB_PAYMENT_STATUS_OPTIONS)[number];
export type CustomerBillingStatus = (typeof CUSTOMER_BILLING_STATUS_OPTIONS)[number];

export function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

export function toMoneyNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateOutstandingBalance(
  _status: string | null | undefined,
  finalCost: string | number | null | undefined,
  amountPaid: string | number | null | undefined,
) {
  return Math.max(0, toMoneyNumber(finalCost) - toMoneyNumber(amountPaid));
}

export function deriveJobPaymentStatus(
  _status: string | null | undefined,
  finalCost: string | number | null | undefined,
  amountPaid: string | number | null | undefined,
): JobPaymentStatus {
  const total = toMoneyNumber(finalCost);
  const paid = toMoneyNumber(amountPaid);

  if (total > 0 && paid >= total) {
    return "Paid in Full";
  }

  if (paid > 0) {
    return "Partial Payment";
  }

  return "Pending Payment";
}

export function deriveCustomerBillingStatus(
  jobs: Array<{
    status: string;
    paymentStatus?: string | null;
    finalCost?: string | number | null;
    amountPaid?: string | number | null;
  }>,
): CustomerBillingStatus {
  const activeJobs = jobs;

  if (!activeJobs.length) {
    return "No Balance";
  }

  const jobsWithBalance = activeJobs.filter(
    (job) => calculateOutstandingBalance(job.status, job.finalCost, job.amountPaid) > 0,
  );

  if (jobsWithBalance.length) {
    return "Outstanding Balance";
  }

  return "No Balance";
}
