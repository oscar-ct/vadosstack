import { Star } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

export function PlatformAdminIdentity() {
  return (
    <div className="relative isolate mx-1 flex items-center gap-2 overflow-hidden rounded-md border border-amber-300/80 px-2 py-2 text-amber-950 dark:border-amber-600/50 dark:text-amber-100">
      <Skeleton className="absolute inset-0 -z-10 size-full rounded-none bg-amber-200/80 motion-reduce:animate-none dark:bg-amber-500/25" />
      <Star className="size-4 fill-amber-400 text-amber-600 dark:fill-amber-300 dark:text-amber-300" />
      <span className="font-medium text-sm">VadosStack Founder</span>
    </div>
  );
}
