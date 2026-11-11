"use client";

import * as React from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { WorkspaceNavigationFeedbackProvider } from "@/components/workspace-path-provider";
import { cn } from "@/lib/utils";
import { getDashboardNavigationPath, getLegacyDashboardPath } from "@/lib/workspace-path";

type DashboardNavigationLoaderContextValue = {
  isNavigating: boolean;
  startNavigation: (url: string, isNewTab?: boolean) => void;
  startWorkspaceNavigation: (url: string, workspaceName: string, isNewTab?: boolean) => void;
};

const DashboardNavigationLoaderContext = React.createContext<DashboardNavigationLoaderContextValue>({
  isNavigating: false,
  startNavigation: () => undefined,
  startWorkspaceNavigation: () => undefined,
});

export function useDashboardNavigationLoader() {
  return React.useContext(DashboardNavigationLoaderContext);
}

type DashboardNavigationLinkProps = Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: string;
};

export function DashboardNavigationLink({ href, onClick, target, ...props }: DashboardNavigationLinkProps) {
  const { startNavigation } = useDashboardNavigationLoader();

  return (
    <Link
      {...props}
      href={href}
      target={target}
      onClick={(event) => {
        onClick?.(event);
        const destinationPath = href.split(/[?#]/, 1)[0] ?? href;
        if (event.defaultPrevented || !getLegacyDashboardPath(destinationPath).startsWith("/dashboard")) return;

        const opensNewTab =
          target === "_blank" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        startNavigation(destinationPath, opensNewTab);
      }}
    />
  );
}

export function DashboardNavigationLoaderProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [workspaceTransition, setWorkspaceTransition] = React.useState<{ name: string; url: string } | null>(null);
  const previousPathRef = React.useRef(pathname);

  React.useEffect(() => {
    if (previousPathRef.current !== pathname) {
      previousPathRef.current = pathname;
      setIsNavigating(false);
      setWorkspaceTransition(null);
    }
  }, [pathname]);

  React.useEffect(() => {
    if (!isNavigating && !workspaceTransition) return;

    const timeout = window.setTimeout(() => {
      setIsNavigating(false);
      setWorkspaceTransition(null);
    }, 10000);

    return () => window.clearTimeout(timeout);
  }, [isNavigating, workspaceTransition]);

  const startNavigation = React.useCallback((url: string, isNewTab?: boolean) => {
    if (isNewTab || !getDashboardNavigationPath(url, window.location.href)) return;

    setIsNavigating(true);
  }, []);

  const startWorkspaceNavigation = React.useCallback(
    (url: string, workspaceName: string, isNewTab?: boolean) => {
      if (isNewTab || url === pathname) return;

      setIsNavigating(false);
      setWorkspaceTransition({ name: workspaceName, url });
    },
    [pathname],
  );

  const contextValue = React.useMemo(
    () => ({ isNavigating, startNavigation, startWorkspaceNavigation }),
    [isNavigating, startNavigation, startWorkspaceNavigation],
  );

  return (
    <DashboardNavigationLoaderContext.Provider value={contextValue}>
      <WorkspaceNavigationFeedbackProvider onNavigate={startNavigation}>{children}</WorkspaceNavigationFeedbackProvider>
      {workspaceTransition ? <WorkspaceTransitionLoader workspaceName={workspaceTransition.name} /> : null}
    </DashboardNavigationLoaderContext.Provider>
  );
}

export function DashboardNavigationContent({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  const { isNavigating } = useDashboardNavigationLoader();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const dashboardPath = getLegacyDashboardPath(usePathname());
  const isOverviewPage = dashboardPath === "/dashboard/overview" || dashboardPath === "/dashboard/overview-v2";

  return (
    <div
      ref={contentRef}
      className={cn(
        "relative h-full p-0 md:p-6 print:bg-transparent print:p-0",
        isOverviewPage
          ? "bg-[#17181d] md:bg-transparent"
          : "bg-background max-md:[&>*:not([data-slot=card]):not(:has(>[data-slot=card]))]:p-4 max-md:[&>*>[data-slot=card]]:rounded-none max-md:[&>*>[data-slot=card]]:shadow-none max-md:[&>*>[data-slot=card]]:ring-0 max-md:[&>[data-slot=card]]:rounded-none max-md:[&>[data-slot=card]]:shadow-none max-md:[&>[data-slot=card]]:ring-0",
        className,
      )}
    >
      {children}
      <DashboardNavigationLoader contentRef={contentRef} active={isNavigating} />
    </div>
  );
}

function useContentBounds(contentRef: React.RefObject<HTMLDivElement | null>) {
  const [bounds, setBounds] = React.useState<{ left: number; right: number; top: number } | null>(null);

  React.useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const header = content.previousElementSibling;
    const measure = () => {
      const rect = content.getBoundingClientRect();
      const next = {
        left: Math.max(0, rect.left),
        right: Math.max(0, window.innerWidth - rect.right),
        top: Math.min(window.innerHeight, Math.max(0, header?.getBoundingClientRect().bottom ?? rect.top)),
      };
      setBounds((previous) =>
        previous?.left === next.left && previous.right === next.right && previous.top === next.top ? previous : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    if (header) observer.observe(header);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { capture: true, passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [contentRef]);

  return bounds;
}

function DashboardNavigationLoader({
  contentRef,
  active,
}: {
  contentRef: React.RefObject<HTMLDivElement | null>;
  active: boolean;
}) {
  const bounds = useContentBounds(contentRef);
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {active && bounds ? (
        <motion.div
          key="motion-navigation"
          className="fixed bottom-0 z-40 cursor-wait overflow-hidden print:hidden"
          style={bounds}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.14 }}
          role="status"
          aria-live="polite"
          aria-label="Loading page"
        >
          <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-border/40" aria-hidden="true">
            <motion.div
              className="h-full w-2/5 rounded-full bg-primary"
              initial={{ x: "-100%" }}
              animate={{ x: reduceMotion ? "75%" : ["-100%", "250%"] }}
              transition={reduceMotion ? { duration: 0 } : { duration: 2, ease: "easeInOut", repeat: Infinity }}
            />
          </div>
          <motion.div
            className="absolute inset-0 grid place-items-center bg-background/10 px-4 backdrop-blur-[1.5px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.16 }}
          >
            <motion.div
              className="flex size-28 flex-col items-center justify-center gap-3 rounded-[28px] border border-white/10 bg-black/75 text-sm text-white shadow-xl backdrop-blur-md sm:size-32 sm:rounded-[32px]"
              initial={{ y: reduceMotion ? 0 : 4 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <motion.span
                aria-hidden="true"
                className="size-8 rounded-full border-[3px] border-white/25 border-t-white"
                animate={{ rotate: reduceMotion ? 0 : 360 }}
                transition={{ duration: 0.8, ease: "linear", repeat: reduceMotion ? 0 : Infinity }}
              />
              Loading…
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function WorkspaceTransitionLoader({ workspaceName }: Readonly<{ workspaceName: string }>) {
  return (
    <div
      className="fixed inset-0 z-[100] grid cursor-wait place-items-center bg-white px-6 text-neutral-950 print:hidden"
      role="status"
      aria-live="polite"
      aria-label={`Switching to ${workspaceName}`}
    >
      <div className="flex w-full max-w-xs flex-col items-center text-center">
        <Image
          src="/apple-icon.png"
          alt="VadosStack"
          width={120}
          height={120}
          priority
          className="size-24 object-contain"
        />
        <p className="text-2xl tracking-tight">VadosStack Workspace</p>
        <p className="mt-1 max-w-96 truncate text-neutral-500">Switching to {workspaceName}…</p>
        <div className="mt-5 h-px w-48 overflow-hidden bg-neutral-200" aria-hidden="true">
          <div className="workspace-loading-bar h-full w-2/5 bg-neutral-950" />
        </div>
      </div>
    </div>
  );
}
