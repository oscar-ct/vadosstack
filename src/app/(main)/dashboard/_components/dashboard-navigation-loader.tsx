"use client";

import * as React from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type DashboardNavigationLoaderContextValue = {
  isNavigating: boolean;
  startNavigation: (url: string, isNewTab?: boolean) => void;
};

const DashboardNavigationLoaderContext = React.createContext<DashboardNavigationLoaderContextValue>({
  isNavigating: false,
  startNavigation: () => undefined,
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
        if (event.defaultPrevented || !href.startsWith("/dashboard")) return;

        const opensNewTab =
          target === "_blank" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        const destinationPath = href.split(/[?#]/, 1)[0] ?? href;
        startNavigation(destinationPath, opensNewTab);
      }}
    />
  );
}

export function DashboardNavigationLoaderProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const previousPathRef = React.useRef(pathname);

  React.useEffect(() => {
    if (previousPathRef.current !== pathname) {
      previousPathRef.current = pathname;
      setIsNavigating(false);
    }
  }, [pathname]);

  React.useEffect(() => {
    if (!isNavigating) return;

    const timeout = window.setTimeout(() => setIsNavigating(false), 6000);

    return () => window.clearTimeout(timeout);
  }, [isNavigating]);

  const startNavigation = React.useCallback(
    (url: string, isNewTab?: boolean) => {
      if (isNewTab || url === pathname) return;

      setIsNavigating(true);
    },
    [pathname],
  );

  const contextValue = React.useMemo(() => ({ isNavigating, startNavigation }), [isNavigating, startNavigation]);

  return (
    <DashboardNavigationLoaderContext.Provider value={contextValue}>
      {children}
    </DashboardNavigationLoaderContext.Provider>
  );
}

export function DashboardNavigationContent({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  const { isNavigating } = useDashboardNavigationLoader();

  return (
    <div className={cn("relative h-full p-4 md:p-6 print:p-0", className)}>
      {children}
      {isNavigating ? <DashboardNavigationLoader /> : null}
    </div>
  );
}

function DashboardNavigationLoader() {
  return (
    <div
      className="absolute inset-0 z-40 cursor-wait overflow-hidden bg-background/20 backdrop-blur-[2px] print:hidden"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-border/50">
        <div className="h-full w-1/2 animate-pulse rounded-r-full bg-primary shadow-[0_0_16px_hsl(var(--primary)/0.35)]" />
      </div>
      <div className="absolute inset-x-0 top-[calc(50svh-3rem)] flex -translate-y-1/2 justify-center px-4">
        <div className="flex min-w-36 flex-col items-center rounded-2xl border bg-background/95 px-5 py-4 text-center text-sm shadow-xl ring-1 ring-foreground/5">
          <span className="relative flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Image
              src="/apple-icon.png"
              alt=""
              width={28}
              height={28}
              className="relative z-10 size-7 animate-pulse object-contain"
            />
            <span className="pointer-events-none absolute size-full animate-ping rounded-full bg-primary/15" />
          </span>
          <span className="mt-2 font-medium">Loading page...</span>
        </div>
      </div>
    </div>
  );
}
