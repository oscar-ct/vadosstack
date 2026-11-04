"use client";

import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function MetricBreakdown({
  label,
  title,
  rows,
  description,
  triggerLabel,
}: {
  label: string;
  title: string;
  rows: Array<[string, string]>;
  description: string;
  triggerLabel?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={triggerLabel ? "sm" : "icon"}
          className={triggerLabel ? "shrink-0 text-muted-foreground text-xs" : "-my-1 size-6 shrink-0"}
          aria-label={label}
        >
          <Info className="size-3.5" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="w-72 max-w-[calc(100vw-2rem)] p-4 text-xs"
        aria-label={label}
      >
        <h3 className="font-medium text-sm">{title}</h3>
        <dl className="mt-3 grid gap-2">
          {rows.map(([name, value]) => (
            <div key={name} className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">{name}</dt>
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-muted-foreground">{description}</p>
      </PopoverContent>
    </Popover>
  );
}
