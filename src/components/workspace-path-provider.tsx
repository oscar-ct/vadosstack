"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter as useNextRouter } from "next/navigation";

import { scopeWorkspacePath } from "@/lib/workspace-path";

const WorkspaceSlugContext = React.createContext<string | null>(null);
const WorkspaceNavigationFeedbackContext = React.createContext<(href: string) => void>(() => undefined);

export function WorkspaceNavigationFeedbackProvider({
  children,
  onNavigate,
}: Readonly<{ children: React.ReactNode; onNavigate: (href: string) => void }>) {
  return (
    <WorkspaceNavigationFeedbackContext.Provider value={onNavigate}>
      {children}
    </WorkspaceNavigationFeedbackContext.Provider>
  );
}

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
  const startNavigation = React.useContext(WorkspaceNavigationFeedbackContext);

  return React.useMemo(
    () => ({
      ...router,
      push: (href, options) => {
        const destination = workspacePath(href);
        startNavigation(destination);
        router.push(destination, options);
      },
      replace: (href, options) => {
        const destination = workspacePath(href);
        startNavigation(destination);
        router.replace(destination, options);
      },
      prefetch: (href, options) => router.prefetch(workspacePath(href), options),
    }),
    [router, workspacePath, startNavigation],
  );
}

export function WorkspaceLink({ href, onNavigate, ...props }: React.ComponentProps<typeof Link>) {
  const workspacePath = useWorkspacePath();
  const startNavigation = React.useContext(WorkspaceNavigationFeedbackContext);
  const resolvedHref = typeof href === "string" ? workspacePath(href) : href;

  return (
    <Link
      {...props}
      href={resolvedHref}
      onNavigate={(event) => {
        let prevented = false;
        onNavigate?.({
          preventDefault: () => {
            prevented = true;
            event.preventDefault();
          },
        });
        if (prevented || (props.target && props.target !== "_self")) return;
        const destination = typeof resolvedHref === "string" ? resolvedHref : resolvedHref.pathname;
        if (destination) startNavigation(destination);
      }}
    />
  );
}
