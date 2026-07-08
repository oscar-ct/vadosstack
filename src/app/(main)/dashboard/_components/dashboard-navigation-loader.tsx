"use client";

import * as React from "react";

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
      <div className="absolute inset-x-0 top-[clamp(7rem,28svh,14rem)] flex justify-center px-4">
        <div className="flex items-center gap-3 rounded-full border bg-background/95 px-4 py-2.5 text-sm shadow-xl ring-1 ring-foreground/5">
          <span className="relative flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="absolute size-full animate-ping rounded-full bg-primary/15" />
            <span className="size-2 rounded-full bg-primary" />
          </span>
          <span className="font-medium">Loading page</span>
          <span className="flex items-end gap-1" aria-hidden="true">
            <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-200ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-100ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-primary" />
          </span>
        </div>
      </div>
    </div>
  );
}
