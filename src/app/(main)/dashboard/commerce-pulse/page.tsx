import { format } from "date-fns";

import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";

import { CommerceKpiStrip } from "./_components/commerce-kpi-strip";
import { CommercePulseFilters } from "./_components/commerce-pulse-filters";
import { InventoryHealthCard } from "./_components/inventory-health-card";
import { OrderOperationsCard } from "./_components/order-operations-card";
import { TopProductsCard } from "./_components/top-products-card";
import { getCommercePulseData, parseCommercePulsePeriod, parseCommercePulseScope } from "./_lib/commerce-pulse-data";

type PageProps = {
  searchParams?: Promise<{
    period?: string | string[];
    scope?: string | string[];
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view commerce analytics"
        description="Order and inventory analytics are private to each signed-in account."
      />
    );
  }

  const params = await searchParams;
  const period = parseCommercePulsePeriod(params?.period);
  const scope = parseCommercePulseScope(params?.scope);
  const data = await getCommercePulseData(currentUser.id, period, scope);
  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Commerce Pulse</h1>
          <p className="text-muted-foreground text-sm">{formattedDate}</p>
        </div>

        <CommercePulseFilters period={period} scope={scope} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <CommerceKpiStrip data={data} />
        <div className="xl:col-span-4">
          <TopProductsCard data={data.topProducts} />
        </div>
        <div className="xl:col-span-4">
          <InventoryHealthCard data={data.inventory} />
        </div>
        <div className="xl:col-span-4">
          <OrderOperationsCard data={data} />
        </div>
      </div>
    </div>
  );
}
