"use client";

import * as React from "react";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { calculateMaterialTotal, type JobMaterial, stringifyMaterials } from "../../jobs/_components/materials";
import { type PricingLineItem, stringifyPricingItems } from "../../jobs/_components/pricing-items";
import type { ServiceTemplateRow } from "../types";

const categories = ["Repair", "Installation", "Other"] as const;
const mobileFieldClassName = "text-base md:text-sm bg-background/80";

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
    price: item?.price ?? "",
  };
}

function createMaterialLineItem(item?: Partial<JobMaterial>): MaterialLineItem {
  return {
    id: crypto.randomUUID(),
    description: item?.description ?? "",
    quantity: item?.quantity ?? "1",
    unitPrice: item?.unitPrice ?? item?.price ?? "",
    price: item?.price ?? "",
  };
}

function formatMoney(value: string) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function LineItemsEditor({ items, onChange }: { items: LineItem[]; onChange: (items: LineItem[]) => void }) {
  return (
    <div
      className={
        "grid gap-4 pb-4 rounded-lg border border-sky-200/80 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20"
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
            className="grid grid-cols-[minmax(0,1fr)_3rem] gap-3 p-3 odd:py-0 even:bg-sky-100/80 sm:grid-cols-[minmax(0,1fr)_120px_auto]"
          >
            <div className="col-span-2 grid gap-2 sm:col-span-1">
              {index === 0 ? <Label>Description</Label> : null}
              <Input
                aria-label={`Labor} ${index + 1} description`}
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
            <div className="grid gap-2">
              {index === 0 ? <Label>Price</Label> : null}
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
                placeholder="0.00"
                className={mobileFieldClassName}
              />
            </div>
            <div className="flex justify-end items-end">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={items.length === 1}
                onClick={() => onChange(items.length === 1 ? items : items.filter((current) => current.id !== item.id))}
                aria-label={`Remove labor ${index + 1}`}
              >
                <Trash2 className="size-4 text-red-500" />
              </Button>
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
    <div className="grid gap-4 pb-4 rounded-lg border border-amber-200/80 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
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
        {items.map((item, index) => {
          const total = calculateMaterialTotal(item);

          return (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(3rem,0.6fr)_minmax(5rem,1fr)_minmax(3rem,0.6fr)_auto] items-end gap-3 p-3 odd:py-0 even:bg-amber-100/80 lg:grid-cols-[minmax(0,1fr)_60px_100px_75px_auto]"
            >
              <div className="col-span-4 grid gap-2 lg:pb-0 lg:col-span-1">
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
              <div className="grid gap-2">
                {index === 0 ? <Label>Qty</Label> : null}
                <Input
                  aria-label={`Material ${index + 1} quantity`}
                  value={item.quantity}
                  type="number"
                  min="1"
                  step="1"
                  onChange={(event) =>
                    onChange(
                      items.map((current, itemIndex) =>
                        itemIndex === index ? { ...current, quantity: event.target.value } : current,
                      ),
                    )
                  }
                  className={mobileFieldClassName}
                />
              </div>
              <div className="grid gap-2">
                {index === 0 ? <Label>Unit price</Label> : null}
                <Input
                  aria-label={`Material ${index + 1} unit price`}
                  value={item.unitPrice}
                  type="number"
                  min="0"
                  step="0.01"
                  onChange={(event) =>
                    onChange(
                      items.map((current, itemIndex) =>
                        itemIndex === index ? { ...current, unitPrice: event.target.value } : current,
                      ),
                    )
                  }
                  placeholder="0.00"
                  className={mobileFieldClassName}
                />
              </div>
              <div className="grid h-full rounded-md lg:bg-transparent lg:p-0">
                {index === 0 ? <Label className={"flex items-start"}>Total</Label> : null}
                <span className="flex items-center truncate font-medium text-xs tabular-nums sm:text-sm">
                  {formatMoney(total)}
                </span>
              </div>
              <div className={index === 0 ? "flex items-end justify-end" : "flex justify-end"}>
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
          );
        })}
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
      <input
        type="hidden"
        name="laborItems"
        value={stringifyPricingItems(laborItems.map(({ description, price }) => ({ description, price })))}
      />
      <input
        type="hidden"
        name="materials"
        value={stringifyMaterials(
          materials.map(({ description, quantity, unitPrice, price }) => ({ description, quantity, unitPrice, price })),
        )}
      />
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
