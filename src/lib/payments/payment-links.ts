import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { prisma } from "@/lib/prisma";

import {
  createPaymentLinkToken,
  createPaymentLinkUrl,
  decryptPaymentLinkToken,
  encryptPaymentLinkToken,
  hashPaymentLinkToken,
} from "./payment-link-token";

export function recoverInvoicePaymentLinkUrl(tokenCipher?: string | null) {
  if (!tokenCipher) return null;
  try {
    return createPaymentLinkUrl(decryptPaymentLinkToken(tokenCipher));
  } catch (error) {
    console.error("Stored payment link could not be decrypted.", error);
    return null;
  }
}

export async function createInvoicePaymentLink(input: {
  workspaceId: string;
  invoiceId: string;
  expiresAt?: Date | null;
  audit?: { actorUserId: string; membershipId: string };
}) {
  const token = createPaymentLinkToken();
  const tokenHash = hashPaymentLinkToken(token);
  const tokenCipher = encryptPaymentLinkToken(token);

  const link = await prisma.$transaction(async (transaction) => {
    const invoice = await transaction.invoice.findUnique({
      where: { id_ownerId: { id: input.invoiceId, ownerId: input.workspaceId } },
      select: { id: true },
    });
    if (!invoice) throw new Error("Invoice could not be found.");

    await transaction.invoicePaymentLink.updateMany({
      where: { invoiceId: invoice.id, ownerId: input.workspaceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const createdLink = await transaction.invoicePaymentLink.create({
      data: {
        ownerId: input.workspaceId,
        invoiceId: invoice.id,
        tokenCipher,
        tokenHash,
        expiresAt: input.expiresAt ?? null,
      },
      select: { id: true, invoiceId: true, expiresAt: true, createdAt: true, tokenCipher: true },
    });

    if (input.audit) {
      await recordAuthorizationAuditEvent(
        {
          workspaceId: input.workspaceId,
          actorUserId: input.audit.actorUserId,
          membershipId: input.audit.membershipId,
          action: "invoice.payment_link.create",
          targetType: "InvoicePaymentLink",
          targetId: createdLink.id,
          metadata: { invoiceId: createdLink.invoiceId },
        },
        transaction,
      );
    }

    return createdLink;
  });

  return { ...link, token };
}

export async function getOrCreateInvoicePaymentLink(input: Parameters<typeof createInvoicePaymentLink>[0]) {
  const activeLink = await prisma.invoicePaymentLink.findFirst({
    where: {
      invoiceId: input.invoiceId,
      ownerId: input.workspaceId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
  if (activeLink?.tokenCipher) {
    try {
      const token = decryptPaymentLinkToken(activeLink.tokenCipher);
      return { ...activeLink, token };
    } catch (error) {
      console.error("Active payment link could not be decrypted and will be replaced.", error);
    }
  }
  return createInvoicePaymentLink(input);
}

export async function resolveInvoicePaymentLink(token: string, accessedAt = new Date()) {
  if (!token || token.length > 256) return null;

  const tokenHash = hashPaymentLinkToken(token);
  return prisma.$transaction(async (transaction) => {
    const link = await transaction.invoicePaymentLink.findUnique({
      where: { tokenHash },
      include: {
        invoice: {
          include: {
            job: {
              select: {
                jobType: true,
                laborItems: true,
                payments: {
                  where: { status: { in: ["succeeded", "partially_refunded"] } },
                  orderBy: [{ paidOn: "asc" }, { createdAt: "asc" }],
                },
              },
            },
            owner: {
              select: {
                companyAddress: true,
                name: true,
                companyEmail: true,
                companyPhone: true,
                invoiceDueDays: true,
                invoiceMessageAlign: true,
                invoiceMessageEnabled: true,
                invoiceMessageText: true,
                status: true,
                legacyOwner: { select: { email: true } },
                paymentProviderConnections: {
                  where: { provider: "stripe" },
                  select: { accountType: true, chargesEnabled: true, externalAccountId: true, status: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!link || link.revokedAt || (link.expiresAt && link.expiresAt <= accessedAt)) return null;
    if (link.invoice.owner.status !== "Active") return null;

    await transaction.invoicePaymentLink.update({
      where: { id: link.id },
      data: { lastAccessedAt: accessedAt, accessCount: { increment: 1 } },
    });

    return link;
  });
}

export async function revokeInvoicePaymentLink(input: {
  workspaceId: string;
  invoiceId: string;
  linkId: string;
  audit?: { actorUserId: string; membershipId: string };
}) {
  return prisma.$transaction(async (transaction) => {
    const result = await transaction.invoicePaymentLink.updateMany({
      where: {
        invoiceId: input.invoiceId,
        ownerId: input.workspaceId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (!result.count) return false;

    if (input.audit) {
      await recordAuthorizationAuditEvent(
        {
          workspaceId: input.workspaceId,
          actorUserId: input.audit.actorUserId,
          membershipId: input.audit.membershipId,
          action: "invoice.payment_link.revoke",
          targetType: "InvoicePaymentLink",
          targetId: input.linkId,
          metadata: { invoiceId: input.invoiceId },
        },
        transaction,
      );
    }
    return true;
  });
}
