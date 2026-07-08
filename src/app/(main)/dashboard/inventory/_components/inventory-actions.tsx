"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Boxes, MapPin, Plus, Search, Settings, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import type { InventoryStockRules } from "../_lib/inventory-data";
import type { InventoryActionState } from "../actions";
import {
  createInventoryListItemAction,
  deleteInventoryItemAction,
  deleteInventoryListItemAction,
  saveInventoryItemAction,
  saveInventoryStockRulesAction,
} from "../actions";
import type { InventoryItem } from "./inventory-table";

const initialInventoryActionState: InventoryActionState = {
  message: "",
  success: false,
};

const commonInventoryUnits = ["each", "box", "case", "pack", "pair", "set", "roll", "ft", "yard", "lb", "oz", "gal"];

function formatMoneyInputValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue.toFixed(2) : "";
}

function formatMoneyInputOnBlur(event: React.FocusEvent<HTMLInputElement>) {
  const value = event.currentTarget.value.trim();
  if (!value) return;

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return;

  event.currentTarget.value = parsedValue.toFixed(2);
}

type InventoryItemDialogProps = {
  categories: string[];
  item?: InventoryItem;
  locations: string[];
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  stockRules?: InventoryStockRules;
};

type InventorySettingsMenuProps = {
  categories: string[];
  locations: string[];
  stockRules: InventoryStockRules;
};

function DeleteInventoryItemButton({ item, onDeleted }: { item: InventoryItem; onDeleted: () => void }) {
  const router = useRouter();
  const [error, setError] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive">
          <Trash2 />
          Delete item
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete item?</AlertDialogTitle>
          <AlertDialogDescription>
            Delete {item.product} from inventory. This will not remove existing order item snapshots.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="grid gap-2 rounded-md border bg-muted/30 p-3">
          <div className="grid grid-cols-[5.5rem_1fr] gap-3 text-sm">
            <dt className="text-muted-foreground">SKU</dt>
            <dd className="font-medium">{item.sku}</dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-3 text-sm">
            <dt className="text-muted-foreground">Category</dt>
            <dd className="font-medium">{item.category}</dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-3 text-sm">
            <dt className="text-muted-foreground">Location</dt>
            <dd className="font-medium">{item.location}</dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-3 text-sm">
            <dt className="text-muted-foreground">Stock</dt>
            <dd className="font-medium tabular-nums">{item.stock}</dd>
          </div>
        </dl>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              setError("");
              startTransition(async () => {
                const result = await deleteInventoryItemAction(item.id);

                if (result.success) {
                  router.refresh();
                  toast.success(result.message || "Inventory item deleted.");
                  onDeleted();
                  return;
                }

                toast.error(result.message || "Inventory item could not be deleted.");
                setError(result.message);
              });
            }}
          >
            {isPending ? "Deleting..." : "Delete item"}
          </AlertDialogAction>
        </AlertDialogFooter>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function InventoryItemForm({
  categories,
  focusField,
  item,
  locations,
  onDone,
  stockRules,
}: {
  categories: string[];
  focusField?: string;
  item?: InventoryItem;
  locations: string[];
  onDone: () => void;
  stockRules?: InventoryStockRules;
}) {
  const mode = item ? "edit" : "create";
  const router = useRouter();
  const [isTaxable, setIsTaxable] = React.useState(item?.taxable ?? true);
  const unitOptions = React.useMemo(() => {
    const currentUnit = item?.unit?.trim();

    if (!currentUnit || commonInventoryUnits.includes(currentUnit)) return commonInventoryUnits;

    return [currentUnit, ...commonInventoryUnits];
  }, [item?.unit]);
  const action = saveInventoryItemAction.bind(null, item?.id ?? null);
  const [state, formAction, isPending] = React.useActionState(action, initialInventoryActionState);
  const [isSubmitting, startSubmitTransition] = React.useTransition();
  const pending = isPending || isSubmitting;

  React.useEffect(() => {
    setIsTaxable(item?.taxable ?? true);
  }, [item]);

  React.useEffect(() => {
    if (state.message && !state.success) {
      toast.error(state.message);
      return;
    }

    if (!state.success) return;

    toast.success(state.message || (item ? "Inventory item updated." : "Inventory item created."));
    router.refresh();
    onDone();
  }, [item, onDone, router, state.message, state.success]);

  React.useEffect(() => {
    if (!focusField) return;

    const frame = window.requestAnimationFrame(() => {
      const field = document.querySelector(`[data-inventory-field="${focusField}"]`);
      const focusTarget = field?.querySelector(
        'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), button:not(:disabled)',
      ) as HTMLElement | null;

      field?.scrollIntoView({ block: "center", behavior: "smooth" });
      focusTarget?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusField]);

  return (
    <form
      className="grid min-w-0 gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);

        startSubmitTransition(() => {
          formAction(formData);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="grid min-w-0 gap-2" data-inventory-field="product">
          <Label htmlFor={`inventory-${mode}-product`}>Product name</Label>
          <Input
            id={`inventory-${mode}-product`}
            name="product"
            defaultValue={item?.product ?? ""}
            placeholder="Wireless Headphones Pro"
            required
          />
        </div>
        <div className="grid min-w-0 gap-2" data-inventory-field="sku">
          <Label htmlFor={`inventory-${mode}-sku`}>SKU</Label>
          <Input id={`inventory-${mode}-sku`} name="sku" defaultValue={item?.sku ?? ""} placeholder="WH-1001" />
        </div>
      </div>

      <div className="grid gap-2" data-inventory-field="description">
        <Label htmlFor={`inventory-${mode}-description`}>Description</Label>
        <Textarea
          id={`inventory-${mode}-description`}
          name="description"
          defaultValue={item?.description ?? ""}
          placeholder="Short product description..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="grid min-w-0 gap-2" data-inventory-field="category">
          <Label htmlFor={`inventory-${mode}-category`}>Category</Label>
          <Select name="category" defaultValue={item?.category ?? categories[0]}>
            <SelectTrigger id={`inventory-${mode}-category`} className="w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent align="start" position="popper">
              <SelectGroup>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-0 gap-2" data-inventory-field="location">
          <Label htmlFor={`inventory-${mode}-location`}>Location</Label>
          <Select name="location" defaultValue={item?.location ?? locations[0]}>
            <SelectTrigger id={`inventory-${mode}-location`} className="w-full">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent align="start" position="popper">
              <SelectGroup>
                {locations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="grid min-w-0 gap-2" data-inventory-field="unit">
          <Label htmlFor={`inventory-${mode}-unit`}>Unit</Label>
          <Select name="unit" defaultValue={item?.unit ?? "each"}>
            <SelectTrigger id={`inventory-${mode}-unit`} className="w-full">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {unitOptions.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-0 gap-2" data-inventory-field="itemStatus">
          <Label htmlFor={`inventory-${mode}-status`}>Status</Label>
          <Select name="itemStatus" defaultValue={item?.itemStatus ?? "Active"}>
            <SelectTrigger id={`inventory-${mode}-status`} className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div
          className="flex min-h-16 items-center justify-between gap-3 rounded-md px-3 py-2"
          data-inventory-field="taxable"
        >
          <input type="hidden" name="taxable" value={isTaxable ? "true" : "false"} />
          <div className="grid gap-0.5">
            <Label htmlFor={`inventory-${mode}-taxable`}>Taxable</Label>
          </div>
          <Switch id={`inventory-${mode}-taxable`} checked={isTaxable} onCheckedChange={setIsTaxable} />
        </div>
        <div className="grid min-w-0 gap-2" data-inventory-field="taxRate">
          <Label htmlFor={`inventory-${mode}-tax-rate`}>Tax rate</Label>
          <Input
            id={`inventory-${mode}-tax-rate`}
            name="taxRate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={item?.taxRate ?? "8.25"}
            disabled={!isTaxable}
            placeholder="8.25"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="grid min-w-0 gap-2" data-inventory-field="stock">
          <Label htmlFor={`inventory-${mode}-stock`}>Stock</Label>
          <Input
            id={`inventory-${mode}-stock`}
            name="stock"
            type="number"
            min="0"
            step="1"
            defaultValue={item?.stock ?? ""}
            placeholder="0"
          />
        </div>
        <div className="grid min-w-0 gap-2" data-inventory-field="unitPrice">
          <Label htmlFor={`inventory-${mode}-unit-price`}>Unit price</Label>
          <Input
            id={`inventory-${mode}-unit-price`}
            name="unitPrice"
            type="number"
            min="0"
            step="0.01"
            defaultValue={formatMoneyInputValue(item?.unitPrice)}
            onBlur={formatMoneyInputOnBlur}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="grid min-w-0 gap-2" data-inventory-field="cost">
          <Label htmlFor={`inventory-${mode}-cost`}>Cost</Label>
          <Input
            id={`inventory-${mode}-cost`}
            name="cost"
            type="number"
            min="0"
            step="0.01"
            defaultValue={formatMoneyInputValue(item?.cost)}
            onBlur={formatMoneyInputOnBlur}
            placeholder="0.00"
          />
        </div>
        <div className="grid min-w-0 gap-2" data-inventory-field="vendor">
          <Label htmlFor={`inventory-${mode}-vendor`}>Supplier</Label>
          <Input
            id={`inventory-${mode}-vendor`}
            name="vendor"
            defaultValue={item?.vendor ?? ""}
            placeholder="Supplier"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="grid min-w-0 gap-2" data-inventory-field="maxStock">
          <Label htmlFor={`inventory-${mode}-max-stock`}>Max stock</Label>
          <Input
            id={`inventory-${mode}-max-stock`}
            name="maxStock"
            type="number"
            min="0"
            step="1"
            defaultValue={item?.maxStock ?? stockRules?.defaultMaxStock ?? ""}
            placeholder="0"
          />
        </div>
        <div className="grid min-w-0 gap-2" data-inventory-field="reorderPoint">
          <Label htmlFor={`inventory-${mode}-reorder-point`}>Reorder point</Label>
          <Input
            id={`inventory-${mode}-reorder-point`}
            name="reorderPoint"
            type="number"
            min="0"
            step="1"
            defaultValue={item?.reorderPoint ?? stockRules?.defaultReorderPoint ?? ""}
            placeholder="0"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4">
        <div className="grid min-w-0 gap-2" data-inventory-field="barcode">
          <Label htmlFor={`inventory-${mode}-barcode`}>Barcode / UPC</Label>
          <Input
            id={`inventory-${mode}-barcode`}
            name="barcode"
            defaultValue={item?.barcode ?? ""}
            placeholder="012345678905"
          />
        </div>
      </div>

      <div className="grid gap-2" data-inventory-field="notes">
        <Label htmlFor={`inventory-${mode}-notes`}>Notes</Label>
        <Textarea
          id={`inventory-${mode}-notes`}
          name="notes"
          defaultValue={item?.notes ?? ""}
          placeholder="Optional item notes..."
        />
      </div>

      <DialogFooter>
        {item ? (
          <div className="mr-auto">
            <DeleteInventoryItemButton item={item} onDeleted={onDone} />
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" disabled={pending} onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : item ? "Save item" : "Add item"}
          </Button>
        </div>
      </DialogFooter>
      {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
    </form>
  );
}

export function InventoryItemDialog({
  categories,
  item,
  locations,
  onOpenChange,
  open,
  stockRules,
}: InventoryItemDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = onOpenChange ?? setInternalOpen;
  const title = item ? "Edit item" : "Add item";

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!isControlled ? (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus />
            Add item
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div className="grid gap-1">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {item
                  ? "Update the item details used by inventory and future orders."
                  : "Create a draft inventory item."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <InventoryItemForm
          categories={categories}
          item={item}
          locations={locations}
          onDone={() => setDialogOpen(false)}
          stockRules={stockRules}
        />
      </DialogContent>
    </Dialog>
  );
}

function ManageListDeleteButton({
  itemLabel,
  itemType,
  onDeleted,
}: {
  itemLabel: string;
  itemType: "category" | "location";
  onDeleted: (message: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground hover:text-red-600"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await deleteInventoryListItemAction(itemType, itemLabel);

          if (result.success) {
            router.refresh();
            toast.success(result.message || `${itemLabel} deleted.`);
          }

          onDeleted(result.message);
        });
      }}
    >
      <Trash2 className="size-4" />
      <span className="sr-only">Delete {itemLabel}</span>
    </Button>
  );
}

function InventoryListManagerPanel({
  addLabel,
  description,
  emptyLabel,
  itemType,
  items,
  open,
  placeholder,
  searchPlaceholder,
  title,
}: {
  addLabel: string;
  description: string;
  emptyLabel: string;
  itemType: "category" | "location";
  items: string[];
  open: boolean;
  placeholder: string;
  searchPlaceholder: string;
  title: string;
}) {
  const [draftItems, setDraftItems] = React.useState(items);
  const [newItem, setNewItem] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const router = useRouter();
  const action = createInventoryListItemAction.bind(null, itemType);
  const [state, formAction, isPending] = React.useActionState(action, initialInventoryActionState);
  const [actionMessage, setActionMessage] = React.useState("");
  const [actionSucceeded, setActionSucceeded] = React.useState(false);
  const [deleteMessage, setDeleteMessage] = React.useState("");
  const submittedItemRef = React.useRef("");
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredItems = draftItems.filter((item) => item.toLowerCase().includes(normalizedQuery));

  React.useEffect(() => {
    if (!open) return;

    setActionMessage("");
    setActionSucceeded(false);
    setDeleteMessage("");
    setDraftItems(items);
  }, [items, open]);

  React.useEffect(() => {
    const currentState = state;

    if (currentState.message && !currentState.success) {
      setActionMessage(currentState.message);
      setActionSucceeded(false);
      return;
    }

    if (!currentState.success) return;

    const addedItem = submittedItemRef.current;

    setActionMessage(currentState.message || (itemType === "category" ? "Category added." : "Location added."));
    setActionSucceeded(true);
    toast.success(currentState.message || (itemType === "category" ? "Category added." : "Location added."));
    if (addedItem) {
      setDraftItems((currentItems) => {
        if (currentItems.some((currentItem) => currentItem.toLowerCase() === addedItem.toLowerCase())) {
          return currentItems;
        }

        return [...currentItems, addedItem].sort((left, right) => left.localeCompare(right));
      });
    }
    submittedItemRef.current = "";
    setNewItem("");
    router.refresh();
  }, [itemType, router, state]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="grid gap-1">
        <h3 className="font-medium text-sm">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          action={(formData) => {
            submittedItemRef.current = newItem.trim();
            formAction(formData);
          }}
        >
          <div className="grid min-w-0 flex-1 gap-2">
            <Label htmlFor={`inventory-new-${itemType}`}>{addLabel}</Label>
            <Input
              id={`inventory-new-${itemType}`}
              name="name"
              value={newItem}
              onChange={(event) => setNewItem(event.target.value)}
              placeholder={placeholder}
            />
          </div>
          <Button type="submit" className="sm:self-end" disabled={isPending}>
            <Plus />
            {isPending ? "Adding..." : "Add"}
          </Button>
        </form>
        {actionMessage ? (
          <p className={actionSucceeded ? "text-muted-foreground text-sm" : "text-destructive text-sm"}>
            {actionMessage}
          </p>
        ) : null}
        {deleteMessage ? (
          <p
            className={deleteMessage.includes("deleted") ? "text-muted-foreground text-sm" : "text-destructive text-sm"}
          >
            {deleteMessage}
          </p>
        ) : null}

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>

        <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto rounded-lg border p-2">
          {filteredItems.length ? (
            filteredItems.map((item) => (
              <div
                key={item}
                className="flex min-h-11 items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-sm">{item}</div>
                  <div className="text-muted-foreground text-xs">Inventory {itemType}</div>
                </div>
                <ManageListDeleteButton
                  itemLabel={item}
                  itemType={itemType}
                  onDeleted={(message) => {
                    setDeleteMessage(message);
                    if (message.includes("deleted")) {
                      setDraftItems((currentItems) => currentItems.filter((currentItem) => currentItem !== item));
                    }
                  }}
                />
              </div>
            ))
          ) : (
            <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
              {emptyLabel}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function InventoryStockRulesPanel({ open, stockRules }: { open: boolean; stockRules: InventoryStockRules }) {
  const router = useRouter();
  const [autoRestockAlerts, setAutoRestockAlerts] = React.useState(stockRules.autoRestockAlerts);
  const [includeOutOfStock, setIncludeOutOfStock] = React.useState(stockRules.includeOutOfStock);
  const [state, formAction, isPending] = React.useActionState(
    saveInventoryStockRulesAction,
    initialInventoryActionState,
  );

  React.useEffect(() => {
    if (!open) return;

    setAutoRestockAlerts(stockRules.autoRestockAlerts);
    setIncludeOutOfStock(stockRules.includeOutOfStock);
  }, [open, stockRules.autoRestockAlerts, stockRules.includeOutOfStock]);

  React.useEffect(() => {
    if (state.message && !state.success) {
      toast.error(state.message);
      return;
    }

    if (!state.success) return;

    toast.success(state.message || "Stock rules saved.");
    router.refresh();
  }, [router, state.message, state.success]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="grid gap-1">
        <h3 className="font-medium text-sm">Stock rules</h3>
        <p className="text-muted-foreground text-sm">
          Set draft thresholds and alert behavior for inventory restock signals.
        </p>
      </div>

      <form className="flex min-h-0 flex-1 flex-col gap-4" action={formAction}>
        <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="inventory-low-stock-threshold">Low stock threshold</Label>
              <Input
                id="inventory-low-stock-threshold"
                name="lowStockThreshold"
                type="number"
                min="0"
                step="1"
                defaultValue={stockRules.lowStockThreshold}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inventory-critical-threshold">Critical threshold</Label>
              <Input
                id="inventory-critical-threshold"
                name="criticalStockThreshold"
                type="number"
                min="0"
                step="1"
                defaultValue={stockRules.criticalStockThreshold}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="inventory-default-reorder-point">Default reorder point</Label>
              <Input
                id="inventory-default-reorder-point"
                name="defaultReorderPoint"
                type="number"
                min="0"
                step="1"
                defaultValue={stockRules.defaultReorderPoint}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inventory-default-max-stock">Default max stock</Label>
              <Input
                id="inventory-default-max-stock"
                name="defaultMaxStock"
                type="number"
                min="0"
                step="1"
                defaultValue={stockRules.defaultMaxStock}
              />
            </div>
          </div>

          <div className="grid gap-2 rounded-lg border p-3">
            <input type="hidden" name="autoRestockAlerts" value={String(autoRestockAlerts)} />
            <input type="hidden" name="includeOutOfStock" value={String(includeOutOfStock)} />
            <div className="flex items-center justify-between gap-3">
              <div className="grid gap-0.5">
                <Label htmlFor="inventory-auto-restock-alerts">Restock alerts</Label>
                <p className="text-muted-foreground text-xs">Show items below their reorder point.</p>
              </div>
              <Switch
                id="inventory-auto-restock-alerts"
                checked={autoRestockAlerts}
                onCheckedChange={setAutoRestockAlerts}
              />
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <div className="grid gap-0.5">
                <Label htmlFor="inventory-include-out-of-stock">Out of stock priority</Label>
                <p className="text-muted-foreground text-xs">Keep zero-stock items in the highest priority group.</p>
              </div>
              <Switch
                id="inventory-include-out-of-stock"
                checked={includeOutOfStock}
                onCheckedChange={setIncludeOutOfStock}
              />
            </div>
          </div>

          {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
          {state.message && state.success ? <p className="text-muted-foreground text-sm">{state.message}</p> : null}
        </div>
        <div className="flex justify-end border-t pt-3">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving..." : "Save rules"}
          </Button>
        </div>
      </form>
    </section>
  );
}

export function InventorySettingsMenu({ categories, locations, stockRules }: InventorySettingsMenuProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label="Manage inventory settings">
          <Settings />
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[min(37rem,calc(100svh-2rem))] w-[calc(100vw-1rem)] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Manage inventory</DialogTitle>
          <DialogDescription>Update categories, locations, and stock rules from one place.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="categories" className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <TabsList className="grid h-auto w-full shrink-0 grid-cols-3">
            <TabsTrigger value="categories">
              <Tags className="size-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="locations">
              <MapPin className="size-4" />
              Locations
            </TabsTrigger>
            <TabsTrigger value="stock-rules">
              <Boxes className="size-4" />
              Stock Rules
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
            <InventoryListManagerPanel
              addLabel="New category"
              description="Add, search, and remove inventory categories."
              emptyLabel="No categories found."
              itemType="category"
              items={categories}
              open={open}
              placeholder="Accessories"
              searchPlaceholder="Search categories..."
              title="Categories"
            />
          </TabsContent>

          <TabsContent value="locations" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
            <InventoryListManagerPanel
              addLabel="New location"
              description="Add, search, and remove inventory storage locations."
              emptyLabel="No locations found."
              itemType="location"
              items={locations}
              open={open}
              placeholder="Warehouse D"
              searchPlaceholder="Search locations..."
              title="Locations"
            />
          </TabsContent>

          <TabsContent value="stock-rules" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
            <InventoryStockRulesPanel open={open} stockRules={stockRules} />
          </TabsContent>
        </Tabs>

        <DialogFooter className="shrink-0 border-t pt-3">
          <Button type="button" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
