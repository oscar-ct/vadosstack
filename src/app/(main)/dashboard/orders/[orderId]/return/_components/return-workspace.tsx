"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { RotateCcw, Save, Undo, Unlock } from "lucide-react";
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
import { formatCurrency } from "@/lib/utils";

import type { OrderCompany } from "../../../create/_components/data";
import {
  getDefaultRefundAmount,
  getReturnDispositionLabel,
  getReturnedItemsSubtotal,
  type ReturnDisposition,
  type ReturnRefundFormValues,
} from "../_lib/return-data";
import { saveReturnRefundAction } from "../actions";
import { ReturnRefundPreview } from "./return-preview";

const headerActionButtonClassName = "min-w-32 justify-center";
const dispositionOptions: ReturnDisposition[] = ["Returned", "Damaged", "Lost", "No physical return"];
const refundStatusOptions = ["Full Refund", "Partial Refund", "No Refund"] as const;

type ReturnRefundWorkspaceProps = {
  company: OrderCompany;
  defaultValues: ReturnRefundFormValues;
  emailAction?: React.ReactNode;
  orderId: string;
  returnId: string | null;
};

function getValidationError(values: ReturnRefundFormValues) {
  if (!values.returnDate) return "Return date is required.";
  if (!values.items.some((item) => item.returnQuantity > 0)) return "Choose at least one item to resolve.";
  if (values.items.some((item) => item.returnQuantity < 0 || item.returnQuantity > item.orderedQuantity)) {
    return "Returned quantities cannot exceed the original order quantities.";
  }
  if (values.refundStatus !== "No Refund" && (!Number.isFinite(values.refundAmount) || values.refundAmount <= 0)) {
    return "Enter a refund amount or choose No Refund.";
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

function ReturnItemsSection({ disabled }: { disabled: boolean }) {
  const { control, setValue } = useReturnForm();
  const items = useWatch({ control, name: "items" }) ?? [];

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-medium tracking-tight">Resolved Items</h2>
        <p className="text-muted-foreground text-sm">
          Choose the affected quantities, then mark whether each item was returned, damaged, lost, or not physically
          received.
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
                  Ordered {item.orderedQuantity} at {formatCurrency(item.unitPrice)}
                </div>
              </div>
              <div className="text-right font-medium text-sm tabular-nums">
                {formatCurrency(item.returnQuantity * item.unitPrice)}
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:grid-cols-[minmax(0,0.34fr)_minmax(0,1fr)_auto]">
              <Controller
                control={control}
                name={`items.${index}.returnQuantity`}
                render={({ field }) => (
                  <Field className="gap-1">
                    <FieldLabel className="text-xs" htmlFor={`return-quantity-${index}`}>
                      Qty
                    </FieldLabel>
                    <Select
                      disabled={disabled}
                      value={String(field.value)}
                      onValueChange={(value) => {
                        const quantity = Number(value);

                        field.onChange(quantity);
                        if (quantity === 0) {
                          setValue(`items.${index}.restock`, false, { shouldDirty: true });
                        } else if (item.disposition === "Returned" && item.inventoryItemId) {
                          setValue(`items.${index}.restock`, true, { shouldDirty: true });
                        }
                      }}
                    >
                      <SelectTrigger id={`return-quantity-${index}`} className="w-full text-base md:text-sm">
                        <SelectValue placeholder="Qty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {getQuantityOptions(item.orderedQuantity).map((quantity) => (
                            <SelectItem key={`quantity-${quantity}`} value={String(quantity)}>
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
                  <Field className="order-3 col-span-2 gap-1 sm:order-2 sm:col-span-1">
                    <FieldLabel className="text-xs" htmlFor={`return-disposition-${index}`}>
                      Outcome
                    </FieldLabel>
                    <Select
                      disabled={disabled || item.returnQuantity === 0}
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
              <Controller
                control={control}
                name={`items.${index}.restock`}
                render={({ field }) => (
                  <div className="order-2 flex h-9 items-center gap-2 rounded-lg border px-3 text-sm sm:order-3">
                    <Checkbox
                      checked={field.value}
                      disabled={
                        disabled ||
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
          </div>
        ))}
      </div>
    </section>
  );
}

function RefundDetailsSection({ disabled }: { disabled: boolean }) {
  const { control, register, setValue } = useReturnForm();
  const values = useWatch({ control }) as ReturnRefundFormValues;

  React.useEffect(() => {
    if (values.refundStatus === "No Refund" && values.refundAmount !== 0) {
      setValue("refundAmount", 0, { shouldDirty: true });
    }
  }, [setValue, values.refundAmount, values.refundStatus]);

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-medium tracking-tight">Refund Details</h2>
        <p className="text-muted-foreground text-sm">
          Record the refund amount, method, and reference shown on the receipt.
        </p>
      </div>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          <Controller
            control={control}
            name="refundStatus"
            render={({ field }) => (
              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="refund-status">
                  Refund Status
                </FieldLabel>
                <Select disabled={disabled} value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="refund-status" className="w-full text-base md:text-sm">
                    <SelectValue placeholder="Refund status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {refundStatusOptions.map((status) => (
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
                disabled={disabled || values.refundStatus === "No Refund"}
                {...register("refundAmount", { valueAsNumber: true })}
                onBlur={formatMoneyInputOnBlur}
              />
              <InputGroupAddon align="inline-end">$</InputGroupAddon>
            </InputGroup>
          </Field>
        </div>

        <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] gap-3 sm:grid-cols-2 sm:gap-5">
          <Field className="gap-1">
            <FieldLabel className="text-xs" htmlFor="refund-method">
              Refund Method
            </FieldLabel>
            <Input id="refund-method" disabled={disabled} placeholder="Card refund" {...register("refundMethod")} />
          </Field>
          <Field className="gap-1">
            <FieldLabel className="text-xs" htmlFor="refund-reference">
              Ref #
            </FieldLabel>
            <Input id="refund-reference" disabled={disabled} placeholder="RFND-1234" {...register("refundReference")} />
          </Field>
        </div>

        <div className="rounded-lg bg-muted/40 p-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Resolved item value</span>
            <span className="font-medium tabular-nums">{formatCurrency(getReturnedItemsSubtotal(values))}</span>
          </div>
          <div className="mt-1 flex justify-between gap-4">
            <span className="text-muted-foreground">Receipt refund amount</span>
            <span className="font-medium tabular-nums">{formatCurrency(getDefaultRefundAmount(values))}</span>
          </div>
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
        <h2 className="font-medium tracking-tight">Receipt Details</h2>
        <p className="text-muted-foreground text-sm">Add the reason and customer-facing note for the return receipt.</p>
      </div>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          <Field className="gap-1">
            <FieldLabel className="text-xs" htmlFor="return-number">
              Return Receipt
            </FieldLabel>
            <Input id="return-number" disabled {...register("returnNumber")} />
          </Field>
          <Field className="gap-1">
            <FieldLabel className="text-xs" htmlFor="return-date">
              Return Date
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
  company,
  defaultValues,
  emailAction,
  orderId,
  returnId,
}: ReturnRefundWorkspaceProps) {
  const router = useRouter();
  const [locked, setLocked] = React.useState(Boolean(returnId));
  const [isSaving, setIsSaving] = React.useState(false);
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
      const result = await saveReturnRefundAction(orderId, nextValues);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success("Return/refund saved.");
      setLocked(true);
      form.reset(nextValues);
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
                  Return / Refund {values.orderNumber}
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <RotateCcw className="size-4" />
                  </span>
                </h1>
                <p className="text-muted-foreground text-sm">
                  Review returned items, refund details, and the customer-facing return receipt.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {locked ? (
                <Button
                  type="button"
                  size="sm"
                  className={headerActionButtonClassName}
                  onClick={() => {
                    setLocked(false);
                    toast.success("Return/refund unlocked.");
                  }}
                >
                  <Unlock />
                  Unlock Return
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
                    {isSaving ? "Saving..." : "Save Return"}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.56fr)_minmax(380px,0.44fr)]">
            <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
              <Tabs defaultValue="return" className="gap-4">
                <TabsList className="w-full">
                  <TabsTrigger value="return">Return</TabsTrigger>
                  <TabsTrigger value="refund">Refund</TabsTrigger>
                  <TabsTrigger value="receipt">Receipt</TabsTrigger>
                </TabsList>
                <TabsContent value="return" className="mt-0">
                  <ReturnItemsSection disabled={locked} />
                </TabsContent>
                <TabsContent value="refund" className="mt-0">
                  <RefundDetailsSection disabled={locked} />
                </TabsContent>
                <TabsContent value="receipt" className="mt-0">
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
