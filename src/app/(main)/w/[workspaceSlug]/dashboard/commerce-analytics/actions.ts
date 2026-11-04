"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { CommerceError, commerceTransaction, lockOrder } from "@/lib/commerce/transaction";
import { amountSchema, parseCommerceInput, submissionKeySchema } from "@/lib/commerce/validation";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

import { createHash } from "node:crypto";

const correctionSchema = z
  .object({
    entryId: z.string().min(1),
    expectedAmount: z.string(),
    correctedAmount: z
      .number()
      .finite()
      .min(0)
      .max(1e12)
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001),
    reason: z.string().trim().min(1).max(1000),
    submissionKey: submissionKeySchema,
  })
  .strict();
export async function correctInventoryInvestmentAction(raw: z.infer<typeof correctionSchema>) {
  const auth = await getPermittedDashboardAuthorization("inventory.manage");
  if (!auth) throw new Error("You cannot correct inventory investment.");
  const input = parseCommerceInput(correctionSchema, raw);
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const outcome = await commerceTransaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM workspaces WHERE id=${auth.workspaceId} FOR UPDATE`;
    const previous = await tx.inventoryInvestmentEntry.findUnique({
      where: { ownerId_idempotencyKey: { ownerId: auth.workspaceId, idempotencyKey: input.submissionKey } },
    });
    if (previous) {
      if (previous.submissionHash !== hash) throw new CommerceError("Submission key already used.");
      const evidence =
        previous.evidence && typeof previous.evidence === "object" && !Array.isArray(previous.evidence)
          ? previous.evidence
          : {};
      return {
        status: "saved" as const,
        entryId: previous.correctionOfId ?? input.entryId,
        correctionId: previous.id,
        amount: new Prisma.Decimal(String(evidence.correctedAmount ?? input.correctedAmount)).toFixed(2),
        previousAmount: new Prisma.Decimal(String(evidence.previousAmount ?? input.expectedAmount)).toFixed(2),
        change: previous.amount.toFixed(2),
        recordedAt: previous.createdAt.toISOString(),
      };
    }
    const entry = await tx.inventoryInvestmentEntry.findFirstOrThrow({
      where: { id: input.entryId, ownerId: auth.workspaceId, kind: { in: ["Opening", "Purchase"] } },
      include: { corrections: true },
    });
    const current = entry.corrections.reduce((sum, r) => sum.plus(r.amount), entry.amount);
    if (!current.equals(input.expectedAmount))
      throw new CommerceError("Investment changed. Close and reopen this dialog to load the latest saved amount.");
    const amount = new Prisma.Decimal(input.correctedAmount).minus(current);
    if (amount.isZero()) return { status: "unchanged" as const, entryId: entry.id, amount: current.toFixed(2) };
    const result = await tx.inventoryInvestmentEntry.create({
      data: {
        ownerId: auth.workspaceId,
        kind: "Correction",
        amount,
        correctionOfId: entry.id,
        actorUserId: auth.principal.user.id,
        idempotencyKey: input.submissionKey,
        submissionHash: hash,
        notes: input.reason,
        evidence: { previousAmount: current.toString(), correctedAmount: input.correctedAmount },
      },
    });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: auth.workspaceId,
        actorUserId: auth.principal.user.id,
        membershipId: auth.membership.id,
        action: "inventory.investment.correct",
        targetType: "InventoryInvestmentEntry",
        targetId: result.id,
        metadata: { reason: input.reason, amount: amount.toString() },
      },
      tx,
    );
    return {
      status: "saved" as const,
      entryId: entry.id,
      correctionId: result.id,
      amount: new Prisma.Decimal(input.correctedAmount).toFixed(2),
      previousAmount: current.toFixed(2),
      change: amount.toFixed(2),
      recordedAt: result.createdAt.toISOString(),
    };
  });
  if (outcome.status === "saved")
    revalidateWorkspacePath(auth.membership.workspaceSlug, "/dashboard/commerce-analytics");
  return outcome;
}

const shippingSchema = z
  .object({
    orderId: z.string().min(1),
    shipmentId: z.string().optional(),
    kind: z.enum(["Outbound", "ReturnLabel", "CarrierCredit"]),
    amount: amountSchema.refine((v) => v > 0),
    reference: z.string().trim().max(200),
    notes: z.string().trim().min(1).max(1000),
    incurredDate: z.iso.date(),
    submissionKey: submissionKeySchema,
    confirmed: z.boolean().refine((value) => value, "Confirm the carrier charge or credit actually occurred."),
  })
  .strict();
export async function recordShippingExpenseAction(raw: z.infer<typeof shippingSchema>) {
  const auth = await getPermittedDashboardAuthorization("orders.payments.manage");
  if (!auth) throw new Error("You cannot record shipping expenses.");
  const input = parseCommerceInput(shippingSchema, raw);
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const expense = await commerceTransaction(async (tx) => {
    await lockOrder(tx, auth.workspaceId, input.orderId);
    const previous = await tx.orderShippingExpense.findUnique({
      where: { ownerId_idempotencyKey: { ownerId: auth.workspaceId, idempotencyKey: input.submissionKey } },
    });
    if (previous) {
      if (previous.submissionHash !== hash) throw new CommerceError("Submission key already used.");
      return previous;
    }
    if (
      input.shipmentId &&
      !(await tx.orderShipment.findFirst({ where: { id: input.shipmentId, orderId: input.orderId } }))
    )
      throw new CommerceError("Shipment does not belong to this order.");
    const amount = input.kind === "CarrierCredit" ? -input.amount : input.amount;
    const entry = await tx.orderShippingExpense.create({
      data: {
        ownerId: auth.workspaceId,
        orderId: input.orderId,
        shipmentId: input.shipmentId || null,
        kind: input.kind,
        amount,
        reference: input.reference || null,
        notes: input.notes,
        incurredAt: new Date(`${input.incurredDate}T12:00:00Z`),
        actorUserId: auth.principal.user.id,
        idempotencyKey: input.submissionKey,
        submissionHash: hash,
      },
    });
    await recordAuthorizationAuditEvent(
      {
        workspaceId: auth.workspaceId,
        actorUserId: auth.principal.user.id,
        membershipId: auth.membership.id,
        action: "order.shipping.expense",
        targetType: "OrderShippingExpense",
        targetId: entry.id,
        metadata: { amount, kind: input.kind },
      },
      tx,
    );
    return entry;
  });
  for (const path of ["/dashboard/commerce-analytics", `/dashboard/orders/${input.orderId}/edit`])
    revalidateWorkspacePath(auth.membership.workspaceSlug, path);
  return { id: expense.id };
}
