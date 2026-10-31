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
import { format, parseISO, startOfMonth } from "date-fns";
import { enGB } from "date-fns/locale";
import {
  CalendarIcon,
  Check,
  ChevronsUpDown,
  CircleDollarSign,
  Clock3,
  GripVertical,
  Hash,
  PackageCheck,
  PackageSearch,
  PackageX,
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
import { isWalkInOrder, type OrderDeliveryMethod, WALK_IN_CUSTOMER_NAME } from "@/lib/commerce/order-customer";
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";

import type { InventoryItem } from "../../../inventory/_components/inventory-table";
import {
  clampOrderFooterMessage,
  getLineAmount,
  getOrderTotal,
  type OrderCustomer,
  type OrderCustomerAddress,
  type OrderFormValues,
  type OrderFulfillmentStatus,
  type OrderLineItem,
  type OrderPaymentStatus,
  orderFooterMaxLength,
  orderFooterMaxLines,
  orderNeedsShipping,
} from "./data";
import { getOrderStepValidationError } from "./order-input";
import { type OrderStep, orderSteps } from "./order-steps";

const customAddressValue = "new-address";
const newCustomerValue = "new-customer";
const walkInCustomerValue = "walk-in";
const selectCustomerValue = "";
const paymentStatusOptions: OrderPaymentStatus[] = [
  "Pending",
  "Paid",
  "Partially Paid",
  "Partially Refunded",
  "Refunded",
];
const fulfillmentStatusOptions: OrderFulfillmentStatus[] = ["Unfulfilled", "Fulfilled", "Partially Fulfilled"];

function formatOrderCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

function formatMoneyInputOnBlur(event: React.FocusEvent<HTMLInputElement>) {
  const value = event.currentTarget.value.trim();

  if (!value) return;

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) return;

  event.currentTarget.value = parsedValue.toFixed(2);
}

export function OrderForm({
  customers,
  disabled = false,
  creating = false,
  canRecordPayment = false,
  canOverridePrices = false,
  inventoryItems,
  activeStep = "customer",
  furthestStep = 0,
  onStepChange,
  validationError,
  validationAttempt = 0,
  footer,
}: {
  customers: OrderCustomer[];
  disabled?: boolean;
  creating?: boolean;
  canRecordPayment?: boolean;
  canOverridePrices?: boolean;
  inventoryItems: InventoryItem[];
  activeStep?: OrderStep;
  furthestStep?: number;
  onStepChange?: (step: OrderStep) => void;
  validationError?: string | null;
  validationAttempt?: number;
  footer?: React.ReactNode;
}) {
  const { control } = useFormContext<OrderFormValues>();
  const order = useWatch({ control }) as OrderFormValues;
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const errorRef = React.useRef<HTMLParagraphElement>(null);
  const formRef = React.useRef<HTMLDivElement>(null);
  const previousStep = React.useRef(activeStep);
  const panelId = React.useId();
  React.useEffect(() => {
    if (previousStep.current !== activeStep) {
      headingRef.current?.focus({ preventScroll: true });
      formRef.current?.scrollIntoView({ block: "start" });
    }
    previousStep.current = activeStep;
  }, [activeStep]);
  React.useEffect(() => {
    if (validationAttempt > 0) {
      errorRef.current?.focus({ preventScroll: true });
      errorRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [validationAttempt]);
  const review = (
    <>
      {creating ? <OrderReviewSummary order={order} onStepChange={onStepChange} disabled={disabled} /> : null}
      <OrderDetails disabled={disabled} creating={creating} canRecordPayment={canRecordPayment} />
      <Separator />
      <OrderAdjustments disabled={disabled} />
      <Separator />
      <OrderFooterMessage disabled={disabled} />
    </>
  );
  const customer = <CustomerDetails customers={customers} disabled={disabled} />;
  const items = (
    <OrderItems disabled={disabled} inventoryItems={inventoryItems} canOverridePrices={canOverridePrices} />
  );
  const stepIndex = orderSteps.findIndex((step) => step.id === activeStep);
  const step = orderSteps[stepIndex];
  return (
    <div ref={formRef} className="flex min-w-0 scroll-mt-20 flex-col gap-5 rounded-xl border bg-card p-4">
      {creating ? (
        <>
          <nav aria-label="Order creation steps">
            <ol className="grid grid-cols-3 gap-2">
              {orderSteps.map((entry, index) => {
                const completed = index < furthestStep && !getOrderStepValidationError(order, entry.id, true);
                return (
                  <li key={entry.id} className="min-w-0">
                    <button
                      type="button"
                      aria-current={activeStep === entry.id ? "step" : undefined}
                      aria-controls={panelId}
                      aria-label={`Step ${index + 1}: ${entry.title}${completed ? ", completed" : ""}`}
                      disabled={disabled ? true : index > furthestStep}
                      className={cn(
                        "flex h-full w-full min-w-0 flex-col items-start gap-2 rounded-lg border p-2 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-50 sm:flex-row sm:items-center sm:p-3 sm:text-sm",
                        activeStep === entry.id
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-transparent bg-muted/40 hover:bg-muted",
                      )}
                      onClick={() => onStepChange?.(entry.id)}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-full text-xs",
                          activeStep === entry.id
                            ? "bg-primary text-primary-foreground"
                            : completed
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {completed ? <Check className="size-3.5" /> : index + 1}
                      </span>
                      <span className="min-w-0 leading-tight">{entry.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          <section
            id={panelId}
            aria-labelledby={`${panelId}-title`}
            aria-describedby={validationError ? `${panelId}-error` : undefined}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-1">
              <p className="text-muted-foreground text-xs">
                Step {stepIndex + 1} of {orderSteps.length}
              </p>
              <h2
                id={`${panelId}-title`}
                ref={headingRef}
                tabIndex={-1}
                className="w-fit font-medium text-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {step.title}
              </h2>
              <p className="text-muted-foreground text-sm">{step.description}</p>
            </div>
            {validationError ? (
              <p
                id={`${panelId}-error`}
                role="alert"
                tabIndex={-1}
                ref={errorRef}
                className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive text-sm"
              >
                {validationError}
              </p>
            ) : null}
            {activeStep === "customer" ? customer : activeStep === "items" ? items : review}
          </section>
          {footer ? <div className="border-t pt-4">{footer}</div> : null}
        </>
      ) : (
        <Tabs defaultValue="customer" className="gap-4">
          <TabsList className="w-full">
            <TabsTrigger value="customer">Customer</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="review">Order details</TabsTrigger>
          </TabsList>
          <TabsContent value="customer" className="mt-0">
            {customer}
          </TabsContent>
          <TabsContent value="items" className="mt-0">
            {items}
          </TabsContent>
          <TabsContent value="review" className="mt-0 flex flex-col gap-4">
            {review}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function OrderReviewSummary({
  order,
  onStepChange,
  disabled,
}: {
  order: OrderFormValues;
  onStepChange?: (step: OrderStep) => void;
  disabled: boolean;
}) {
  return (
    <section aria-label="Order summary" className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h3 className="font-medium">{isWalkInOrder(order) ? WALK_IN_CUSTOMER_NAME : order.customerName}</h3>
          <p className="break-words text-muted-foreground text-xs">
            {orderNeedsShipping(order)
              ? ["Delivery", order.streetAddress, order.apartment, order.city, order.state, order.zip]
                  .filter(Boolean)
                  .join(" · ")
              : "In-person pickup"}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onStepChange?.("customer")}>
          Edit customer
        </Button>
      </div>
      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <p>
          {order.items.length} {order.items.length === 1 ? "item" : "items"} ·{" "}
          {order.items.reduce((sum, item) => sum + item.quantity, 0)} units
        </p>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onStepChange?.("items")}>
          Edit items
        </Button>
      </div>
      <div className="flex items-center justify-between gap-3 border-t pt-3 font-medium">
        <span>Order total</span>
        <span className="tabular-nums">{formatOrderCurrency(getOrderTotal(order))}</span>
      </div>
    </section>
  );
}

function OrderDetails({
  disabled,
  creating,
  canRecordPayment,
}: {
  disabled: boolean;
  creating: boolean;
  canRecordPayment: boolean;
}) {
  const { control, register, setValue } = useFormContext<OrderFormValues>();
  const watchedOrder = useWatch({ control }) as OrderFormValues;
  const needsDelivery = orderNeedsShipping(watchedOrder);

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

        <section className="grid gap-4 rounded-xl border-2 border-primary/25 bg-primary/[0.025] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="grid gap-1">
              <h3 className="font-semibold text-base">Confirm order status</h3>
              <p className="text-muted-foreground text-xs">
                Choose what has actually happened. These selections create payment and fulfillment records.
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary text-xs">
              Review carefully
            </span>
          </div>

          <div className={cn("grid gap-4", !creating && "sm:grid-cols-2")}>
            <Controller
              control={control}
              name="paymentStatus"
              render={({ field }) => {
                const options = creating
                  ? paymentStatusOptions.filter((status) => status === "Paid" || status === "Pending")
                  : [field.value];
                return (
                  <Field className="gap-2">
                    <FieldLabel className="font-semibold text-sm" id="payment-status-label">
                      1. Has payment been received?
                    </FieldLabel>
                    <div
                      aria-labelledby="payment-status-label"
                      className={cn("grid gap-2", creating && "sm:grid-cols-2")}
                      role="radiogroup"
                    >
                      {options.map((status) => (
                        <StatusChoice
                          key={status}
                          checked={field.value === status}
                          description={paymentStatusDescription(status)}
                          disabled={disabled || !creating || !canRecordPayment}
                          icon={status === "Paid" ? <CircleDollarSign /> : <Clock3 />}
                          label={status}
                          name="payment-status"
                          onClick={() => {
                            if (field.value !== status)
                              setValue("externalPaymentConfirmed", false, { shouldDirty: true });
                            field.onChange(status);
                          }}
                          tone={status === "Paid" ? "success" : "warning"}
                        />
                      ))}
                    </div>
                    {creating && !canRecordPayment ? (
                      <p className="text-muted-foreground text-xs">
                        You can create this order as Pending. An authorized user can record payment afterward.
                      </p>
                    ) : null}
                  </Field>
                );
              }}
            />
            <Controller
              control={control}
              name="fulfillmentStatus"
              render={({ field }) => {
                const options = creating
                  ? fulfillmentStatusOptions.filter((status) => status !== "Partially Fulfilled")
                  : [field.value];
                return (
                  <Field className="gap-2">
                    <FieldLabel className="font-semibold text-sm" id="fulfillment-status-label">
                      2. Have the items left your possession?
                    </FieldLabel>
                    <div
                      aria-labelledby="fulfillment-status-label"
                      className={cn("grid gap-2", creating && "sm:grid-cols-2")}
                      role="radiogroup"
                    >
                      {options.map((status) => (
                        <StatusChoice
                          key={status}
                          checked={field.value === status}
                          description={fulfillmentStatusDescription(status)}
                          disabled={disabled || !creating}
                          icon={status === "Fulfilled" ? <PackageCheck /> : <PackageX />}
                          label={status}
                          name="fulfillment-status"
                          onClick={() => field.onChange(status)}
                          tone={status === "Fulfilled" ? "success" : "warning"}
                        />
                      ))}
                    </div>
                  </Field>
                );
              }}
            />
          </div>

          {creating && canRecordPayment && watchedOrder.paymentStatus === "Paid" ? (
            <label className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/40">
              <input
                className="mt-0.5 size-4 shrink-0 accent-emerald-600"
                type="checkbox"
                disabled={disabled}
                {...register("externalPaymentConfirmed")}
              />
              <span className="grid gap-0.5">
                <strong>Required payment confirmation</strong>
                <span>
                  I confirm the full order amount has already been received externally. VadosStack will record it but
                  will not charge a card.
                </span>
              </span>
            </label>
          ) : null}

          <p className="rounded-md bg-background/80 px-3 py-2 font-medium text-sm" aria-live="polite">
            This order will be recorded as <strong>{watchedOrder.paymentStatus}</strong> and{" "}
            <strong>{watchedOrder.fulfillmentStatus}</strong>.
          </p>
          <p className="text-muted-foreground text-xs">
            Unpaid, unshipped orders hold stock for seven days. Backorders are not accepted. After creation, use Order
            operations to record payments, fulfillment, corrections, and returns.
          </p>
        </section>
        <div className="grid grid-cols-2 gap-3 sm:gap-5">
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
          {needsDelivery ? (
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
          ) : null}
        </div>

        {needsDelivery ? (
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
              <Input
                id="tracking-number"
                disabled={disabled}
                placeholder="1Z999AA..."
                {...register("trackingNumber")}
              />
            </Field>
          </div>
        ) : null}

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

function paymentStatusDescription(status: OrderPaymentStatus) {
  if (status === "Paid") return "The full amount has already been received.";
  if (status === "Pending") return "No payment has been received; the full balance is due.";
  if (status === "Partially Paid") return "Part of the order total has been received.";
  if (status === "Partially Refunded") return "Some received funds have been returned.";
  return "All received funds have been returned.";
}

function fulfillmentStatusDescription(status: OrderFulfillmentStatus) {
  if (status === "Fulfilled") return "Every item has been shipped or handed to the customer.";
  if (status === "Unfulfilled") return "No item has been shipped or handed to the customer.";
  return "Only some of the ordered items have left your possession.";
}

function StatusChoice({
  checked,
  description,
  disabled,
  icon,
  label,
  name,
  onClick,
  tone,
}: {
  checked: boolean;
  description: string;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  name: string;
  onClick: () => void;
  tone: "success" | "warning";
}) {
  return (
    <label
      className={cn(
        "flex min-h-24 items-start gap-3 rounded-lg border bg-background p-3 text-left transition-colors",
        "has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
        disabled ? "cursor-not-allowed opacity-75" : "cursor-pointer hover:border-primary/50",
        checked &&
          (tone === "success"
            ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 dark:bg-emerald-950/40"
            : "border-amber-500 bg-amber-50 ring-1 ring-amber-500 dark:bg-amber-950/40"),
      )}
    >
      <input checked={checked} className="sr-only" disabled={disabled} name={name} onChange={onClick} type="radio" />
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full [&>svg]:size-4",
          checked
            ? tone === "success"
              ? "bg-emerald-600 text-white"
              : "bg-amber-500 text-white"
            : "bg-muted text-muted-foreground",
        )}
      >
        {checked ? <Check /> : icon}
      </span>
      <span className="grid gap-1">
        <span className="font-semibold text-sm">{label}</span>
        <span className="text-muted-foreground text-xs leading-relaxed">{description}</span>
      </span>
    </label>
  );
}

function getInitialCustomerSelection(order: OrderFormValues, customers: OrderCustomer[]) {
  if (isWalkInOrder(order)) return walkInCustomerValue;
  if (order.customerId)
    return customers.some((customer) => customer.id === order.customerId) ? order.customerId : newCustomerValue;
  if (!order.customerName && !order.customerEmail && !order.customerPhone) return selectCustomerValue;
  return (
    customers.find(
      (customer) =>
        (order.customerEmail && customer.email === order.customerEmail) ||
        (order.customerPhone && customer.phone === order.customerPhone) ||
        (order.customerName && customer.name === order.customerName),
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
    )?.id ?? customAddressValue
  );
}

function formatAddressOption(address: OrderCustomerAddress) {
  const cityLine = [address.city, address.state, address.zip].filter(Boolean).join(", ");
  return [address.streetAddress, address.apartment, cityLine].filter(Boolean).join(", ");
}

function CustomerDetails({ customers, disabled }: { customers: OrderCustomer[]; disabled: boolean }) {
  const { control, register, setValue } = useFormContext<OrderFormValues>();
  const [customerPickerOpen, setCustomerPickerOpen] = React.useState(false);
  const order = useWatch({ control }) as OrderFormValues;
  const selectedCustomerId = order.customerSelection ?? getInitialCustomerSelection(order, customers);
  const setSelectedCustomerId = (value: string) => setValue("customerSelection", value, { shouldDirty: true });
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const selectedAddressId = order.addressSelection ?? getInitialAddressSelection(order, selectedCustomer);
  const setSelectedAddressId = (value: string) => setValue("addressSelection", value, { shouldDirty: true });
  const isWalkIn = selectedCustomerId === walkInCustomerValue;
  const needsDelivery = orderNeedsShipping(order);
  const isCreatingNewCustomer = selectedCustomerId === newCustomerValue;
  const addressOptions = selectedCustomer?.addresses ?? [];
  const showCustomerFields = isWalkIn || isCreatingNewCustomer || Boolean(selectedCustomer);
  const selectedCustomerLabel = React.useMemo(() => {
    if (isCreatingNewCustomer) return "Customer details";
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
    setValue("customerMode", "customer", { shouldDirty: true });
    setValue("customerId", null, { shouldDirty: true });
    setSelectedCustomerId(newCustomerValue);
    setSelectedAddressId(customAddressValue);
    fillCustomerFields(null);
    setCustomerPickerOpen(false);
  }

  function selectCustomer(customer: OrderCustomer) {
    const primaryAddress = customer.addresses[0] ?? null;

    setValue("customerMode", "customer", { shouldDirty: true });
    setValue("customerId", customer.id, { shouldDirty: true });
    setSelectedCustomerId(customer.id);
    setSelectedAddressId(primaryAddress?.id ?? customAddressValue);
    fillCustomerFields(customer);
    if (!needsDelivery) fillAddressFields(null);
    setCustomerPickerOpen(false);
  }

  function selectDelivery(method: OrderDeliveryMethod) {
    setValue("deliveryMethod", method, { shouldDirty: true });
    if (method === "pickup") {
      fillAddressFields(null);
      setValue("shipping", 0, { shouldDirty: true });
      setValue("deliveryCompany", "", { shouldDirty: true });
      setValue("deliveryRange", "", { shouldDirty: true });
      setValue("trackingNumber", "", { shouldDirty: true });
    } else if (selectedCustomer) {
      fillAddressFields(
        selectedCustomer.addresses.find((address) => address.id === selectedAddressId) ??
          selectedCustomer.addresses[0] ??
          null,
      );
    }
  }

  function selectWalkIn() {
    setSelectedCustomerId(walkInCustomerValue);
    setSelectedAddressId(customAddressValue);
    fillCustomerFields(null);
    setValue("customerMode", "walk_in", { shouldDirty: true });
    setValue("customerId", null, { shouldDirty: true });
    setValue("customerName", WALK_IN_CUSTOMER_NAME, { shouldDirty: true });
    setValue("customerNotes", "", { shouldDirty: true });
    selectDelivery("pickup");
    setCustomerPickerOpen(false);
  }

  function selectCustomerMode() {
    setValue("customerMode", "customer", { shouldDirty: true });
    setValue("customerId", null, { shouldDirty: true });
    setSelectedCustomerId(selectCustomerValue);
    fillCustomerFields(null);
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
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-medium text-sm">Customer type</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "customer", label: "Customer details", help: "Choose a profile or enter a name" },
            { value: "walk_in", label: "Walk-in customer", help: "No profile or name required" },
          ].map((choice) => (
            <label
              key={choice.value}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm",
                (choice.value === "walk_in" ? isWalkIn : !isWalkIn) && "border-foreground bg-muted/50",
              )}
            >
              <input
                type="radio"
                name="customer-type"
                value={choice.value}
                checked={choice.value === "walk_in" ? isWalkIn : !isWalkIn}
                disabled={disabled}
                onChange={() => (choice.value === "walk_in" ? selectWalkIn() : selectCustomerMode())}
                className="mt-1"
              />
              <span className="grid gap-1">
                <span className="font-medium">{choice.label}</span>
                <span className="text-muted-foreground text-xs">{choice.help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {!isWalkIn ? (
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
                className="h-8 w-full justify-between bg-background font-normal text-base md:text-sm"
              >
                <span className="truncate">{selectedCustomerLabel}</span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
              <Command>
                <CommandInput className="text-base md:text-sm" placeholder="Search customers..." />
                <CommandList>
                  <CommandEmpty>No customers found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="Enter customer details" onSelect={selectNewCustomer}>
                      <Check className={cn("size-4", isCreatingNewCustomer ? "opacity-100" : "opacity-0")} />
                      Enter customer details
                    </CommandItem>
                    {customers.map((customer) => (
                      <CommandItem key={customer.id} value={customer.name} onSelect={() => selectCustomer(customer)}>
                        <Check
                          className={cn("size-4", selectedCustomerId === customer.id ? "opacity-100" : "opacity-0")}
                        />
                        <span>{customer.name}</span>
                        <span className="ml-auto text-muted-foreground text-xs">
                          {formatPhoneNumber(customer.phone)}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-muted-foreground text-xs">
            Choose a saved profile or enter customer details for this order.
          </p>
        </div>
      ) : (
        <p className="rounded-lg bg-muted/40 p-3 text-muted-foreground text-sm">
          This order will use “Walk-in customer.” No customer profile will be created. Contact details are optional.
        </p>
      )}
      <Field className="gap-1">
        <FieldLabel className="text-xs" htmlFor="order-delivery-method">
          How will the customer receive the order?
        </FieldLabel>
        <Select
          disabled={disabled}
          value={needsDelivery ? "delivery" : "pickup"}
          onValueChange={(value) => selectDelivery(value as OrderDeliveryMethod)}
        >
          <SelectTrigger id="order-delivery-method" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pickup">In-person pickup</SelectItem>
            <SelectItem value="delivery">Delivery / shipping</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {showCustomerFields ? (
        <FieldGroup>
          {!isWalkIn ? (
            <Field className="gap-1">
              <FieldLabel className="text-xs" htmlFor="customer-name">
                Name
              </FieldLabel>
              <Input id="customer-name" disabled={disabled} placeholder="Jane Smith" {...register("customerName")} />
            </Field>
          ) : null}

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <Controller
              control={control}
              name="customerPhone"
              render={({ field }) => (
                <Field className="min-w-0 gap-1">
                  <FieldLabel className="text-xs" htmlFor="customer-phone">
                    {isWalkIn ? "Phone (optional)" : "Phone Number"}
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
            <Field className="min-w-0 gap-1">
              <FieldLabel className="text-xs" htmlFor="customer-email">
                {isWalkIn ? "Email (optional)" : "Email"}
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

          {needsDelivery ? (
            <>
              <h2 className="font-medium tracking-tight">Shipping To</h2>

              {selectedCustomer && addressOptions.length > 1 ? (
                <Field className="gap-1">
                  <FieldLabel className="text-xs" htmlFor="shipping-address-select">
                    Saved Address
                  </FieldLabel>
                  <Select disabled={disabled} value={selectedAddressId} onValueChange={selectAddress}>
                    <SelectTrigger
                      id="shipping-address-select"
                      className="w-full min-w-0 overflow-hidden text-base md:text-sm"
                    >
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

              <div className="grid min-w-0 grid-cols-2 gap-4 md:grid-cols-3">
                <Field className="col-span-2 min-w-0 gap-1">
                  <FieldLabel className="text-xs" htmlFor="shipping-street">
                    Street Address
                  </FieldLabel>
                  <Input
                    id="shipping-street"
                    disabled={disabled}
                    placeholder="123 Main St"
                    autoComplete="shipping address-line1"
                    {...register("streetAddress")}
                  />
                </Field>
                <Field className="min-w-0 gap-1">
                  <FieldLabel className="text-xs" htmlFor="shipping-apartment">
                    Apt/Suite
                  </FieldLabel>
                  <Input
                    id="shipping-apartment"
                    disabled={disabled}
                    placeholder="Apartment, suite, or unit"
                    autoComplete="shipping address-line2"
                    {...register("apartment")}
                  />
                </Field>
                <Field className="min-w-0 gap-1 md:col-span-3">
                  <FieldLabel className="text-xs" htmlFor="shipping-city">
                    City
                  </FieldLabel>
                  <Input
                    id="shipping-city"
                    disabled={disabled}
                    placeholder="Houston"
                    autoComplete="shipping address-level2"
                    {...register("city")}
                  />
                </Field>
                <Controller
                  control={control}
                  name="state"
                  render={({ field }) => (
                    <Field className="min-w-0 gap-1 md:col-span-2">
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
                <Field className="min-w-0 gap-1">
                  <FieldLabel className="text-xs" htmlFor="shipping-zip">
                    ZIP
                  </FieldLabel>
                  <Input
                    id="shipping-zip"
                    inputMode="numeric"
                    disabled={disabled}
                    placeholder="77001"
                    autoComplete="shipping postal-code"
                    {...register("zip")}
                  />
                </Field>
              </div>
            </>
          ) : null}
          <Field className="gap-1">
            <FieldLabel className="text-xs" htmlFor="customer-notes">
              Customer Notes
            </FieldLabel>
            <Textarea
              id="customer-notes"
              className="min-h-24 resize-none text-base md:text-sm"
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
  const { register, control, setValue } = useFormContext<OrderFormValues>();

  const needsDelivery = orderNeedsShipping(useWatch({ control }) as OrderFormValues);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-medium tracking-tight">Adjustments</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
        {needsDelivery ? (
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
                onBlur={formatMoneyInputOnBlur}
              />
              <InputGroupAddon align="inline-end">$</InputGroupAddon>
            </InputGroup>
          </Field>
        ) : null}

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
              {...register("tax", {
                valueAsNumber: true,
                onChange: () => setValue("overrideTaxRate", true, { shouldDirty: true }),
              })}
              max="100"
              aria-describedby="order-tax-help"
            />
            <InputGroupAddon align="inline-end">%</InputGroupAddon>
          </InputGroup>
          <p id="order-tax-help" className="text-muted-foreground text-xs">
            Applies to taxable items in this order. Enter 0 for no tax. Tax-exempt items stay exempt.
          </p>
        </Field>
        <Field className="col-span-2 gap-1 sm:col-span-1">
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
              onBlur={formatMoneyInputOnBlur}
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
          className="h-[5.25rem] resize-none text-base md:text-sm"
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
  const date = React.useMemo(() => parseDateValue(value), [value]);
  const [currentMonth, setCurrentMonth] = React.useState(() => startOfMonth(date ?? new Date()));

  React.useEffect(() => {
    if (date) {
      setCurrentMonth(startOfMonth(date));
    }
  }, [date]);

  function handleSelect(selectedDate: Date | undefined) {
    if (!selectedDate) return;

    onChange(format(selectedDate, "yyyy-MM-dd"));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!date}
          className="w-full justify-start gap-2 text-left font-normal text-base data-[empty=true]:text-muted-foreground md:text-sm"
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate">{date ? format(date, "MMM d, yyyy") : "Pick date"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto overflow-hidden p-0">
        <div className="p-3">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            fixedWeeks
            locale={enGB}
            className="w-full p-0"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function parseDateValue(value: string) {
  const date = parseISO(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function OrderItems({
  disabled,
  inventoryItems,
  canOverridePrices,
}: {
  disabled: boolean;
  inventoryItems: InventoryItem[];
  canOverridePrices: boolean;
}) {
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
    append(
      {
        id: crypto.randomUUID(),
        category: "",
        product: "",
        quantity: 1,
        sku: "",
        unitPrice: 0,
      },
      {
        shouldFocus: false,
      },
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium tracking-tight">Order Items</h2>
          <p className="text-muted-foreground text-sm">
            Choose products and quantities. Use a custom item for one-off products.
          </p>
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
                  canOverridePrices={canOverridePrices}
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
  canOverridePrices,
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
  canOverridePrices: boolean;
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
        "relative grid min-w-0 grid-cols-[24px_minmax(0,1fr)] gap-2 rounded-lg border bg-muted/10 p-2 pb-11 lg:grid-cols-[24px_minmax(0,1fr)_28px] lg:pb-2",
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
            {item?.inventoryItemId ? (
              <p id={`order-item-sku-${index}`} className="min-h-9 break-words py-2 text-sm">
                {item.sku || "—"}
              </p>
            ) : (
              <Input
                id={`order-item-sku-${index}`}
                className="font-mono text-base md:text-sm"
                disabled={disabled}
                placeholder="SKU"
                {...register(`items.${index}.sku` as const)}
              />
            )}
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
            {item?.inventoryItemId ? (
              <p id={`order-item-category-${index}`} className="min-h-9 break-words py-2 text-sm">
                {item.category || "—"}
              </p>
            ) : (
              <Input
                id={`order-item-category-${index}`}
                className="min-w-0 text-base md:text-sm"
                disabled={disabled}
                placeholder="Category"
                {...register(`items.${index}.category` as const)}
              />
            )}
          </Field>
          <div
            className={cn(
              "col-span-2 row-start-3 grid min-w-0 items-start gap-3 lg:col-span-3 lg:col-start-2 lg:row-start-2 xl:col-span-2 xl:col-start-1 xl:row-start-3",
              item?.priceOverride ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2",
            )}
          >
            <Field className="min-w-0 gap-1 lg:max-xl:max-w-24">
              <FieldLabel className="text-xs" htmlFor={`order-item-quantity-${index}`}>
                Qty
              </FieldLabel>
              <Input
                id={`order-item-quantity-${index}`}
                type="number"
                min="1"
                step="1"
                className="min-w-0 text-base md:text-sm"
                disabled={disabled}
                {...register(`items.${index}.quantity` as const, { min: 1, valueAsNumber: true })}
              />
            </Field>
            <Field className="min-w-0 gap-1">
              <FieldLabel className="text-xs" htmlFor={`order-item-unit-price-${index}`}>
                Unit Price
              </FieldLabel>
              <OrderItemPrice
                item={item}
                index={index}
                disabled={disabled}
                canOverridePrices={canOverridePrices}
                register={register}
                setValue={setValue}
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
        className="absolute bottom-2 left-2 text-muted-foreground lg:static lg:-mr-2"
        aria-label={`Remove item ${index + 1}`}
        disabled={disabled ? true : removeDisabled}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

function OrderItemPrice({
  item,
  index,
  disabled,
  canOverridePrices,
  register,
  setValue,
}: {
  item?: OrderLineItem;
  index: number;
  disabled: boolean;
  canOverridePrices: boolean;
  register: UseFormRegister<OrderFormValues>;
  setValue: UseFormSetValue<OrderFormValues>;
}) {
  const inventoryLine = Boolean(item?.inventoryItemId);
  const editingOverride = inventoryLine && item?.priceOverride === true;
  const canEditPrice = !inventoryLine || (editingOverride && canOverridePrices);
  const referencePrice = item?.catalogUnitPrice;
  function cancelOverride() {
    setValue(`items.${index}.unitPrice`, item?.savedUnitPrice ?? referencePrice ?? item?.unitPrice ?? 0, {
      shouldDirty: true,
    });
    setValue(`items.${index}.priceOverride`, false, { shouldDirty: true });
    setValue(`items.${index}.priceOverrideReason`, item?.savedPriceOverrideReason ?? "", { shouldDirty: true });
  }
  return (
    <div className="grid min-w-0 gap-2">
      {canEditPrice ? (
        <Input
          id={`order-item-unit-price-${index}`}
          type="number"
          min="0"
          step="0.01"
          className="min-w-0 text-base md:text-sm"
          disabled={disabled}
          {...register(`items.${index}.unitPrice`, { min: 0, valueAsNumber: true })}
          onBlur={formatMoneyInputOnBlur}
        />
      ) : (
        <p id={`order-item-unit-price-${index}`} className="min-h-9 py-2 text-sm tabular-nums">
          {formatOrderCurrency(item?.unitPrice ?? 0)}
        </p>
      )}
      {inventoryLine && referencePrice != null && (editingOverride || item?.priceOverrideReason) ? (
        <p className="text-muted-foreground text-xs">Original catalog price: {formatOrderCurrency(referencePrice)}</p>
      ) : null}
      {inventoryLine && editingOverride && referencePrice == null && item?.savedUnitPrice != null ? (
        <p className="text-muted-foreground text-xs">
          Price before this change: {formatOrderCurrency(item.savedUnitPrice)}. Original catalog price was not recorded.
        </p>
      ) : null}
      {editingOverride ? (
        <>
          <FieldLabel className="text-xs" htmlFor={`order-item-price-reason-${index}`}>
            Price override reason
          </FieldLabel>
          <Textarea
            id={`order-item-price-reason-${index}`}
            disabled={disabled || !canOverridePrices}
            required
            maxLength={500}
            rows={2}
            placeholder="Why is this order's price different?"
            {...register(`items.${index}.priceOverrideReason`)}
          />
          {!disabled && canOverridePrices ? (
            <Button type="button" variant="ghost" size="sm" className="justify-start px-0" onClick={cancelOverride}>
              Cancel override
            </Button>
          ) : null}
        </>
      ) : inventoryLine ? (
        <>
          {item?.priceOverrideReason ? (
            <p className="break-words text-muted-foreground text-xs">Override reason: {item.priceOverrideReason}</p>
          ) : null}
          {!disabled && canOverridePrices ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setValue(`items.${index}.priceOverride`, true, { shouldDirty: true })}
            >
              Override price
            </Button>
          ) : null}
        </>
      ) : null}
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
  if (item?.inventoryItemId && item.savedUnitPrice !== undefined) {
    return (
      <p id={`order-item-product-${index}`} className="min-h-9 break-words py-2 text-sm">
        {item.product}
      </p>
    );
  }

  function selectCustomItem() {
    setValue(`items.${index}.catalogUnitPrice`, null, { shouldDirty: true });
    setValue(`items.${index}.priceOverride`, false, { shouldDirty: true });
    setValue(`items.${index}.priceOverrideReason`, "", { shouldDirty: true });
    setValue(`items.${index}.savedUnitPrice`, undefined, { shouldDirty: true });
    setValue(`items.${index}.savedPriceOverrideReason`, undefined, { shouldDirty: true });
    setValue(`items.${index}.inventoryItemId`, undefined, { shouldDirty: true });
    setValue(`items.${index}.taxable`, true, { shouldDirty: true });
    setValue(`items.${index}.taxRate`, undefined, { shouldDirty: true });
    setValue(`items.${index}.sku`, "", { shouldDirty: true });
    setValue(`items.${index}.product`, "", { shouldDirty: true });
    setValue(`items.${index}.category`, "", { shouldDirty: true });
    setValue(`items.${index}.unitPrice`, 0, { shouldDirty: true });
    setManualMode(true);
    setOpen(false);
  }

  function selectInventoryItem(inventoryItem: InventoryItem) {
    setValue(`items.${index}.catalogUnitPrice`, inventoryItem.unitPrice, { shouldDirty: true });
    setValue(`items.${index}.priceOverride`, false, { shouldDirty: true });
    setValue(`items.${index}.priceOverrideReason`, "", { shouldDirty: true });
    setValue(`items.${index}.savedUnitPrice`, undefined, { shouldDirty: true });
    setValue(`items.${index}.savedPriceOverrideReason`, undefined, { shouldDirty: true });
    setValue(`items.${index}.inventoryItemId`, inventoryItem.id, { shouldDirty: true });
    setValue(`items.${index}.sku`, inventoryItem.sku, { shouldDirty: true });
    setValue(`items.${index}.product`, inventoryItem.product, { shouldDirty: true });
    setValue(`items.${index}.category`, inventoryItem.category, { shouldDirty: true });
    setValue(`items.${index}.unitPrice`, inventoryItem.unitPrice, { shouldDirty: true });
    setValue(`items.${index}.taxable`, inventoryItem.taxable, { shouldDirty: true });
    setValue(`items.${index}.taxRate`, undefined, { shouldDirty: true });
    setManualMode(false);
    setOpen(false);
  }

  if (manualMode) {
    return (
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Input
          id={`order-item-product-${index}`}
          className="min-w-0 text-base md:text-sm"
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
          className="h-8 min-w-0 max-w-full justify-between overflow-hidden bg-background px-2.5 font-normal text-base md:text-sm"
        >
          <span className="min-w-0 truncate text-left">
            <span className={cn(!item?.product && "text-muted-foreground")}>{buttonLabel}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput className="text-base md:text-sm" placeholder="Search SKU or product..." />
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
