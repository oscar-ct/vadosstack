import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type AuthorizationAuditInput = {
  workspaceId: string;
  actorUserId?: string | null;
  membershipId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonObject;
};

export async function recordAuthorizationAuditEvent(
  input: AuthorizationAuditInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return client.authorizationAuditEvent.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      membershipId: input.membershipId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
    },
  });
}
