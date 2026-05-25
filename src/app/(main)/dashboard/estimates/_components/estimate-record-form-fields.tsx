"use client";

import * as React from "react";

import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { calculateMaterialTotal, type JobMaterial, stringifyMaterials } from "../../jobs/_components/materials";
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

type LineItem = PricingLineItem & {
  id: string;
};

type MaterialLineItem = JobMaterial & {
  id: string;
};

type CustomLocationFields = {
  street: string;
  apt: string;
  city: string;
  state: string;
  zip: string;
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
          <p className="text-muted-foreground text-xs">Add optional labor line items for this estimate.</p>
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
            className="grid grid-cols-[minmax(0,1fr)_3rem] gap-3 px-4 py-3 odd:py-0 even:bg-sky-100/80 sm:grid-cols-[minmax(0,1fr)_120px_auto]"
          >
            <div className="col-span-2 grid gap-2 sm:col-span-1">
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
            <div className="flex items-end justify-end">
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
    <div className="grid gap-4 rounded-lg border border-amber-200/80 bg-amber-50/60 pb-4 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="grid gap-4 px-4 pt-4 pb-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-2">
        <div className="grid gap-1">
          <Label>Materials</Label>
          <p className="text-muted-foreground text-xs">Add optional material quantities and unit prices.</p>
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
              className="grid grid-cols-[minmax(3rem,0.6fr)_minmax(5rem,1fr)_minmax(3rem,0.6fr)_auto] items-end gap-3 px-4 py-3 odd:py-0 even:bg-amber-100/80 lg:grid-cols-[minmax(0,1fr)_60px_100px_75px_auto]"
            >
              <div className="col-span-4 grid gap-2 lg:col-span-1">
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
                  min="0"
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
                  min="1"
                  step="0.01"
                  onChange={(event) =>
                    onChange(
                      items.map((current, itemIndex) =>
                        itemIndex === index ? { ...current, unitPrice: event.target.value } : current,
                      ),
                    )
                  }
                  onBlur={() =>
                    onChange(
                      items.map((current, itemIndex) =>
                        itemIndex === index
                          ? { ...current, unitPrice: formatMoneyInputValue(current.unitPrice) }
                          : current,
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
                  ${formatCurrency(toNumber(total))}
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

export function EstimateRecordFormFields({
  customers,
  estimate,
  resetKey = 0,
  services,
}: {
  customers: JobCustomer[];
  estimate?: EstimateRecordRow;
  resetKey?: number;
  services: ServiceTemplateRow[];
}) {
  const [customerPickerOpen, setCustomerPickerOpen] = React.useState(false);
  const [title, setTitle] = React.useState(estimate?.description ?? "");
  const [description, setDescription] = React.useState(estimate?.scope ?? "");
  const [category, setCategory] = React.useState(estimate?.category ?? "Other");
  const [notes, setNotes] = React.useState(estimate?.notes ?? "");
  const [newCustomerName, setNewCustomerName] = React.useState("");
  const [newCustomerEmail, setNewCustomerEmail] = React.useState("");
  const [newCustomerPhone, setNewCustomerPhone] = React.useState("");
  const [selectedCustomerId, setSelectedCustomerId] = React.useState(estimate?.customerId ?? selectCustomerValue);
  const [laborItems, setLaborItems] = React.useState<LineItem[]>(
    estimate?.laborItems.length ? estimate.laborItems.map((item) => createLineItem(item)) : [createLineItem()],
  );
  const [materials, setMaterials] = React.useState<MaterialLineItem[]>(
    estimate?.materials.length
      ? estimate.materials.map((item) => createMaterialLineItem(item))
      : [createMaterialLineItem()],
  );
  const [taxRate, setTaxRate] = React.useState(Number(estimate?.materialTaxRate ?? "8.25"));
  const isCreatingNewCustomer = selectedCustomerId === newCustomerValue;
  const selectedCustomer = isCreatingNewCustomer
    ? undefined
    : customers.find((customer) => customer.id === selectedCustomerId);
  const addressOptions = selectedCustomer?.addresses ?? [];
  const initialLocation = estimate?.serviceLocation ?? "";
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

  React.useEffect(() => {
    const initializedFromKey = `${resetKey}:${estimate?.id ?? "new"}`;
    if (initializedFromKeyRef.current === initializedFromKey) {
      return;
    }
    initializedFromKeyRef.current = initializedFromKey;

    const nextSelectedCustomerId = estimate?.customerId ?? selectCustomerValue;
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
    setTitle(estimate?.description ?? "");
    setDescription(estimate?.scope ?? "");
    setCategory(estimate?.category ?? "Other");
    setNotes(estimate?.notes ?? "");
    setNewCustomerName("");
    setNewCustomerEmail("");
    setNewCustomerPhone("");
    setTaxRate(Number(estimate?.materialTaxRate ?? "8.25"));
    setSelectedLocation(nextHasSavedInitialLocation && nextInitialLocation ? nextInitialLocation : customLocationValue);
    setCustomLocationFields(createCustomLocationFields(nextHasSavedInitialLocation ? "" : nextInitialLocation));
  }, [customers, estimate, resetKey]);

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

  const selectedCustomerLabel = React.useMemo(() => {
    if (isCreatingNewCustomer) return "New customer";

    return customers.find((customer) => customer.id === selectedCustomerId)?.name ?? "Select customer";
  }, [customers, isCreatingNewCustomer, selectedCustomerId]);
  const laborSubtotal = laborItems.reduce((total, item) => total + toNumber(item.price), 0);
  const materialsSubtotal = materials.reduce((total, item) => total + toNumber(calculateMaterialTotal(item)), 0);
  const tax = (laborSubtotal + materialsSubtotal) * (taxRate / 100);
  const total = laborSubtotal + materialsSubtotal + tax;

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

  return (
    <div className="grid gap-4">
      <input type="hidden" name="customerId" value={isCreatingNewCustomer ? "" : selectedCustomerId} />
      <input type="hidden" name="serviceLocation" value={serviceLocation} />
      <input type="hidden" name="dateBegin" value="" />
      <input type="hidden" name="dateEnd" value="" />
      <input type="hidden" name="laborItems" value={stringifyPricingItems(laborItems)} />
      <input type="hidden" name="materials" value={stringifyMaterials(materials)} />
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
          <Select name="status" defaultValue={estimate?.status ?? "Draft"} required>
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
          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3 sm:grid-cols-2">
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
            <div className="grid gap-2">
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
            <div className="grid gap-2 sm:col-span-1">
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
