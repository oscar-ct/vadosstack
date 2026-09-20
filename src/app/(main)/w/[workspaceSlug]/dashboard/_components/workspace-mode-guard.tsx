"use client";

import * as React from "react";

import { usePathname } from "next/navigation";

import { useWorkspaceRouter as useRouter } from "@/components/workspace-path-provider";
import { getWorkspaceHomePath, isDashboardPathEnabled, type WorkspaceMode } from "@/lib/workspace-mode";
import { getLegacyDashboardPath, getWorkspaceDashboardPath } from "@/lib/workspace-path";

export function WorkspaceModeGuard({ mode, workspaceSlug }: { mode: WorkspaceMode; workspaceSlug: string }) {
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (isDashboardPathEnabled(getLegacyDashboardPath(pathname), mode)) return;

    router.replace(getWorkspaceDashboardPath(workspaceSlug, getWorkspaceHomePath(mode)));
  }, [mode, pathname, router, workspaceSlug]);

  return null;
}
