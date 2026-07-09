"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import type { CommercePulsePeriod, CommercePulseScope } from "../_lib/commerce-pulse-data";
import { commercePulsePeriodOptions, commercePulseScopeOptions } from "../_lib/commerce-pulse-data";

type CommercePulseFiltersProps = {
  period: CommercePulsePeriod;
  scope: CommercePulseScope;
};

export function CommercePulseFilters({ period, scope }: CommercePulseFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: "period" | "scope", value: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set(key, value);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-end justify-start gap-2 lg:w-fit lg:justify-end">
      <Select value={period} onValueChange={(value) => updateFilter("period", value)}>
        <SelectTrigger className="w-36" id="commerce-pulse-period" size="sm">
          <SelectValue placeholder="This Month" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {commercePulsePeriodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select value={scope} onValueChange={(value) => updateFilter("scope", value)}>
        <SelectTrigger className="w-42" id="commerce-pulse-scope" size="sm">
          <SelectValue placeholder="All Order Lines" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {commercePulseScopeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Separator className="hidden h-8 lg:block" orientation="vertical" />

      <Button asChild size="icon-sm" variant="outline">
        <a aria-label="Manage inventory settings" href="/dashboard/inventory">
          <Settings2 />
        </a>
      </Button>
    </div>
  );
}
