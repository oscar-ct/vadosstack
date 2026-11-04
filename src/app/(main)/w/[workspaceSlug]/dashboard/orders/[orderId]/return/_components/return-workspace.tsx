"use client";

import * as React from "react";

import { RotateCcw, Save, Undo } from "lucide-react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceRouter as useRouter } from "@/components/workspace-path-provider";
import {
  getCalculatedRefundAmount,
  getCalculatedRefundStatus,
  getDefaultRefundAmount,
  getReturnDispositionLabel,
  getReturnedItemsDiscount,
  getReturnedItemsSubtotal,
  getReturnedItemsTax,
  type ReturnDisposition,
  type ReturnRefundFormValues,
  type ReturnRefundStatus,
} from "@/lib/commerce/returns";
import { formatCurrency } from "@/lib/utils";

import type { OrderCompany } from "../../../create/_components/data";
import { saveReturnRefundAction } from "../actions";
import { ReturnRefundPreview } from "./return-preview";

const headerActionButtonClassName = "min-w-32 justify-center";
const dispositionOptions: ReturnDisposition[] = ["Returned", "Damaged", "Lost", "No physical return"];
const refundExplanationMaxLength = 80;
const refundStatusOptions: ReturnRefundStatus[] = ["Full Refund", "Partial Refund", "No Refund", "Other"];

type ReturnRefundWorkspaceProps = {
  canCancelItems: boolean;
  canReturnItems: boolean;
  company: OrderCompany;
  defaultValues: ReturnRefundFormValues;
  emailAction?: React.ReactNode;
  orderId: string;
  payments: Array<{ amount: number; id: string; method: string; reference: string | null; refundableAmount: number }>;
  returnId: string | null;
};

function getValidationError(values: ReturnRefundFormValues) {
  if (!values.returnDate) return "Resolution date is required.";
  if (!values.items.some((item) => item.returnQuantity > 0 || item.cancelQuantity > 0)) {
    return "Choose at least one item to cancel or return.";
  }
  if (
    values.items.some(
      (item) =>
        item.returnQuantity < 0 ||
        item.returnQuantity > item.returnableQuantity ||
        item.cancelQuantity < 0 ||
        item.cancelQuantity > item.cancellableQuantity,
    )
  ) {
    return "Resolution quantities exceed the units available for cancellation or return.";
  }
  if (values.refundStatus === "Other" && (!Number.isFinite(values.refundAmount) || values.refundAmount < 0)) {
    return "Enter a refund amount or choose No Refund.";
  }
  if (values.refundStatus !== "No Refund" && !values.paymentId) return "Choose the original payment to refund.";
  if (values.refundStatus !== "No Refund" && !values.refundMethod.trim()) return "Refund method is required.";
  if (values.refundExplanation.length > refundExplanationMaxLength) {
    return `Refund explanation must be ${refundExplanationMaxLength} characters or less.`;
  }

  return null;
}

function getQuantityOptions(orderedQuantity: number) {
  const options: number[] = [];

  for (let quantity = 0; quantity <= orderedQuantity; quantity += 1) {
    options.push(quantity);
  }

  return options;
}

function formatMoneyInputOnBlur(event: React.FocusEvent<HTMLInputElement>) {
  const value = event.currentTarget.value.trim();

  if (!value) return;

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) return;

  event.currentTarget.value = parsedValue.toFixed(2);
}

const FormContext = React.createContext<ReturnType<typeof useForm<ReturnRefundFormValues>> | null>(null);

function useReturnForm() {
  const context = React.useContext(FormContext);

  if (!context) {
    throw new Error("useReturnForm must be used inside ReturnRefundWorkspace.");
  }

  return context;
}

function ReturnItemsSection({
  canCancelItems,
  canReturnItems,
  disabled,
  refundableAmount,
}: {
  canCancelItems: boolean;
  canReturnItems: boolean;
  disabled: boolean;
  refundableAmount: number;
}) {
  const { control, getValues, setValue, register } = useReturnForm();
  const items = useWatch({ control, name: "items" }) ?? [];

  function updateQuantity(index: number, name: "cancelQuantity" | "returnQuantity", quantity: number) {
    const currentValues = getValues();
    const nextItems = currentValues.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [name]: quantity } : item,
    );
    const nextValues = { ...currentValues, items: nextItems };
    const alreadyChoseNoRefund =
      currentValues.refundStatus === "No Refund" &&
      currentValues.items.some((item) => item.returnQuantity > 0 || item.cancelQuantity > 0);

    setValue(`items.${index}.${name}`, quantity, { shouldDirty: true });
    if (name === "returnQuantity") {
      if (quantity === 0) setValue(`items.${index}.restock`, false, { shouldDirty: true });
      else if (items[index]?.disposition === "Returned" && items[index]?.inventoryItemId)
        setValue(`items.${index}.restock`, true, { shouldDirty: true });
    }
    if (refundableAmount <= 0) {
      setValue("refundStatus", "No Refund", { shouldDirty: true });
      setValue("refundAmount", 0, { shouldDirty: true });
      return;
    }
    if (currentValues.refundStatus === "Other" || alreadyChoseNoRefund) return;
    setValue("refundStatus", getCalculatedRefundStatus(nextValues, refundableAmount), { shouldDirty: true });
    setValue("refundAmount", getCalculatedRefundAmount(nextValues, refundableAmount), { shouldDirty: true });
  }

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-medium tracking-tight">Choose items to resolve</h2>
        <p className="text-muted-foreground text-sm">
          Cancel units that have not been fulfilled. Return units the customer already received. A partially fulfilled
          line can use both.
        </p>
      </div>
      <div className="grid gap-3">
        {items.map((item, index) => (
          <div key={item.orderItemId} className="grid gap-3 rounded-lg border bg-muted/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{item.product}</div>
                <div className="truncate text-muted-foreground text-xs">
                  {[item.sku, item.category].filter(Boolean).join(" · ") || "Order item"}
                </div>
                <div className="text-muted-foreground text-xs">
                  {item.cancellableQuantity} unfulfilled · {item.returnableQuantity} fulfilled ·{" "}
                  {formatCurrency(item.unitPrice)} each
                </div>
              </div>
              <div className="text-right font-medium text-sm tabular-nums">
                {formatCurrency((item.returnQuantity + item.cancelQuantity) * item.unitPrice)}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {item.cancellableQuantity > 0 ? (
                <Controller
                  control={control}
                  name={`items.${index}.cancelQuantity`}
                  render={({ field }) => (
                    <Field className="gap-1 rounded-lg border bg-background p-3">
                      <FieldLabel className="text-xs" htmlFor={`cancel-quantity-${index}`}>
                        Cancel unfulfilled
                      </FieldLabel>
                      <Select
                        disabled={disabled || !canCancelItems}
                        value={String(field.value)}
                        onValueChange={(value) => updateQuantity(index, "cancelQuantity", Number(value))}
                      >
                        <SelectTrigger id={`cancel-quantity-${index}`} className="w-full text-base md:text-sm">
                          <SelectValue placeholder="Qty" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {getQuantityOptions(item.cancellableQuantity).map((quantity) => (
                              <SelectItem key={`cancel-${quantity}`} value={String(quantity)}>
                                {quantity}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <p className="text-muted-foreground text-xs">Releases reserved stock; no physical return.</p>
                    </Field>
                  )}
                />
              ) : null}
              {item.returnableQuantity > 0 ? (
                <div className="grid gap-3 rounded-lg border bg-background p-3">
                  <Controller
                    control={control}
                    name={`items.${index}.returnQuantity`}
                    render={({ field }) => (
                      <Field className="gap-1">
                        <FieldLabel className="text-xs" htmlFor={`return-quantity-${index}`}>
                          Return fulfilled
                        </FieldLabel>
                        <Select
                          disabled={disabled || !canReturnItems}
                          value={String(field.value)}
                          onValueChange={(value) => updateQuantity(index, "returnQuantity", Number(value))}
                        >
                          <SelectTrigger id={`return-quantity-${index}`} className="w-full text-base md:text-sm">
                            <SelectValue placeholder="Qty" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {getQuantityOptions(item.returnableQuantity).map((quantity) => (
                                <SelectItem key={`return-${quantity}`} value={String(quantity)}>
                                  {quantity}
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
                    name={`items.${index}.disposition`}
                    render={({ field }) => (
                      <Field className="gap-1">
                        <FieldLabel className="text-xs" htmlFor={`return-disposition-${index}`}>
                          Outcome
                        </FieldLabel>
                        <Select
                          disabled={disabled || !canReturnItems || item.returnQuantity === 0}
                          value={field.value}
                          onValueChange={(value) => {
                            const disposition = value as ReturnDisposition;

                            field.onChange(disposition);
                            if (disposition !== "Returned") {
                              setValue(`items.${index}.restock`, false, { shouldDirty: true });
                            } else if (item.inventoryItemId) {
                              setValue(`items.${index}.restock`, true, { shouldDirty: true });
                            }
                          }}
                        >
                          <SelectTrigger id={`return-disposition-${index}`} className="w-full text-base md:text-sm">
                            <SelectValue placeholder="Outcome" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {dispositionOptions.map((disposition) => (
                                <SelectItem key={disposition} value={disposition}>
                                  {getReturnDispositionLabel(disposition)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  />
                  {item.disposition === "Damaged" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        disabled={disabled || !canReturnItems}
                        {...register(`items.${index}.physicallyReceived`)}
                      />
                      Damaged item physically received
                    </label>
                  ) : null}
                  <Controller
                    control={control}
                    name={`items.${index}.restock`}
                    render={({ field }) => (
                      <div className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm">
                        <Checkbox
                          checked={field.value}
                          disabled={
                            disabled ||
                            !canReturnItems ||
                            !item.inventoryItemId ||
                            item.returnQuantity === 0 ||
                            item.disposition !== "Returned"
                          }
                          onCheckedChange={(value) => field.onChange(value === true)}
                        />
                        Restock
                      </div>
                    )}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RefundDetailsSection({
  disabled,
  payments,
}: {
  disabled: boolean;
  payments: ReturnRefundWorkspaceProps["payments"];
}) {
  const { control, register, setValue } = useReturnForm();
  const values = useWatch({ control }) as ReturnRefundFormValues;
  const refundableAmount = payments.reduce((sum, payment) => sum + Math.max(payment.refundableAmount, 0), 0);
  const calculatedRefundAmount = getCalculatedRefundAmount(values, refundableAmount);
  const calculatedRefundStatus = getCalculatedRefundStatus(values, refundableAmount);
  const isCustomRefund = values.refundStatus === "Other";
  const showsRefundExplanation =
    (values.refundStatus === "No Refund" && refundableAmount > 0) || values.refundStatus === "Other";
  const refundExplanationLength = values.refundExplanation.length;
  const refundAmountRegistration = register("refundAmount", { valueAsNumber: true });

  React.useEffect(() => {
    if (disabled) return;

    if (!showsRefundExplanation && values.refundExplanation) {
      setValue("refundExplanation", "", { shouldDirty: true });
    }

    if (refundableAmount <= 0) {
      if (values.refundStatus !== "No Refund") setValue("refundStatus", "No Refund", { shouldDirty: true });
      if (values.refundAmount !== 0) setValue("refundAmount", 0, { shouldDirty: true });
      return;
    }
    if (values.refundStatus === "Other") return;

    if (values.refundStatus === "No Refund") {
      if (values.refundAmount !== 0) {
        setValue("refundAmount", 0, { shouldDirty: true });
      }

      return;
    }

    if (values.refundStatus !== calculatedRefundStatus) {
      setValue("refundStatus", calculatedRefundStatus, { shouldDirty: true });
    }

    if (values.refundAmount !== calculatedRefundAmount) {
      setValue("refundAmount", calculatedRefundAmount, { shouldDirty: true });
    }
  }, [
    calculatedRefundAmount,
    calculatedRefundStatus,
    refundableAmount,
    disabled,
    setValue,
    values.refundAmount,
    values.refundExplanation,
    values.refundStatus,
    showsRefundExplanation,
  ]);

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-medium tracking-tight">Credit & refund</h2>
        <p className="text-muted-foreground text-sm">
          The credit combines every cancellation and return selected on the Items tab. Record a completed refund only
          when money is being returned.
        </p>
      </div>
      <FieldGroup>
        {values.refundStatus !== "No Refund" ? (
          <Controller
            control={control}
            name="paymentId"
            render={({ field }) => (
              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="refund-payment">
                  Refund From
                </FieldLabel>
                <Select
                  disabled={disabled || payments.length === 0}
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    if (value === "all")
                      setValue("refundMethod", [...new Set(payments.map((payment) => payment.method))].join(", "), {
                        shouldDirty: true,
                      });
                  }}
                >
                  <SelectTrigger id="refund-payment" className="w-full text-base md:text-sm">
                    <SelectValue placeholder="Select the original payment(s)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {payments.length > 1 ? (
                        <SelectItem value="all">
                          All original payments · {formatCurrency(refundableAmount)} available
                        </SelectItem>
                      ) : null}
                      {payments.map((payment) => (
                        <SelectItem key={payment.id} value={payment.id}>
                          {payment.method} ·{" "}
                          {formatCurrency(payment.refundableAmount > 0.001 ? payment.refundableAmount : payment.amount)}{" "}
                          {payment.refundableAmount > 0.001 ? "available" : "refunded"}
                          {payment.reference ? ` · ${payment.reference}` : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {field.value === "all" ? (
                  <p className="text-muted-foreground text-xs">
                    Records the refund against each original payment, within its remaining balance. Confirm every refund
                    has completed.
                  </p>
                ) : null}
                {payments.length === 0 ? (
                  <p className="text-destructive text-xs">No refundable payment remains on this order.</p>
                ) : null}
              </Field>
            )}
          />
        ) : null}
        {refundableAmount <= 0 ? (
          <p role="status" className="rounded-lg bg-muted/40 p-3 text-muted-foreground text-sm">
            No refund is required because no refundable payment is recorded. The cancellation credit still reduces the
            amount owed.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          <Controller
            control={control}
            name="refundStatus"
            render={({ field }) => (
              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="refund-status">
                  Refund Status
                </FieldLabel>
                <Select
                  disabled={disabled}
                  value={field.value}
                  onValueChange={(value) => {
                    const refundStatus = value as ReturnRefundStatus;

                    if (refundStatus === "Other") {
                      field.onChange(refundStatus);
                      return;
                    }

                    if (refundStatus === "No Refund") {
                      field.onChange(refundStatus);
                      setValue("refundAmount", 0, { shouldDirty: true });
                      return;
                    }

                    field.onChange(calculatedRefundStatus);
                    setValue("refundAmount", calculatedRefundAmount, { shouldDirty: true });
                  }}
                >
                  <SelectTrigger id="refund-status" className="w-full text-base md:text-sm">
                    <SelectValue placeholder="Refund status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {refundStatusOptions.map((status) => (
                        <SelectItem
                          key={status}
                          value={status}
                          disabled={refundableAmount <= 0 && status !== "No Refund"}
                        >
                          {status}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
          <Field className="gap-1">
            <FieldLabel className="text-xs" htmlFor="refund-amount">
              Refund Amount
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="refund-amount"
                type="number"
                min="0"
                step="0.01"
                disabled={disabled || !isCustomRefund}
                {...refundAmountRegistration}
                onBlur={(event) => {
                  refundAmountRegistration.onBlur(event);
                  formatMoneyInputOnBlur(event);
                }}
              />
              <InputGroupAddon align="inline-end">$</InputGroupAddon>
            </InputGroup>
          </Field>
        </div>

        {showsRefundExplanation ? (
          <Field className="gap-1">
            <div className="flex items-center justify-between gap-3">
              <FieldLabel className="text-xs" htmlFor="refund-explanation">
                Refund Explanation
              </FieldLabel>
              <span className="text-muted-foreground text-xs">
                {refundExplanationLength}/{refundExplanationMaxLength}
              </span>
            </div>
            <Input
              id="refund-explanation"
              disabled={disabled}
              maxLength={refundExplanationMaxLength}
              placeholder={
                isCustomRefund
                  ? "Includes shipping refund or manual adjustment"
                  : "Replacement issued, warranty claim, or non-refundable item"
              }
              {...register("refundExplanation", { maxLength: refundExplanationMaxLength })}
            />
          </Field>
        ) : null}

        {isCustomRefund && (!disabled || values.refundTaxAmount !== undefined) ? (
          <div className="grid gap-3 rounded-lg border p-3">
            <p className="text-sm">Break down the actual refund. These amounts must add up to the refund total.</p>
            {(
              [
                ["refundMerchandiseAmount", "Merchandise refund"],
                ["refundTaxAmount", "Tax refund"],
                ["refundShippingAmount", "Shipping refund"],
              ] as const
            ).map(([name, label]) => (
              <Field key={name}>
                <FieldLabel htmlFor={name}>{label} ($)</FieldLabel>
                <Input
                  id={name}
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  disabled={disabled}
                  {...register(name, { valueAsNumber: true })}
                />
              </Field>
            ))}
          </div>
        ) : null}
        {values.refundStatus !== "No Refund" ? (
          <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] gap-3 sm:grid-cols-2 sm:gap-5">
            <Field className="gap-1">
              <FieldLabel className="text-xs" htmlFor="refund-method">
                Refund Method
              </FieldLabel>
              <Input
                id="refund-method"
                disabled={disabled}
                placeholder="Card refund"
                required
                {...register("refundMethod")}
              />
            </Field>
            <Field className="gap-1">
              <FieldLabel className="text-xs" htmlFor="refund-reference">
                Ref #
              </FieldLabel>
              <Input
                id="refund-reference"
                disabled={disabled}
                placeholder="RFND-1234"
                {...register("refundReference")}
              />
            </Field>
          </div>
        ) : null}

        <div className="rounded-lg bg-muted/40 p-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Cancelled + returned value</span>
            <span className="font-medium tabular-nums">{formatCurrency(getReturnedItemsSubtotal(values))}</span>
          </div>
          <div className="mt-1 flex justify-between gap-4">
            <span className="text-muted-foreground">Tax credit</span>
            <span className="font-medium tabular-nums">{formatCurrency(getReturnedItemsTax(values))}</span>
          </div>
          {getReturnedItemsDiscount(values) > 0 ? (
            <div className="mt-1 flex justify-between gap-4">
              <span className="text-muted-foreground">Returned item discount</span>
              <span className="font-medium tabular-nums">-{formatCurrency(getReturnedItemsDiscount(values))}</span>
            </div>
          ) : null}
          {refundableAmount <= 0 &&
          values.items.some((item) => item.cancelQuantity > 0) &&
          values.items.every((item) => item.returnQuantity === 0) ? (
            <div className="mt-2 flex justify-between gap-4 border-t pt-2">
              <span className="text-muted-foreground">Cancellation credit</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(
                  getReturnedItemsSubtotal(values) + getReturnedItemsTax(values) - getReturnedItemsDiscount(values),
                )}
              </span>
            </div>
          ) : null}
          <div className="mt-1 flex justify-between gap-4">
            <span className="text-muted-foreground">Refund amount</span>
            <span className="font-medium tabular-nums">{formatCurrency(getDefaultRefundAmount(values))}</span>
          </div>
          {isCustomRefund ? (
            <p className="mt-2 text-muted-foreground text-xs">
              Other lets you enter a custom refund for shipping, goodwill, fees, or an adjusted tax decision.
            </p>
          ) : (
            <p className="mt-2 text-muted-foreground text-xs">
              Calculated from cancelled and returned item value plus refundable tax. Shipping stays out unless you
              choose Other.
            </p>
          )}
        </div>
      </FieldGroup>
    </section>
  );
}

function ReceiptDetailsSection({ disabled }: { disabled: boolean }) {
  const { control, register } = useReturnForm();

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-medium tracking-tight">Review details</h2>
        <p className="text-muted-foreground text-sm">Add the reason and customer-facing note for this resolution.</p>
      </div>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          <Field className="gap-1">
            <FieldLabel className="text-xs" htmlFor="return-number">
              Resolution number
            </FieldLabel>
            <Input id="return-number" disabled {...register("returnNumber")} />
          </Field>
          <Field className="gap-1">
            <FieldLabel className="text-xs" htmlFor="return-date">
              Resolution date
            </FieldLabel>
            <Input id="return-date" type="date" disabled={disabled} {...register("returnDate")} />
          </Field>
        </div>

        <Field className="gap-1">
          <FieldLabel className="text-xs" htmlFor="return-reason">
            Reason
          </FieldLabel>
          <Input id="return-reason" disabled={disabled} placeholder="Customer return" {...register("reason")} />
        </Field>

        <Field className="gap-1">
          <FieldLabel className="text-xs" htmlFor="customer-note">
            Customer Note
          </FieldLabel>
          <Textarea
            id="customer-note"
            className="min-h-24 resize-none text-base md:text-sm"
            disabled={disabled}
            placeholder="Refund timing, exchange notes, or return policy details"
            {...register("customerNote")}
          />
        </Field>

        <Field className="gap-1">
          <FieldLabel className="text-xs" htmlFor="internal-notes">
            Internal Notes
          </FieldLabel>
          <Textarea
            id="internal-notes"
            className="min-h-20 resize-none text-base md:text-sm"
            disabled={disabled}
            placeholder="Private notes for your team"
            {...register("internalNotes")}
          />
        </Field>

        <Controller
          control={control}
          name="restockItems"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="grid gap-0.5">
                <span className="font-medium text-sm">Restock inventory items</span>
                <span className="text-muted-foreground text-xs">
                  Inventory-linked returned items will be added back to stock.
                </span>
              </span>
              <Switch checked={field.value} disabled={disabled} onCheckedChange={field.onChange} />
            </div>
          )}
        />
      </FieldGroup>
    </section>
  );
}

export function ReturnRefundWorkspace({
  canCancelItems,
  canReturnItems,
  company,
  defaultValues,
  emailAction,
  orderId,
  payments,
  returnId,
}: ReturnRefundWorkspaceProps) {
  const router = useRouter();
  const [locked, setLocked] = React.useState(Boolean(returnId));
  const [isSaving, setIsSaving] = React.useState(false);
  const submissionKey = React.useRef<string | null>(null);
  const form = useForm<ReturnRefundFormValues>({
    defaultValues,
  });
  const values = useWatch({ control: form.control }) as ReturnRefundFormValues;
  const actionsDisabled = !returnId || !locked;

  async function saveReturnRefund() {
    if (isSaving) return;

    const nextValues = form.getValues();
    const validationError = getValidationError(nextValues);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSaving(true);

    try {
      submissionKey.current ??= crypto.randomUUID();
      const result = await saveReturnRefundAction(orderId, { ...nextValues, submissionKey: submissionKey.current });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success("Item resolution saved.");
      setLocked(true);
      router.replace(`/dashboard/orders/${orderId}/return?returnId=${result.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Return/refund could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <FormContext.Provider value={form}>
      <FormProvider {...form}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-3">
              <div>
                <BackButton fallbackHref={`/dashboard/orders/${orderId}/edit`} />
              </div>
              <div className="flex flex-col gap-1">
                <h1 className="flex items-center gap-2 font-medium text-xl leading-none tracking-tight">
                  {returnId ? "Resolution" : "Resolve Items"} {values.orderNumber}
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <RotateCcw className="size-4" />
                  </span>
                </h1>
                <p className="text-muted-foreground text-sm">
                  Cancel unfulfilled units, return fulfilled units, and record the resulting refund in one workflow.
                  Saved resolutions are final and fully auditable.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {locked ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    window.location.href = `?new=1`;
                  }}
                >
                  Start another resolution
                </Button>
              ) : (
                <>
                  {returnId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={headerActionButtonClassName}
                      onClick={() => {
                        form.reset();
                        setLocked(true);
                        toast.success("Changes discarded.");
                      }}
                    >
                      <Undo />
                      Discard Changes
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className={headerActionButtonClassName}
                    disabled={isSaving}
                    onClick={saveReturnRefund}
                  >
                    <Save />
                    {isSaving ? "Saving..." : values.refundStatus === "No Refund" ? "Save resolution" : "Save & refund"}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.56fr)_minmax(380px,0.44fr)]">
            <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
              <Tabs defaultValue="items" className="gap-4">
                <TabsList className="w-full">
                  <TabsTrigger value="items">Items</TabsTrigger>
                  <TabsTrigger value="credit">Credit & refund</TabsTrigger>
                  <TabsTrigger value="review">Review</TabsTrigger>
                </TabsList>
                <TabsContent value="items" className="mt-0">
                  <ReturnItemsSection
                    refundableAmount={payments.reduce((sum, payment) => sum + Math.max(payment.refundableAmount, 0), 0)}
                    canCancelItems={canCancelItems}
                    canReturnItems={canReturnItems}
                    disabled={locked}
                  />
                </TabsContent>
                <TabsContent value="credit" className="mt-0">
                  <RefundDetailsSection disabled={locked} payments={payments} />
                </TabsContent>
                <TabsContent value="review" className="mt-0">
                  <ReceiptDetailsSection disabled={locked} />
                </TabsContent>
              </Tabs>
            </div>

            <ReturnRefundPreview
              actionsDisabled={actionsDisabled}
              company={company}
              emailAction={emailAction}
              orderId={orderId}
              values={values}
            />
          </div>
        </div>
      </FormProvider>
    </FormContext.Provider>
  );
}
