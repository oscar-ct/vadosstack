"use client";

import * as React from "react";

import { format, isSameDay, startOfMonth } from "date-fns";
import { enGB } from "date-fns/locale";
import {
  BadgeDollarSign,
  Building2,
  Calculator,
  CalendarDays,
  Check,
  ChevronsUpDown,
  ClipboardList,
  Home,
  MapPin,
  Package,
  Plus,
  ReceiptText,
  Ruler,
  Trash2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UsStateSelect } from "@/components/us-state-select";
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";

import type { JobCustomer } from "../../jobs/_components/jobs-table/schema";
import { type JobMaterial, stringifyMaterials } from "../../jobs/_components/materials";
import { type PricingLineItem, stringifyPricingItems } from "../../jobs/_components/pricing-items";
import { ServicePicker } from "../../services/_components/service-picker";
import type { ServiceTemplateRow } from "../../services/types";
import type { EstimateRecordRow } from "./schema";

const statuses = ["Draft", "Ready to Send", "Waiting on Customer", "Won", "Lost"] as const;
const categories = ["Repair", "Installation", "Other"] as const;
const newCustomerValue = "new-customer";
const customLocationValue = "custom-location";
const selectCustomerValue = "";
const mobileFieldClassName = "text-base md:text-sm bg-background/60";
const lineItemUnits = ["sq ft", "linear ft", "each", "hour"] as const;
const jobTypes = ["Residential", "Commercial"] as const;

type LineItem = PricingLineItem & {
  id: string;
};

type JobType = (typeof jobTypes)[number];

type MaterialLineItem = JobMaterial & {
  id: string;
};

type MeasurementRoom = {
  id: string;
  name: string;
  length: string;
  width: string;
};

type CustomLocationFields = {
  street: string;
  apt: string;
  city: string;
  state: string;
  zip: string;
};

type EstimateRecordDraft = {
  category: string;
  customLocationFields: CustomLocationFields;
  description: string;
  jobType: JobType;
  laborItems: LineItem[];
  materialTaxRate: number;
  materials: MaterialLineItem[];
  measurementRooms: MeasurementRoom[];
  measurementsOpen: boolean;
  newCustomerEmail: string;
  newCustomerName: string;
  newCustomerPhone: string;
  notes: string;
  savedAt: string;
  scheduledDate: string;
  selectedCustomerId: string;
  selectedLocation: string;
  status: string;
  title: string;
  version: 1;
};

export type LeadEstimatePrefill = {
  leadId: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  description: string;
  serviceLocation?: string;
  category?: string;
  notes?: string;
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

function createMeasurementRoom(item?: Partial<MeasurementRoom>, index = 0): MeasurementRoom {
  return {
    id: item?.id ?? crypto.randomUUID(),
    name: item?.name ?? `Area ${index + 1}`,
    length: item?.length ?? "",
    width: item?.width ?? "",
  };
}

function formatAddress(address: JobCustomer["addresses"][number]) {
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(", ");
  return [address.line1, address.line2, cityLine, address.country].filter(Boolean).join(", ");
}

function createCustomLocationFields(value?: string): CustomLocationFields {
  return {
    street: value ?? "",
    apt: "",
    city: "",
    state: "",
    zip: "",
  };
}

function formatCustomLocation(fields: CustomLocationFields) {
  return [fields.street, fields.apt, [fields.city, fields.state].filter(Boolean).join(", "), fields.zip]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
}

function parseEstimateDate(value?: string) {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return date;
}

function toDateValue(date?: Date) {
  if (!date) return "";

  return date.toISOString();
}

function parseDraftDate(value?: string) {
  return value ? parseEstimateDate(value) : undefined;
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return value.toFixed(2);
}

function formatMoneyInputValue(value: string) {
  if (!value.trim()) return "";

  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : value;
}

function formatSquareFeet(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDraftSavedAt(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function calculateRoomArea(room: Pick<MeasurementRoom, "length" | "width">) {
  const length = Number(room.length);
  const width = Number(room.width);
  const area = length * width;

  return Number.isFinite(area) && area > 0 ? area : 0;
}

function stringifyMeasurementRooms(rooms: MeasurementRoom[]) {
  return JSON.stringify(
    rooms.map((room) => ({
      id: room.id,
      name: room.name,
      length: room.length,
      width: room.width,
      area: calculateRoomArea(room).toFixed(2),
    })),
  );
}

function parseEstimateDraft(value: string): EstimateRecordDraft | null {
  try {
    const parsed = JSON.parse(value) as Partial<EstimateRecordDraft>;

    if (parsed.version !== 1) return null;

    return {
      category: parsed.category ?? "Other",
      customLocationFields: {
        street: parsed.customLocationFields?.street ?? "",
        apt: parsed.customLocationFields?.apt ?? "",
        city: parsed.customLocationFields?.city ?? "",
        state: parsed.customLocationFields?.state ?? "",
        zip: parsed.customLocationFields?.zip ?? "",
      },
      description: parsed.description ?? "",
      jobType: parsed.jobType === "Commercial" ? "Commercial" : "Residential",
      laborItems: parsed.laborItems?.length
        ? parsed.laborItems.map((item) => createLineItem(item))
        : [createLineItem()],
      materialTaxRate: Number.isFinite(Number(parsed.materialTaxRate)) ? Number(parsed.materialTaxRate) : 8.25,
      materials: parsed.materials?.length
        ? parsed.materials.map((item) => createMaterialLineItem(item))
        : [createMaterialLineItem()],
      measurementRooms: parsed.measurementRooms?.length
        ? parsed.measurementRooms.map((room, index) => createMeasurementRoom(room, index))
        : [createMeasurementRoom()],
      measurementsOpen: Boolean(parsed.measurementsOpen),
      newCustomerEmail: parsed.newCustomerEmail ?? "",
      newCustomerName: parsed.newCustomerName ?? "",
      newCustomerPhone: parsed.newCustomerPhone ?? "",
      notes: parsed.notes ?? "",
      savedAt: parsed.savedAt ?? new Date().toISOString(),
      scheduledDate: parsed.scheduledDate ?? "",
      selectedCustomerId: parsed.selectedCustomerId ?? selectCustomerValue,
      selectedLocation: parsed.selectedLocation ?? customLocationValue,
      status: statuses.includes(parsed.status as (typeof statuses)[number]) ? (parsed.status as string) : "Draft",
      title: parsed.title ?? "",
      version: 1,
    };
  } catch {
    return null;
  }
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

function ScheduledDatePicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value?: Date;
  onChange: (date: Date | undefined) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [currentMonth, setCurrentMonth] = React.useState(() => startOfMonth(value ?? new Date()));

  React.useEffect(() => {
    if (value) {
      setCurrentMonth(startOfMonth(value));
    }
  }, [value]);

  function handleSelect(date: Date | undefined) {
    if (!date) {
      onChange(undefined);
      return;
    }

    if (value && isSameDay(value, date)) {
      onChange(undefined);
      return;
    }

    onChange(date);
    setOpen(false);
  }

  function clearDate() {
    onChange(undefined);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={`w-full justify-start gap-2 text-left font-normal ${mobileFieldClassName}`}
        >
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="truncate text-muted-foreground">
            {value ? format(value, "MMM d, yyyy") : "Select date (optional)"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto overflow-hidden p-0">
        <div className="p-3">
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleSelect}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            fixedWeeks
            locale={enGB}
            className="w-full p-0"
          />
        </div>
        {value ? (
          <div className="border-t p-2">
            <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={clearDate}>
              <X className="size-4" />
              Clear date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function LineItemsEditor({ items, onChange }: { items: LineItem[]; onChange: (items: LineItem[]) => void }) {
  return (
    <div className="grid min-w-0 gap-3">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-2">
        <div className="grid min-w-0 gap-1">
          <Label className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md border border-emerald-600 bg-background">
              <Wrench className="size-4 text-emerald-600" />
            </span>
            Labor
          </Label>
          <p className="text-muted-foreground text-xs">Add optional labor line items for this estimate.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onChange([createLineItem(), ...items])}>
            <Plus />
            Add labor
          </Button>
        </div>
      </div>
      <div className="min-w-0 overflow-hidden rounded-lg border bg-background">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="grid min-w-0 grid-cols-2 gap-3 border-t p-3 first:border-t-0 odd:bg-emerald-50/50 sm:grid-cols-4 lg:grid-cols-[36px_minmax(0,1fr)] lg:gap-x-3 xl:grid-cols-[36px_minmax(0,1fr)_72px_88px_88px_96px_36px] xl:items-end xl:gap-2 dark:odd:bg-emerald-900"
          >
            <div className="col-span-2 flex items-center justify-between sm:col-span-4 lg:col-span-1 lg:block lg:pt-7 xl:self-end xl:pt-0 xl:pb-1">
              <span className="inline-flex size-7 items-center justify-center rounded-md border border-emerald-600 bg-background font-medium text-emerald-600 text-xs">
                L{index + 1}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={items.length === 1}
                onClick={() => onChange(items.length === 1 ? items : items.filter((current) => current.id !== item.id))}
                aria-label={`Remove labor ${index + 1}`}
                className="lg:hidden"
              >
                <Trash2 className="size-4 text-red-500" />
              </Button>
            </div>

            <div className="col-span-2 grid min-w-0 gap-3 sm:col-span-4 lg:col-span-1 xl:contents">
              <div className="grid min-w-0 gap-2 xl:col-span-1">
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
                  placeholder="Labor description"
                  rows={1}
                  className={`h-8 min-h-8 resize-y overflow-hidden bg-background px-3 py-1.25 leading-6 ${mobileFieldClassName}`}
                />
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-[72px_88px_88px_96px_36px] lg:items-end lg:gap-2 xl:contents">
                <div className="grid min-w-0 gap-2">
                  <Label>Qty</Label>
                  <Input
                    aria-label={`Labor ${index + 1} quantity`}
                    value={item.quantity ?? ""}
                    type="number"
                    min="0"
                    step="1"
                    onChange={(event) =>
                      onChange(
                        items.map((current, itemIndex) =>
                          itemIndex === index
                            ? updateCalculatedLineTotal({ ...current, quantity: event.target.value })
                            : current,
                        ),
                      )
                    }
                    className={`min-w-0 bg-background ${mobileFieldClassName}`}
                  />
                </div>

                <div className="grid w-full min-w-0 gap-2">
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
                      aria-label={`Labor ${index + 1} unit`}
                      className={`w-full min-w-0 bg-background ${mobileFieldClassName}`}
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
                    className={`min-w-0 bg-background ${mobileFieldClassName}`}
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
                    className={`min-w-0 bg-background ${mobileFieldClassName}`}
                  />
                </div>

                <div className="hidden justify-end lg:flex">
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
    <div className="grid min-w-0 gap-3">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-2">
        <div className="grid min-w-0 gap-1">
          <Label className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md border border-amber-600 bg-background">
              <Package className="size-4 text-amber-600" />
            </span>
            Materials
          </Label>
          <p className="text-muted-foreground text-xs">Add optional material quantities and unit prices.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onChange([createMaterialLineItem(), ...items])}>
            <Plus />
            Add material
          </Button>
        </div>
      </div>
      <div className="min-w-0 overflow-hidden rounded-lg border bg-background">
        {items.map((item, index) => {
          return (
            <div
              key={item.id}
              className="grid min-w-0 grid-cols-2 gap-3 border-t p-3 first:border-t-0 odd:bg-amber-50/50 sm:grid-cols-4 lg:grid-cols-[36px_minmax(0,1fr)] lg:gap-x-3 xl:grid-cols-[36px_minmax(0,1fr)_72px_88px_88px_96px_36px] xl:items-end xl:gap-2 dark:odd:bg-amber-900"
            >
              <div className="col-span-2 flex items-center justify-between sm:col-span-4 lg:col-span-1 lg:block lg:pt-7 xl:self-end xl:pt-0 xl:pb-1">
                <span className="inline-flex size-7 items-center justify-center rounded-md border border-amber-600 bg-background font-medium text-amber-600 text-xs">
                  M{index + 1}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={items.length === 1}
                  onClick={() =>
                    onChange(items.length === 1 ? items : items.filter((current) => current.id !== item.id))
                  }
                  aria-label={`Remove material ${index + 1}`}
                  className="lg:hidden"
                >
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>

              <div className="col-span-2 grid min-w-0 gap-3 sm:col-span-4 lg:col-span-1 xl:contents">
                <div className="grid min-w-0 gap-2 xl:col-span-1">
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
                    className={`h-8 min-h-8 resize-y overflow-hidden bg-background px-3 py-1.25 leading-6 ${mobileFieldClassName}`}
                  />
                </div>

                <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-[72px_88px_88px_96px_36px] lg:items-end lg:gap-2 xl:contents">
                  <div className="grid min-w-0 gap-2">
                    <Label>Qty</Label>
                    <Input
                      aria-label={`Material ${index + 1} quantity`}
                      value={item.quantity}
                      type="number"
                      min="0"
                      step="1"
                      onChange={(event) =>
                        onChange(
                          items.map((current, itemIndex) =>
                            itemIndex === index
                              ? updateCalculatedLineTotal({ ...current, quantity: event.target.value })
                              : current,
                          ),
                        )
                      }
                      className={`min-w-0 bg-background ${mobileFieldClassName}`}
                    />
                  </div>

                  <div className="grid w-full min-w-0 gap-2">
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
                        className={`w-full min-w-0 bg-background ${mobileFieldClassName}`}
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
                      className={`min-w-0 bg-background ${mobileFieldClassName}`}
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
                      className={`min-w-0 bg-background ${mobileFieldClassName}`}
                    />
                  </div>

                  <div className="hidden justify-end lg:flex">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MeasurementRoomsEditor({
  rooms,
  onChange,
}: {
  rooms: MeasurementRoom[];
  onChange: (rooms: MeasurementRoom[]) => void;
}) {
  const measuredRooms = rooms.filter((room) => calculateRoomArea(room) > 0);
  const totalSqft = rooms.reduce((total, room) => total + calculateRoomArea(room), 0);

  return (
    <div className="grid gap-3 p-3">
      <div className="flex items-end justify-between gap-3">
        <div className="grid gap-1">
          Building measurements
          <p className="text-muted-foreground text-xs">Track areas once, then use the total for sqft pricing.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => onChange([...rooms, createMeasurementRoom({}, rooms.length)])}
        >
          <Plus />
          Add area
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg bg-background md:border">
        <div className="hidden border-b bg-muted/30 px-2 py-2 font-medium text-muted-foreground text-xs md:grid md:grid-cols-[minmax(120px,1fr)_minmax(82px,0.55fr)_minmax(82px,0.55fr)_minmax(76px,0.5fr)_32px] md:gap-2">
          <span>Space area</span>
          <span>Length</span>
          <span>Width</span>
          <span className="text-right">Sq ft</span>
          <span />
        </div>
        {rooms.map((room, index) => {
          const area = calculateRoomArea(room);

          return (
            <div
              key={room.id}
              className="grid grid-cols-2 gap-4 border-t py-4 first:border-t-0 md:grid-cols-[minmax(120px,1fr)_minmax(82px,0.55fr)_minmax(82px,0.55fr)_minmax(76px,0.5fr)_32px] md:items-end md:gap-2 md:p-2"
            >
              <div className="col-span-2 grid gap-2 md:col-span-1">
                <Label className="md:hidden">Space area</Label>
                <Input
                  aria-label={`Area ${index + 1} name`}
                  value={room.name}
                  onChange={(event) =>
                    onChange(
                      rooms.map((current) =>
                        current.id === room.id ? { ...current, name: event.target.value } : current,
                      ),
                    )
                  }
                  placeholder={`Area ${index + 1}`}
                  className={"border-none bg-muted/60 text-base md:text-sm"}
                />
              </div>
              <div className="grid gap-2">
                <Label className="md:hidden">Length</Label>
                <Input
                  aria-label={`${room.name || `Area ${index + 1}`} length`}
                  value={room.length}
                  type="number"
                  min="0"
                  step="0.01"
                  onChange={(event) =>
                    onChange(
                      rooms.map((current) =>
                        current.id === room.id ? { ...current, length: event.target.value } : current,
                      ),
                    )
                  }
                  placeholder="0"
                  className={"border-none bg-muted/60 text-base md:text-sm"}
                />
              </div>
              <div className="grid gap-2">
                <Label className="md:hidden">Width</Label>
                <Input
                  aria-label={`${room.name || `Area ${index + 1}`} width`}
                  value={room.width}
                  type="number"
                  min="0"
                  step="0.01"
                  onChange={(event) =>
                    onChange(
                      rooms.map((current) =>
                        current.id === room.id ? { ...current, width: event.target.value } : current,
                      ),
                    )
                  }
                  placeholder="0"
                  className={"border-none bg-muted/60 text-base md:text-sm"}
                />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md bg-muted/35 px-2 py-2 text-sm md:justify-end md:bg-transparent md:px-0 md:py-0">
                <span className="text-muted-foreground md:hidden">Sq ft</span>
                <span className="font-medium tabular-nums">{formatSquareFeet(area)}</span>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={rooms.length === 1}
                  onClick={() =>
                    onChange(rooms.length === 1 ? rooms : rooms.filter((current) => current.id !== room.id))
                  }
                  aria-label={`Remove ${room.name || `area ${index + 1}`}`}
                >
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg bg-background px-3">
        <div className="text-muted-foreground text-xs">
          Areas measured
          <div className="font-semibold text-foreground text-lg tabular-nums">{measuredRooms.length}</div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground text-xs">Building total</div>
          <div className="font-semibold text-2xl tabular-nums">{formatSquareFeet(totalSqft)} sq ft</div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceSectionHeader({
  description,
  icon: Icon,
  step,
}: {
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  step: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-lg leading-tight">{step}</div>
        <p className="mt-1 text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
}

export function EstimateRecordFormFields({
  clearDraft = false,
  customers,
  draftKey,
  estimate,
  leadPrefill,
  presentation = "modal",
  resetKey = 0,
  services,
}: {
  clearDraft?: boolean;
  customers: JobCustomer[];
  draftKey?: string;
  estimate?: EstimateRecordRow;
  leadPrefill?: LeadEstimatePrefill;
  presentation?: "modal" | "workspace";
  resetKey?: number;
  services: ServiceTemplateRow[];
}) {
  const [customerPickerOpen, setCustomerPickerOpen] = React.useState(false);
  const [title, setTitle] = React.useState(estimate?.description ?? leadPrefill?.description ?? "");
  const [description, setDescription] = React.useState(estimate?.scope ?? leadPrefill?.notes ?? "");
  const [category, setCategory] = React.useState(
    estimate?.category ??
      (categories.includes(leadPrefill?.category as (typeof categories)[number]) ? leadPrefill?.category : "Other") ??
      "Other",
  );
  const [status, setStatus] = React.useState(estimate?.status ?? "Draft");
  const [scheduledDate, setScheduledDate] = React.useState<Date | undefined>(() =>
    parseEstimateDate(estimate?.dateBegin),
  );
  const [notes, setNotes] = React.useState(estimate?.notes ?? "");
  const [newCustomerName, setNewCustomerName] = React.useState(
    leadPrefill?.customerId ? "" : (leadPrefill?.customerName ?? ""),
  );
  const [newCustomerEmail, setNewCustomerEmail] = React.useState(
    leadPrefill?.customerId ? "" : (leadPrefill?.customerEmail ?? ""),
  );
  const [newCustomerPhone, setNewCustomerPhone] = React.useState(
    leadPrefill?.customerId ? "" : (leadPrefill?.customerPhone ?? ""),
  );
  const [selectedCustomerId, setSelectedCustomerId] = React.useState(
    estimate?.customerId ?? leadPrefill?.customerId ?? (leadPrefill ? newCustomerValue : selectCustomerValue),
  );
  const [laborItems, setLaborItems] = React.useState<LineItem[]>(
    estimate?.laborItems.length ? estimate.laborItems.map((item) => createLineItem(item)) : [createLineItem()],
  );
  const [materials, setMaterials] = React.useState<MaterialLineItem[]>(
    estimate?.materials.length
      ? estimate.materials.map((item) => createMaterialLineItem(item))
      : [createMaterialLineItem()],
  );
  const [jobType, setJobType] = React.useState<JobType>(estimate?.jobType ?? "Residential");
  const [measurementRooms, setMeasurementRooms] = React.useState<MeasurementRoom[]>(
    estimate?.measurementRooms.length
      ? estimate.measurementRooms.map((room, index) => createMeasurementRoom(room, index))
      : [createMeasurementRoom()],
  );
  const [measurementsOpen, setMeasurementsOpen] = React.useState(() => Boolean(estimate?.measurementRooms.length));
  const [taxRate, setTaxRate] = React.useState(Number(estimate?.materialTaxRate ?? "8.25"));
  const isCreatingNewCustomer = selectedCustomerId === newCustomerValue;
  const selectedCustomer = isCreatingNewCustomer
    ? undefined
    : customers.find((customer) => customer.id === selectedCustomerId);
  const addressOptions = selectedCustomer?.addresses ?? [];
  const initialLocation = estimate?.serviceLocation ?? leadPrefill?.serviceLocation ?? "";
  const hasSavedInitialLocation = addressOptions.some((address) => formatAddress(address) === initialLocation);
  const [selectedLocation, setSelectedLocation] = React.useState(
    hasSavedInitialLocation && initialLocation ? initialLocation : customLocationValue,
  );
  const [customLocationFields, setCustomLocationFields] = React.useState(() =>
    createCustomLocationFields(hasSavedInitialLocation ? "" : initialLocation),
  );
  const serviceLocation =
    selectedLocation === customLocationValue ? formatCustomLocation(customLocationFields) : selectedLocation;
  const initializedFromKeyRef = React.useRef(`${resetKey}:${estimate?.id ?? "new"}`);
  const draftHydratedRef = React.useRef(false);
  const skipNextDraftSaveRef = React.useRef(true);
  const latestDraftJsonRef = React.useRef<string | undefined>(undefined);
  const suppressDraftFlushRef = React.useRef(false);
  const [draftSavedAt, setDraftSavedAt] = React.useState<string>();
  const [draftRestoredAt, setDraftRestoredAt] = React.useState<string>();

  const resetToEstimate = React.useCallback(() => {
    const nextSelectedCustomerId =
      estimate?.customerId ?? leadPrefill?.customerId ?? (leadPrefill ? newCustomerValue : selectCustomerValue);
    const nextCustomer = customers.find((customer) => customer.id === nextSelectedCustomerId);
    const nextAddressOptions = nextCustomer?.addresses ?? [];
    const nextInitialLocation = estimate?.serviceLocation ?? "";
    const nextHasSavedInitialLocation = nextAddressOptions.some(
      (address) => formatAddress(address) === nextInitialLocation,
    );

    setSelectedCustomerId(nextSelectedCustomerId);
    setLaborItems(
      estimate?.laborItems.length ? estimate.laborItems.map((item) => createLineItem(item)) : [createLineItem()],
    );
    setMaterials(
      estimate?.materials.length
        ? estimate.materials.map((item) => createMaterialLineItem(item))
        : [createMaterialLineItem()],
    );
    setTitle(estimate?.description ?? leadPrefill?.description ?? "");
    setDescription(estimate?.scope ?? leadPrefill?.notes ?? "");
    setCategory(
      estimate?.category ??
        (categories.includes(leadPrefill?.category as (typeof categories)[number]) ? leadPrefill?.category : "Other") ??
        "Other",
    );
    setStatus(estimate?.status ?? "Draft");
    setScheduledDate(parseEstimateDate(estimate?.dateBegin));
    setNotes(estimate?.notes ?? "");
    setNewCustomerName(leadPrefill?.customerId ? "" : (leadPrefill?.customerName ?? ""));
    setNewCustomerEmail(leadPrefill?.customerId ? "" : (leadPrefill?.customerEmail ?? ""));
    setNewCustomerPhone(leadPrefill?.customerId ? "" : (leadPrefill?.customerPhone ?? ""));
    setJobType(estimate?.jobType ?? "Residential");
    setMeasurementRooms(
      estimate?.measurementRooms.length
        ? estimate.measurementRooms.map((room, index) => createMeasurementRoom(room, index))
        : [createMeasurementRoom()],
    );
    setMeasurementsOpen(false);
    setTaxRate(Number(estimate?.materialTaxRate ?? "8.25"));
    setSelectedLocation(nextHasSavedInitialLocation && nextInitialLocation ? nextInitialLocation : customLocationValue);
    setCustomLocationFields(createCustomLocationFields(nextHasSavedInitialLocation ? "" : nextInitialLocation));
  }, [customers, estimate, leadPrefill]);

  React.useEffect(() => {
    const initializedFromKey = `${resetKey}:${estimate?.id ?? "new"}`;
    if (initializedFromKeyRef.current === initializedFromKey) {
      return;
    }
    initializedFromKeyRef.current = initializedFromKey;

    resetToEstimate();
  }, [estimate, resetKey, resetToEstimate]);

  React.useEffect(() => {
    if (!draftKey || typeof window === "undefined") return;

    const draft = window.localStorage.getItem(draftKey);
    if (!draft) {
      draftHydratedRef.current = true;
      skipNextDraftSaveRef.current = true;
      return;
    }

    const parsed = parseEstimateDraft(draft);
    if (!parsed) {
      window.localStorage.removeItem(draftKey);
      draftHydratedRef.current = true;
      skipNextDraftSaveRef.current = true;
      return;
    }

    setSelectedCustomerId(parsed.selectedCustomerId);
    setLaborItems(parsed.laborItems);
    setMaterials(parsed.materials);
    setTitle(parsed.title);
    setDescription(parsed.description);
    setCategory(parsed.category);
    setStatus(parsed.status);
    setScheduledDate(parseDraftDate(parsed.scheduledDate));
    setNotes(parsed.notes);
    setNewCustomerName(parsed.newCustomerName);
    setNewCustomerEmail(parsed.newCustomerEmail);
    setNewCustomerPhone(parsed.newCustomerPhone);
    setJobType(parsed.jobType);
    setMeasurementRooms(parsed.measurementRooms);
    setMeasurementsOpen(parsed.measurementsOpen);
    setTaxRate(parsed.materialTaxRate);
    setSelectedLocation(parsed.selectedLocation);
    setCustomLocationFields(parsed.customLocationFields);
    setDraftSavedAt(parsed.savedAt);
    setDraftRestoredAt(parsed.savedAt);

    draftHydratedRef.current = true;
    skipNextDraftSaveRef.current = true;
  }, [draftKey]);

  React.useEffect(() => {
    if (!clearDraft || !draftKey || typeof window === "undefined") return;

    suppressDraftFlushRef.current = true;
    latestDraftJsonRef.current = undefined;
    window.localStorage.removeItem(draftKey);
    setDraftSavedAt(undefined);
    setDraftRestoredAt(undefined);
  }, [clearDraft, draftKey]);

  React.useEffect(() => {
    if (isCreatingNewCustomer || !addressOptions.length) {
      setSelectedLocation(customLocationValue);
      return;
    }

    if (
      selectedLocation !== customLocationValue &&
      !addressOptions.some((address) => formatAddress(address) === selectedLocation)
    ) {
      setSelectedLocation(formatAddress(addressOptions[0]));
      setCustomLocationFields(createCustomLocationFields());
    }
  }, [addressOptions, isCreatingNewCustomer, selectedLocation]);

  React.useEffect(() => {
    if (!draftKey || clearDraft || typeof window === "undefined" || !draftHydratedRef.current) return;

    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }

    const savedAt = new Date().toISOString();
    const draft: EstimateRecordDraft = {
      category,
      customLocationFields,
      description,
      jobType,
      laborItems,
      materialTaxRate: taxRate,
      materials,
      measurementRooms,
      measurementsOpen,
      newCustomerEmail,
      newCustomerName,
      newCustomerPhone,
      notes,
      savedAt,
      scheduledDate: toDateValue(scheduledDate),
      selectedCustomerId,
      selectedLocation,
      status,
      title,
      version: 1,
    };
    const draftJson = JSON.stringify(draft);
    latestDraftJsonRef.current = draftJson;

    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, draftJson);
      setDraftSavedAt(savedAt);
      setDraftRestoredAt(undefined);
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [
    category,
    clearDraft,
    customLocationFields,
    description,
    draftKey,
    jobType,
    laborItems,
    materials,
    measurementRooms,
    measurementsOpen,
    newCustomerEmail,
    newCustomerName,
    newCustomerPhone,
    notes,
    scheduledDate,
    selectedCustomerId,
    selectedLocation,
    status,
    taxRate,
    title,
  ]);

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

  const selectedCustomerLabel = React.useMemo(() => {
    if (isCreatingNewCustomer) return "New customer";

    return customers.find((customer) => customer.id === selectedCustomerId)?.name ?? "Select customer";
  }, [customers, isCreatingNewCustomer, selectedCustomerId]);
  const laborSubtotal = laborItems.reduce((total, item) => total + toNumber(item.price), 0);
  const materialsSubtotal = materials.reduce((total, item) => total + toNumber(item.price), 0);
  const taxableSubtotal = materialsSubtotal + (jobType === "Commercial" ? laborSubtotal : 0);
  const tax = taxableSubtotal * (taxRate / 100);
  const total = laborSubtotal + materialsSubtotal + tax;
  const measurementTotalSqft = measurementRooms.reduce((sum, room) => sum + calculateRoomArea(room), 0);
  const measuredAreaCount = measurementRooms.filter((room) => calculateRoomArea(room) > 0).length;

  function applyService(service: ServiceTemplateRow) {
    setTitle(service.title);
    setDescription(service.description ?? "");
    setCategory(categories.includes(service.category as (typeof categories)[number]) ? service.category : "Other");
    setNotes(service.notes ?? "");
    setLaborItems(
      service.laborItems.length ? service.laborItems.map((item) => createLineItem(item)) : [createLineItem()],
    );
    setMaterials(
      service.materials.length
        ? service.materials.map((item) => createMaterialLineItem(item))
        : [createMaterialLineItem()],
    );
  }

  function discardDraft() {
    if (!draftKey || typeof window === "undefined") return;

    window.localStorage.removeItem(draftKey);
    latestDraftJsonRef.current = undefined;
    skipNextDraftSaveRef.current = true;
    setDraftSavedAt(undefined);
    setDraftRestoredAt(undefined);
    resetToEstimate();
  }

  if (presentation === "workspace") {
    return (
      <div className="grid gap-0 md:gap-2">
        <input type="hidden" name="customerId" value={isCreatingNewCustomer ? "" : selectedCustomerId} />
        {leadPrefill ? <input type="hidden" name="leadId" value={leadPrefill.leadId} /> : null}
        <input type="hidden" name="serviceLocation" value={serviceLocation} />
        <input type="hidden" name="dateBegin" value={toDateValue(scheduledDate)} />
        <input type="hidden" name="dateEnd" value="" />
        <input type="hidden" name="laborItems" value={stringifyPricingItems(laborItems)} />
        <input type="hidden" name="materials" value={stringifyMaterials(materials)} />
        <input type="hidden" name="jobType" value={jobType} />
        <input type="hidden" name="measurementRooms" value={stringifyMeasurementRooms(measurementRooms)} />
        <input type="hidden" name="materialTaxRate" value={taxRate.toFixed(2)} />
        <input type="hidden" name="status" value={status} />
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
                <span>Autosave is on locally for this estimate.</span>
              )}
            </div>
            {draftRestoredAt || draftSavedAt ? (
              <Button type="button" variant="outline" size="sm" className="h-7 bg-background" onClick={discardDraft}>
                Discard local draft
              </Button>
            ) : null}
          </div>
        ) : null}

        <section className="grid gap-4 border-b px-0 py-5 md:gap-5 md:px-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <WorkspaceSectionHeader
              description="Start with the job story. This is the part your team scans first."
              icon={ClipboardList}
              step="1. Scope and customer"
            />
            {services.length ? <ServicePicker services={services} onApply={applyService} /> : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor={`estimate-title-${estimate?.id ?? "new"}`}>Estimate title</Label>
                <Input
                  id={`estimate-title-${estimate?.id ?? "new"}`}
                  name="description"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Water heater replacement"
                  className="h-8 bg-background text-base md:text-sm"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`estimate-description-${estimate?.id ?? "new"}`}>Scope of work</Label>
                <Textarea
                  id={`estimate-description-${estimate?.id ?? "new"}`}
                  name="scope"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe the requested work..."
                  className="min-h-18 bg-background text-base md:text-sm"
                />
              </div>
            </div>

            <div className="grid content-start gap-3 py-3 md:p-4 md:pt-0">
              <div className="flex items-center gap-2 font-medium text-sm">
                <UserRound className="size-4 text-muted-foreground" />
                Customer
              </div>
              <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerPickerOpen}
                    className="h-8 w-full justify-between bg-background font-normal"
                  >
                    <span className="truncate">{selectedCustomerLabel}</span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Search customers..." />
                    <CommandList>
                      <CommandEmpty>No customers found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="New customer"
                          onSelect={() => {
                            setSelectedCustomerId(newCustomerValue);
                            setSelectedLocation(customLocationValue);
                            setCustomerPickerOpen(false);
                          }}
                        >
                          <Check className={cn("size-4", isCreatingNewCustomer ? "opacity-100" : "opacity-0")} />
                          New customer
                        </CommandItem>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.name}
                            onSelect={() => {
                              setSelectedCustomerId(customer.id);
                              if (customer.addresses.length) {
                                setSelectedLocation(formatAddress(customer.addresses[0]));
                                setCustomLocationFields(createCustomLocationFields());
                              } else {
                                setSelectedLocation(customLocationValue);
                              }
                              setCustomerPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn("size-4", selectedCustomerId === customer.id ? "opacity-100" : "opacity-0")}
                            />
                            {customer.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-muted-foreground text-xs">
                Choose an existing customer or create one while building the estimate.
              </p>
            </div>
          </div>

          {isCreatingNewCustomer ? (
            <div className="grid gap-4 rounded-lg py-4 sm:grid-cols-3">
              <div className="grid gap-1 sm:col-span-3">
                <Label>New customer</Label>
                <p className="text-muted-foreground text-xs">
                  Name, email, and phone are <span className={"pl-0.25 font-semibold"}>required</span>
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`estimate-new-customer-name-${estimate?.id ?? "new"}`}>Name</Label>
                <Input
                  id={`estimate-new-customer-name-${estimate?.id ?? "new"}`}
                  name="newCustomerName"
                  value={newCustomerName}
                  onChange={(event) => setNewCustomerName(event.target.value)}
                  placeholder="Jane Smith"
                  className="bg-background"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`estimate-new-customer-email-${estimate?.id ?? "new"}`}>Email</Label>
                <Input
                  id={`estimate-new-customer-email-${estimate?.id ?? "new"}`}
                  name="newCustomerEmail"
                  type="email"
                  value={newCustomerEmail}
                  onChange={(event) => setNewCustomerEmail(event.target.value)}
                  placeholder="customer@example.com"
                  className="bg-background"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`estimate-new-customer-phone-${estimate?.id ?? "new"}`}>Phone</Label>
                <Input
                  id={`estimate-new-customer-phone-${estimate?.id ?? "new"}`}
                  name="newCustomerPhone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={12}
                  value={formatPhoneNumber(newCustomerPhone)}
                  onChange={(event) => setNewCustomerPhone(normalizePhoneNumber(event.target.value).slice(0, 10))}
                  placeholder="(555) 555-1234"
                  className="bg-background"
                  required
                />
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 border-b px-0 py-5 md:gap-5 md:px-1">
          <WorkspaceSectionHeader
            description="Set how this estimate should move through the pipeline and when the work is expected."
            icon={ReceiptText}
            step="2. Status, category, and schedule"
          />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
            <div className="grid gap-3">
              <Label>Status</Label>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {statuses.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatus(option)}
                    className={cn(
                      "grid min-h-20 gap-1 rounded-lg border bg-background p-3 text-left shadow-sm transition-colors",
                      status === option && "border-primary bg-primary/5 ring-1 ring-primary/30",
                    )}
                  >
                    <span className="flex items-center gap-2 font-medium text-sm">
                      <span
                        className={cn(
                          "size-3 rounded-full border",
                          status === option ? "border-primary bg-primary" : "border-muted-foreground/40",
                        )}
                      />
                      {option}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {option === "Draft"
                        ? "Still shaping the estimate."
                        : option === "Ready to Send"
                          ? "Ready for the customer."
                          : option === "Waiting on Customer"
                            ? "Sent or being reviewed."
                            : option === "Won"
                              ? "Approved and ready for job conversion."
                              : "Closed without moving forward."}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid content-start gap-4 py-3 md:p-4 md:pt-0">
              <div className="grid gap-2">
                <Label htmlFor={`estimate-category-${estimate?.id ?? "new"}`}>Category</Label>
                <Select name="category" value={category} onValueChange={setCategory} required>
                  <SelectTrigger
                    id={`estimate-category-${estimate?.id ?? "new"}`}
                    className="h-11 w-full bg-background"
                  >
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
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
              <div className="grid gap-2">
                <Label htmlFor={`estimate-scheduled-date-${estimate?.id ?? "new"}`}>Scheduled date</Label>
                <ScheduledDatePicker
                  id={`estimate-scheduled-date-${estimate?.id ?? "new"}`}
                  value={scheduledDate}
                  onChange={setScheduledDate}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-b px-0 py-5 md:gap-5 md:px-1">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)] lg:items-start">
            <div className="grid gap-4">
              <WorkspaceSectionHeader
                description="A clean service address makes the handoff to jobs, invoices, and field work easier."
                icon={MapPin}
                step="3. Service location and notes"
              />
              <div className="grid gap-3">
                {addressOptions.length ? (
                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger
                      id={`estimate-location-${estimate?.id ?? "new"}`}
                      className="h-11 w-full min-w-0 overflow-hidden bg-background [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
                    >
                      <SelectValue placeholder="Select service location" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[calc(100vw-2rem)]">
                      <SelectGroup>
                        {addressOptions.map((address) => {
                          const value = formatAddress(address);
                          return (
                            <SelectItem key={address.id} value={value} className="max-w-[calc(100vw-2rem)]">
                              <span className="block truncate">
                                {address.label ? `${address.label}: ${value}` : value}
                              </span>
                            </SelectItem>
                          );
                        })}
                        <SelectItem value={customLocationValue}>Custom location</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : null}
                {!addressOptions.length || selectedLocation === customLocationValue ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 grid gap-2">
                      <Label htmlFor={`estimate-location-street-${estimate?.id ?? "new"}`}>Street address</Label>
                      <Input
                        id={`estimate-location-street-${estimate?.id ?? "new"}`}
                        value={customLocationFields.street}
                        onChange={(event) =>
                          setCustomLocationFields((current) => ({ ...current, street: event.target.value }))
                        }
                        placeholder="123 Main St"
                        className="bg-background"
                      />
                    </div>
                    <div className="col-span-2 grid gap-2 sm:col-span-1">
                      <Label htmlFor={`estimate-location-apt-${estimate?.id ?? "new"}`}>Apt, suite, unit</Label>
                      <Input
                        id={`estimate-location-apt-${estimate?.id ?? "new"}`}
                        value={customLocationFields.apt}
                        onChange={(event) =>
                          setCustomLocationFields((current) => ({ ...current, apt: event.target.value }))
                        }
                        placeholder="Unit B"
                        className="bg-background"
                      />
                    </div>
                    <div className="grid min-w-0 gap-2">
                      <Label htmlFor={`estimate-location-city-${estimate?.id ?? "new"}`}>City</Label>
                      <Input
                        id={`estimate-location-city-${estimate?.id ?? "new"}`}
                        value={customLocationFields.city}
                        onChange={(event) =>
                          setCustomLocationFields((current) => ({ ...current, city: event.target.value }))
                        }
                        placeholder="Houston"
                        className="bg-background"
                      />
                    </div>
                    <div className="grid min-w-0 gap-2">
                      <Label htmlFor={`estimate-location-state-${estimate?.id ?? "new"}`}>State</Label>
                      <UsStateSelect
                        id={`estimate-location-state-${estimate?.id ?? "new"}`}
                        value={customLocationFields.state}
                        onChange={(event) =>
                          setCustomLocationFields((current) => ({ ...current, state: event.target.value }))
                        }
                        className="bg-background"
                      />
                    </div>
                    <div className="col-span-2 grid gap-2 sm:col-span-1">
                      <Label htmlFor={`estimate-location-zip-${estimate?.id ?? "new"}`}>Zip code</Label>
                      <Input
                        id={`estimate-location-zip-${estimate?.id ?? "new"}`}
                        value={customLocationFields.zip}
                        onChange={(event) =>
                          setCustomLocationFields((current) => ({ ...current, zip: event.target.value }))
                        }
                        placeholder="77001"
                        className="bg-background"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 py-3 md:p-4 md:pt-0">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Home className="size-4 text-muted-foreground" />
                Internal notes
              </div>
              <Textarea
                id={`estimate-notes-${estimate?.id ?? "new"}`}
                name="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional team notes..."
                className="min-h-24 bg-background text-base md:min-h-28 md:text-sm"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-b px-0 py-5 md:gap-5 md:px-1">
          <WorkspaceSectionHeader
            description="Set the tax basis before pricing labor and materials."
            icon={Building2}
            step="4. Job type"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {jobTypes.map((option) => {
              const selected = jobType === option;
              const isCommercial = option === "Commercial";

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setJobType(option)}
                  className={cn(
                    "grid gap-2 rounded-lg border bg-background p-4 text-left shadow-sm transition-colors",
                    selected && "border-primary bg-primary/5 ring-1 ring-primary/30",
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-medium">{option}</span>
                    <span
                      className={cn(
                        "flex size-3 items-center justify-center rounded-full border",
                        selected ? "border-primary bg-primary" : "border-muted-foreground/40",
                      )}
                    >
                      <span className={cn("size-2 rounded-full", selected && "bg-primary")} />
                    </span>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {isCommercial ? "Labor and materials are taxable." : "Materials are taxable. Labor is not."}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 px-0 py-5 md:gap-5 md:px-1">
          <WorkspaceSectionHeader
            description="Build the estimate from actual labor and material pieces, then review tax and totals."
            icon={BadgeDollarSign}
            step="5. Labor, materials, and tax"
          />
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="grid gap-4">
              <div className="grid gap-3 py-4">
                <button
                  type="button"
                  aria-expanded={measurementsOpen}
                  onClick={() => setMeasurementsOpen((current) => !current)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border bg-background p-3 text-left shadow-sm transition-colors md:py-3",
                    measurementsOpen && "border-primary bg-primary/5 ring-1 ring-primary/30",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/80">
                      <Ruler className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {measurementsOpen
                          ? "Hide measurements"
                          : measuredAreaCount
                            ? "View measurements"
                            : "Add measurements"}
                      </span>
                      <span className="block truncate text-muted-foreground text-xs">
                        {measuredAreaCount
                          ? `${measuredAreaCount} ${measuredAreaCount === 1 ? "area" : "areas"} · ${formatSquareFeet(
                              measurementTotalSqft,
                            )} sq ft`
                          : "Optional sqft helper for labor and materials"}
                      </span>
                    </span>
                  </span>
                  <Plus className={cn("size-4 shrink-0 transition-transform", measurementsOpen && "rotate-45")} />
                </button>

                {measurementsOpen ? (
                  <MeasurementRoomsEditor rooms={measurementRooms} onChange={setMeasurementRooms} />
                ) : null}
              </div>

              <LineItemsEditor items={laborItems} onChange={setLaborItems} />
              <MaterialItemsEditor items={materials} onChange={setMaterials} />
            </div>

            <div className="grid content-start gap-4 rounded-lg border border-sky-200 bg-sky-50/70 p-3 md:w-full md:max-w-sm md:justify-self-end md:p-4 xl:sticky xl:top-20 dark:border-sky-900/60 dark:bg-sky-950/20">
              <div className="flex items-center gap-2 font-semibold text-sky-900 text-sm uppercase tracking-normal dark:text-sky-200">
                <Calculator className="size-4" />
                Estimate summary
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`estimate-tax-rate-${estimate?.id ?? "new"}`}>Sales tax rate</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`estimate-tax-rate-${estimate?.id ?? "new"}`}
                    type="number"
                    min="0"
                    max="15"
                    step="0.25"
                    value={taxRate}
                    onChange={(event) => setTaxRate(toNumber(event.target.value))}
                    className="h-11 bg-background"
                  />
                  <span className="text-muted-foreground text-sm">%</span>
                </div>
              </div>
              <div className="grid gap-2 border-t pt-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Labor</span>
                  <span className="font-medium tabular-nums">${formatCurrency(laborSubtotal)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Materials</span>
                  <span className="font-medium tabular-nums">${formatCurrency(materialsSubtotal)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Tax basis</span>
                  <span className="font-medium tabular-nums">${formatCurrency(taxableSubtotal)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium tabular-nums">${formatCurrency(tax)}</span>
                </div>
                <div className="mt-2 rounded-lg border border-sky-200 bg-background p-3 dark:border-sky-900/60">
                  <div className="text-muted-foreground text-xs">Customer estimate</div>
                  <div className="font-semibold text-2xl tabular-nums">${formatCurrency(total)}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <input type="hidden" name="customerId" value={isCreatingNewCustomer ? "" : selectedCustomerId} />
      <input type="hidden" name="serviceLocation" value={serviceLocation} />
      <input type="hidden" name="dateBegin" value={toDateValue(scheduledDate)} />
      <input type="hidden" name="dateEnd" value="" />
      <input type="hidden" name="laborItems" value={stringifyPricingItems(laborItems)} />
      <input type="hidden" name="materials" value={stringifyMaterials(materials)} />
      <input type="hidden" name="jobType" value={jobType} />
      <input type="hidden" name="measurementRooms" value={stringifyMeasurementRooms(measurementRooms)} />
      <input type="hidden" name="materialTaxRate" value={taxRate.toFixed(2)} />

      <div className="grid gap-4 sm:grid-cols-2">
        {services.length ? (
          <div className="sm:col-span-2 sm:flex sm:justify-center">
            <ServicePicker services={services} onApply={applyService} />
          </div>
        ) : null}
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={`estimate-title-${estimate?.id ?? "new"}`}>Title</Label>
          <Input
            id={`estimate-title-${estimate?.id ?? "new"}`}
            name="description"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Water heater replacement"
            className={mobileFieldClassName}
            required
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={`estimate-description-${estimate?.id ?? "new"}`}>Description</Label>
          <Textarea
            id={`estimate-description-${estimate?.id ?? "new"}`}
            name="scope"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the requested work..."
            className={mobileFieldClassName}
          />
        </div>
        <div className="grid gap-2">
          <Label>Customer</Label>
          <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={customerPickerOpen}
                className={`w-full justify-between font-normal ${mobileFieldClassName}`}
              >
                <span className="truncate">{selectedCustomerLabel}</span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
              <Command>
                <CommandInput placeholder="Search customers..." />
                <CommandList>
                  <CommandEmpty>No customers found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="New customer"
                      onSelect={() => {
                        setSelectedCustomerId(newCustomerValue);
                        setSelectedLocation(customLocationValue);
                        setCustomerPickerOpen(false);
                      }}
                    >
                      <Check className={cn("size-4", isCreatingNewCustomer ? "opacity-100" : "opacity-0")} />
                      New customer
                    </CommandItem>
                    {customers.map((customer) => (
                      <CommandItem
                        key={customer.id}
                        value={customer.name}
                        onSelect={() => {
                          setSelectedCustomerId(customer.id);
                          if (customer.addresses.length) {
                            setSelectedLocation(formatAddress(customer.addresses[0]));
                            setCustomLocationFields(createCustomLocationFields());
                          } else {
                            setSelectedLocation(customLocationValue);
                          }
                          setCustomerPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn("size-4", selectedCustomerId === customer.id ? "opacity-100" : "opacity-0")}
                        />
                        {customer.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`estimate-status-${estimate?.id ?? "new"}`}>Status</Label>
          <Select name="status" value={status} onValueChange={setStatus} required>
            <SelectTrigger id={`estimate-status-${estimate?.id ?? "new"}`} className={`w-full ${mobileFieldClassName}`}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:col-span-2 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={`estimate-category-${estimate?.id ?? "new"}`}>Category</Label>
            <Select name="category" value={category} onValueChange={setCategory} required>
              <SelectTrigger
                id={`estimate-category-${estimate?.id ?? "new"}`}
                className={`w-full ${mobileFieldClassName}`}
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
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
          <div className="grid gap-2">
            <Label htmlFor={`estimate-scheduled-date-${estimate?.id ?? "new"}`}>Scheduled date</Label>
            <ScheduledDatePicker
              id={`estimate-scheduled-date-${estimate?.id ?? "new"}`}
              value={scheduledDate}
              onChange={setScheduledDate}
            />
          </div>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={`estimate-notes-${estimate?.id ?? "new"}`}>Notes</Label>
          <Textarea
            id={`estimate-notes-${estimate?.id ?? "new"}`}
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add internal notes..."
            className={mobileFieldClassName}
          />
        </div>
      </div>

      {isCreatingNewCustomer ? (
        <div className="grid gap-4 rounded-lg border bg-muted/80 p-4 sm:grid-cols-2">
          <div className="grid gap-1 sm:col-span-2">
            <Label>New customer</Label>
            <p className="text-muted-foreground text-xs">
              This customer will be created and linked to the estimate. Name, email, and phone are required.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`estimate-new-customer-name-${estimate?.id ?? "new"}`}>Customer name</Label>
            <Input
              id={`estimate-new-customer-name-${estimate?.id ?? "new"}`}
              name="newCustomerName"
              value={newCustomerName}
              onChange={(event) => setNewCustomerName(event.target.value)}
              placeholder="Jane Smith"
              className={mobileFieldClassName}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`estimate-new-customer-email-${estimate?.id ?? "new"}`}>Customer email</Label>
            <Input
              id={`estimate-new-customer-email-${estimate?.id ?? "new"}`}
              name="newCustomerEmail"
              type="email"
              value={newCustomerEmail}
              onChange={(event) => setNewCustomerEmail(event.target.value)}
              placeholder="customer@example.com"
              className={mobileFieldClassName}
              required
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor={`estimate-new-customer-phone-${estimate?.id ?? "new"}`}>Customer phone</Label>
            <Input
              id={`estimate-new-customer-phone-${estimate?.id ?? "new"}`}
              name="newCustomerPhone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={12}
              value={formatPhoneNumber(newCustomerPhone)}
              onChange={(event) => setNewCustomerPhone(normalizePhoneNumber(event.target.value).slice(0, 10))}
              placeholder="(555) 555-1234"
              className={mobileFieldClassName}
              required
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 rounded-lg border border-emerald-200/80 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <div className="grid gap-1">
          <Label htmlFor={`estimate-location-${estimate?.id ?? "new"}`}>Service location</Label>
          <p className="text-emerald-900/70 text-xs dark:text-emerald-200/70">
            {addressOptions.length
              ? "Choose a saved customer location or enter a custom address for this estimate."
              : "Enter the service address for this estimate."}
          </p>
        </div>
        {addressOptions.length ? (
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger
              id={`estimate-location-${estimate?.id ?? "new"}`}
              className="w-full min-w-0 overflow-hidden [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
            >
              <SelectValue placeholder="Select service location" />
            </SelectTrigger>
            <SelectContent className="max-w-[calc(100vw-2rem)]">
              <SelectGroup>
                {addressOptions.map((address) => {
                  const value = formatAddress(address);
                  return (
                    <SelectItem key={address.id} value={value} className="max-w-[calc(100vw-2rem)]">
                      <span className="block truncate">{address.label ? `${address.label}: ${value}` : value}</span>
                    </SelectItem>
                  );
                })}
                <SelectItem value={customLocationValue}>Custom location</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}
        {!addressOptions.length || selectedLocation === customLocationValue ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid gap-2 sm:col-span-2">
              <Label htmlFor={`estimate-location-street-${estimate?.id ?? "new"}`}>Street address</Label>
              <Input
                id={`estimate-location-street-${estimate?.id ?? "new"}`}
                value={customLocationFields.street}
                onChange={(event) =>
                  setCustomLocationFields((current) => ({
                    ...current,
                    street: event.target.value,
                  }))
                }
                placeholder="123 Main St"
                className={mobileFieldClassName}
              />
            </div>
            <div className="col-span-2 grid gap-2 sm:col-span-1">
              <Label htmlFor={`estimate-location-apt-${estimate?.id ?? "new"}`}>Apt, suite, unit</Label>
              <Input
                id={`estimate-location-apt-${estimate?.id ?? "new"}`}
                value={customLocationFields.apt}
                onChange={(event) =>
                  setCustomLocationFields((current) => ({
                    ...current,
                    apt: event.target.value,
                  }))
                }
                placeholder="Unit B"
                className={mobileFieldClassName}
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor={`estimate-location-city-${estimate?.id ?? "new"}`}>City</Label>
              <Input
                id={`estimate-location-city-${estimate?.id ?? "new"}`}
                value={customLocationFields.city}
                onChange={(event) =>
                  setCustomLocationFields((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
                placeholder="Houston"
                className={mobileFieldClassName}
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor={`estimate-location-state-${estimate?.id ?? "new"}`}>State</Label>
              <UsStateSelect
                id={`estimate-location-state-${estimate?.id ?? "new"}`}
                value={customLocationFields.state}
                onChange={(event) =>
                  setCustomLocationFields((current) => ({
                    ...current,
                    state: event.target.value,
                  }))
                }
                className={mobileFieldClassName}
              />
            </div>
            <div className="col-span-2 grid gap-2 sm:col-span-1">
              <Label htmlFor={`estimate-location-zip-${estimate?.id ?? "new"}`}>Zip code</Label>
              <Input
                id={`estimate-location-zip-${estimate?.id ?? "new"}`}
                value={customLocationFields.zip}
                onChange={(event) =>
                  setCustomLocationFields((current) => ({
                    ...current,
                    zip: event.target.value,
                  }))
                }
                placeholder="77001"
                className={mobileFieldClassName}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-2 grid gap-1 border-t pt-4">
        <div className="font-medium text-sm">Labor and materials</div>
        <p className="text-muted-foreground text-xs">
          Add line items when you are ready. Tax is automatically calculated at {taxRate.toFixed(2)}%.
        </p>
      </div>

      <LineItemsEditor items={laborItems} onChange={setLaborItems} />
      <MaterialItemsEditor items={materials} onChange={setMaterials} />

      <div className="grid gap-4 rounded-lg border bg-muted/20 p-4">
        <div className="grid gap-1">
          <Label>Estimate totals</Label>
          <p className="text-muted-foreground text-xs">
            Review calculated totals. Tax defaults to 8.25% but can be adjusted when needed.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="grid gap-2">
            <Label htmlFor={`estimate-tax-rate-${estimate?.id ?? "new"}`}>Tax rate</Label>
            <div className="flex items-center gap-2">
              <Input
                id={`estimate-tax-rate-${estimate?.id ?? "new"}`}
                type="number"
                min="0"
                max="15"
                step="0.25"
                value={taxRate}
                onChange={(event) => setTaxRate(toNumber(event.target.value))}
                className={mobileFieldClassName}
              />
              <span className="text-muted-foreground text-sm">%</span>
            </div>
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground text-xs">Labor</span>
            <span className="font-medium text-sm">${formatCurrency(laborSubtotal)}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground text-xs">Materials</span>
            <span className="font-medium text-sm">${formatCurrency(materialsSubtotal)}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground text-xs">Tax</span>
            <span className="font-medium text-sm">${formatCurrency(tax)}</span>
          </div>
          <div className="col-span-2 grid gap-1 rounded-md bg-background p-3 sm:col-span-1 sm:bg-transparent sm:p-0">
            <span className="text-muted-foreground text-xs">Estimate value</span>
            <span className="font-semibold text-base">${formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
