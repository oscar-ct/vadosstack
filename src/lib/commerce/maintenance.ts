import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { escapeHtml } from "@/lib/email-content";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";

import { getOrderBalance } from "./ledger";
import { adjustStock, commerceTransaction, lockOrder } from "./transaction";
import { randomUUID } from "node:crypto";

export async function expireUnpaidOrderHolds(limit = 50, deadline = Date.now() + 20000) {
  const due = await prisma.order.findMany({
    where: { orderStatus: "Active", reservationExpiresAt: { lte: new Date() } },
    select: { id: true, ownerId: true },
    orderBy: { reservationExpiresAt: "asc" },
    take: limit,
  });
  let expired = 0;
  for (const candidate of due) {
    if (Date.now() >= deadline) break;
    const didExpire = await commerceTransaction(async (tx) => {
      await lockOrder(tx, candidate.ownerId, candidate.id);
      const balance = await getOrderBalance(tx, candidate.ownerId, candidate.id);
      if (
        balance.order.orderStatus !== "Active" ||
        !balance.order.reservationExpiresAt ||
        balance.order.reservationExpiresAt > new Date() ||
        balance.paid > 0
      )
        return false;
      const items = await tx.orderItem.findMany({ where: { orderId: candidate.id, ownerId: candidate.ownerId } });
      if (
        items.some((item) => item.shippedQuantity > 0) ||
        (await tx.orderReturn.count({ where: { orderId: candidate.id } }))
      )
        return false;
      for (const item of items)
        if (item.inventoryItemId)
          await adjustStock(tx, {
            ownerId: candidate.ownerId,
            inventoryItemId: item.inventoryItemId,
            quantityChange: item.quantity,
            reason: "Unpaid hold expired",
            orderId: candidate.id,
            orderItemId: item.id,
          });
      await tx.order.update({
        where: { id: candidate.id },
        data: {
          orderStatus: "Cancelled",
          cancelledAt: new Date(),
          reservationExpiresAt: null,
          version: { increment: 1 },
        },
      });
      await recordAuthorizationAuditEvent(
        { workspaceId: candidate.ownerId, action: "order.hold.expire", targetType: "Order", targetId: candidate.id },
        tx,
      );
      return true;
    });
    if (didExpire) expired++;
  }
  return { scanned: due.length, expired };
}

export async function deliverInventoryStockAlerts(limit = 50, deadline = Date.now() + 20000, ownerId?: string) {
  // Email delivery is opt-in per workspace. Provider retries use a stable episode key.
  const settings = await prisma.inventorySettings.findMany({
    where: { autoRestockAlerts: true, restockAlertEmail: { not: null }, ...(ownerId ? { ownerId } : {}) },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });
  let sent = 0;
  let failed = 0;
  for (const setting of settings) {
    if (!setting.restockAlertEmail || sent + failed >= limit || Date.now() >= deadline) break;
    await prisma.$executeRaw`
      UPDATE inventory_stock_alerts a SET status = 'resolved', "claimedAt" = NULL, "updatedAt" = NOW()
      FROM inventory_items i WHERE a."inventoryItemId" = i.id AND a.status = 'open' AND i."ownerId" = ${setting.ownerId}
        AND (i."itemStatus" <> 'Active' OR i.stock > GREATEST(i."reorderPoint", ${setting.lowStockThreshold}))
    `;
    const items = await prisma.inventoryItem.findMany({
      where: {
        ownerId: setting.ownerId,
        itemStatus: "Active",
        OR: [
          { stock: { lte: setting.lowStockThreshold } },
          { stock: { lte: prisma.inventoryItem.fields.reorderPoint } },
        ],
        AND: [
          { OR: [{ stockAlert: null }, { stockAlert: { status: "resolved" } }, { stockAlert: { deliveredAt: null } }] },
        ],
      },
      orderBy: { id: "asc" },
      take: Math.max(limit - sent - failed, 1),
    });
    for (const item of items) {
      if (Date.now() >= deadline) break;
      const threshold = Math.max(item.reorderPoint, setting.lowStockThreshold);
      const low = item.itemStatus === "Active" && item.stock <= threshold;
      const existing = await prisma.inventoryStockAlert.findUnique({ where: { inventoryItemId: item.id } });
      if (!low) {
        if (existing?.status === "open")
          await prisma.inventoryStockAlert.updateMany({
            where: { id: existing.id, episodeKey: existing.episodeKey },
            data: { status: "resolved", claimedAt: null },
          });
        continue;
      }
      if (!process.env.RESEND_API_KEY || !process.env.COMMERCE_ALERT_FROM) {
        failed++;
        continue;
      }
      const alert = await commerceTransaction(async (tx) => {
        const current = await tx.inventoryStockAlert.findUnique({ where: { inventoryItemId: item.id } });
        if (current?.status === "open") return current;
        const data = {
          episodeKey: randomUUID(),
          status: "open",
          deliveredAt: null,
          claimedAt: null,
          lastError: null,
          attemptCount: 0,
        };
        return tx.inventoryStockAlert.upsert({
          where: { inventoryItemId: item.id },
          update: data,
          create: { ...data, inventoryItemId: item.id },
        });
      });
      if (alert.deliveredAt) continue;
      const claim = await prisma.inventoryStockAlert.updateMany({
        where: {
          id: alert.id,
          episodeKey: alert.episodeKey,
          deliveredAt: null,
          OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(Date.now() - 10 * 60000) } }],
        },
        data: { claimedAt: new Date(), attemptCount: { increment: 1 } },
      });
      if (!claim.count) continue;
      try {
        const result = await resend.emails.send(
          {
            from: process.env.COMMERCE_ALERT_FROM,
            to: setting.restockAlertEmail,
            subject: `Low stock: ${item.product}`,
            html: `<p>${escapeHtml(item.product)} (${escapeHtml(item.sku ?? "no SKU")}) has ${item.stock} available units. Its alert threshold is ${threshold}.</p><p>Review inventory in VadosStack to receive stock or update its reorder point.</p>`,
          },
          { idempotencyKey: `inventory:${alert.episodeKey}` },
        );
        if (result.error) throw new Error(result.error.message);
        await prisma.inventoryStockAlert.updateMany({
          where: { id: alert.id, episodeKey: alert.episodeKey },
          data: { deliveredAt: new Date(), claimedAt: null, lastError: null },
        });
        sent++;
      } catch (error) {
        await prisma.inventoryStockAlert.updateMany({
          where: { id: alert.id, episodeKey: alert.episodeKey },
          data: { claimedAt: null, lastError: error instanceof Error ? error.message : "Email delivery failed." },
        });
        failed++;
      }
    }
    await prisma.inventorySettings.update({ where: { id: setting.id }, data: { updatedAt: new Date() } });
  }
  return { sent, failed };
}
