"use client";

import * as React from "react";

import { usePathname, useRouter } from "next/navigation";

import { getWorkspaceHomePath, isDashboardPathEnabled, type WorkspaceMode } from "@/lib/workspace-mode";

export function WorkspaceModeGuard({ mode }: { mode: WorkspaceMode }) {
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (isDashboardPathEnabled(pathname, mode)) return;

    router.replace(getWorkspaceHomePath(mode));
  }, [mode, pathname, router]);

  return null;
}
