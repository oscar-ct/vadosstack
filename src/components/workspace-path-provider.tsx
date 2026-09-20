"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter as useNextRouter } from "next/navigation";

import { scopeWorkspacePath } from "@/lib/workspace-path";

const WorkspaceSlugContext = React.createContext<string | null>(null);

export function WorkspacePathProvider({
  children,
  workspaceSlug,
}: Readonly<{ children: React.ReactNode; workspaceSlug: string }>) {
  return <WorkspaceSlugContext.Provider value={workspaceSlug}>{children}</WorkspaceSlugContext.Provider>;
}

export function useWorkspacePath() {
  const workspaceSlug = React.useContext(WorkspaceSlugContext);

  return React.useCallback(
    (href: string) => (workspaceSlug ? scopeWorkspacePath(workspaceSlug, href) : href),
    [workspaceSlug],
  );
}

export function useWorkspaceRouter(): ReturnType<typeof useNextRouter> {
  const router = useNextRouter();
  const workspacePath = useWorkspacePath();

  return React.useMemo(
    () => ({
      ...router,
      push: (href, options) => router.push(workspacePath(href), options),
      replace: (href, options) => router.replace(workspacePath(href), options),
      prefetch: (href, options) => router.prefetch(workspacePath(href), options),
    }),
    [router, workspacePath],
  );
}

export function WorkspaceLink({ href, ...props }: React.ComponentProps<typeof Link>) {
  const workspacePath = useWorkspacePath();
  const resolvedHref = typeof href === "string" ? workspacePath(href) : href;

  return <Link {...props} href={resolvedHref} />;
}
