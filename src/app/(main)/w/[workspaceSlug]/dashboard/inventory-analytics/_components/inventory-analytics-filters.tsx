"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { RotateCcw } from "lucide-react";

import {
  type CommercePulsePeriod,
  commercePulsePeriodOptions,
} from "@/app/(main)/w/[workspaceSlug]/dashboard/commerce-pulse/_lib/commerce-pulse-data";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspaceRouter } from "@/components/workspace-path-provider";

type Option = { id: string; name: string };

export function InventoryAnalyticsFilters({
  period,
  categoryId,
  locationId,
  categories,
  locations,
}: {
  period: CommercePulsePeriod;
  categoryId: string;
  locationId: string;
  categories: Option[];
  locations: Option[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useWorkspaceRouter();

  function update(key: "period" | "category" | "location", value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select value={period} onValueChange={(value) => update("period", value)}>
        <SelectTrigger className="w-38" aria-label="Reporting period" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {commercePulsePeriodOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={categoryId || "all"} onValueChange={(value) => update("category", value)}>
        <SelectTrigger className="w-40" aria-label="Inventory category" size="sm">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={locationId || "all"} onValueChange={(value) => update("location", value)}>
        <SelectTrigger className="w-40" aria-label="Inventory location" size="sm">
          <SelectValue placeholder="All locations" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All locations</SelectItem>
          {locations.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {categoryId || locationId ? (
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label="Clear inventory filters"
          onClick={() => {
            const next = new URLSearchParams(searchParams.toString());
            next.delete("category");
            next.delete("location");
            router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
          }}
        >
          <RotateCcw />
        </Button>
      ) : null}
    </div>
  );
}
