import { prisma } from "@/lib/prisma";

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

export async function cleanupAuthRecords() {
  const now = new Date();
  const rateLimitCutoff = new Date(Date.now() - ONE_DAY_IN_MS);

  const [sessions, passwordResetTokens, pendingAccountConfirmations, rateLimitAttempts] = await Promise.all([
    prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          {
            expiresAt: {
              lt: now,
            },
          },
          {
            usedAt: {
              not: null,
            },
          },
        ],
      },
    }),
    prisma.pendingAccountConfirmation.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    }),
    prisma.rateLimitAttempt.deleteMany({
      where: {
        createdAt: {
          lt: rateLimitCutoff,
        },
      },
    }),
  ]);

  return {
    passwordResetTokens: passwordResetTokens.count,
    pendingAccountConfirmations: pendingAccountConfirmations.count,
    rateLimitAttempts: rateLimitAttempts.count,
    sessions: sessions.count,
  };
}
