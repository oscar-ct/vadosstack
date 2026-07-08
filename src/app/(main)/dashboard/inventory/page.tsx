import { AlertTriangle, Boxes } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";

import { InventoryItemDialog, InventorySettingsMenu } from "./_components/inventory-actions";
import { type InventoryItem, InventoryTable } from "./_components/inventory-table";
import { getInventoryItems, getInventoryOptions, getInventoryStockRules } from "./_lib/inventory-data";

function getInventoryValue(items: InventoryItem[]) {
  return items.reduce((total, item) => total + item.stock * item.unitPrice, 0);
}

function needsRestock(item: InventoryItem) {
  return item.stock <= item.reorderPoint;
}

function getUniqueOptions(items: InventoryItem[], key: "category" | "location") {
  return Array.from(new Set(items.map((item) => item[key]))).sort();
}

function mergeOptions(...optionSets: string[][]) {
  return Array.from(new Set(optionSets.flat().filter(Boolean))).sort();
}

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view inventory"
        description="Inventory records are private to each signed-in account."
      />
    );
  }

  const [inventoryItems, inventoryOptions, stockRules] = await Promise.all([
    getInventoryItems(currentUser.id),
    getInventoryOptions(currentUser.id),
    getInventoryStockRules(currentUser.id),
  ]);
  const totalValue = getInventoryValue(inventoryItems);
  const restockCount = stockRules.autoRestockAlerts ? inventoryItems.filter(needsRestock).length : 0;
  const categories = mergeOptions(inventoryOptions.categories, getUniqueOptions(inventoryItems, "category"));
  const locations = mergeOptions(inventoryOptions.locations, getUniqueOptions(inventoryItems, "location"));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid max-w-2xl gap-2">
            <CardTitle className="flex items-center gap-2 leading-none">
              <span className="text-lg">Inventory</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Boxes className="size-4 text-muted-foreground" />
              </div>
            </CardTitle>
            <CardDescription>
              {inventoryItems.length} products · {formatCurrency(totalValue)} total value
            </CardDescription>
          </div>
          <CardAction className="flex flex-wrap items-center gap-2">
            {restockCount ? (
              <Badge className="border-red-600 bg-red-600 text-white hover:bg-red-600">
                <AlertTriangle />
                {restockCount} need restock
              </Badge>
            ) : null}
            <InventoryItemDialog
              categories={inventoryOptions.categories}
              locations={inventoryOptions.locations}
              stockRules={stockRules}
            />
            <InventorySettingsMenu
              categories={inventoryOptions.categories}
              locations={inventoryOptions.locations}
              stockRules={stockRules}
            />
            <div id="inventory-export-action" />
          </CardAction>
        </div>
      </CardHeader>
      <CardContent>
        <InventoryTable
          categories={categories}
          exportSlotId="inventory-export-action"
          items={inventoryItems}
          locations={locations}
          stockRules={stockRules}
        />
      </CardContent>
    </Card>
  );
}
