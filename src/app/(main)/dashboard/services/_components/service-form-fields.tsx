"use client";

import * as React from "react";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { type JobMaterial, stringifyMaterials } from "../../jobs/_components/materials";
import { type PricingLineItem, stringifyPricingItems } from "../../jobs/_components/pricing-items";
import type { ServiceTemplateRow } from "../types";

const categories = ["Repair", "Installation", "Other"] as const;
const mobileFieldClassName = "text-base md:text-sm bg-background/80";
const compactNumberClassName = `${mobileFieldClassName} h-9 w-full max-w-28`;
const lineItemUnits = ["sq ft", "linear ft", "each", "hour"] as const;

type LineItem = PricingLineItem & {
  id: string;
};

type MaterialLineItem = JobMaterial & {
  id: string;
};

type ServiceTemplateDraft = {
  category: string;
  description: string;
  laborItems: LineItem[];
  materials: MaterialLineItem[];
  notes: string;
  savedAt: string;
  title: string;
  version: 1;
};

function createLineItem(item?: Partial<PricingLineItem>): LineItem {
  return {
    id: crypto.randomUUID(),
    description: item?.description ?? "",
    quantity: item?.quantity ?? "",
    unit: item?.unit ?? "",
    unitPrice: item?.unitPrice ?? "",
    price: item?.price ?? "",
  };
}

function createMaterialLineItem(item?: Partial<JobMaterial>): MaterialLineItem {
  return {
    id: crypto.randomUUID(),
    description: item?.description ?? "",
    quantity: item?.quantity ?? "1",
    unit: item?.unit ?? "",
    unitPrice: item?.unitPrice ?? item?.price ?? "",
    price: item?.price ?? "",
  };
}

function formatMoneyInputValue(value: string) {
  if (!value.trim()) return "";

  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : value;
}

function calculateLineTotal(item: { quantity?: string; unitPrice?: string; price?: string }) {
  const quantity = Number(item.quantity ?? 0);
  const unitPrice = Number(item.unitPrice ?? 0);
  const fallbackPrice = Number(item.price ?? 0);
  const total = quantity > 0 && unitPrice > 0 ? quantity * unitPrice : fallbackPrice;

  return Number.isFinite(total) ? total.toFixed(2) : "0.00";
}

function formatMoneyDisplay(value: number) {
  return `$${value.toFixed(2)}`;
}

function getSubtotal(items: Array<{ price: string }>) {
  return items.reduce((total, item) => total + Number(item.price || 0), 0);
}

function getDraftSignature({
  category,
  description,
  laborItems,
  materials,
  notes,
  title,
}: {
  category: string;
  description: string;
  laborItems: LineItem[];
  materials: MaterialLineItem[];
  notes: string;
  title: string;
}) {
  return JSON.stringify({
    category,
    description,
    laborItems: laborItems.map(({ id: _id, ...item }) => item),
    materials: materials.map(({ id: _id, ...item }) => item),
    notes,
    title,
  });
}

function formatDraftSavedAt(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function parseServiceDraft(value: string): ServiceTemplateDraft | null {
  try {
    const parsed = JSON.parse(value) as Partial<ServiceTemplateDraft>;
    if (parsed.version !== 1) return null;

    return {
      category: categories.includes(parsed.category as (typeof categories)[number])
        ? (parsed.category ?? "Other")
        : "Other",
      description: parsed.description ?? "",
      laborItems: Array.isArray(parsed.laborItems)
        ? parsed.laborItems.map((item) => createLineItem(item))
        : [createLineItem()],
      materials: Array.isArray(parsed.materials)
        ? parsed.materials.map((item) => createMaterialLineItem(item))
        : [createMaterialLineItem()],
      notes: parsed.notes ?? "",
      savedAt: parsed.savedAt ?? "",
      title: parsed.title ?? "",
      version: 1,
    };
  } catch {
    return null;
  }
}

function updateCalculatedLineTotal<T extends { quantity?: string; unitPrice?: string; price: string }>(item: T): T {
  if (!item.quantity || !item.unitPrice) {
    return item;
  }

  return {
    ...item,
    price: calculateLineTotal(item),
  };
}

function LineItemsEditor({ items, onChange }: { items: LineItem[]; onChange: (items: LineItem[]) => void }) {
  const subtotal = getSubtotal(items);

  return (
    <div className="grid gap-3 rounded-lg border border-sky-200/80 bg-sky-50/60 p-3 dark:border-sky-900/60 dark:bg-sky-950/20">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Label>Labor</Label>
            <span className="rounded-md bg-background px-2 py-1 font-medium text-xs tabular-nums">
              {formatMoneyDisplay(subtotal)}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">Reusable labor line items for this service.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => onChange([createLineItem(), ...items])}>
          <Plus />
          Add labor
        </Button>
      </div>
      <div className="grid gap-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="grid gap-3 rounded-md border border-sky-200/70 bg-background/90 p-3 md:grid-cols-[minmax(12rem,1fr)_5.5rem_7rem] md:items-end xl:grid-cols-[minmax(14rem,1fr)_6rem_7.25rem_7rem_7rem_2.5rem] dark:border-sky-900/60"
          >
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                aria-label={`Labor ${index + 1} description`}
                value={item.description}
                onChange={(event) =>
                  onChange(
                    items.map((current, itemIndex) =>
                      itemIndex === index ? { ...current, description: event.target.value } : current,
                    ),
                  )
                }
                placeholder={`Labor description`}
                rows={1}
                className={`min-h-9 resize-y py-2 ${mobileFieldClassName}`}
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Qty</Label>
              <Input
                aria-label={`Labor ${index + 1} quantity`}
                value={item.quantity ?? ""}
                type="number"
                min="0"
                step="0.01"
                onChange={(event) =>
                  onChange(
                    items.map((current, itemIndex) =>
                      itemIndex === index
                        ? updateCalculatedLineTotal({ ...current, quantity: event.target.value })
                        : current,
                    ),
                  )
                }
                className={compactNumberClassName}
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Unit</Label>
              <Select
                value={item.unit || "none"}
                onValueChange={(value) =>
                  onChange(
                    items.map((current, itemIndex) =>
                      itemIndex === index ? { ...current, unit: value === "none" ? "" : value } : current,
                    ),
                  )
                }
              >
                <SelectTrigger aria-label={`Labor ${index + 1} unit`} className={`h-9 w-full ${mobileFieldClassName}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">No unit</SelectItem>
                    {lineItemUnits.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Rate</Label>
              <Input
                aria-label={`Labor ${index + 1} unit price`}
                value={item.unitPrice ?? ""}
                type="number"
                min="0"
                step="0.01"
                onChange={(event) =>
                  onChange(
                    items.map((current, itemIndex) =>
                      itemIndex === index
                        ? updateCalculatedLineTotal({ ...current, unitPrice: event.target.value })
                        : current,
                    ),
                  )
                }
                onBlur={() =>
                  onChange(
                    items.map((current, itemIndex) =>
                      itemIndex === index
                        ? updateCalculatedLineTotal({
                            ...current,
                            unitPrice: formatMoneyInputValue(current.unitPrice ?? ""),
                          })
                        : current,
                    ),
                  )
                }
                placeholder="0.00"
                className={compactNumberClassName}
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Total</Label>
              <Input
                aria-label={`Labor ${index + 1} price`}
                value={item.price}
                type="number"
                min="0"
                step="0.01"
                onChange={(event) =>
                  onChange(
                    items.map((current, itemIndex) =>
                      itemIndex === index ? { ...current, price: event.target.value } : current,
                    ),
                  )
                }
                onBlur={() =>
                  onChange(
                    items.map((current, itemIndex) =>
                      itemIndex === index ? { ...current, price: formatMoneyInputValue(current.price) } : current,
                    ),
                  )
                }
                placeholder="0.00"
                className={compactNumberClassName}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={items.length === 1}
              onClick={() => onChange(items.length === 1 ? items : items.filter((current) => current.id !== item.id))}
              aria-label={`Remove labor ${index + 1}`}
              className="justify-self-end"
            >
              <Trash2 className="size-4 text-red-500" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MaterialItemsEditor({
  items,
  onChange,
}: {
  items: MaterialLineItem[];
  onChange: (items: MaterialLineItem[]) => void;
}) {
  const subtotal = getSubtotal(items);

  return (
    <div className="grid gap-3 rounded-lg border border-amber-200/80 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Label>Materials</Label>
            <span className="rounded-md bg-background px-2 py-1 font-medium text-xs tabular-nums">
              {formatMoneyDisplay(subtotal)}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">Reusable material line items with quantity and unit pricing.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => onChange([createMaterialLineItem(), ...items])}>
          <Plus />
          Add material
        </Button>
      </div>
      <div className="grid gap-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="grid gap-3 rounded-md border border-amber-200/70 bg-background/90 p-3 md:grid-cols-[minmax(12rem,1fr)_5.5rem_7rem] md:items-end xl:grid-cols-[minmax(14rem,1fr)_6rem_7.25rem_7rem_7rem_2.5rem] dark:border-amber-900/60"
          >
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                aria-label={`Material ${index + 1} description`}
                value={item.description}
                onChange={(event) =>
                  onChange(
                    items.map((current, itemIndex) =>
                      itemIndex === index ? { ...current, description: event.target.value } : current,
                    ),
                  )
                }
                placeholder="Material description"
                rows={1}
                className={`min-h-9 resize-y py-2 ${mobileFieldClassName}`}
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Qty</Label>
              <Input
                aria-label={`Material ${index + 1} quantity`}
                value={item.quantity}
                type="number"
                min="0"
                step="0.01"
                onChange={(event) =>
                  onChange(
                    items.map((current, itemIndex) =>
                      itemIndex === index
                        ? updateCalculatedLineTotal({ ...current, quantity: event.target.value })
                        : current,
                    ),
                  )
                }
                className={compactNumberClassName}
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Unit</Label>
              <Select
                value={item.unit || "none"}
                onValueChange={(value) =>
                  onChange(
                    items.map((current, itemIndex) =>
                      itemIndex === index ? { ...current, unit: value === "none" ? "" : value } : current,
                    ),
                  )
                }
              >
                <SelectTrigger
                  aria-label={`Material ${index + 1} unit`}
                  className={`h-9 w-full ${mobileFieldClassName}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">No unit</SelectItem>
                    {lineItemUnits.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Rate</Label>
              <Input
                aria-label={`Material ${index + 1} unit price`}
                value={item.unitPrice}
                type="number"
                min="1"
                step="0.01"
                onChange={(event) =>
                  onChange(
                    items.map((current, itemIndex) =>
                      itemIndex === index
                        ? updateCalculatedLineTotal({ ...current, unitPrice: event.target.value })
                        : current,
                    ),
                  )
                }
                onBlur={() =>
                  onChange(
                    items.map((current, itemIndex) =>
                      itemIndex === index
                        ? updateCalculatedLineTotal({
                            ...current,
                            unitPrice: formatMoneyInputValue(current.unitPrice),
                          })
                        : current,
                    ),
                  )
                }
                placeholder="0.00"
                className={compactNumberClassName}
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Total</Label>
              <Input
                aria-label={`Material ${index + 1} total`}
                value={item.price}
                type="number"
                min="0"
                step="0.01"
                onChange={(event) =>
                  onChange(
                    items.map((current, itemIndex) =>
                      itemIndex === index ? { ...current, price: event.target.value } : current,
                    ),
                  )
                }
                onBlur={() =>
                  onChange(
                    items.map((current, itemIndex) =>
                      itemIndex === index ? { ...current, price: formatMoneyInputValue(current.price) } : current,
                    ),
                  )
                }
                placeholder="0.00"
                className={compactNumberClassName}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={items.length === 1}
              onClick={() => onChange(items.length === 1 ? items : items.filter((current) => current.id !== item.id))}
              aria-label={`Remove material ${index + 1}`}
              className="justify-self-end"
            >
              <Trash2 className="size-4 text-red-500" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ServiceFormFields({
  clearDraftSignal = 0,
  draftKey,
  service,
}: {
  clearDraftSignal?: number;
  draftKey?: string;
  service?: ServiceTemplateRow;
}) {
  const [title, setTitle] = React.useState(service?.title ?? "");
  const [description, setDescription] = React.useState(service?.description ?? "");
  const [category, setCategory] = React.useState(service?.category ?? "Other");
  const [notes, setNotes] = React.useState(service?.notes ?? "");
  const [laborItems, setLaborItems] = React.useState<LineItem[]>(
    service?.laborItems.length ? service.laborItems.map((item) => createLineItem(item)) : [createLineItem()],
  );
  const [materials, setMaterials] = React.useState<MaterialLineItem[]>(
    service?.materials.length
      ? service.materials.map((item) => createMaterialLineItem(item))
      : [createMaterialLineItem()],
  );
  const draftHydratedRef = React.useRef(false);
  const skipNextDraftSaveRef = React.useRef(true);
  const latestDraftJsonRef = React.useRef<string | undefined>(undefined);
  const suppressDraftFlushRef = React.useRef(false);
  const draftSaveTimeoutRef = React.useRef<number | undefined>(undefined);
  const clearedDraftSignatureRef = React.useRef<string | undefined>(undefined);
  const latestDraftSignatureRef = React.useRef<string | undefined>(undefined);
  const [draftSavedAt, setDraftSavedAt] = React.useState<string>();
  const [draftRestoredAt, setDraftRestoredAt] = React.useState<string>();
  const draftSignature = React.useMemo(
    () => getDraftSignature({ category, description, laborItems, materials, notes, title }),
    [category, description, laborItems, materials, notes, title],
  );

  React.useEffect(() => {
    latestDraftSignatureRef.current = draftSignature;
  }, [draftSignature]);

  const resetToService = React.useCallback(() => {
    setTitle(service?.title ?? "");
    setDescription(service?.description ?? "");
    setCategory(service?.category ?? "Other");
    setNotes(service?.notes ?? "");
    setLaborItems(
      service?.laborItems.length ? service.laborItems.map((item) => createLineItem(item)) : [createLineItem()],
    );
    setMaterials(
      service?.materials.length
        ? service.materials.map((item) => createMaterialLineItem(item))
        : [createMaterialLineItem()],
    );
  }, [service]);

  React.useEffect(() => {
    resetToService();
  }, [resetToService]);

  React.useEffect(() => {
    draftHydratedRef.current = false;
    skipNextDraftSaveRef.current = true;
    latestDraftJsonRef.current = undefined;
    clearedDraftSignatureRef.current = undefined;
    suppressDraftFlushRef.current = false;

    if (!draftKey || typeof window === "undefined") return;

    const draft = window.localStorage.getItem(draftKey);
    if (!draft) {
      draftHydratedRef.current = true;
      return;
    }

    const parsed = parseServiceDraft(draft);
    if (!parsed) {
      window.localStorage.removeItem(draftKey);
      draftHydratedRef.current = true;
      return;
    }

    setTitle(parsed.title);
    setDescription(parsed.description);
    setCategory(parsed.category);
    setNotes(parsed.notes);
    setLaborItems(parsed.laborItems.length ? parsed.laborItems : [createLineItem()]);
    setMaterials(parsed.materials.length ? parsed.materials : [createMaterialLineItem()]);
    setDraftSavedAt(parsed.savedAt);
    setDraftRestoredAt(parsed.savedAt);

    draftHydratedRef.current = true;
  }, [draftKey]);

  React.useEffect(() => {
    if (!clearDraftSignal || !draftKey || typeof window === "undefined") return;

    suppressDraftFlushRef.current = true;
    latestDraftJsonRef.current = undefined;
    clearedDraftSignatureRef.current = latestDraftSignatureRef.current;
    if (draftSaveTimeoutRef.current) {
      window.clearTimeout(draftSaveTimeoutRef.current);
      draftSaveTimeoutRef.current = undefined;
    }
    window.localStorage.removeItem(draftKey);
    setDraftSavedAt(undefined);
    setDraftRestoredAt(undefined);
  }, [clearDraftSignal, draftKey]);

  React.useEffect(() => {
    if (!draftKey || typeof window === "undefined" || !draftHydratedRef.current) return;

    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }

    if (clearedDraftSignatureRef.current === draftSignature) {
      suppressDraftFlushRef.current = true;
      latestDraftJsonRef.current = undefined;
      return;
    }

    const savedAt = new Date().toISOString();
    const draft: ServiceTemplateDraft = {
      category,
      description,
      laborItems,
      materials,
      notes,
      savedAt,
      title,
      version: 1,
    };
    const draftJson = JSON.stringify(draft);
    clearedDraftSignatureRef.current = undefined;
    suppressDraftFlushRef.current = false;
    latestDraftJsonRef.current = draftJson;

    if (draftSaveTimeoutRef.current) {
      window.clearTimeout(draftSaveTimeoutRef.current);
    }

    draftSaveTimeoutRef.current = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, draftJson);
      draftSaveTimeoutRef.current = undefined;
      setDraftSavedAt(savedAt);
      setDraftRestoredAt(undefined);
    }, 500);

    return () => {
      if (draftSaveTimeoutRef.current) {
        window.clearTimeout(draftSaveTimeoutRef.current);
        draftSaveTimeoutRef.current = undefined;
      }
    };
  }, [category, description, draftKey, draftSignature, laborItems, materials, notes, title]);

  React.useEffect(() => {
    if (!draftKey || typeof window === "undefined") return;
    const localDraftKey = draftKey;

    function flushDraft() {
      if (!suppressDraftFlushRef.current && latestDraftJsonRef.current) {
        window.localStorage.setItem(localDraftKey, latestDraftJsonRef.current);
      }
    }

    window.addEventListener("beforeunload", flushDraft);

    return () => {
      flushDraft();
      window.removeEventListener("beforeunload", flushDraft);
    };
  }, [draftKey]);

  function discardDraft() {
    if (!draftKey || typeof window === "undefined") return;

    window.localStorage.removeItem(draftKey);
    latestDraftJsonRef.current = undefined;
    clearedDraftSignatureRef.current = latestDraftSignatureRef.current;
    if (draftSaveTimeoutRef.current) {
      window.clearTimeout(draftSaveTimeoutRef.current);
      draftSaveTimeoutRef.current = undefined;
    }
    skipNextDraftSaveRef.current = true;
    setDraftSavedAt(undefined);
    setDraftRestoredAt(undefined);
    resetToService();
  }

  const laborSubtotal = getSubtotal(laborItems);
  const materialsSubtotal = getSubtotal(materials);
  const templateTotal = laborSubtotal + materialsSubtotal;
  const laborShare = templateTotal > 0 ? Math.round((laborSubtotal / templateTotal) * 100) : 0;
  const materialsShare = templateTotal > 0 ? 100 - laborShare : 0;

  return (
    <div className="grid gap-4">
      <input type="hidden" name="laborItems" value={stringifyPricingItems(laborItems)} />
      <input type="hidden" name="materials" value={stringifyMaterials(materials)} />
      <input type="hidden" name="materialTaxRate" value="0" />

      {draftKey ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-sky-950 text-xs dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-100">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            {draftRestoredAt ? (
              <span>
                Restored autosave from {formatDraftSavedAt(draftRestoredAt)}. Changes keep saving in this browser.
              </span>
            ) : draftSavedAt ? (
              <span>Autosaved locally at {formatDraftSavedAt(draftSavedAt)}.</span>
            ) : (
              <span>Autosave is on locally for this service.</span>
            )}
          </div>
          {draftRestoredAt || draftSavedAt ? (
            <Button type="button" variant="outline" size="sm" className="h-7 bg-background" onClick={discardDraft}>
              Discard local draft
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid gap-4 rounded-lg border bg-muted/20 p-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
            <div className="grid gap-2">
              <Label htmlFor={`service-title-${service?.id ?? "new"}`}>Title</Label>
              <Input
                id={`service-title-${service?.id ?? "new"}`}
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Water heater replacement"
                className={mobileFieldClassName}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`service-category-${service?.id ?? "new"}`}>Category</Label>
              <Select name="category" value={category} onValueChange={setCategory} required>
                <SelectTrigger
                  id={`service-category-${service?.id ?? "new"}`}
                  className={`w-full ${mobileFieldClassName}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {categories.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`service-description-${service?.id ?? "new"}`}>Description</Label>
              <Textarea
                id={`service-description-${service?.id ?? "new"}`}
                name="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the reusable work scope..."
                className={`${mobileFieldClassName} min-h-28`}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`service-notes-${service?.id ?? "new"}`}>Notes</Label>
              <Textarea
                id={`service-notes-${service?.id ?? "new"}`}
                name="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Internal service notes..."
                className={`${mobileFieldClassName} min-h-28`}
              />
            </div>
          </div>
        </div>

        <div className="grid content-start gap-3 rounded-lg border bg-background p-4">
          <div className="grid gap-1">
            <div className="text-muted-foreground text-xs">Pricing breakdown</div>
            <div className="font-semibold text-lg">{category}</div>
          </div>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-md bg-sky-50 px-3 py-2 dark:bg-sky-950/30">
              <span className="text-muted-foreground">Labor subtotal</span>
              <span className="font-medium tabular-nums">{formatMoneyDisplay(laborSubtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
              <span className="text-muted-foreground">Materials subtotal</span>
              <span className="font-medium tabular-nums">{formatMoneyDisplay(materialsSubtotal)}</span>
            </div>
          </div>
          <div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Pricing mix</span>
              <span className="font-medium tabular-nums">
                {laborShare}% / {materialsShare}%
              </span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              <span className="bg-sky-400" style={{ width: `${laborShare}%` }} />
              <span className="bg-amber-400" style={{ width: `${materialsShare}%` }} />
            </div>
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span>Labor</span>
              <span>Materials</span>
            </div>
          </div>
        </div>
      </div>

      <LineItemsEditor items={laborItems} onChange={setLaborItems} />
      <MaterialItemsEditor items={materials} onChange={setMaterials} />
    </div>
  );
}
