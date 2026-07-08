"use client";

import * as React from "react";

import {
  ArrowUpDown,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Drawer,
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
import { cn, formatCurrency } from "@/lib/utils";

import type { InventoryStockRules } from "../_lib/inventory-data";
import { InventoryItemForm } from "./inventory-actions";

export type InventoryItem = {
  barcode?: string;
  category: string;
  cost: number;
  description: string;
  id: string;
  itemStatus: "Active" | "Inactive";
  location: string;
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

type InventoryStatus = "Critical" | "In Stock" | "Low Stock" | "Out of Stock";
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
type SortValue = "product-asc" | "stock-asc" | "stock-desc" | "value-desc";

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
];

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
  if (item.stock <= 0) return stockRules.includeOutOfStock ? "Out of Stock" : "Critical";
  if (!stockRules.autoRestockAlerts) return "In Stock";

  const lowStockThreshold = item.reorderPoint > 0 ? item.reorderPoint : stockRules.lowStockThreshold;
  const criticalThreshold = Math.min(lowStockThreshold, stockRules.criticalStockThreshold);

  if (item.stock <= criticalThreshold) return "Critical";
  if (item.stock <= lowStockThreshold) return "Low Stock";
  return "In Stock";
}

function getStatusClassName(status: InventoryStatus) {
  if (status === "In Stock") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Low Stock") return "border-yellow-200 bg-yellow-50 text-yellow-700";
  if (status === "Critical") return "border-red-600 bg-red-600 text-white";
  return "border-transparent bg-transparent px-0 text-red-600 shadow-none";
}

function getStockClassName(status: InventoryStatus) {
  if (status === "Out of Stock" || status === "Critical") return "text-red-600";
  if (status === "Low Stock") return "text-amber-600";
  return "text-foreground";
}

function getSearchText(item: InventoryItem, stockRules: InventoryStockRules) {
  return [item.sku, item.product, item.category, item.location, getInventoryStatus(item, stockRules)]
    .join(" ")
    .toLowerCase();
}

function sortInventoryItems(items: InventoryItem[], sortValue: SortValue) {
  return [...items].sort((left, right) => {
    if (sortValue === "stock-asc") return left.stock - right.stock;
    if (sortValue === "stock-desc") return right.stock - left.stock;
    if (sortValue === "product-asc") return left.product.localeCompare(right.product);
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

function ReadOnlyField({
  field,
  label,
  multiline = false,
  onEdit,
  value,
}: {
  field: InventoryFieldKey;
  label: string;
  multiline?: boolean;
  onEdit: (field: InventoryFieldKey) => void;
  value?: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <Label>{label}</Label>
      <button
        type="button"
        className={cn(
          "min-h-9 rounded-md border bg-muted/20 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          multiline && "min-h-20 whitespace-pre-wrap",
        )}
        onClick={() => onEdit(field)}
      >
        {value ?? "-"}
      </button>
    </div>
  );
}

function InventoryItemViewFields({
  item,
  onEdit,
}: {
  item: InventoryItem;
  onEdit: (field: InventoryFieldKey) => void;
}) {
  const fieldProps = { onEdit };

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <ReadOnlyField field="product" label="Product name" value={item.product} {...fieldProps} />
        <ReadOnlyField field="sku" label="SKU" value={item.sku} {...fieldProps} />
      </div>

      <ReadOnlyField
        field="description"
        label="Description"
        value={item.description || "No description added."}
        multiline
        {...fieldProps}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyField field="category" label="Category" value={item.category} {...fieldProps} />
        <ReadOnlyField field="location" label="Location" value={item.location} {...fieldProps} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <ReadOnlyField field="unit" label="Unit" value={item.unit} {...fieldProps} />
        <ReadOnlyField field="itemStatus" label="Status" value={item.itemStatus} {...fieldProps} />
        <ReadOnlyField field="taxable" label="Taxable" value={item.taxable ? "Yes" : "No"} {...fieldProps} />
        <ReadOnlyField
          field="taxRate"
          label="Tax rate"
          value={item.taxable ? `${item.taxRate.toFixed(2)}%` : "-"}
          {...fieldProps}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <ReadOnlyField
          field="stock"
          label="Stock"
          value={<span className="tabular-nums">{item.stock}</span>}
          {...fieldProps}
        />
        <ReadOnlyField
          field="reorderPoint"
          label="Reorder point"
          value={<span className="tabular-nums">{item.reorderPoint}</span>}
          {...fieldProps}
        />
        <ReadOnlyField
          field="maxStock"
          label="Max stock"
          value={<span className="tabular-nums">{item.maxStock}</span>}
          {...fieldProps}
        />
        <ReadOnlyField
          field="unitPrice"
          label="Unit price"
          value={<span className="tabular-nums">{formatCurrency(item.unitPrice)}</span>}
          {...fieldProps}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <ReadOnlyField
          field="cost"
          label="Cost"
          value={<span className="tabular-nums">{formatCurrency(item.cost)}</span>}
          {...fieldProps}
        />
        <ReadOnlyField field="vendor" label="Vendor" value={item.vendor} {...fieldProps} />
        <ReadOnlyField field="barcode" label="Barcode / UPC" value={item.barcode} {...fieldProps} />
      </div>

      <ReadOnlyField field="notes" label="Notes" value={item.notes ?? "No notes added."} multiline {...fieldProps} />
    </div>
  );
}

function InventoryRowActions({ item, onEdit }: { item: InventoryItem; onEdit: () => void }) {
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
  categories,
  focusField,
  item,
  locations,
  mode,
  onEdit,
  onOpenChange,
}: {
  categories: string[];
  focusField?: InventoryFieldKey;
  item: InventoryItem;
  locations: string[];
  mode: InventoryDialogMode;
  onEdit: (field?: InventoryFieldKey) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const title = mode === "edit" ? "Edit item" : "View item";

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div className="grid gap-1">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {mode === "edit"
                  ? "Update the item details used by inventory and future orders."
                  : "Review the item details used by inventory and future orders."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {mode === "edit" ? (
          <InventoryItemForm
            categories={categories}
            focusField={focusField}
            item={item}
            locations={locations}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <InventoryItemViewFields item={item} onEdit={onEdit} />
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
    <div className="relative grid gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/35">
      <button
        type="button"
        className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`View ${item.product}`}
        onClick={onView}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="relative flex min-w-0 items-start gap-3">
          <div className="pointer-events-none min-w-0">
            <div className="truncate font-medium">{item.product}</div>
            <div className="truncate text-muted-foreground text-xs">
              {item.sku} · {item.category}
            </div>
          </div>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-1" data-row-click-ignore>
          <Badge variant="outline" className={getStatusClassName(status)}>
            {status}
          </Badge>
        </div>
      </div>
      <div className="pointer-events-none relative grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-muted-foreground text-xs">Stock</div>
          <div className={cn("font-semibold tabular-nums", getStockClassName(status))}>{item.stock}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Value</div>
          <div className="font-medium tabular-nums">{formatCurrency(getInventoryValue(item))}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Location</div>
          <div className="font-medium">{item.location}</div>
        </div>
        <div>
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
  categories = [],
  exportSlotId,
  items,
  locations = [],
  stockRules = fallbackStockRules,
}: {
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
  const [pageSize, setPageSize] = React.useState(10);
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

    return sortInventoryItems(filtered, sortValue);
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
      {exportSlotId ? <CsvExportSlot id={exportSlotId}>{exportMenu}</CsvExportSlot> : null}
      {activeItem ? (
        <InventoryItemDetailsDialog
          categories={categoryFormOptions}
          focusField={focusField}
          item={activeItem}
          locations={locationFormOptions}
          mode={dialogMode}
          onEdit={(field) => {
            setDialogMode("edit");
            setFocusField(field);
          }}
          onOpenChange={(open) => {
            if (!open) closeItemDialog();
          }}
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
            {exportSlotId ? null : exportMenu}
            <div className="md:hidden">
              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal />
                    Filters
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Inventory filters</DrawerTitle>
                    <DrawerDescription>Filter and sort the inventory list on mobile.</DrawerDescription>
                  </DrawerHeader>
                  <div className="grid gap-4 px-4">
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
                  </div>
                  <DrawerFooter>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ArrowUpDown />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={sortValue} onValueChange={(value) => updateSort(value as SortValue)}>
                    {sortOptions.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
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

        <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
          <Table>
            <TableHeader className="bg-muted/15">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected || (someVisibleSelected ? "indeterminate" : false)}
                    aria-label="Select all visible inventory items"
                    onCheckedChange={(value) => toggleVisibleItems(value === true)}
                  />
                </TableHead>
                <TableHead className="w-[5.25rem] text-muted-foreground">SKU</TableHead>
                <TableHead className="min-w-[14rem] text-muted-foreground">Product</TableHead>
                <TableHead className="w-[4.5rem] text-right text-muted-foreground">Stock</TableHead>
                <TableHead className="w-[8.25rem] text-muted-foreground">Level</TableHead>
                <TableHead className="w-[7.5rem] text-muted-foreground">Status</TableHead>
                <TableHead className="w-[10.5rem] text-muted-foreground">Location</TableHead>
                <TableHead className="w-[7.5rem] text-right text-muted-foreground">Value</TableHead>
                <TableHead className="w-10" />
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
                      <TableCell className="font-mono text-muted-foreground text-xs">{item.sku}</TableCell>
                      <TableCell>
                        <div className="font-medium leading-none">{item.product}</div>
                        <div className="mt-1 text-muted-foreground text-xs">{item.category}</div>
                      </TableCell>
                      <TableCell className={cn("text-right font-semibold tabular-nums", getStockClassName(status))}>
                        {item.stock}
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
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="size-3.5" />
                          {item.location}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {item.stock > 0 ? formatCurrency(getInventoryValue(item)) : "$0"}
                      </TableCell>
                      <TableCell className="text-right">
                        <InventoryRowActions item={item} onEdit={() => openItemDialog(item, "edit")} />
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
                    {[10, 20, 30, 40, 50].map((size) => (
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
