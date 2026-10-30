"use client";

import * as React from "react";

import { PackagePlus, Save, Send, Undo, Unlock } from "lucide-react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { useWorkspaceRouter as useRouter } from "@/components/workspace-path-provider";

import type { InventoryItem } from "../../../inventory/_components/inventory-table";
import { createOrderWithInventoryAdjustments, updateOrderWithInventoryAdjustments } from "../../actions";
import type { OrderCompany, OrderCustomer, OrderFormValues } from "./data";
import { OrderForm } from "./order-form";
import { getOrderValidationError, orderValuesToInput } from "./order-input";
import { OrderPreview } from "./order-preview";

type OrderWorkspaceMode = "create" | "edit";
const headerActionButtonClassName = "min-w-32 justify-center";

type OrderWorkspaceProps = {
  canEdit?: boolean;
  canRecordPayment?: boolean;
  company: OrderCompany;
  customers: OrderCustomer[];
  defaultValues: OrderFormValues;
  description: string;
  headerActions?: React.ReactNode;
  inventoryItems: InventoryItem[];
  mode: OrderWorkspaceMode;
  orderId?: string;
  previewActions?: React.ReactNode;
  title: string;
};

export function OrderWorkspace({
  canEdit = true,
  canRecordPayment = false,
  company,
  customers,
  defaultValues,
  description,
  headerActions,
  inventoryItems,
  mode,
  orderId,
  previewActions,
  title,
}: OrderWorkspaceProps) {
  const router = useRouter();
  const submissionKey = React.useRef<string | null>(null);
  const [locked, setLocked] = React.useState(mode === "edit");
  const [isSaving, setIsSaving] = React.useState(false);
  const form = useForm<OrderFormValues>({
    defaultValues,
  });
  const order = useWatch({ control: form.control }) as OrderFormValues;
  const isCreate = mode === "create";
  const isReadOnly = !isCreate && (locked || !canEdit);

  async function saveOrder() {
    if (isSaving) return;

    const values = form.getValues();
    const validationError = getOrderValidationError(values);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    const input = orderValuesToInput(values);

    setIsSaving(true);

    try {
      if (isCreate) {
        const storageKey = `commerce:order-submission:${window.location.pathname}`;
        try {
          submissionKey.current ??= sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
          sessionStorage.setItem(storageKey, submissionKey.current);
        } catch {
          submissionKey.current ??= crypto.randomUUID();
        }
        const createdOrder = await createOrderWithInventoryAdjustments({
          ...input,
          submissionKey: submissionKey.current,
        });
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* Storage may be disabled. */
        }
        toast.success("Order created.");
        router.push(`/dashboard/orders/${createdOrder.id}/edit`);
        router.refresh();
        return;
      }

      if (!orderId) {
        toast.error("Order id is missing.");
        return;
      }

      const updated = await updateOrderWithInventoryAdjustments(orderId, input);
      values.expectedVersion = updated.version;
      toast.success("Order saved.");
      setLocked(true);
      form.reset(values);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Order could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-3">
          <div>
            <BackButton fallbackHref="/dashboard/orders" preferFallback />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 font-medium text-xl leading-none tracking-tight">
              {title}
              <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <PackagePlus className="size-4" />
              </span>
            </h1>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {headerActions}
          {isCreate ? (
            <Button
              type="button"
              size="sm"
              className={headerActionButtonClassName}
              disabled={isSaving}
              onClick={saveOrder}
            >
              <Send />
              {isSaving ? "Creating..." : "Create Order"}
            </Button>
          ) : locked && canEdit ? (
            <Button
              type="button"
              size="sm"
              className={headerActionButtonClassName}
              onClick={() => {
                setLocked(false);
                toast.success("Order unlocked.");
              }}
            >
              <Unlock />
              Unlock Order
            </Button>
          ) : canEdit ? (
            <>
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
              <Button
                type="button"
                size="sm"
                className={headerActionButtonClassName}
                disabled={isSaving}
                onClick={saveOrder}
              >
                <Save />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {/*xl:grid-cols-[minmax(0,0.95fr)_minmax(28rem,1.05fr)]*/}
      <FormProvider {...form}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.56fr)_minmax(380px,0.44fr)]">
          <OrderForm
            customers={customers}
            disabled={isReadOnly}
            creating={isCreate}
            canRecordPayment={canRecordPayment}
            inventoryItems={inventoryItems}
          />
          <OrderPreview
            actionsDisabled={!isCreate && !locked}
            company={company}
            emailAction={previewActions}
            order={order}
            orderId={orderId}
          />
        </div>
      </FormProvider>
    </div>
  );
}
