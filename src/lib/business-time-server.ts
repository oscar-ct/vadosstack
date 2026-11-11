import { cache } from "react";

import { DEFAULT_BUSINESS_TIME_ZONE } from "@/lib/business-time";
import { prisma } from "@/lib/prisma";

export const getWorkspaceTimeZone = cache(async (workspaceId: string) => {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { timeZone: true } });
  return workspace?.timeZone ?? DEFAULT_BUSINESS_TIME_ZONE;
});
