"use client";

import * as React from "react";

import { ArrowRightLeft, ChevronDown, History, MapPin, SlidersHorizontal, Tags } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InventoryOptionSummary } from "@/lib/commerce/inventory-options";

import type { InventoryStockRules } from "../_lib/inventory-data";
import { InventorySettingsMenu } from "./inventory-actions";
import type { InventoryItem } from "./inventory-table";
import { StockHistory } from "./stock-history";
import { StockOperations } from "./stock-operations";

export function InventoryActionsMenu({
  items,
  categories,
  locations,
  stockRules,
}: {
  items: InventoryItem[];
  categories: InventoryOptionSummary[];
  locations: InventoryOptionSummary[];
  stockRules: InventoryStockRules;
}) {
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsTab, setSettingsTab] = React.useState<"categories" | "locations" | "stock-rules">("categories");
  function openSettings(tab: typeof settingsTab) {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }
  return (
    <>
      <StockOperations
        items={items}
        renderTrigger={(begin) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                Inventory actions <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={begin} disabled={!items.length}>
                <ArrowRightLeft />
                Adjust stock
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                <History />
                Stock history
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => openSettings("categories")}>
                <Tags />
                Categories
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openSettings("locations")}>
                <MapPin />
                Locations
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openSettings("stock-rules")}>
                <SlidersHorizontal />
                Stock rules
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <StockHistory open={historyOpen} onOpenChange={setHistoryOpen} />
      <InventorySettingsMenu
        categories={categories}
        locations={locations}
        stockRules={stockRules}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialTab={settingsTab}
      />
    </>
  );
}
