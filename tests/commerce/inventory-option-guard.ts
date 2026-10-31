import type { Prisma } from "@prisma/client";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// The caller owns the transaction and must roll it back: this helper creates only fixture records.
export async function verifyInventoryOptionGuard(tx: Prisma.TransactionClient) {
  const workspace = await tx.workspace.create({
    data: {
      name: "Option guard fixture",
      slug: `option-guard-${randomUUID()}`,
      estimateMessageText: "",
      invoiceMessageText: "",
      orderMessageText: "",
    },
  });
  const ownerId = workspace.id;
  const source = await tx.inventoryLocation.create({ data: { ownerId, name: "Warehoues A" } });
  const target = await tx.inventoryLocation.create({ data: { ownerId, name: "Warehouse A" } });
  const category = await tx.inventoryCategory.create({ data: { ownerId, name: "Accesories" } });
  const keptCategory = await tx.inventoryCategory.create({ data: { ownerId, name: "Accessories" } });
  const item = await tx.inventoryItem.create({
    data: {
      ownerId,
      product: "Guard fixture",
      stock: 5,
      cost: 1,
      unitPrice: 2,
      categoryId: category.id,
      locationId: source.id,
    },
  });
  const movement = await tx.inventoryStockMovement.create({
    data: { ownerId, inventoryItemId: item.id, quantityChange: 5, balanceAfter: 5, reason: "Opening fixture" },
  });
  async function denied(operation: () => Promise<unknown>, pattern: RegExp) {
    await tx.$executeRawUnsafe("SAVEPOINT option_guard_probe");
    let failure: unknown;
    try {
      await operation();
    } catch (error) {
      failure = error;
    }
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT option_guard_probe");
    await tx.$executeRawUnsafe("RELEASE SAVEPOINT option_guard_probe");
    assert(failure, "The database unexpectedly allowed a protected mutation");
    assert(failure instanceof Error);
    assert.match(failure.message, pattern);
  }
  await denied(
    () => tx.inventoryItem.update({ where: { id: item.id }, data: { locationId: target.id } }),
    /location is locked/,
  );
  await tx.inventoryCategory.update({ where: { id: category.id }, data: { name: "Corrected category" } });
  await tx.inventoryLocation.update({ where: { id: source.id }, data: { name: "Corrected source label" } });
  const approval = await tx.inventoryLocationMerge.create({
    data: {
      ownerId,
      sourceLocationId: source.id,
      targetLocationId: target.id,
      sourceName: "Corrected source label",
      targetName: target.name,
      actorUserId: "rollback-fixture-actor",
      reason: "Duplicate name for one physical location",
      itemIds: [item.id],
    },
  });
  const moved = await tx.inventoryItem.update({
    where: { id: item.id },
    data: { locationId: target.id, categoryId: keptCategory.id },
  });
  assert.equal(moved.stock, 5);
  assert.equal(moved.locationId, target.id);
  assert.equal(moved.productId, item.productId);
  const history = await tx.inventoryStockMovement.findUniqueOrThrow({ where: { id: movement.id } });
  assert.deepEqual(history.itemSnapshot, movement.itemSnapshot);
  assert.equal((history.itemSnapshot as Prisma.JsonObject).category, "Accesories");
  assert.equal((history.itemSnapshot as Prisma.JsonObject).location, "Warehoues A");
  await tx.inventoryCategory.delete({ where: { id: category.id } });
  await denied(
    () => tx.inventoryItem.update({ where: { id: item.id }, data: { locationId: source.id } }),
    /location is locked/,
  );
  await denied(
    () => tx.inventoryItem.update({ where: { id: item.id }, data: { product: "Different product" } }),
    /identity is locked/,
  );
  const unlisted = await tx.inventoryItem.create({
    data: { ownerId, product: "Unlisted fixture", stock: 1, locationId: source.id },
  });
  await denied(
    () => tx.inventoryItem.update({ where: { id: unlisted.id }, data: { locationId: target.id } }),
    /location is locked/,
  );
  await denied(
    () => tx.inventoryLocationMerge.update({ where: { id: approval.id }, data: { reason: "Rewrite evidence" } }),
    /immutable|append-only/i,
  );
  await denied(() => tx.inventoryLocationMerge.delete({ where: { id: approval.id } }), /immutable|append-only/i);
  const oldSource = await tx.inventoryLocation.create({ data: { ownerId, name: "Other source" } });
  const other = await tx.inventoryItem.create({
    data: { ownerId, product: "Stale approval fixture", stock: 2, locationId: oldSource.id },
  });
  await tx.inventoryLocationMerge.create({
    data: {
      ownerId,
      sourceLocationId: oldSource.id,
      targetLocationId: target.id,
      sourceName: oldSource.name,
      targetName: target.name,
      actorUserId: "rollback-fixture-actor",
      reason: "Stale transaction approval",
      itemIds: [other.id],
      transactionId: approval.transactionId - BigInt(1),
    },
  });
  await denied(
    () => tx.inventoryItem.update({ where: { id: other.id }, data: { locationId: target.id } }),
    /location is locked/,
  );
  const otherWorkspace = await tx.workspace.create({
    data: {
      name: "Other option guard fixture",
      slug: `option-guard-${randomUUID()}`,
      estimateMessageText: "",
      invoiceMessageText: "",
      orderMessageText: "",
    },
  });
  await tx.inventoryLocationMerge.create({
    data: {
      ownerId: otherWorkspace.id,
      sourceLocationId: source.id,
      targetLocationId: target.id,
      sourceName: source.name,
      targetName: target.name,
      actorUserId: "rollback-fixture-actor",
      reason: "Wrong workspace approval",
      itemIds: [unlisted.id],
    },
  });
  await denied(
    () => tx.inventoryItem.update({ where: { id: unlisted.id }, data: { locationId: target.id } }),
    /location is locked/,
  );
  return { checks: 12, workspaceId: workspace.id, otherWorkspaceId: otherWorkspace.id };
}
