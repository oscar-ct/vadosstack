"use client";

import * as React from "react";

import { ArrowLeft, ArrowRight, ChevronDown, PackagePlus, Save, Send, Undo, Unlock } from "lucide-react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { useWorkspaceRouter as useRouter } from "@/components/workspace-path-provider";
import { cn } from "@/lib/utils";

import type { InventoryItem } from "../../../inventory/_components/inventory-table";
import { createOrderWithInventoryAdjustments, updateOrderWithInventoryAdjustments } from "../../actions";
import { getOrderTotal, type OrderCompany, type OrderCustomer, type OrderFormValues } from "./data";
import { OrderForm } from "./order-form";
import { getOrderStepValidationError, getOrderValidationError, orderValuesToInput } from "./order-input";
import { OrderPreview } from "./order-preview";
import { type OrderStep, orderSteps } from "./order-steps";

type OrderWorkspaceMode = "create" | "edit";
const headerActionButtonClassName = "min-w-32 justify-center";

type OrderWorkspaceProps = {
  canEdit?: boolean;
  canRecordPayment?: boolean;
  canOverridePrices?: boolean;
  company: OrderCompany;
  customers: OrderCustomer[];
  defaultValues: OrderFormValues;
  description: string;
  headerActions?: React.ReactNode;
  inventoryItems: InventoryItem[];
  mode: OrderWorkspaceMode;
  orderId?: string;
  operations?: React.ReactNode;
  previewActions?: React.ReactNode;
  title: string;
};

export function OrderWorkspace({
  canEdit = true,
  canRecordPayment = false,
  canOverridePrices = false,
  company,
  customers,
  defaultValues,
  description,
  headerActions,
  inventoryItems,
  mode,
  orderId,
  operations,
  previewActions,
  title,
}: OrderWorkspaceProps) {
  const router = useRouter();
  const submissionKey = React.useRef<string | null>(null);
  const [locked, setLocked] = React.useState(mode === "edit");
  const [isSaving, setIsSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const [activeStep, setActiveStep] = React.useState<OrderStep>("customer");
  const [furthestStep, setFurthestStep] = React.useState(0);
  const [validationAttempts, setValidationAttempts] = React.useState(0);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const previewId = React.useId();
  const form = useForm<OrderFormValues>({
    defaultValues,
  });
  const order = useWatch({ control: form.control }) as OrderFormValues;
  const isCreate = mode === "create";
  const isReadOnly = !isCreate && (locked || !canEdit);

  const stepIndex = orderSteps.findIndex((step) => step.id === activeStep);
  const stepError = validationAttempts > 0 ? getOrderStepValidationError(order, activeStep, true) : null;

  function navigateStep(target: OrderStep) {
    if (savingRef.current) return;
    const targetIndex = orderSteps.findIndex((step) => step.id === target);
    if (targetIndex < stepIndex) {
      setActiveStep(target);
      setValidationAttempts(0);
      return;
    }
    for (let index = 0; index < targetIndex; index++) {
      const error = getOrderStepValidationError(form.getValues(), orderSteps[index].id, true);
      if (error) {
        setActiveStep(orderSteps[index].id);
        setValidationAttempts((attempts) => attempts + 1);
        return;
      }
    }
    setActiveStep(target);
    setFurthestStep((furthest) => Math.max(furthest, targetIndex));
    setValidationAttempts(0);
  }

  async function saveOrder() {
    if (savingRef.current || isReadOnly || (isCreate && activeStep !== "review")) return;

    const values = form.getValues();
    if (isCreate) {
      for (const step of orderSteps) {
        if (getOrderStepValidationError(values, step.id, true)) {
          setActiveStep(step.id);
          setValidationAttempts((attempts) => attempts + 1);
          return;
        }
      }
    }
    const validationError = getOrderValidationError(values);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    const input = orderValuesToInput(values);

    savingRef.current = true;
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
      savingRef.current = false;
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
          {isCreate ? null : locked && canEdit ? (
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
      {operations}
      <FormProvider {...form}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.56fr)_minmax(380px,0.44fr)]">
          <OrderForm
            customers={customers}
            disabled={isReadOnly || isSaving}
            creating={isCreate}
            activeStep={activeStep}
            furthestStep={furthestStep}
            onStepChange={navigateStep}
            validationError={stepError}
            validationAttempt={validationAttempts}
            footer={
              isCreate ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {stepIndex > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSaving}
                      onClick={() => navigateStep(orderSteps[stepIndex - 1].id)}
                    >
                      <ArrowLeft />
                      Back to {activeStep === "review" ? "items" : "customer"}
                    </Button>
                  ) : null}
                  {activeStep === "review" ? (
                    <Button type="button" size="sm" className="ml-auto" disabled={isSaving} onClick={saveOrder}>
                      <Send />
                      {isSaving ? "Creating..." : "Create order"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="ml-auto"
                      disabled={isSaving}
                      onClick={() => navigateStep(orderSteps[stepIndex + 1].id)}
                    >
                      Continue to {activeStep === "customer" ? "items" : "review"}
                      <ArrowRight />
                    </Button>
                  )}
                </div>
              ) : null
            }
            canRecordPayment={canRecordPayment}
            canOverridePrices={canOverridePrices}
            inventoryItems={inventoryItems}
          />
          <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start" aria-label="Receipt preview">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-4 text-left text-sm xl:hidden"
              aria-expanded={previewOpen}
              aria-controls={previewId}
              onClick={() => setPreviewOpen((open) => !open)}
            >
              <span className="grid gap-1">
                <span className="font-medium">Receipt preview</span>
                <span className="text-muted-foreground">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(getOrderTotal(order))}
                </span>
              </span>
              <ChevronDown
                className={cn("size-4 transition-transform", previewOpen && "rotate-180")}
                aria-hidden="true"
              />
            </button>
            <div id={previewId} className={cn(previewOpen ? "mt-3 block" : "hidden", "xl:mt-0 xl:block")}>
              <OrderPreview
                actionsDisabled={!isCreate && !locked}
                company={company}
                emailAction={previewActions}
                order={order}
                orderId={orderId}
              />
            </div>
          </aside>
        </div>
      </FormProvider>
    </div>
  );
}
