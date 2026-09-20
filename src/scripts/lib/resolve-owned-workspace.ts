import { prisma } from "../../lib/prisma";

export async function resolveOwnedWorkspaceByEmail(email: string) {
  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      status: "Active",
      role: {
        systemKey: "OWNER",
      },
      user: {
        email,
      },
    },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    select: {
      workspace: {
        select: {
          id: true,
          orderMessageText: true,
        },
      },
    },
  });

  if (!membership) {
    throw new Error("No owned workspace matches SEED_OWNER_EMAIL.");
  }

  return membership.workspace;
}
