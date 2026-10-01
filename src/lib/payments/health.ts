import { PAYMENT_WEBHOOK_PROCESSING_LEASE_MS } from "@/lib/payments/webhook-events";
import { prisma } from "@/lib/prisma";

const CLOSED_DISPUTE_STATUSES = ["lost", "won", "warning_closed", "prevented"];

export async function getWorkspacePaymentHealth(workspaceId: string) {
  const staleBefore = new Date(Date.now() - PAYMENT_WEBHOOK_PROCESSING_LEASE_MS);
  const [failedWebhooks, stuckWebhooks, failedRefunds, openDisputes, lastProcessedWebhook, webhookIssues] =
    await Promise.all([
      prisma.paymentWebhookEvent.count({ where: { ownerId: workspaceId, provider: "stripe", status: "failed" } }),
      prisma.paymentWebhookEvent.count({
        where: {
          ownerId: workspaceId,
          provider: "stripe",
          status: "processing",
          processingStartedAt: { lt: staleBefore },
        },
      }),
      prisma.paymentRefund.count({ where: { ownerId: workspaceId, provider: "stripe", status: "failed" } }),
      prisma.paymentDispute.count({
        where: { ownerId: workspaceId, provider: "stripe", status: { notIn: CLOSED_DISPUTE_STATUSES } },
      }),
      prisma.paymentWebhookEvent.findFirst({
        where: { ownerId: workspaceId, provider: "stripe", status: "processed" },
        orderBy: { processedAt: "desc" },
        select: { processedAt: true },
      }),
      prisma.paymentWebhookEvent.findMany({
        where: {
          ownerId: workspaceId,
          provider: "stripe",
          OR: [{ status: "failed" }, { status: "processing", processingStartedAt: { lt: staleBefore } }],
        },
        orderBy: { updatedAt: "desc" },
        select: {
          attemptCount: true,
          eventType: true,
          id: true,
          lastError: true,
          nextAttemptAt: true,
          receivedAt: true,
          status: true,
        },
        take: 5,
      }),
    ]);
  const issueCount = failedWebhooks + stuckWebhooks + failedRefunds + openDisputes;
  return {
    failedRefunds,
    failedWebhooks,
    healthy: issueCount === 0,
    issueCount,
    lastProcessedAt: lastProcessedWebhook?.processedAt ?? null,
    openDisputes,
    stuckWebhooks,
    webhookIssues,
  };
}
