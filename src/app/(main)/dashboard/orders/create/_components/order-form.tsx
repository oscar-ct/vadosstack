import * as React from "react";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { format, parseISO } from "date-fns";
import {
  CalendarIcon,
  Check,
  ChevronsUpDown,
  GripVertical,
  Hash,
  PackageSearch,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  Controller,
  type UseFormRegister,
  type UseFormSetValue,
  useFieldArray,
  useFormContext,
  useWatch,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { UsStateSelect } from "@/components/us-state-select";
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";

import type { InventoryItem } from "../../../inventory/_components/inventory-table";
import {
  clampOrderFooterMessage,
  getLineAmount,
  type OrderCustomer,
  type OrderCustomerAddress,
  type OrderFormValues,
  type OrderFulfillmentStatus,
  type OrderLineItem,
  type OrderPaymentStatus,
  orderFooterMaxLength,
  orderFooterMaxLines,
} from "./data";

const customAddressValue = "new-address";
const newCustomerValue = "new-customer";
const selectCustomerValue = "";
const paymentStatusOptions: OrderPaymentStatus[] = ["Pending", "Paid"];
const fulfillmentStatusOptions: OrderFulfillmentStatus[] = ["Unfulfilled", "Fulfilled", "Returned"];

function formatOrderCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

export function OrderForm({
  customers,
  disabled = false,
  inventoryItems,
}: {
  customers: OrderCustomer[];
  disabled?: boolean;
  inventoryItems: InventoryItem[];
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <Tabs defaultValue="order" className="gap-4">
        <TabsList className="w-full">
          <TabsTrigger value="order">Order</TabsTrigger>
          <TabsTrigger value="customer">Customer</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
        </TabsList>

        <TabsContent value="order" className="mt-0 flex flex-col gap-4">
          <OrderDetails disabled={disabled} />
          <Separator />
          <OrderAdjustments disabled={disabled} />
          <Separator />
          <OrderFooterMessage disabled={disabled} />
        </TabsContent>

        <TabsContent value="customer" className="mt-0">
          <CustomerDetails customers={customers} disabled={disabled} />
        </TabsContent>

        <TabsContent value="items" className="mt-0">
          <OrderItems disabled={disabled} inventoryItems={inventoryItems} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrderDetails({ disabled }: { disabled: boolean }) {
  const { control, register } = useFormContext<OrderFormValues>();

  return (
    <section className="flex flex-col gap-3">
      <FieldGroup>
        <Field className="gap-1">
          <FieldLabel className="text-xs" htmlFor="order-number">
            Order Number
          </FieldLabel>
          <InputGroup>
            <InputGroupInput id="order-number" disabled {...register("orderNumber")} />
            <InputGroupAddon align="inline-end">
              <Hash />
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Controller
            control={control}
            name="paymentStatus"
            render={({ field }) => (
              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="payment-status">
                  Payment Status
                </FieldLabel>
                <Select disabled={disabled} value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="payment-status" className="w-full">
                    <SelectValue placeholder="Payment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {paymentStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
          <Controller
            control={control}
            name="fulfillmentStatus"
            render={({ field }) => (
              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="fulfillment-status">
                  Fulfillment Status
                </FieldLabel>
                <Select disabled={disabled} value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="fulfillment-status" className="w-full">
                    <SelectValue placeholder="Fulfillment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {fulfillmentStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Controller
            control={control}
            name="orderDate"
            render={({ field }) => (
              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="order-date">
                  Order Date
                </FieldLabel>
                <DatePicker disabled={disabled} id="order-date" value={field.value} onChange={field.onChange} />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="deliveryRange"
            render={({ field }) => (
              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="delivery-range">
                  Estimated Delivery
                </FieldLabel>
                <DatePicker disabled={disabled} id="delivery-range" value={field.value} onChange={field.onChange} />
              </Field>
            )}
          />
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Field className="gap-1">
            <FieldLabel className="text-xs" htmlFor="delivery-company">
              Shipping Service
            </FieldLabel>
            <Input
              id="delivery-company"
              disabled={disabled}
              placeholder="USPS Priority Mail"
              {...register("deliveryCompany")}
            />
          </Field>
          <Field className="gap-1">
            <FieldLabel className="text-xs" htmlFor="tracking-number">
              Tracking Number
            </FieldLabel>
            <Input id="tracking-number" disabled={disabled} placeholder="1Z999AA..." {...register("trackingNumber")} />
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
          <Field className="gap-1">
            <FieldLabel className="text-xs" htmlFor="payment-method">
              Payment Method
            </FieldLabel>
            <Input
              id="payment-method"
              disabled={disabled}
              placeholder="Visa ending in 4242"
              {...register("paymentMethod")}
            />
          </Field>
          <Field className="gap-1">
            <FieldLabel className="text-xs" htmlFor="payment-reference">
              Ref #
            </FieldLabel>
            <Input
              id="payment-reference"
              disabled={disabled}
              placeholder="AUTH-8427"
              {...register("paymentReference")}
            />
          </Field>
        </div>
      </FieldGroup>
    </section>
  );
}

function getInitialCustomerSelection(order: OrderFormValues, customers: OrderCustomer[]) {
  const hasCustomerDetails = Boolean(order.customerName || order.customerEmail || order.customerPhone);
  if (!hasCustomerDetails) return selectCustomerValue;

  return (
    customers.find(
      (customer) =>
        customer.email === order.customerEmail ||
        customer.phone === order.customerPhone ||
        customer.name === order.customerName,
    )?.id ?? newCustomerValue
  );
}

function getInitialAddressSelection(order: OrderFormValues, customer?: OrderCustomer) {
  if (!customer) return customAddressValue;

  return (
    customer.addresses.find(
      (address) =>
        address.streetAddress === order.streetAddress &&
        address.apartment === order.apartment &&
        address.city === order.city &&
        address.state === order.state &&
        address.zip === order.zip,
    )?.id ??
    customer.addresses[0]?.id ??
    customAddressValue
  );
}

function formatAddressOption(address: OrderCustomerAddress) {
  const cityLine = [address.city, address.state, address.zip].filter(Boolean).join(", ");
  return [address.streetAddress, address.apartment, cityLine].filter(Boolean).join(", ");
}

function CustomerDetails({ customers, disabled }: { customers: OrderCustomer[]; disabled: boolean }) {
  const { control, getValues, register, setValue } = useFormContext<OrderFormValues>();
  const [customerPickerOpen, setCustomerPickerOpen] = React.useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState(() =>
    getInitialCustomerSelection(getValues(), customers),
  );
  const [selectedAddressId, setSelectedAddressId] = React.useState(() => {
    const order = getValues();
    const initialCustomer = customers.find(
      (customer) =>
        customer.email === order.customerEmail ||
        customer.phone === order.customerPhone ||
        customer.name === order.customerName,
    );

    return getInitialAddressSelection(order, initialCustomer);
  });
  const isCreatingNewCustomer = selectedCustomerId === newCustomerValue;
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const addressOptions = selectedCustomer?.addresses ?? [];
  const showCustomerFields = isCreatingNewCustomer || Boolean(selectedCustomer);
  const selectedCustomerLabel = React.useMemo(() => {
    if (isCreatingNewCustomer) return "New customer";
    return selectedCustomer?.name ?? "Select customer";
  }, [isCreatingNewCustomer, selectedCustomer]);

  function fillAddressFields(address: OrderCustomerAddress | null) {
    setValue("streetAddress", address?.streetAddress ?? "", { shouldDirty: true });
    setValue("apartment", address?.apartment ?? "", { shouldDirty: true });
    setValue("city", address?.city ?? "", { shouldDirty: true });
    setValue("state", address?.state ?? "", { shouldDirty: true });
    setValue("zip", address?.zip ?? "", { shouldDirty: true });
  }

  function fillCustomerFields(customer: OrderCustomer | null) {
    setValue("customerName", customer?.name ?? "", { shouldDirty: true });
    setValue("customerPhone", customer?.phone ?? "", { shouldDirty: true });
    setValue("customerEmail", customer?.email ?? "", { shouldDirty: true });
    fillAddressFields(customer?.addresses[0] ?? null);
  }

  function selectNewCustomer() {
    setSelectedCustomerId(newCustomerValue);
    setSelectedAddressId(customAddressValue);
    fillCustomerFields(null);
    setCustomerPickerOpen(false);
  }

  function selectCustomer(customer: OrderCustomer) {
    const primaryAddress = customer.addresses[0] ?? null;

    setSelectedCustomerId(customer.id);
    setSelectedAddressId(primaryAddress?.id ?? customAddressValue);
    fillCustomerFields(customer);
    setCustomerPickerOpen(false);
  }

  function selectAddress(value: string) {
    setSelectedAddressId(value);

    if (value === customAddressValue) {
      fillAddressFields(null);
      return;
    }

    fillAddressFields(addressOptions.find((address) => address.id === value) ?? null);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="grid content-start gap-3">
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
              disabled={disabled}
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
                  <CommandItem value="New customer" onSelect={selectNewCustomer}>
                    <Check className={cn("size-4", isCreatingNewCustomer ? "opacity-100" : "opacity-0")} />
                    New customer
                  </CommandItem>
                  {customers.map((customer) => (
                    <CommandItem key={customer.id} value={customer.name} onSelect={() => selectCustomer(customer)}>
                      <Check
                        className={cn("size-4", selectedCustomerId === customer.id ? "opacity-100" : "opacity-0")}
                      />
                      <span>{customer.name}</span>
                      <span className="ml-auto text-muted-foreground text-xs">{formatPhoneNumber(customer.phone)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p className="text-muted-foreground text-xs">
          Choose an existing customer or create one while building the order.
        </p>
      </div>

      {showCustomerFields ? (
        <FieldGroup>
          <div className="grid gap-5 md:grid-cols-2">
            <Field className="gap-1">
              <FieldLabel className="text-xs" htmlFor="customer-name">
                Name
              </FieldLabel>
              <Input id="customer-name" disabled={disabled} placeholder="Jane Smith" {...register("customerName")} />
            </Field>
            <Controller
              control={control}
              name="customerPhone"
              render={({ field }) => (
                <Field className="gap-1">
                  <FieldLabel className="text-xs" htmlFor="customer-phone">
                    Phone Number
                  </FieldLabel>
                  <Input
                    id="customer-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={14}
                    disabled={disabled}
                    placeholder="(555) 555-1234"
                    value={formatPhoneNumber(field.value)}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(normalizePhoneNumber(event.target.value).slice(0, 10))}
                  />
                </Field>
              )}
            />
            <Field className="gap-1 md:col-span-2">
              <FieldLabel className="text-xs" htmlFor="customer-email">
                Email
              </FieldLabel>
              <Input
                id="customer-email"
                type="email"
                disabled={disabled}
                placeholder="jane@example.com"
                {...register("customerEmail")}
              />
            </Field>
          </div>

          <h2 className="font-medium tracking-tight">Shipping To</h2>

          {selectedCustomer && addressOptions.length > 1 ? (
            <Field className="gap-1">
              <FieldLabel className="text-xs" htmlFor="shipping-address-select">
                Saved Address
              </FieldLabel>
              <Select disabled={disabled} value={selectedAddressId} onValueChange={selectAddress}>
                <SelectTrigger id="shipping-address-select" className="w-full min-w-0 overflow-hidden">
                  <SelectValue placeholder="Select shipping address" />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  <SelectGroup>
                    {addressOptions.map((address) => (
                      <SelectItem key={address.id} value={address.id} className="max-w-[calc(100vw-2rem)]">
                        <span className="block truncate">
                          {address.label
                            ? `${address.label}: ${formatAddressOption(address)}`
                            : formatAddressOption(address)}
                        </span>
                      </SelectItem>
                    ))}
                    <SelectItem value={customAddressValue}>New address</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.45fr)]">
            <Field className="gap-1">
              <FieldLabel className="text-xs" htmlFor="shipping-street">
                Street Address
              </FieldLabel>
              <Input
                id="shipping-street"
                disabled={disabled}
                placeholder="123 Main St"
                {...register("streetAddress")}
              />
            </Field>
            <Field className="gap-1">
              <FieldLabel className="text-xs" htmlFor="shipping-apartment">
                Apt/Suite
              </FieldLabel>
              <Input id="shipping-apartment" disabled={disabled} placeholder="Unit B" {...register("apartment")} />
            </Field>
          </div>

          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_150px_140px]">
            <Field className="gap-1">
              <FieldLabel className="text-xs" htmlFor="shipping-city">
                City
              </FieldLabel>
              <Input id="shipping-city" disabled={disabled} placeholder="Houston" {...register("city")} />
            </Field>
            <div className="grid grid-cols-2 gap-5 md:contents">
              <Controller
                control={control}
                name="state"
                render={({ field }) => (
                  <Field className="gap-1">
                    <FieldLabel className="text-xs" htmlFor="shipping-state">
                      State
                    </FieldLabel>
                    <UsStateSelect
                      id="shipping-state"
                      disabled={disabled}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </Field>
                )}
              />
              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="shipping-zip">
                  ZIP
                </FieldLabel>
                <Input
                  id="shipping-zip"
                  inputMode="numeric"
                  disabled={disabled}
                  placeholder="77001"
                  {...register("zip")}
                />
              </Field>
            </div>
          </div>

          <Field className="gap-1">
            <FieldLabel className="text-xs" htmlFor="customer-notes">
              Customer Notes
            </FieldLabel>
            <Textarea
              id="customer-notes"
              className="min-h-24 resize-none text-sm"
              disabled={disabled}
              placeholder="Delivery instructions, order requests, or notes from the customer"
              {...register("customerNotes")}
            />
          </Field>
        </FieldGroup>
      ) : null}
    </section>
  );
}

function OrderAdjustments({ disabled }: { disabled: boolean }) {
  const { register } = useFormContext<OrderFormValues>();

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-medium tracking-tight">Adjustments</h2>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field className="gap-1">
          <FieldLabel className="text-xs" htmlFor="order-shipping">
            Shipping
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="order-shipping"
              type="number"
              min="0"
              step="0.01"
              disabled={disabled}
              {...register("shipping", { valueAsNumber: true })}
            />
            <InputGroupAddon align="inline-end">$</InputGroupAddon>
          </InputGroup>
        </Field>
        <Field className="gap-1">
          <FieldLabel className="text-xs" htmlFor="order-tax">
            Tax Rate
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="order-tax"
              type="number"
              min="0"
              step="0.01"
              disabled={disabled}
              {...register("tax", { valueAsNumber: true })}
            />
            <InputGroupAddon align="inline-end">%</InputGroupAddon>
          </InputGroup>
        </Field>
        <Field className="gap-1">
          <FieldLabel className="text-xs" htmlFor="order-discount">
            Discount
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="order-discount"
              type="number"
              min="0"
              step="0.01"
              disabled={disabled}
              {...register("discount", { valueAsNumber: true })}
            />
            <InputGroupAddon align="inline-end">$</InputGroupAddon>
          </InputGroup>
        </Field>
      </div>
    </section>
  );
}

function OrderFooterMessage({ disabled }: { disabled: boolean }) {
  const { register } = useFormContext<OrderFormValues>();
  const footerMessageField = register("footerMessage", {
    onChange: (event) => {
      const target = event.target as HTMLTextAreaElement;
      const nextValue = clampOrderFooterMessage(target.value);

      if (target.value !== nextValue) {
        target.value = nextValue;
      }
    },
  });

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-medium tracking-tight">Footer Message</h2>
        <p className="text-muted-foreground text-sm">
          Shown at the bottom of the order confirmation preview. Limited to {orderFooterMaxLines} lines.
        </p>
      </div>

      <Field className="gap-1">
        <FieldLabel className="text-xs" htmlFor="order-footer-message">
          Message
        </FieldLabel>
        <Textarea
          id="order-footer-message"
          className="h-[5.25rem] resize-none text-sm"
          disabled={disabled}
          maxLength={orderFooterMaxLength}
          placeholder="Thank you for your order."
          rows={orderFooterMaxLines}
          {...footerMessageField}
        />
      </Field>
    </section>
  );
}

function DatePicker({
  disabled,
  id,
  onChange,
  value,
}: {
  disabled: boolean;
  id: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [open, setOpen] = React.useState(false);
  const date = parseDateValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!date}
          className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
        >
          {date ? format(date, "PPP") : <span>Pick a date</span>}
          <CalendarIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Calendar
          className="w-full"
          mode="single"
          selected={date}
          onSelect={(selectedDate) => {
            if (!selectedDate) return;

            onChange(format(selectedDate, "yyyy-MM-dd"));
            setOpen(false);
          }}
          defaultMonth={date}
        />
      </PopoverContent>
    </Popover>
  );
}

function parseDateValue(value: string) {
  const date = parseISO(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function OrderItems({ disabled, inventoryItems }: { disabled: boolean; inventoryItems: InventoryItem[] }) {
  const { control, register, setValue } = useFormContext<OrderFormValues>();
  const { append, fields, move, remove } = useFieldArray({
    control,
    keyName: "fieldKey",
    name: "items",
  });
  const items = useWatch({ control, name: "items" }) ?? [];
  const sortableItemIds = fields.map((field) => field.id);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    if (disabled) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((field) => field.id === active.id);
    const newIndex = fields.findIndex((field) => field.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    move(oldIndex, newIndex);
  }

  function handleAddItem() {
    append({
      id: crypto.randomUUID(),
      category: "",
      product: "",
      quantity: 1,
      sku: "",
      unitPrice: 0,
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium tracking-tight">Order Items</h2>
          <p className="text-muted-foreground text-sm">Add products, categories, quantities, and pricing.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={handleAddItem}>
          <Plus />
          Add Item
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <DndContext
          id="order-items"
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableItemIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {fields.map((field, index) => (
                <SortableOrderItemRow
                  key={field.fieldKey}
                  disabled={disabled}
                  id={field.id}
                  index={index}
                  item={items[index]}
                  inventoryItems={inventoryItems}
                  orderItems={items}
                  register={register}
                  removeDisabled={fields.length === 1}
                  setValue={setValue}
                  onRemove={() => remove(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </section>
  );
}

function SortableOrderItemRow({
  disabled,
  id,
  index,
  inventoryItems,
  item,
  onRemove,
  orderItems,
  register,
  removeDisabled,
  setValue,
}: {
  disabled: boolean;
  id: string;
  index: number;
  inventoryItems: InventoryItem[];
  item?: OrderLineItem;
  onRemove: () => void;
  orderItems: OrderLineItem[];
  register: UseFormRegister<OrderFormValues>;
  removeDisabled: boolean;
  setValue: UseFormSetValue<OrderFormValues>;
}) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform, transition } = useSortable({
    disabled,
    id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
      }}
      className={cn(
        "grid min-w-0 grid-cols-[24px_minmax(0,1fr)_28px] gap-2 rounded-lg border bg-muted/10 p-2",
        isDragging && "relative z-10 opacity-50",
      )}
    >
      <Button
        ref={setActivatorNodeRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        className="-ml-2 cursor-grab text-muted-foreground active:cursor-grabbing"
        aria-label={`Reorder item ${index + 1}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical />
      </Button>

      <div className="grid min-w-0 gap-3">
        <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)_96px_140px] xl:grid-cols-2">
          <Field className="col-start-1 row-start-2 min-w-0 gap-1 lg:row-start-1 xl:row-start-2">
            <FieldLabel className="text-xs" htmlFor={`order-item-sku-${index}`}>
              SKU
            </FieldLabel>
            <Input
              id={`order-item-sku-${index}`}
              className="font-mono text-sm"
              disabled={disabled}
              placeholder="SKU"
              {...register(`items.${index}.sku` as const)}
            />
          </Field>
          <Field className="col-span-2 row-start-1 min-w-0 gap-1 lg:col-span-3 lg:col-start-2 xl:col-span-2 xl:col-start-1">
            <FieldLabel className="text-xs" htmlFor={`order-item-product-${index}`}>
              Product
            </FieldLabel>
            <InventoryProductPicker
              disabled={disabled}
              index={index}
              inventoryItems={inventoryItems}
              item={item}
              orderItems={orderItems}
              register={register}
              setValue={setValue}
            />
          </Field>
          <Field className="col-start-2 row-start-2 min-w-0 gap-1 lg:col-start-1 xl:col-start-2">
            <FieldLabel className="text-xs" htmlFor={`order-item-category-${index}`}>
              Category
            </FieldLabel>
            <Input
              id={`order-item-category-${index}`}
              className="min-w-0 text-sm"
              disabled={disabled}
              placeholder="Category"
              {...register(`items.${index}.category` as const)}
            />
          </Field>
          <div className="col-span-2 row-start-3 grid min-w-0 grid-cols-2 items-end gap-3 lg:col-span-3 lg:col-start-2 lg:row-start-2 xl:col-span-2 xl:col-start-1 xl:row-start-3">
            <Field className="min-w-0 gap-1 lg:max-xl:max-w-24">
              <FieldLabel className="text-xs" htmlFor={`order-item-quantity-${index}`}>
                Qty
              </FieldLabel>
              <Input
                id={`order-item-quantity-${index}`}
                type="number"
                min="1"
                step="1"
                className="min-w-0 text-sm"
                disabled={disabled}
                {...register(`items.${index}.quantity` as const, { min: 1, valueAsNumber: true })}
              />
            </Field>
            <Field className="min-w-0 gap-1">
              <FieldLabel className="text-xs" htmlFor={`order-item-unit-price-${index}`}>
                Unit Price
              </FieldLabel>
              <Input
                id={`order-item-unit-price-${index}`}
                type="number"
                min="0"
                step="0.01"
                className="min-w-0 text-sm"
                disabled={disabled}
                {...register(`items.${index}.unitPrice` as const, { min: 0, valueAsNumber: true })}
              />
            </Field>
          </div>
          <div className="col-span-2 row-start-4 flex min-h-8 items-center justify-between gap-3 border-t pt-2 lg:col-span-4 lg:row-start-3 xl:col-span-2 xl:row-start-4">
            <span className="font-medium text-muted-foreground text-xs">Line Total</span>
            <span className="font-medium text-sm tabular-nums">{formatOrderCurrency(getLineAmount(item))}</span>
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="-mr-2 text-muted-foreground"
        aria-label={`Remove item ${index + 1}`}
        disabled={disabled ? true : removeDisabled}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

function InventoryProductPicker({
  disabled,
  index,
  inventoryItems,
  item,
  orderItems,
  register,
  setValue,
}: {
  disabled: boolean;
  index: number;
  inventoryItems: InventoryItem[];
  item?: OrderLineItem;
  orderItems: OrderLineItem[];
  register: UseFormRegister<OrderFormValues>;
  setValue: UseFormSetValue<OrderFormValues>;
}) {
  const [open, setOpen] = React.useState(false);
  const [manualMode, setManualMode] = React.useState(() => Boolean(item?.product && !item.inventoryItemId));
  const selectedInventoryItem = item?.inventoryItemId
    ? inventoryItems.find((inventoryItem) => inventoryItem.id === item.inventoryItemId)
    : undefined;
  const buttonLabel = item?.product || "Select product";

  function selectCustomItem() {
    setValue(`items.${index}.inventoryItemId`, undefined, { shouldDirty: true });
    setValue(`items.${index}.sku`, "", { shouldDirty: true });
    setValue(`items.${index}.product`, "", { shouldDirty: true });
    setValue(`items.${index}.category`, "", { shouldDirty: true });
    setValue(`items.${index}.unitPrice`, 0, { shouldDirty: true });
    setManualMode(true);
    setOpen(false);
  }

  function selectInventoryItem(inventoryItem: InventoryItem) {
    setValue(`items.${index}.inventoryItemId`, inventoryItem.id, { shouldDirty: true });
    setValue(`items.${index}.sku`, inventoryItem.sku, { shouldDirty: true });
    setValue(`items.${index}.product`, inventoryItem.product, { shouldDirty: true });
    setValue(`items.${index}.category`, inventoryItem.category, { shouldDirty: true });
    setValue(`items.${index}.unitPrice`, inventoryItem.unitPrice, { shouldDirty: true });
    setManualMode(false);
    setOpen(false);
  }

  if (manualMode) {
    return (
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Input
          id={`order-item-product-${index}`}
          className="min-w-0 text-sm"
          disabled={disabled}
          placeholder="Product"
          {...register(`items.${index}.product` as const)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Select from inventory"
          disabled={disabled}
          onClick={() => {
            setManualMode(false);
            setOpen(true);
          }}
        >
          <PackageSearch />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={`order-item-product-${index}`}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-8 min-w-0 max-w-full justify-between overflow-hidden bg-background px-2.5 font-normal"
        >
          <span className="min-w-0 truncate text-left">
            <span className={cn(!item?.product && "text-muted-foreground")}>{buttonLabel}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search SKU or product..." />
          <CommandList>
            <CommandEmpty>No inventory items found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="Custom item" onSelect={selectCustomItem}>
                <PackageSearch className="size-4 text-muted-foreground" />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <div className="truncate font-medium">Custom item</div>
                  <div className="truncate text-muted-foreground text-xs">
                    Use a one-off product not saved in inventory
                  </div>
                </div>
              </CommandItem>
              {inventoryItems.map((inventoryItem) => {
                const isOutOfStock = inventoryItem.stock <= 0;
                const isAlreadyAdded = orderItems.some(
                  (orderItem, orderItemIndex) =>
                    orderItemIndex !== index && orderItem.inventoryItemId === inventoryItem.id,
                );
                const isUnavailable = isOutOfStock || isAlreadyAdded;

                return (
                  <CommandItem
                    key={inventoryItem.id}
                    value={`${inventoryItem.sku} ${inventoryItem.product}`}
                    disabled={isUnavailable}
                    onSelect={() => {
                      if (isUnavailable) return;
                      selectInventoryItem(inventoryItem);
                    }}
                  >
                    <PackageSearch className="size-4 text-muted-foreground" />
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <div className={cn("truncate font-medium", isUnavailable && "text-muted-foreground")}>
                        {inventoryItem.product}
                      </div>
                      <div className="truncate text-muted-foreground text-xs">
                        {inventoryItem.sku} · {inventoryItem.category} ·{" "}
                        {isAlreadyAdded
                          ? "Already added"
                          : isOutOfStock
                            ? "Out of stock"
                            : `${inventoryItem.stock} in stock`}
                      </div>
                    </div>
                    <span className="font-medium text-xs tabular-nums">
                      {formatOrderCurrency(inventoryItem.unitPrice)}
                    </span>
                    <Check
                      className={cn(
                        "size-4",
                        selectedInventoryItem?.id === inventoryItem.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
