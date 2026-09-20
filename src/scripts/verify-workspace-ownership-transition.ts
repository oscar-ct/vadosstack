import { prisma } from "../lib/prisma";
import { randomUUID } from "node:crypto";

const ROLLBACK_PROBE = Symbol("rollback-workspace-ownership-probe");

async function main() {
  const probeId = randomUUID();
  const userId = `ownership-probe-user-${probeId}`;
  const workspaceId = `ownership-probe-workspace-${probeId}`;
  const workspaceSlug = `ownership-probe-${probeId}`;
  const email = `ownership-probe-${probeId}@example.invalid`;

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.user.create({
        data: {
          id: userId,
          companyName: "Workspace ownership verification",
          email,
          passwordHash: "not-a-login-credential",
        },
      });

      await transaction.workspace.create({
        data: {
          id: workspaceId,
          slug: workspaceSlug,
          name: "Workspace ownership verification",
          estimateMessageText: "Verification only",
          invoiceMessageText: "Verification only",
          orderMessageText: "Verification only",
          legacyOwnerId: userId,
        },
      });

      await transaction.customer.create({
        data: {
          ownerId: workspaceId,
          name: "Workspace-owned verification customer",
        },
      });

      await transaction.googleMailAccount.create({
        data: {
          workspaceId,
          googleSubject: `ownership-probe-${probeId}`,
          email,
          refreshTokenCipher: "verification-only",
          scopes: "verification-only",
        },
      });

      await transaction.user.delete({ where: { id: userId } });

      const [workspace, customerCount, googleMailAccountCount] = await Promise.all([
        transaction.workspace.findUnique({
          where: { id: workspaceId },
          select: { id: true, legacyOwnerId: true },
        }),
        transaction.customer.count({ where: { ownerId: workspaceId } }),
        transaction.googleMailAccount.count({ where: { workspaceId } }),
      ]);

      if (!workspace || workspace.legacyOwnerId !== null) {
        throw new Error("Deleting the legacy user did not preserve and detach the workspace.");
      }
      if (customerCount !== 1) {
        throw new Error("Workspace-owned business data did not survive legacy user deletion.");
      }
      if (googleMailAccountCount !== 1) {
        throw new Error("The workspace Gmail connection did not survive legacy user deletion.");
      }

      throw ROLLBACK_PROBE;
    });
  } catch (error) {
    if (error !== ROLLBACK_PROBE) {
      throw error;
    }
  }

  const [userCount, workspaceCount, customerCount, googleMailAccountCount] = await Promise.all([
    prisma.user.count({ where: { id: userId } }),
    prisma.workspace.count({ where: { id: workspaceId } }),
    prisma.customer.count({ where: { ownerId: workspaceId } }),
    prisma.googleMailAccount.count({ where: { workspaceId } }),
  ]);

  const report = {
    distinctUserAndWorkspaceIds: userId !== workspaceId,
    workspaceSurvivedLegacyUserDeletionInsideTransaction: true,
    workspaceDataSurvivedLegacyUserDeletionInsideTransaction: true,
    gmailConnectionSurvivedLegacyUserDeletionInsideTransaction: true,
    rollbackLeftNoProbeRows:
      userCount === 0 && workspaceCount === 0 && customerCount === 0 && googleMailAccountCount === 0,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!report.rollbackLeftNoProbeRows) {
    throw new Error("Workspace ownership verification did not roll back cleanly.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
