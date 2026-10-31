import { Boxes, Plus, Settings2 } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { CommerceIndexControls } from "@/components/commerce-index-controls";
import { PermissionDisabledButton } from "@/components/permission-disabled-button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { inventoryListWhere, parseInventoryVisibility } from "@/lib/commerce/inventory-filter";
import { prisma } from "@/lib/prisma";

import { InventoryItemDialog, InventorySettingsMenu } from "./_components/inventory-actions";
import { type InventoryItem, InventoryTable } from "./_components/inventory-table";
import { StockOperations } from "./_components/stock-operations";
import { getInventoryItems, getInventoryOptions, getInventoryStockRules } from "./_lib/inventory-data";

function getUniqueOptions(items: InventoryItem[], key: "category" | "location") {
  return Array.from(new Set(items.map((item) => item[key]))).sort();
}

function mergeOptions(...optionSets: string[][]) {
  return Array.from(new Set(optionSets.flat().filter(Boolean))).sort();
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; visibility?: string }>;
}) {
  const authorization = await getPermittedDashboardAuthorization("inventory.view");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Sign in to view inventory"
        description="Inventory records are private to each signed-in account."
      />
    );
  }
  const workspaceId = authorization.workspaceId;
  const canExport = can(authorization.membership, "reports.export");
  const canManage = can(authorization.membership, "inventory.manage");

  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 200);
  const visibility = parseInventoryVisibility(params.visibility);
  const inventoryWhere = inventoryListWhere(workspaceId, q, visibility);
  const total = await prisma.inventoryItem.count({ where: inventoryWhere });
  const page = Math.min(Math.max(1, Math.trunc(Number(params.page)) || 1), Math.max(1, Math.ceil(total / 50)));
  const [inventoryItems, inventoryOptions, stockRules] = await Promise.all([
    getInventoryItems(workspaceId, { q, page, visibility }),
    getInventoryOptions(workspaceId),
    getInventoryStockRules(workspaceId),
  ]);
  const categories = mergeOptions(inventoryOptions.categories, getUniqueOptions(inventoryItems, "category"));
  const locations = mergeOptions(inventoryOptions.locations, getUniqueOptions(inventoryItems, "location"));

  return (
    <Card className="md:overflow-visible">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid max-w-2xl gap-2">
            <CardTitle className="flex items-center gap-2 leading-none">
              <span className="text-xl">Inventory</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Boxes className="size-4 text-muted-foreground" />
              </div>
            </CardTitle>
            <CardDescription>Manage inventory and track stock levels.</CardDescription>
          </div>
          <CardAction className="flex flex-wrap items-center gap-2">
            {canManage ? (
              <InventoryItemDialog
                categories={inventoryOptions.categories}
                locations={inventoryOptions.locations}
                stockRules={stockRules}
              />
            ) : null}
            {canManage ? (
              <InventorySettingsMenu
                categories={inventoryOptions.categoryDetails}
                locations={inventoryOptions.locationDetails}
                stockRules={stockRules}
              />
            ) : null}
            {!canManage ? (
              <>
                <PermissionDisabledButton size="sm" reason="Your role can view inventory but cannot add items.">
                  <Plus />
                  Add item
                </PermissionDisabledButton>
                <PermissionDisabledButton
                  size="icon-sm"
                  variant="outline"
                  reason="Your role cannot change inventory settings."
                  aria-label="Inventory settings unavailable"
                >
                  <Settings2 />
                </PermissionDisabledButton>
              </>
            ) : null}
            {canExport ? <div id="inventory-export-action" /> : null}
          </CardAction>
        </div>
      </CardHeader>
      <CardContent>
        <CommerceIndexControls
          path="/dashboard/inventory"
          query={q}
          page={page}
          total={total}
          inventoryVisibility={visibility}
          showSearch={false}
        />
        {canManage ? <StockOperations items={inventoryItems} /> : null}
        <InventoryTable
          key={visibility}
          canExport={canExport}
          canManage={canManage}
          categories={categories}
          exportSlotId={canExport ? "inventory-export-action" : undefined}
          items={inventoryItems}
          locations={locations}
          query={q}
          stockRules={stockRules}
          visibility={visibility}
        />
      </CardContent>
    </Card>
  );
}
