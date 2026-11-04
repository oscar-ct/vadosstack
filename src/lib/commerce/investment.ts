import { Prisma } from "@prisma/client";

export async function recordInventoryPurchase(
  tx: Prisma.TransactionClient,
  input: {
    ownerId: string;
    inventoryItemId: string;
    stockMovementId: string;
    quantity: number;
    unitCost: number;
    actorUserId: string;
    idempotencyKey: string;
    submissionHash: string;
    notes?: string;
  },
) {
  // Workspaces created after the migration start with zero prior spending.
  const opening = await tx.inventoryInvestmentEntry.findFirst({ where: { ownerId: input.ownerId, kind: "Opening" } });
  if (!opening) {
    await tx.inventoryInvestmentEntry.create({
      data: {
        ownerId: input.ownerId,
        kind: "Opening",
        amount: 0,
        idempotencyKey: "opening:commerce-analytics",
        submissionHash: "new-workspace",
        actorUserId: input.actorUserId,
        evidence: { source: "New workspace purchase tracking" },
      },
    });
    await tx.inventorySettings.upsert({
      where: { ownerId: input.ownerId },
      create: { ownerId: input.ownerId, investmentTrackingStartedAt: new Date() },
      update: { investmentTrackingStartedAt: new Date() },
    });
  }
  const { unitCost, ...rest } = input;
  return tx.inventoryInvestmentEntry.create({
    data: { ...rest, unitCost, amount: new Prisma.Decimal(unitCost).times(input.quantity), kind: "Purchase" },
  });
}
