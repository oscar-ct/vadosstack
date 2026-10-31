import { format } from "date-fns";
import { PackageSearch } from "lucide-react";

import { parseCommercePulsePeriod } from "@/app/(main)/w/[workspaceSlug]/dashboard/commerce-pulse/_lib/commerce-pulse-data";
import { AuthRequiredState } from "@/components/auth-required-state";
import { getPermittedDashboardAuthorization } from "@/lib/authorization";

import { InventoryAnalyticsDashboard } from "./_components/inventory-analytics-dashboard";
import { InventoryAnalyticsFilters } from "./_components/inventory-analytics-filters";
import { getInventoryAnalyticsData } from "./_lib/inventory-analytics-data";

type PageProps = {
  searchParams?: Promise<{
    category?: string | string[];
    location?: string | string[];
    period?: string | string[];
  }>;
};

function first(value?: string | string[]) {
  return (Array.isArray(value) ? value[0] : value)?.slice(0, 100) ?? "";
}

export default async function Page({ searchParams }: PageProps) {
  const authorization = await getPermittedDashboardAuthorization("commerce.performance.view");
  if (!authorization) {
    return (
      <AuthRequiredState
        title="Sign in to view inventory analytics"
        description="Inventory reporting is private to each workspace."
      />
    );
  }

  const params = await searchParams;
  const period = parseCommercePulsePeriod(params?.period);
  const categoryId = first(params?.category);
  const locationId = first(params?.location);
  const data = await getInventoryAnalyticsData(authorization.workspaceId, period, { categoryId, locationId });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid max-w-2xl gap-2">
          <h1 className="flex items-center gap-2 font-medium text-xl leading-none">
            <span>Inventory Analytics</span>
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <PackageSearch className="size-4" />
            </span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Inventory value, movement, and loss · {format(new Date(), "EEEE, do MMMM yyyy")}
          </p>
        </div>
        <InventoryAnalyticsFilters
          period={period}
          categoryId={categoryId}
          locationId={locationId}
          categories={data.filterOptions.categories}
          locations={data.filterOptions.locations}
        />
      </div>
      <InventoryAnalyticsDashboard data={data} />
    </div>
  );
}
