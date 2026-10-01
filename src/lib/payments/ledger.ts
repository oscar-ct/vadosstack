import type { Prisma } from "@prisma/client";

import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { deriveCustomerBillingStatus, deriveJobPaymentStatus } from "@/lib/customer-billing";
import { prisma } from "@/lib/prisma";

import { calculateApplicationFeeDecimal } from "./application-fee";
import {
  canTransitionPaymentStatus,
  decimalMoneyToMinorUnits,
  getNetPaymentMinorUnits,
  isPaymentStatus,
  minorUnitsToDecimalMoney,
  normalizeCurrency,
  type PaymentProvider,
  type PaymentStatus,
} from "./domain";

type TransactionClient = Prisma.TransactionClient;

async function recalculateJobPaymentSummary(transaction: TransactionClient, workspaceId: string, jobId: string) {
  const job = await transaction.job.findUnique({
    where: { id_ownerId: { id: jobId, ownerId: workspaceId } },
    select: {
      id: true,
      customerId: true,
      finalCost: true,
      status: true,
      invoice: { select: { id: true } },
    },
  });
  if (!job) throw new Error("Payment job could not be found.");

  const payments = await transaction.jobPayment.findMany({
    where: { jobId, ownerId: workspaceId },
    select: { amount: true, paymentType: true, refundedAmount: true, status: true },
  });
  const amountPaidMinor = payments.reduce(
    (total, payment) =>
      total +
      getNetPaymentMinorUnits({
        amount: payment.amount.toString(),
        refundedAmount: payment.refundedAmount.toString(),
        status: payment.status,
      }),
    0,
  );
  const depositPaidMinor = payments
    .filter((payment) => payment.paymentType === "deposit")
    .reduce(
      (total, payment) =>
        total +
        getNetPaymentMinorUnits({
          amount: payment.amount.toString(),
          refundedAmount: payment.refundedAmount.toString(),
          status: payment.status,
        }),
      0,
    );
  const amountPaid = minorUnitsToDecimalMoney(amountPaidMinor);
  const depositPaid = minorUnitsToDecimalMoney(depositPaidMinor);
  const finalCostMinor = decimalMoneyToMinorUnits(job.finalCost?.toString() ?? "0");
  const paymentStatus = deriveJobPaymentStatus(job.status, job.finalCost?.toString(), amountPaid);

  await transaction.job.update({
    where: { id_ownerId: { id: job.id, ownerId: workspaceId } },
    data: { amountPaid, depositPaid, paymentStatus },
  });
  if (job.invoice) {
    await transaction.invoice.update({
      where: { id_ownerId: { id: job.invoice.id, ownerId: workspaceId } },
      data: {
        amountPaid,
        depositPaid,
        balanceDue: minorUnitsToDecimalMoney(Math.max(0, finalCostMinor - amountPaidMinor)),
        paymentStatus,
      },
    });
  }

  if (job.customerId) {
    const jobs = await transaction.job.findMany({
      where: { ownerId: workspaceId, customerId: job.customerId },
      select: { status: true, paymentStatus: true, finalCost: true, amountPaid: true },
    });
    await transaction.customer.update({
      where: { id_ownerId: { id: job.customerId, ownerId: workspaceId } },
      data: {
        billingStatus: deriveCustomerBillingStatus(
          jobs.map((customerJob) => ({
            ...customerJob,
            finalCost: customerJob.finalCost?.toString(),
            amountPaid: customerJob.amountPaid?.toString(),
          })),
        ),
      },
    });
  }
}

export async function createInvoicePaymentAttempt(input: {
  workspaceId: string;
  invoiceId: string;
  provider: Exclude<PaymentProvider, "manual">;
  externalPaymentId?: string | null;
  idempotencyKey: string;
  method: string;
  methodType?: string | null;
  currency?: string;
}) {
  if (input.externalPaymentId !== undefined && input.externalPaymentId !== null && !input.externalPaymentId.trim()) {
    throw new Error("External payment ID cannot be blank.");
  }
  if (!input.idempotencyKey.trim()) throw new Error("Payment idempotency key is required.");
  const currency = normalizeCurrency(input.currency ?? "USD");

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.jobPayment.findUnique({
      where: { ownerId_idempotencyKey: { ownerId: input.workspaceId, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) {
      if (existing.invoiceId !== input.invoiceId || existing.provider !== input.provider) {
        throw new Error("Payment idempotency key is already used by another payment.");
      }
      return existing;
    }

    const [invoice, connection] = await Promise.all([
      transaction.invoice.findUnique({
        where: { id_ownerId: { id: input.invoiceId, ownerId: input.workspaceId } },
        select: { balanceDue: true, id: true, jobId: true },
      }),
      transaction.paymentProviderConnection.findUnique({
        where: { ownerId_provider: { ownerId: input.workspaceId, provider: input.provider } },
      }),
    ]);
    if (!invoice) throw new Error("Invoice could not be found.");
    if (
      !connection ||
      connection.status !== "active" ||
      !connection.chargesEnabled ||
      (input.provider === "stripe" && connection.accountType !== "standard")
    ) {
      throw new Error(`${input.provider} is not ready to accept payments.`);
    }

    const amountMinor = decimalMoneyToMinorUnits(invoice.balanceDue.toString());
    if (amountMinor <= 0) throw new Error("Invoice does not have an outstanding balance.");
    const applicationFeeAmount = calculateApplicationFeeDecimal(amountMinor);

    const payment = await transaction.jobPayment.create({
      data: {
        ownerId: input.workspaceId,
        jobId: invoice.jobId,
        invoiceId: invoice.id,
        amount: minorUnitsToDecimalMoney(amountMinor),
        applicationFeeAmount,
        currency,
        paymentType: "invoice_payment",
        provider: input.provider,
        status: "created",
        method: input.method,
        methodType: input.methodType ?? null,
        externalPaymentId: input.externalPaymentId ?? null,
        idempotencyKey: input.idempotencyKey,
        description: "Online invoice payment",
      },
    });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: input.workspaceId,
        action: "payment.attempt.create",
        targetType: "JobPayment",
        targetId: payment.id,
        metadata: { invoiceId: invoice.id, provider: input.provider, status: payment.status },
      },
      transaction,
    );
    return payment;
  });
}

export async function attachProviderPaymentReference(input: {
  workspaceId: string;
  paymentId: string;
  provider: Exclude<PaymentProvider, "manual">;
  externalPaymentId: string;
}) {
  if (!input.externalPaymentId.trim()) throw new Error("External payment ID is required.");
  const result = await prisma.jobPayment.updateMany({
    where: {
      id: input.paymentId,
      ownerId: input.workspaceId,
      provider: input.provider,
      status: "created",
      externalPaymentId: null,
    },
    data: { externalPaymentId: input.externalPaymentId, status: "pending" },
  });
  if (result.count !== 1) throw new Error("Payment attempt could not be attached to the provider reference.");
  return prisma.jobPayment.findUniqueOrThrow({
    where: { id_ownerId: { id: input.paymentId, ownerId: input.workspaceId } },
  });
}

export async function applyProviderPaymentEvent(input: {
  workspaceId: string;
  provider: Exclude<PaymentProvider, "manual">;
  externalPaymentId?: string;
  paymentId?: string;
  status: PaymentStatus;
  paidOn?: Date;
  refundedAmount?: string | number;
  feeAmount?: string | number | null;
  method?: string;
  methodType?: string | null;
  referenceNumber?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
}) {
  if (!isPaymentStatus(input.status)) throw new Error("Unsupported payment status.");
  if (!input.paymentId && !input.externalPaymentId) throw new Error("Payment reference is required.");

  return prisma.$transaction(async (transaction) => {
    const payment = input.paymentId
      ? await transaction.jobPayment.findUnique({
          where: { id_ownerId: { id: input.paymentId, ownerId: input.workspaceId } },
        })
      : await transaction.jobPayment.findUnique({
          where: {
            ownerId_provider_externalPaymentId: {
              ownerId: input.workspaceId,
              provider: input.provider,
              externalPaymentId: input.externalPaymentId as string,
            },
          },
        });
    if (!payment || payment.provider !== input.provider) throw new Error("Payment attempt could not be found.");
    if (!isPaymentStatus(payment.status)) {
      throw new Error(`Payment cannot move from ${payment.status} to ${input.status}.`);
    }
    if (!canTransitionPaymentStatus(payment.status, input.status)) return payment;

    const amountMinor = decimalMoneyToMinorUnits(payment.amount.toString());
    const refundedAmount = input.refundedAmount ?? payment.refundedAmount.toString();
    const refundedMinor = decimalMoneyToMinorUnits(refundedAmount);
    if (refundedMinor < 0 || refundedMinor > amountMinor)
      throw new Error("Refund amount is outside the payment total.");

    const updated = await transaction.jobPayment.update({
      where: { id_ownerId: { id: payment.id, ownerId: input.workspaceId } },
      data: {
        status: input.status,
        paidOn: input.paidOn ?? payment.paidOn,
        refundedAmount: minorUnitsToDecimalMoney(refundedMinor),
        method: input.method ?? payment.method,
        ...(input.referenceNumber !== undefined ? { referenceNumber: input.referenceNumber } : {}),
        ...(input.feeAmount !== undefined ? { feeAmount: input.feeAmount } : {}),
        ...(input.methodType !== undefined ? { methodType: input.methodType } : {}),
        ...(input.failureCode !== undefined ? { failureCode: input.failureCode } : {}),
        ...(input.failureMessage !== undefined ? { failureMessage: input.failureMessage } : {}),
      },
    });
    await recalculateJobPaymentSummary(transaction, input.workspaceId, payment.jobId);
    await recordAuthorizationAuditEvent(
      {
        workspaceId: input.workspaceId,
        action: "payment.provider_event.apply",
        targetType: "JobPayment",
        targetId: payment.id,
        metadata: { provider: input.provider, previousStatus: payment.status, status: updated.status },
      },
      transaction,
    );
    return updated;
  });
}
