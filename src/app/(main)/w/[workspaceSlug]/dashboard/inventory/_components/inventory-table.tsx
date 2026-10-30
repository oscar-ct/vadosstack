"use client";

import * as React from "react";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MapPin,
  PackageSearch,
  Pencil,
  Search,
  SlidersHorizontal,
  Tags,
  Warehouse,
  X,
} from "lucide-react";

import { type CsvColumn, CsvExportMenu, CsvExportSlot } from "@/components/csv-export-menu";
import { PermissionDisabledButton } from "@/components/permission-disabled-button";
import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InventoryStockOverview } from "@/lib/commerce/inventory-summary";
import { cn, formatCurrency } from "@/lib/utils";

import type { InventoryStockRules } from "../_lib/inventory-data";
import { InventoryItemForm, InventoryRecordMenu } from "./inventory-actions";
import {
  InventoryRecordHeader,
  InventoryRecordSection,
  InventoryRecordValue,
  inventoryDialogBodyClassName,
  inventoryDialogClassName,
  inventoryDialogFooterClassName,
} from "./inventory-record-layout";
import { InventoryStockSummary } from "./inventory-stock-summary";

export type InventoryItem = {
  updatedAt?: string;
  barcode?: string;
  category: string;
  cost: number;
  description: string;
  id: string;
  itemStatus: "Active" | "Inactive";
  location: string;
  locationLocked?: boolean;
  productId?: string;
  identityLocked?: boolean;
  stockOverview?: InventoryStockOverview;
  maxStock: number;
  notes?: string;
  product: string;
  reorderPoint: number;
  sku: string;
  stock: number;
  taxable: boolean;
  taxRate: number;
  unit: string;
  unitPrice: number;
  vendor?: string;
};

type InventoryStatus = "Archived" | "Critical" | "In Stock" | "Low Stock" | "Out of Stock";
type InventoryDialogMode = "edit" | "view";
type InventoryFieldKey =
  | "barcode"
  | "category"
  | "cost"
  | "description"
  | "itemStatus"
  | "location"
  | "maxStock"
  | "notes"
  | "product"
  | "reorderPoint"
  | "sku"
  | "stock"
  | "taxable"
  | "taxRate"
  | "unit"
  | "unitPrice"
  | "vendor";
type SortValue =
  | "location-asc"
  | "location-desc"
  | "product-asc"
  | "product-desc"
  | "sku-asc"
  | "sku-desc"
  | "status-asc"
  | "status-desc"
  | "stock-asc"
  | "stock-desc"
  | "value-asc"
  | "value-desc";

const fallbackStockRules: InventoryStockRules = {
  autoRestockAlerts: true,
  criticalStockThreshold: 8,
  defaultMaxStock: 100,
  defaultReorderPoint: 20,
  includeOutOfStock: true,
  lowStockThreshold: 25,
};

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "In Stock", label: "In Stock" },
  { value: "Low Stock", label: "Low Stock" },
  { value: "Critical", label: "Critical" },
  { value: "Out of Stock", label: "Out of Stock" },
] as const;

const sortOptions: Array<{ label: string; value: SortValue }> = [
  { value: "value-desc", label: "Highest value" },
  { value: "stock-asc", label: "Lowest stock" },
  { value: "stock-desc", label: "Highest stock" },
  { value: "product-asc", label: "Product A-Z" },
  { value: "product-desc", label: "Product Z-A" },
  { value: "sku-asc", label: "SKU A-Z" },
  { value: "sku-desc", label: "SKU Z-A" },
  { value: "status-asc", label: "Status A-Z" },
  { value: "status-desc", label: "Status Z-A" },
  { value: "location-asc", label: "Location A-Z" },
  { value: "location-desc", label: "Location Z-A" },
  { value: "value-asc", label: "Lowest value" },
];

function inventorySortDirection(sortValue: SortValue, ascending: SortValue, descending: SortValue): TableSortDirection {
  if (sortValue === ascending) return "asc";
  if (sortValue === descending) return "desc";
  return false;
}

function getInventoryExportColumns(stockRules: InventoryStockRules): CsvColumn<InventoryItem>[] {
  return [
    { header: "SKU", value: (item) => item.sku },
    { header: "Product", value: (item) => item.product },
    { header: "Category", value: (item) => item.category },
    { header: "Stock", value: (item) => item.stock },
    { header: "Reorder point", value: (item) => item.reorderPoint },
    { header: "Max stock", value: (item) => item.maxStock },
    { header: "Status", value: (item) => getInventoryStatus(item, stockRules) },
    { header: "Location", value: (item) => item.location },
    { header: "Cost", value: (item) => item.cost },
    { header: "Unit price", value: (item) => item.unitPrice },
    { header: "Unit", value: (item) => item.unit },
    { header: "Taxable", value: (item) => (item.taxable ? "Yes" : "No") },
    { header: "Tax rate", value: (item) => (item.taxable ? `${item.taxRate.toFixed(2)}%` : "") },
    { header: "Item status", value: (item) => item.itemStatus },
    { header: "Vendor", value: (item) => item.vendor },
    { header: "Value", value: (item) => getInventoryValue(item).toFixed(2) },
  ];
}

function getInventoryValue(item: InventoryItem) {
  return item.stock * item.unitPrice;
}

function shouldIgnoreRowClick(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? !!target.closest("a, button, input, label, select, textarea, [data-row-click-ignore]")
    : false;
}

function getInventoryStatus(item: InventoryItem, stockRules: InventoryStockRules): InventoryStatus {
  if (item.itemStatus === "Inactive") return "Archived";
  if (item.stock <= 0) return stockRules.includeOutOfStock ? "Out of Stock" : "Critical";
  if (!stockRules.autoRestockAlerts) return "In Stock";

  const lowStockThreshold = item.reorderPoint > 0 ? item.reorderPoint : stockRules.lowStockThreshold;
  const criticalThreshold = Math.min(lowStockThreshold, stockRules.criticalStockThreshold);

  if (item.stock <= criticalThreshold) return "Critical";
  if (item.stock <= lowStockThreshold) return "Low Stock";
  return "In Stock";
}

function getStatusClassName(status: InventoryStatus) {
  if (status === "Archived") return "border-border bg-muted text-muted-foreground";
  if (status === "In Stock") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Low Stock") return "border-yellow-200 bg-yellow-50 text-yellow-700";
  if (status === "Critical") return "border-red-600 bg-red-600 text-white";
  return "border-transparent bg-transparent px-0 text-red-600 shadow-none";
}

function getStockClassName(status: InventoryStatus) {
  if (status === "Archived") return "text-muted-foreground";
  if (status === "Out of Stock" || status === "Critical") return "text-red-600";
  if (status === "Low Stock") return "text-amber-600";
  return "text-foreground";
}

function getSearchText(item: InventoryItem, stockRules: InventoryStockRules) {
  return [item.sku, item.product, item.category, item.location, getInventoryStatus(item, stockRules)]
    .join(" ")
    .toLowerCase();
}

function sortInventoryItems(items: InventoryItem[], sortValue: SortValue, stockRules: InventoryStockRules) {
  return [...items].sort((left, right) => {
    if (sortValue === "stock-asc") return left.stock - right.stock;
    if (sortValue === "stock-desc") return right.stock - left.stock;
    if (sortValue === "product-asc") return left.product.localeCompare(right.product);
    if (sortValue === "product-desc") return right.product.localeCompare(left.product);
    if (sortValue === "sku-asc") return left.sku.localeCompare(right.sku, undefined, { numeric: true });
    if (sortValue === "sku-desc") return right.sku.localeCompare(left.sku, undefined, { numeric: true });
    if (sortValue === "status-asc") {
      return getInventoryStatus(left, stockRules).localeCompare(getInventoryStatus(right, stockRules));
    }
    if (sortValue === "status-desc") {
      return getInventoryStatus(right, stockRules).localeCompare(getInventoryStatus(left, stockRules));
    }
    if (sortValue === "location-asc") return left.location.localeCompare(right.location);
    if (sortValue === "location-desc") return right.location.localeCompare(left.location);
    if (sortValue === "value-asc") return getInventoryValue(left) - getInventoryValue(right);
    return getInventoryValue(right) - getInventoryValue(left);
  });
}

function StockLevel({ item, stockRules }: { item: InventoryItem; stockRules: InventoryStockRules }) {
  const fillPercentage = Math.min(100, Math.max(0, (item.stock / item.maxStock) * 100));
  const reorderPercentage = Math.min(100, Math.max(0, (item.reorderPoint / item.maxStock) * 100));
  const status = getInventoryStatus(item, stockRules);

  return (
    <div className="relative h-2 w-24 rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-l-full",
          status === "Out of Stock" ? "bg-transparent" : status === "Critical" ? "bg-red-600" : "bg-foreground",
        )}
        style={{ width: `${fillPercentage}%` }}
      />
      <span
        className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-red-500"
        style={{ left: `${reorderPercentage}%` }}
      />
    </div>
  );
}

function InventoryItemViewFields({ item }: { item: InventoryItem }) {
  return (
    <div className={inventoryDialogBodyClassName}>
      <div className="grid gap-5">
        <InventoryStockSummary item={item} />
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <div className="grid min-w-0 gap-5">
            <InventoryRecordSection title="Product information">
              <dl className="grid gap-4">
                <InventoryRecordValue label="Description" value={item.description || "No description added."} />
                <div className="grid grid-cols-2 gap-4">
                  <InventoryRecordValue label="Category" value={item.category} />
                  <InventoryRecordValue label="Unit" value={item.unit} />
                </div>
                <InventoryRecordValue label="Barcode / UPC" value={item.barcode} />
              </dl>
            </InventoryRecordSection>
            <InventoryRecordSection title="Notes">
              <p className="whitespace-pre-wrap break-words text-sm">
                {item.notes?.trim() ? item.notes : "No notes added."}
              </p>
            </InventoryRecordSection>
          </div>
          <div className="grid min-w-0 gap-5">
            <InventoryRecordSection title="Pricing & purchasing" description="For this location’s record.">
              <dl className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <InventoryRecordValue label="Unit price" value={formatCurrency(item.unitPrice)} />
                  <InventoryRecordValue label="Unit cost" value={formatCurrency(item.cost)} />
                </div>
                <InventoryRecordValue label="Supplier" value={item.vendor} />
                <div className="grid grid-cols-2 gap-4">
                  <InventoryRecordValue label="Taxable" value={item.taxable ? "Yes" : "No"} />
                  <InventoryRecordValue
                    label="Tax rate"
                    value={item.taxable ? `${item.taxRate.toFixed(2)}%` : "Not applicable"}
                  />
                </div>
              </dl>
            </InventoryRecordSection>
            <InventoryRecordSection title="Inventory settings" description="For this location’s record.">
              <dl className="grid grid-cols-2 gap-4">
                <InventoryRecordValue label="Reorder point" value={item.reorderPoint} />
                <InventoryRecordValue label="Maximum stock" value={item.maxStock} />
              </dl>
            </InventoryRecordSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryRowActions({
  canManage,
  item,
  onEdit,
}: {
  canManage: boolean;
  item: InventoryItem;
  onEdit: () => void;
}) {
  if (!canManage) {
    return (
      <PermissionDisabledButton
        variant="ghost"
        size="icon-sm"
        reason="Your role can view inventory but cannot edit it."
        aria-label={`Edit ${item.product} unavailable`}
      >
        <Pencil />
      </PermissionDisabledButton>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={`Edit ${item.product}`}
      onClick={onEdit}
    >
      <Pencil className="size-4" />
    </Button>
  );
}

function InventoryItemDetailsDialog({
  canManage,
  categories,
  focusField,
  item,
  locations,
  mode,
  onEdit,
  onOpenChange,
  stockRules,
}: {
  canManage: boolean;
  categories: string[];
  focusField?: InventoryFieldKey;
  item: InventoryItem;
  locations: string[];
  mode: InventoryDialogMode;
  onEdit: (field?: InventoryFieldKey) => void;
  onOpenChange: (open: boolean) => void;
  stockRules: InventoryStockRules;
}) {
  function adjustStock() {
    onOpenChange(false);
    window.dispatchEvent(new CustomEvent("inventory:adjust-stock", { detail: { itemId: item.id } }));
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={inventoryDialogClassName}>
        <InventoryRecordHeader item={item} editing={mode === "edit"} />
        {mode === "edit" ? (
          <InventoryItemForm
            categories={categories}
            focusField={focusField}
            item={item}
            locations={locations}
            onDone={() => onOpenChange(false)}
            stockRules={stockRules}
          />
        ) : (
          <>
            <InventoryItemViewFields item={item} />
            <div className={inventoryDialogFooterClassName}>
              {canManage ? (
                <InventoryRecordMenu item={item} onArchived={() => onOpenChange(false)} />
              ) : (
                <span className="text-muted-foreground text-xs">View only</span>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  className="hidden sm:inline-flex"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                {canManage ? (
                  <>
                    <Button type="button" variant="outline" onClick={adjustStock}>
                      Adjust stock
                    </Button>
                    <Button type="button" onClick={() => onEdit()}>
                      Edit details
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MobileInventoryCard({
  item,
  onView,
  stockRules,
}: {
  item: InventoryItem;
  onView: () => void;
  stockRules: InventoryStockRules;
}) {
  const status = getInventoryStatus(item, stockRules);

  return (
    <div className="relative grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-muted/35 sm:grid-cols-[minmax(0,1fr)_minmax(18rem,1fr)] sm:items-center sm:gap-x-6">
      <button
        type="button"
        className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`View ${item.product}`}
        onClick={onView}
      />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="relative flex min-w-0 flex-1 items-start gap-3">
          <div className="pointer-events-none min-w-0">
            <div className="truncate font-medium">{item.product}</div>
            <div className="truncate text-muted-foreground text-xs">
              {item.sku} · {item.category}
            </div>
            {item.stockOverview && item.stockOverview.locations.length > 1 ? (
              <div className="mt-1 truncate text-muted-foreground text-xs">
                {item.stockOverview.locations.length} locations · {item.stockOverview.totalAvailable} total available
              </div>
            ) : null}
          </div>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-1" data-row-click-ignore>
          <Badge variant="outline" className={getStatusClassName(status)}>
            {status}
          </Badge>
        </div>
      </div>
      <div className="pointer-events-none relative grid min-w-0 grid-cols-2 gap-3 text-sm sm:border-l sm:pl-6">
        <div className="min-w-0">
          <div className="text-muted-foreground text-xs">Stock</div>
          <div className={cn("font-semibold tabular-nums", getStockClassName(status))}>{item.stock}</div>
        </div>
        <div className="min-w-0 text-right">
          <div className="text-muted-foreground text-xs">Value</div>
          <div className="font-medium tabular-nums">{formatCurrency(getInventoryValue(item))}</div>
        </div>
        <div className="min-w-0">
          <div className="text-muted-foreground text-xs">Location</div>
          <div className="truncate font-medium">{item.location}</div>
        </div>
        <div className="min-w-0">
          <div className="text-muted-foreground text-xs">Level</div>
          <div className="mt-1">
            <StockLevel item={item} stockRules={stockRules} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function InventoryTable({
  canExport = true,
  canManage = true,
  categories = [],
  exportSlotId,
  items,
  locations = [],
  stockRules = fallbackStockRules,
}: {
  canExport?: boolean;
  canManage?: boolean;
  categories?: string[];
  exportSlotId?: string;
  items: InventoryItem[];
  locations?: string[];
  stockRules?: InventoryStockRules;
}) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [locationFilter, setLocationFilter] = React.useState("all");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  const [sortValue, setSortValue] = React.useState<SortValue>("value-desc");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [activeItem, setActiveItem] = React.useState<InventoryItem | null>(null);
  const [dialogMode, setDialogMode] = React.useState<InventoryDialogMode>("view");
  const [focusField, setFocusField] = React.useState<InventoryFieldKey | undefined>();
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const categoryOptions = React.useMemo(
    () => ["all", ...Array.from(new Set([...categories, ...items.map((item) => item.category)])).sort()],
    [categories, items],
  );
  const categoryFormOptions = React.useMemo(
    () => Array.from(new Set(categories.filter((category) => category !== "Uncategorized"))).sort(),
    [categories],
  );
  const locationOptions = React.useMemo(
    () => ["all", ...Array.from(new Set([...locations, ...items.map((item) => item.location)])).sort()],
    [items, locations],
  );
  const locationFormOptions = React.useMemo(
    () => Array.from(new Set(locations.filter((location) => location !== "Unassigned"))).sort(),
    [locations],
  );
  const filteredItems = React.useMemo(() => {
    const filtered = items
      .filter((item) => (normalizedQuery ? getSearchText(item, stockRules).includes(normalizedQuery) : true))
      .filter((item) => (statusFilter === "all" ? true : getInventoryStatus(item, stockRules) === statusFilter))
      .filter((item) => (categoryFilter === "all" ? true : item.category === categoryFilter))
      .filter((item) => (locationFilter === "all" ? true : item.location === locationFilter));

    return sortInventoryItems(filtered, sortValue, stockRules);
  }, [categoryFilter, items, locationFilter, normalizedQuery, sortValue, statusFilter, stockRules]);
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const paginatedItems = filteredItems.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize);
  const selectedItems = items.filter((item) => selectedIds.has(item.id));
  const allVisibleSelected = paginatedItems.length > 0 && paginatedItems.every((item) => selectedIds.has(item.id));
  const someVisibleSelected = paginatedItems.some((item) => selectedIds.has(item.id));
  const hasFilters =
    Boolean(normalizedQuery) ||
    statusFilter !== "all" ||
    categoryFilter !== "all" ||
    locationFilter !== "all" ||
    sortValue !== "value-desc";
  const inventoryExportColumns = React.useMemo(() => getInventoryExportColumns(stockRules), [stockRules]);
  const exportMenu = (
    <CsvExportMenu
      allRows={items}
      columns={inventoryExportColumns}
      currentRows={filteredItems}
      filenamePrefix="inventory"
      selectedRows={selectedItems}
      triggerClassName={exportSlotId ? "hidden w-7 px-0 sm:w-auto sm:px-2.5 md:flex" : undefined}
    />
  );

  function toggleItem(itemId: string, checked: boolean) {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (checked) nextIds.add(itemId);
      else nextIds.delete(itemId);

      return nextIds;
    });
  }

  function toggleVisibleItems(checked: boolean) {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);

      for (const item of paginatedItems) {
        if (checked) nextIds.add(item.id);
        else nextIds.delete(item.id);
      }

      return nextIds;
    });
  }

  function resetFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setLocationFilter("all");
    setPageIndex(0);
    setSortValue("value-desc");
  }

  function updateCategoryFilter(value: string) {
    setCategoryFilter(value);
    setPageIndex(0);
  }

  function updateLocationFilter(value: string) {
    setLocationFilter(value);
    setPageIndex(0);
  }

  function updateSearch(value: string) {
    setSearchQuery(value);
    setPageIndex(0);
  }

  function updateSort(value: SortValue) {
    setSortValue(value);
    setPageIndex(0);
  }

  function updateStatusFilter(value: string) {
    setStatusFilter(value);
    setPageIndex(0);
  }

  function openItemDialog(item: InventoryItem, mode: InventoryDialogMode, field?: InventoryFieldKey) {
    setActiveItem(item);
    setDialogMode(mode);
    setFocusField(field);
  }

  function closeItemDialog() {
    setActiveItem(null);
    setDialogMode("view");
    setFocusField(undefined);
  }

  const canPreviousPage = safePageIndex > 0;
  const canNextPage = safePageIndex < pageCount - 1;

  React.useEffect(() => {
    if (pageIndex > pageCount - 1) setPageIndex(pageCount - 1);
  }, [pageCount, pageIndex]);

  return (
    <>
      {exportSlotId && canExport ? <CsvExportSlot id={exportSlotId}>{exportMenu}</CsvExportSlot> : null}
      {activeItem ? (
        <InventoryItemDetailsDialog
          canManage={canManage}
          categories={categoryFormOptions}
          focusField={focusField}
          item={activeItem}
          locations={locationFormOptions}
          mode={dialogMode}
          onEdit={(field) => {
            if (!canManage) return;
            setDialogMode("edit");
            setFocusField(field);
          }}
          onOpenChange={(open) => {
            if (!open) closeItemDialog();
          }}
          stockRules={stockRules}
        />
      ) : null}
      <div className="grid gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
                placeholder="Search inventory..."
                value={searchQuery}
                onChange={(event) => updateSearch(event.target.value)}
              />
            </div>
            {!exportSlotId && canExport ? exportMenu : null}
            <div className="md:hidden">
              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm" className="md:hidden">
                    <SlidersHorizontal />
                    Filters
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader className="landscape:py-2">
                    <DrawerTitle>Inventory filters</DrawerTitle>
                    <DrawerDescription className="landscape:hidden">
                      Filter and sort the inventory list on mobile.
                    </DrawerDescription>
                  </DrawerHeader>
                  <DrawerBody className="grid gap-4 px-4 pb-1 landscape:gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="inventory-mobile-status">Status</Label>
                      <Select value={statusFilter} onValueChange={updateStatusFilter}>
                        <SelectTrigger id="inventory-mobile-status" className="w-full">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="inventory-mobile-category">Category</Label>
                      <Select value={categoryFilter} onValueChange={updateCategoryFilter}>
                        <SelectTrigger id="inventory-mobile-category" className="w-full">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {categoryOptions.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category === "all" ? "All categories" : category}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="inventory-mobile-location">Location</Label>
                      <Select value={locationFilter} onValueChange={updateLocationFilter}>
                        <SelectTrigger id="inventory-mobile-location" className="w-full">
                          <SelectValue placeholder="Location" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {locationOptions.map((location) => (
                              <SelectItem key={location} value={location}>
                                {location === "all" ? "All locations" : location}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="inventory-mobile-sort">Sort</Label>
                      <Select value={sortValue} onValueChange={(value) => updateSort(value as SortValue)}>
                        <SelectTrigger id="inventory-mobile-sort" className="w-full">
                          <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {sortOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </DrawerBody>
                  <DrawerFooter className="border-t bg-popover pb-[max(1rem,env(safe-area-inset-bottom))] landscape:pt-2 landscape:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                    {hasFilters ? (
                      <Button type="button" variant="outline" onClick={resetFilters}>
                        Reset filters
                      </Button>
                    ) : null}
                    <DrawerClose asChild>
                      <Button>Done</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            </div>
            <div className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <PackageSearch />
                    Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={statusFilter} onValueChange={updateStatusFilter}>
                    {statusOptions.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Tags />
                    Category
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={categoryFilter} onValueChange={updateCategoryFilter}>
                    {categoryOptions.map((category) => (
                      <DropdownMenuRadioItem key={category} value={category}>
                        {category === "all" ? "All categories" : category}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Warehouse />
                    Location
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={locationFilter} onValueChange={updateLocationFilter}>
                    {locationOptions.map((location) => (
                      <DropdownMenuRadioItem key={location} value={location}>
                        {location === "all" ? "All locations" : location}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {hasFilters ? (
                <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                  <X />
                  Reset
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="hidden w-full min-w-0 max-w-full overflow-hidden md:block [&_th]:top-0">
          <Table className="min-w-[70rem] table-fixed">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[15%]" />
              <col className="w-[21%]" />
              <col className="w-[6%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-[6%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky top-12 z-20 w-10 border-b bg-card">
                  <Checkbox
                    checked={allVisibleSelected || (someVisibleSelected ? "indeterminate" : false)}
                    aria-label="Select all visible inventory items"
                    onCheckedChange={(value) => toggleVisibleItems(value === true)}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 w-[10rem] border-b bg-card">
                  <SortableTableHeader
                    direction={inventorySortDirection(sortValue, "sku-asc", "sku-desc")}
                    label="SKU"
                    onSort={() => updateSort(sortValue === "sku-asc" ? "sku-desc" : "sku-asc")}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 min-w-[14rem] border-b bg-card">
                  <SortableTableHeader
                    direction={inventorySortDirection(sortValue, "product-asc", "product-desc")}
                    label="Product"
                    onSort={() => updateSort(sortValue === "product-asc" ? "product-desc" : "product-asc")}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 w-[4.5rem] border-b bg-card text-right">
                  <SortableTableHeader
                    align="right"
                    direction={inventorySortDirection(sortValue, "stock-asc", "stock-desc")}
                    label="Stock"
                    onSort={() => updateSort(sortValue === "stock-asc" ? "stock-desc" : "stock-asc")}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 w-[8.25rem] border-b bg-card">Level</TableHead>
                <TableHead className="sticky top-12 z-20 w-[7.5rem] border-b bg-card">
                  <SortableTableHeader
                    direction={inventorySortDirection(sortValue, "status-asc", "status-desc")}
                    label="Status"
                    onSort={() => updateSort(sortValue === "status-asc" ? "status-desc" : "status-asc")}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 w-[10.5rem] border-b bg-card">
                  <SortableTableHeader
                    direction={inventorySortDirection(sortValue, "location-asc", "location-desc")}
                    label="Location"
                    onSort={() => updateSort(sortValue === "location-asc" ? "location-desc" : "location-asc")}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 w-[7.5rem] border-b bg-card text-right">
                  <SortableTableHeader
                    align="right"
                    direction={inventorySortDirection(sortValue, "value-asc", "value-desc")}
                    label="Value"
                    onSort={() => updateSort(sortValue === "value-asc" ? "value-desc" : "value-asc")}
                  />
                </TableHead>
                <TableHead className="sticky top-12 z-20 w-10 border-b bg-card" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length ? (
                paginatedItems.map((item) => {
                  const status = getInventoryStatus(item, stockRules);

                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        status === "Out of Stock" && "bg-muted/25",
                      )}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        if (shouldIgnoreRowClick(event.target)) return;
                        openItemDialog(item, "view");
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        if (shouldIgnoreRowClick(event.target)) return;
                        event.preventDefault();
                        openItemDialog(item, "view");
                      }}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          aria-label={`Select ${item.product}`}
                          onCheckedChange={(value) => toggleItem(item.id, value === true)}
                        />
                      </TableCell>
                      <TableCell className="overflow-hidden font-mono text-muted-foreground text-xs">
                        <span className="block truncate" title={item.sku}>
                          {item.sku || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="truncate font-medium leading-normal" title={item.product}>
                          {item.product}
                        </div>
                        <div className="mt-1 truncate text-muted-foreground text-xs">{item.category}</div>
                        {item.stockOverview && item.stockOverview.locations.length > 1 ? (
                          <div className="mt-1 truncate text-muted-foreground text-xs">
                            {item.stockOverview.locations.length} locations · {item.stockOverview.totalAvailable} total
                            available
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className={cn("text-right font-semibold tabular-nums", getStockClassName(status))}>
                        <span className="block truncate" title={`${item.stock} available`}>
                          {item.stock}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StockLevel item={item} stockRules={stockRules} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusClassName(status)}>
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                          <MapPin className="size-3.5 shrink-0" />
                          <span className="truncate" title={item.location}>
                            {item.location}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        <span className="block truncate" title={formatCurrency(getInventoryValue(item))}>
                          {item.stock > 0 ? formatCurrency(getInventoryValue(item)) : "$0"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <InventoryRowActions
                          canManage={canManage}
                          item={item}
                          onEdit={() => openItemDialog(item, "edit")}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 md:hidden">
          {filteredItems.length ? (
            paginatedItems.map((item) => (
              <MobileInventoryCard
                key={item.id}
                item={item}
                onView={() => openItemDialog(item, "view")}
                stockRules={stockRules}
              />
            ))
          ) : (
            <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm">
              <p>No results.</p>
              {hasFilters ? (
                <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={resetFilters}>
                  Reset filters
                </Button>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden flex-1 text-muted-foreground text-sm lg:flex">
            {selectedIds.size} of {filteredItems.length} row(s) selected.
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="inventory-rows-per-page" className="font-medium text-sm">
                Rows per page
              </Label>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPageIndex(0);
                }}
              >
                <SelectTrigger size="sm" className="w-20" id="inventory-rows-per-page">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectGroup>
                    {[20, 30, 40, 50].map((size) => (
                      <SelectItem key={size} value={`${size}`}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-center font-medium text-sm sm:w-fit">
              Page {safePageIndex + 1} of {pageCount}
            </div>
            <div className="flex items-center justify-center gap-2 sm:ml-auto lg:ml-0">
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => setPageIndex(0)}
                disabled={!canPreviousPage}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => setPageIndex((currentPage) => Math.max(0, currentPage - 1))}
                disabled={!canPreviousPage}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => setPageIndex((currentPage) => Math.min(pageCount - 1, currentPage + 1))}
                disabled={!canNextPage}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => setPageIndex(pageCount - 1)}
                disabled={!canNextPage}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
