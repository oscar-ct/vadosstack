import { redirect } from "next/navigation";

import { getCurrentDashboardAuthorization } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getWorkspaceHomePath, parseWorkspaceMode } from "@/lib/workspace-mode";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";

export default async function Page() {
  const authorization = await getCurrentDashboardAuthorization();
  const workspace = authorization
    ? await prisma.workspace.findUnique({ where: { id: authorization.workspaceId }, select: { workspaceMode: true } })
    : null;

  const homePath = getWorkspaceHomePath(parseWorkspaceMode(workspace?.workspaceMode));
  redirect(authorization ? getWorkspaceDashboardPath(authorization.membership.workspaceSlug, homePath) : homePath);
}
