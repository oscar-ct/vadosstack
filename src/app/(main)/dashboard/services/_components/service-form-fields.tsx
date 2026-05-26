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
const lineItemUnits = ["sq ft", "linear ft", "each", "hour"] as const;

type LineItem = PricingLineItem & {
  id: string;
};

type MaterialLineItem = JobMaterial & {
  id: string;
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
  return (
    <div
      className={
        "grid gap-4 rounded-lg border border-sky-200/80 bg-sky-50/60 pb-4 dark:border-sky-900/60 dark:bg-sky-950/20"
      }
    >
      <div className="grid gap-4 px-4 pt-4 pb-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-2">
        <div className="grid gap-1">
          <Label>Labor</Label>
          <p className="text-muted-foreground text-xs">Reusable labor line items for this service.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => onChange([createLineItem(), ...items])}>
          <Plus />
          Add labor
        </Button>
      </div>
      <div className="grid gap-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="grid grid-cols-2 gap-3 px-4 py-3 odd:py-0 even:bg-sky-100/80 md:grid-cols-[112px_112px_112px_minmax(0,1fr)_auto]"
          >
            <div className="col-span-2 grid gap-2 md:order-1 md:col-span-4">
              {index === 0 ? <Label>Description</Label> : null}
              <Input
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
                className={mobileFieldClassName}
              />
            </div>
            <div className="grid min-w-0 gap-2 md:order-3">
              {index === 0 ? <Label>Qty</Label> : null}
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
                className={mobileFieldClassName}
              />
            </div>
            <div className="grid min-w-0 gap-2 md:order-4">
              {index === 0 ? <Label>Rate</Label> : null}
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
                className={mobileFieldClassName}
              />
            </div>
            <div className="grid min-w-0 gap-2 md:order-5">
              {index === 0 ? <Label>Unit</Label> : null}
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
                <SelectTrigger aria-label={`Labor ${index + 1} unit`} className={`w-full ${mobileFieldClassName}`}>
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
            <div className="grid min-w-0 gap-2 md:order-2">
              {index === 0 ? <Label>Total</Label> : null}
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
                className={mobileFieldClassName}
              />
            </div>
            <div className="col-span-2 min-w-0 gap-2 md:order-6 md:grid">
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={items.length === 1}
                  onClick={() =>
                    onChange(items.length === 1 ? items : items.filter((current) => current.id !== item.id))
                  }
                  aria-label={`Remove labor ${index + 1}`}
                >
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>
            </div>
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
  return (
    <div className="grid gap-4 rounded-lg border border-amber-200/80 bg-amber-50/60 pb-4 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="grid gap-4 px-4 pt-4 pb-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-2">
        <div className="grid gap-1">
          <Label>Materials</Label>
          <p className="text-muted-foreground text-xs">Reusable material line items with quantity and unit pricing.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => onChange([createMaterialLineItem(), ...items])}>
          <Plus />
          Add material
        </Button>
      </div>
      <div className="grid gap-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="grid grid-cols-2 gap-3 px-4 py-3 odd:py-0 even:bg-amber-100/80 md:grid-cols-[112px_112px_112px_minmax(0,1fr)_auto]"
          >
            <div className="col-span-2 grid gap-2 md:order-1 md:col-span-4">
              {index === 0 ? <Label>Description</Label> : null}
              <Input
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
                className={mobileFieldClassName}
              />
            </div>
            <div className="grid min-w-0 gap-2 md:order-3">
              {index === 0 ? <Label>Qty</Label> : null}
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
                className={mobileFieldClassName}
              />
            </div>
            <div className="grid min-w-0 gap-2 md:order-4">
              {index === 0 ? <Label>Rate</Label> : null}
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
                className={mobileFieldClassName}
              />
            </div>
            <div className="grid min-w-0 gap-2 md:order-5">
              {index === 0 ? <Label>Unit</Label> : null}
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
                <SelectTrigger aria-label={`Material ${index + 1} unit`} className={`w-full ${mobileFieldClassName}`}>
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
            <div className="grid min-w-0 gap-2 md:order-2">
              {index === 0 ? <Label>Total</Label> : null}
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
                className={mobileFieldClassName}
              />
            </div>
            <div className="col-span-2 min-w-0 gap-2 md:order-6 md:grid">
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={items.length === 1}
                  onClick={() =>
                    onChange(items.length === 1 ? items : items.filter((current) => current.id !== item.id))
                  }
                  aria-label={`Remove material ${index + 1}`}
                >
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ServiceFormFields({ service }: { service?: ServiceTemplateRow }) {
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

  React.useEffect(() => {
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

  return (
    <div className="grid gap-4">
      <input type="hidden" name="laborItems" value={stringifyPricingItems(laborItems)} />
      <input type="hidden" name="materials" value={stringifyMaterials(materials)} />
      <input type="hidden" name="materialTaxRate" value="0" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
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
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={`service-description-${service?.id ?? "new"}`}>Description</Label>
          <Textarea
            id={`service-description-${service?.id ?? "new"}`}
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the reusable work scope..."
            className={mobileFieldClassName}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`service-category-${service?.id ?? "new"}`}>Category</Label>
          <Select name="category" value={category} onValueChange={setCategory} required>
            <SelectTrigger id={`service-category-${service?.id ?? "new"}`} className={`w-full ${mobileFieldClassName}`}>
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
        <div className="grid gap-2">
          <Label htmlFor={`service-notes-${service?.id ?? "new"}`}>Notes</Label>
          <Textarea
            id={`service-notes-${service?.id ?? "new"}`}
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Internal service notes..."
            className={mobileFieldClassName}
          />
        </div>
      </div>

      <LineItemsEditor items={laborItems} onChange={setLaborItems} />
      <MaterialItemsEditor items={materials} onChange={setMaterials} />
    </div>
  );
}
