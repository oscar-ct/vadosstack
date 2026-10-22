"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type TableSortDirection = "asc" | "desc" | false;

export function SortableTableHeader({
  align = "left",
  direction,
  label,
  onSort,
}: {
  align?: "left" | "right";
  direction: TableSortDirection;
  label: string;
  onSort?: (event: unknown) => void;
}) {
  const SortIcon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <button
      type="button"
      className={cn(
        "flex w-fit items-center gap-1.5 rounded-sm font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        align === "right" && "ml-auto",
      )}
      onClick={(event) => onSort?.(event)}
      aria-label={`Sort by ${label}${direction ? `, currently ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
    >
      {label}
      <SortIcon className={cn("size-3.5", direction ? "text-foreground" : "text-muted-foreground")} />
    </button>
  );
}
