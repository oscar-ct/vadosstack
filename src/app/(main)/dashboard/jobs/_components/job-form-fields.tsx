"use client";

import * as React from "react";

import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { DateRangePicker } from "@/components/date-range-picker";
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

import { ServicePicker } from "../../services/_components/service-picker";
import type { ServiceTemplateRow } from "../../services/types";
import type { JobCustomer, JobRow } from "./jobs-table/schema";
import {
  calculateMaterialTotal,
  calculateSignedMaterialTotal,
  type JobMaterial,
  stringifyMaterials,
} from "./materials";
import { type PricingLineItem, stringifyPricingItems } from "./pricing-items";

const jobStatuses = ["Unscheduled", "Scheduled", "Completed", "On Hold", "Cancelled"] as const;
const jobCategories = ["Repair", "Installation", "Other"] as const;
const newCustomerValue = "new-customer";
const customLocationValue = "custom-location";
const selectCustomerValue = "";
const mobileFieldClassName = "bg-background/70 text-base sm:text-sm";
const commonMaterialVendors = ["Home Depot", "Lowes", "Floor & Decor", "Shop", "Customer Supplied"];

type JobMaterialEntry = JobMaterial & {
  id: string;
};

type LaborItemEntry = PricingLineItem & {
  id: string;
};

type CustomLocationFields = {
  street: string;
  apt: string;
  city: string;
  state: string;
  zip: string;
};

function createMaterialEntry(material?: Partial<JobMaterial>): JobMaterialEntry {
  return {
    id: crypto.randomUUID(),
    description: material?.description ?? "",
    type: material?.type ?? "purchase",
    vendor: material?.vendor ?? "",
    purchaseDate: material?.purchaseDate ?? "",
    quantity: material?.quantity ?? "",
    unitPrice: material?.unitPrice ?? material?.price ?? "",
    price: material?.price ?? "",
  };
}

function getFirstMaterialVendor(materials?: JobMaterial[]) {
  return materials?.find((material) => material.vendor?.trim())?.vendor?.trim() ?? "";
}

function createLaborItemEntry(item?: Partial<PricingLineItem>): LaborItemEntry {
  return {
    id: crypto.randomUUID(),
    description: item?.description ?? "",
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
    state: "TX",
    zip: "",
  };
}

function formatCustomLocation(fields: CustomLocationFields) {
  return [fields.street, fields.apt, [fields.city, fields.state].filter(Boolean).join(", "), fields.zip]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
}

function parseJobDate(value?: string) {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return date;
}

function createJobDateRange(job?: JobRow): DateRange | undefined {
  const from = parseJobDate(job?.dateBegin);
  const to = parseJobDate(job?.dateEnd);

  if (!from && !to) return undefined;

  return {
    from: from ?? to,
    to,
  };
}

function toDateValue(date?: Date) {
  if (!date) return "";

  return date.toISOString();
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return value.toFixed(2);
}

function getDefaultJobStatus(job?: JobRow): (typeof jobStatuses)[number] {
  if (job?.status && jobStatuses.includes(job.status as (typeof jobStatuses)[number])) {
    return job.status as (typeof jobStatuses)[number];
  }

  return job?.dateBegin ? "Scheduled" : "Unscheduled";
}

export function JobFormFields({
  customers,
  job,
  services,
}: {
  customers: JobCustomer[];
  job?: JobRow;
  services: ServiceTemplateRow[];
}) {
  const [customerPickerOpen, setCustomerPickerOpen] = React.useState(false);
  const [title, setTitle] = React.useState(job?.description ?? "");
  const [description, setDescription] = React.useState(job?.scope ?? "");
  const [category, setCategory] = React.useState(job?.category ?? "Other");
  const [status, setStatus] = React.useState<(typeof jobStatuses)[number]>(() => getDefaultJobStatus(job));
  const [notes, setNotes] = React.useState(job?.notes ?? "");
  const [newCustomerName, setNewCustomerName] = React.useState("");
  const [newCustomerEmail, setNewCustomerEmail] = React.useState("");
  const [newCustomerPhone, setNewCustomerPhone] = React.useState("");
  const [selectedCustomerId, setSelectedCustomerId] = React.useState(job?.customerId ?? selectCustomerValue);
  const [laborItems, setLaborItems] = React.useState<LaborItemEntry[]>(
    job?.laborItems.length ? job.laborItems.map((item) => createLaborItemEntry(item)) : [createLaborItemEntry()],
  );
  const [jobDateRange, setJobDateRange] = React.useState<DateRange | undefined>(() => createJobDateRange(job));
  const [materialTaxRate, setMaterialTaxRate] = React.useState(Number(job?.materialTaxRate ?? "8.25"));
  const [materials, setMaterials] = React.useState<JobMaterialEntry[]>(
    job?.materials.length ? job.materials.map((material) => createMaterialEntry(material)) : [createMaterialEntry()],
  );
  const [lastMaterialVendor, setLastMaterialVendor] = React.useState(() => getFirstMaterialVendor(job?.materials));
  const isCreatingNewCustomer = selectedCustomerId === newCustomerValue;
  const selectedCustomer = isCreatingNewCustomer
    ? undefined
    : customers.find((customer) => customer.id === selectedCustomerId);
  const addressOptions = selectedCustomer?.addresses ?? [];
  const initialLocation = job?.serviceLocation ?? "";
  const hasSavedInitialLocation = addressOptions.some((address) => formatAddress(address) === initialLocation);
  const [selectedLocation, setSelectedLocation] = React.useState(
    hasSavedInitialLocation && initialLocation ? initialLocation : customLocationValue,
  );
  const [customLocationFields, setCustomLocationFields] = React.useState(() =>
    createCustomLocationFields(hasSavedInitialLocation ? "" : initialLocation),
  );
  const serviceLocation =
    selectedLocation === customLocationValue ? formatCustomLocation(customLocationFields) : selectedLocation;

  React.useEffect(() => {
    const nextSelectedCustomerId = job?.customerId ?? selectCustomerValue;
    const nextCustomer = customers.find((customer) => customer.id === nextSelectedCustomerId);
    const nextAddressOptions = nextCustomer?.addresses ?? [];
    const nextInitialLocation = job?.serviceLocation ?? "";
    const nextHasSavedInitialLocation = nextAddressOptions.some(
      (address) => formatAddress(address) === nextInitialLocation,
    );

    setSelectedCustomerId(nextSelectedCustomerId);
    setLaborItems(
      job?.laborItems.length ? job.laborItems.map((item) => createLaborItemEntry(item)) : [createLaborItemEntry()],
    );
    setJobDateRange(createJobDateRange(job));
    setMaterialTaxRate(Number(job?.materialTaxRate ?? "8.25"));
    setMaterials(
      job?.materials.length ? job.materials.map((material) => createMaterialEntry(material)) : [createMaterialEntry()],
    );
    setLastMaterialVendor(getFirstMaterialVendor(job?.materials));
    setTitle(job?.description ?? "");
    setDescription(job?.scope ?? "");
    setCategory(job?.category ?? "Other");
    setStatus(getDefaultJobStatus(job));
    setNotes(job?.notes ?? "");
    setNewCustomerName("");
    setNewCustomerEmail("");
    setNewCustomerPhone("");
    setSelectedLocation(nextHasSavedInitialLocation && nextInitialLocation ? nextInitialLocation : customLocationValue);
    setCustomLocationFields(createCustomLocationFields(nextHasSavedInitialLocation ? "" : nextInitialLocation));
  }, [customers, job]);

  React.useEffect(() => {
    const hasJobDates = Boolean(jobDateRange?.from ?? jobDateRange?.to);

    if (!hasJobDates && status === "Scheduled") {
      setStatus("Unscheduled");
      return;
    }

    if (hasJobDates && status === "Unscheduled") {
      setStatus("Scheduled");
      return;
    }
  }, [jobDateRange?.from, jobDateRange?.to, status]);

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

  const materialsSubtotal = React.useMemo(
    () => materials.reduce((total, material) => total + toNumber(calculateSignedMaterialTotal(material)), 0),
    [materials],
  );
  const laborSubtotal = React.useMemo(
    () => laborItems.reduce((total, item) => total + toNumber(item.price), 0),
    [laborItems],
  );
  const materialTaxAmount = React.useMemo(
    () => ((laborSubtotal + materialsSubtotal) * materialTaxRate) / 100,
    [laborSubtotal, materialsSubtotal, materialTaxRate],
  );
  const finalCost = React.useMemo(
    () => laborSubtotal + materialsSubtotal + materialTaxAmount,
    [laborSubtotal, materialTaxAmount, materialsSubtotal],
  );
  const normalizedAmountPaid = React.useMemo(() => toNumber(job?.amountPaid ?? "0"), [job?.amountPaid]);
  const outstandingBalance = React.useMemo(
    () => Math.max(0, finalCost - normalizedAmountPaid),
    [finalCost, normalizedAmountPaid],
  );
  const materialVendorOptions = React.useMemo(
    () =>
      Array.from(
        new Set([
          ...commonMaterialVendors,
          ...materials.map((material) => material.vendor?.trim()).filter((vendor): vendor is string => Boolean(vendor)),
        ]),
      ),
    [materials],
  );
  const materialVendorListId = `job-material-vendors-${job?.id ?? "new"}`;

  function applyService(service: ServiceTemplateRow) {
    setTitle(service.title);
    setDescription(service.description ?? "");
    setCategory(
      jobCategories.includes(service.category as (typeof jobCategories)[number]) ? service.category : "Other",
    );
    setNotes(service.notes ?? "");
    setLaborItems(
      service.laborItems.length
        ? service.laborItems.map((item) => createLaborItemEntry(item))
        : [createLaborItemEntry()],
    );
    setMaterials(
      service.materials.length
        ? service.materials.map((material) => createMaterialEntry(material))
        : [createMaterialEntry({ vendor: lastMaterialVendor })],
    );
    setLastMaterialVendor(getFirstMaterialVendor(service.materials) || lastMaterialVendor);
  }

  return (
    <div className="grid gap-4">
      <input type="hidden" name="customerId" value={isCreatingNewCustomer ? "" : selectedCustomerId} />
      <input type="hidden" name="serviceLocation" value={serviceLocation} />
      <input type="hidden" name="dateBegin" value={toDateValue(jobDateRange?.from)} />
      <input type="hidden" name="dateEnd" value={toDateValue(jobDateRange?.to)} />
      <input type="hidden" name="materialTaxRate" value={materialTaxRate.toFixed(2)} />
      <input type="hidden" name="pictures" value={job?.pictures.join("\n") ?? ""} />
      <datalist id={materialVendorListId}>
        {materialVendorOptions.map((vendor) => (
          <option key={vendor} value={vendor} />
        ))}
      </datalist>
      <input
        type="hidden"
        name="laborItems"
        value={stringifyPricingItems(laborItems.map(({ description, price }) => ({ description, price })))}
      />
      <input
        type="hidden"
        name="materials"
        value={stringifyMaterials(
          materials.map(({ description, type, vendor, purchaseDate, quantity, unitPrice, price }) => ({
            description,
            type,
            vendor,
            purchaseDate,
            quantity,
            unitPrice,
            price,
          })),
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {services.length ? (
          <div className="grid gap-2">
            <div className="flex w-min items-center">
              <ServicePicker services={services} onApply={applyService} />
            </div>
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor={`job-status-${job?.id ?? "new"}`}>Status</Label>
          <Select
            name="status"
            value={status}
            onValueChange={(value) => setStatus(value as (typeof jobStatuses)[number])}
            required
          >
            <SelectTrigger id={`job-status-${job?.id ?? "new"}`} className={`w-full ${mobileFieldClassName}`}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {jobStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={`job-title-${job?.id ?? "new"}`}>Title</Label>
          <Input
            id={`job-title-${job?.id ?? "new"}`}
            name="description"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Water heater replacement"
            className={mobileFieldClassName}
            required
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={`job-description-${job?.id ?? "new"}`}>Description</Label>
          <Textarea
            id={`job-description-${job?.id ?? "new"}`}
            name="scope"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the work, expectations, and notes for this job..."
            className={mobileFieldClassName}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`job-customer-${job?.id ?? "new"}`}>Customer</Label>
          <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                id={`job-customer-${job?.id ?? "new"}`}
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
          <Label htmlFor={`job-category-${job?.id ?? "new"}`}>Category</Label>
          <Select name="category" value={category} onValueChange={setCategory} required>
            <SelectTrigger id={`job-category-${job?.id ?? "new"}`} className={`w-full ${mobileFieldClassName}`}>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {jobCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {/*<div className="grid gap-2">*/}
        {/*  <Label htmlFor={`job-status-${job?.id ?? "new"}`}>Status</Label>*/}
        {/*  <Select*/}
        {/*    name="status"*/}
        {/*    value={status}*/}
        {/*    onValueChange={(value) => setStatus(value as (typeof jobStatuses)[number])}*/}
        {/*    required*/}
        {/*  >*/}
        {/*    <SelectTrigger id={`job-status-${job?.id ?? "new"}`} className={`w-full ${mobileFieldClassName}`}>*/}
        {/*      <SelectValue placeholder="Select status" />*/}
        {/*    </SelectTrigger>*/}
        {/*    <SelectContent>*/}
        {/*      <SelectGroup>*/}
        {/*        {jobStatuses.map((status) => (*/}
        {/*          <SelectItem key={status} value={status}>*/}
        {/*            {status}*/}
        {/*          </SelectItem>*/}
        {/*        ))}*/}
        {/*      </SelectGroup>*/}
        {/*    </SelectContent>*/}
        {/*  </Select>*/}
        {/*</div>*/}
      </div>

      {isCreatingNewCustomer ? (
        <div className="grid gap-4 rounded-lg border bg-muted/80 p-4 sm:grid-cols-2">
          <div className="grid gap-1 sm:col-span-2">
            <Label>New customer</Label>
            <p className="text-muted-foreground text-xs">
              This customer will be created and linked to the job. Name, email, and phone are required.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`job-new-customer-name-${job?.id ?? "new"}`}>Customer name</Label>
            <Input
              id={`job-new-customer-name-${job?.id ?? "new"}`}
              name="newCustomerName"
              value={newCustomerName}
              onChange={(event) => setNewCustomerName(event.target.value)}
              placeholder="Jane Smith"
              className={mobileFieldClassName}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`job-new-customer-email-${job?.id ?? "new"}`}>Customer email</Label>
            <Input
              id={`job-new-customer-email-${job?.id ?? "new"}`}
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
            <Label htmlFor={`job-new-customer-phone-${job?.id ?? "new"}`}>Customer phone</Label>
            <Input
              id={`job-new-customer-phone-${job?.id ?? "new"}`}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`job-date-range-${job?.id ?? "new"}`}>Job Dates</Label>
          <DateRangePicker
            id={`job-date-range-${job?.id ?? "new"}`}
            value={jobDateRange}
            onChange={setJobDateRange}
            placeholder="Select job dates"
            align="start"
            className={`w-full justify-start text-left ${mobileFieldClassName}`}
          />
          <p className="text-muted-foreground text-xs">Choose the scheduled start and end dates for this job.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`job-notes-${job?.id ?? "new"}`}>Notes</Label>
          <Textarea
            id={`job-notes-${job?.id ?? "new"}`}
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add internal notes..."
            className={mobileFieldClassName}
          />
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-emerald-200/80 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <div className="grid gap-1">
          <Label htmlFor={`job-location-${job?.id ?? "new"}`}>Service location</Label>
          <p className="text-emerald-900/70 text-xs dark:text-emerald-200/70">
            {addressOptions.length
              ? "Choose a saved customer location or enter a custom address for this job."
              : "Enter the service address for this job."}
          </p>
        </div>
        {addressOptions.length ? (
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger
              id={`job-location-${job?.id ?? "new"}`}
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
          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3 rounded-lg border border-emerald-200/80 bg-background/70 p-4 sm:grid-cols-2 dark:border-emerald-900/60">
            <div className="col-span-2 grid gap-2 sm:col-span-2">
              <Label htmlFor={`job-location-street-${job?.id ?? "new"}`}>Street address</Label>
              <Input
                id={`job-location-street-${job?.id ?? "new"}`}
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
              <Label htmlFor={`job-location-apt-${job?.id ?? "new"}`}>Apt, suite, unit</Label>
              <Input
                id={`job-location-apt-${job?.id ?? "new"}`}
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
              <Label htmlFor={`job-location-city-${job?.id ?? "new"}`}>City</Label>
              <Input
                id={`job-location-city-${job?.id ?? "new"}`}
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
              <Label htmlFor={`job-location-state-${job?.id ?? "new"}`}>State</Label>
              <UsStateSelect
                id={`job-location-state-${job?.id ?? "new"}`}
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
              <Label htmlFor={`job-location-zip-${job?.id ?? "new"}`}>Zip code</Label>
              <Input
                id={`job-location-zip-${job?.id ?? "new"}`}
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
          Add final job costs here after the job details are set. Payments are recorded in the job transaction history.
        </p>
      </div>

      <div className="grid gap-4 pb-4 rounded-lg border border-sky-200/80 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20">
        <div className="grid pt-4 px-4 pb-2 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-2">
          <div className="grid gap-1">
            <Label>Labor</Label>
            <p className="text-muted-foreground text-xs">Add each labor line item with a description and price.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLaborItems((current) => [createLaborItemEntry(), ...current])}
          >
            <Plus />
            Add labor
          </Button>
        </div>

        <div className="grid gap-4">
          {laborItems.map((item, index) => (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(0,1fr)_3rem] gap-3 p-4 odd:py-0 even:bg-sky-100/80 sm:grid-cols-[minmax(0,1fr)_120px_auto]"
            >
              <div className="col-span-2 grid gap-2 sm:col-span-1">
                <Label>Description</Label>
                <Input
                  id={`job-labor-description-${job?.id ?? "new"}-${index}`}
                  aria-label={`Labor ${index + 1} description`}
                  value={item.description}
                  onChange={(event) =>
                    setLaborItems((current) =>
                      current.map((labor, itemIndex) =>
                        itemIndex === index ? { ...labor, description: event.target.value } : labor,
                      ),
                    )
                  }
                  placeholder="Labor description"
                  className={mobileFieldClassName}
                />
              </div>
              <div className="grid gap-2">
                <Label>Price</Label>
                <Input
                  id={`job-labor-price-${job?.id ?? "new"}-${index}`}
                  aria-label={`Labor ${index + 1} price`}
                  value={item.price}
                  onChange={(event) =>
                    setLaborItems((current) =>
                      current.map((labor, itemIndex) =>
                        itemIndex === index ? { ...labor, price: event.target.value } : labor,
                      ),
                    )
                  }
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={mobileFieldClassName}
                />
              </div>
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={laborItems.length === 1}
                  onClick={() =>
                    setLaborItems((current) =>
                      current.length === 1 ? current : current.filter((labor) => labor.id !== item.id),
                    )
                  }
                  aria-label={`Remove labor ${index + 1}`}
                >
                  <Trash2 className="size-4 cursor-pointer text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 pb-4 rounded-lg border border-amber-200/80 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
        <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-2">
          <div className="grid gap-1">
            <Label>Materials</Label>
            <p className="text-muted-foreground text-xs">
              Add purchases and returns. Vendor, date, quantity, and unit price are optional.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setMaterials((current) => [createMaterialEntry({ vendor: lastMaterialVendor }), ...current])}
          >
            <Plus />
            Add material
          </Button>
        </div>

        <div className="grid gap-4">
          {materials.map((material, index) => {
            return (
              <div key={material.id} className="grid gap-3 p-4 odd:py-0 even:bg-amber-100/80">
                <div className="grid grid-cols-[7rem_minmax(0,1fr)_2.25rem] gap-3 sm:grid-cols-[120px_minmax(0,1fr)_120px_auto] sm:items-end">
                  <div className="order-3 grid gap-2 sm:order-none">
                    <Label>Type</Label>
                    <Select
                      value={material.type ?? "purchase"}
                      onValueChange={(value) =>
                        setMaterials((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, type: value === "return" ? "return" : "purchase" } : item,
                          ),
                        )
                      }
                    >
                      <SelectTrigger
                        id={`job-material-type-${job?.id ?? "new"}-${index}`}
                        aria-label={`Material ${index + 1} type`}
                        className={`w-full ${mobileFieldClassName}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="purchase">Purchase</SelectItem>
                          <SelectItem value="return">Return</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="order-1 col-span-3 grid gap-2 sm:order-none sm:col-span-1">
                    <Label>Description</Label>
                    <Input
                      id={`job-material-description-${job?.id ?? "new"}-${index}`}
                      aria-label={`Material ${index + 1} description`}
                      value={material.description}
                      onChange={(event) =>
                        setMaterials((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, description: event.target.value } : item,
                          ),
                        )
                      }
                      placeholder="Material description"
                      className={mobileFieldClassName}
                    />
                  </div>
                  <div className="order-2 grid gap-2 sm:order-none sm:col-span-1">
                    <Label>Line total</Label>
                    <Input
                      id={`job-material-amount-${job?.id ?? "new"}-${index}`}
                      aria-label={`Material ${index + 1} line total`}
                      value={material.price}
                      onChange={(event) =>
                        setMaterials((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, price: event.target.value } : item,
                          ),
                        )
                      }
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className={mobileFieldClassName}
                    />
                  </div>
                  <div className="order-4 flex items-end justify-end sm:order-none">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={materials.length === 1}
                      onClick={() =>
                        setMaterials((current) =>
                          current.length === 1 ? current : current.filter((item) => item.id !== material.id),
                        )
                      }
                      aria-label={`Remove material ${index + 1}`}
                    >
                      <Trash2 className="size-4 cursor-pointer text-red-500" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,1fr)_150px_90px_120px]">
                  <div className="order-4 grid gap-2 sm:order-none sm:col-span-1">
                    <Label>Vendor</Label>
                    <Input
                      id={`job-material-vendor-${job?.id ?? "new"}-${index}`}
                      aria-label={`Material ${index + 1} vendor`}
                      value={material.vendor ?? ""}
                      onChange={(event) => {
                        const nextVendor = event.target.value;

                        setMaterials((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, vendor: nextVendor } : item,
                          ),
                        );

                        if (nextVendor.trim()) {
                          setLastMaterialVendor(nextVendor);
                        }
                      }}
                      list={materialVendorListId}
                      placeholder=""
                      className={mobileFieldClassName}
                    />
                  </div>
                  <div className="order-3 grid gap-2 sm:order-none sm:col-span-1">
                    <Label>{material.type === "return" ? "Return date" : "Purchase date"}</Label>
                    <Input
                      id={`job-material-date-${job?.id ?? "new"}-${index}`}
                      aria-label={`Material ${index + 1} date`}
                      value={material.purchaseDate ?? ""}
                      onChange={(event) =>
                        setMaterials((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, purchaseDate: event.target.value } : item,
                          ),
                        )
                      }
                      type="date"
                      className={mobileFieldClassName}
                    />
                  </div>
                  <div className="order-1 grid gap-2 sm:order-none">
                    <Label>Qty</Label>
                    <Input
                      id={`job-material-quantity-${job?.id ?? "new"}-${index}`}
                      aria-label={`Material ${index + 1} quantity`}
                      value={material.quantity}
                      onChange={(event) =>
                        setMaterials((current) =>
                          current.map((item, itemIndex) => {
                            if (itemIndex !== index) {
                              return item;
                            }

                            const nextItem = { ...item, quantity: event.target.value };
                            const nextPrice =
                              nextItem.quantity && nextItem.unitPrice ? calculateMaterialTotal(nextItem) : item.price;

                            return { ...nextItem, price: nextPrice };
                          }),
                        )
                      }
                      type="number"
                      min="0"
                      step="1"
                      placeholder=""
                      className={mobileFieldClassName}
                    />
                  </div>
                  <div className="order-2 grid gap-2 sm:order-none">
                    <Label>Unit price</Label>
                    <Input
                      id={`job-material-unit-price-${job?.id ?? "new"}-${index}`}
                      aria-label={`Material ${index + 1} unit price`}
                      value={material.unitPrice}
                      onChange={(event) =>
                        setMaterials((current) =>
                          current.map((item, itemIndex) => {
                            if (itemIndex !== index) {
                              return item;
                            }

                            const nextItem = { ...item, unitPrice: event.target.value };
                            const nextPrice =
                              nextItem.quantity && nextItem.unitPrice ? calculateMaterialTotal(nextItem) : item.price;

                            return { ...nextItem, price: nextPrice };
                          }),
                        )
                      }
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder=""
                      className={mobileFieldClassName}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border bg-muted/20 p-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
          <div className="grid gap-1">
            <Label>Job totals</Label>
            <p className="text-muted-foreground text-xs">
              Review calculated totals. Tax defaults to 8.25% but can be adjusted when needed.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`job-tax-rate-${job?.id ?? "new"}`}>Tax rate</Label>
            <div className="flex items-center gap-2">
              <Input
                id={`job-tax-rate-${job?.id ?? "new"}`}
                type="number"
                min="0"
                max="15"
                step="0.25"
                value={materialTaxRate}
                onChange={(event) => setMaterialTaxRate(toNumber(event.target.value))}
                className={mobileFieldClassName}
              />
              <span className="text-muted-foreground text-sm">%</span>
            </div>
          </div>

          {/*<div className="grid gap-2 rounded-md border border-dashed p-3 sm:col-span-1 xl:col-span-2">*/}
          {/*  <span className="font-medium text-sm">Payments</span>*/}
          {/*  <p className="text-muted-foreground text-sm">*/}
          {/*    Record deposits and additional payments from the job details transaction history.*/}
          {/*  </p>*/}
          {/*</div>*/}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-md bg-background p-3 sm:grid-cols-5">
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
            <span className="font-medium text-sm">${formatCurrency(materialTaxAmount)}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground text-xs">Final price</span>
            <span className="font-semibold text-base">${formatCurrency(finalCost)}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground text-xs">Balance due</span>
            <span className="font-semibold text-base">${formatCurrency(outstandingBalance)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
