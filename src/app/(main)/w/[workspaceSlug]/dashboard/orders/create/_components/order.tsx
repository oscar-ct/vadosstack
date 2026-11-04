"use client";

import * as React from "react";

import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronDown, LockKeyhole, PackagePlus, Save, Send, Undo, Unlock } from "lucide-react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { useWorkspaceRouter as useRouter } from "@/components/workspace-path-provider";
import type { OrderEditPolicy } from "@/lib/commerce/order-edit-policy";
import type { OrderListSummary } from "@/lib/commerce/order-list-summary";
import type { OrderResolutionRecord } from "@/lib/commerce/order-resolution";
import { cn, formatCurrency } from "@/lib/utils";

import type { InventoryItem } from "../../../inventory/_components/inventory-table";
import { OrderResolutionPanel } from "../../_components/order-resolution-panel";
import { createOrderWithInventoryAdjustments, updateOrderWithInventoryAdjustments } from "../../actions";
import { getOrderTotal, type OrderCompany, type OrderCustomer, type OrderFormValues } from "./data";
import { OrderForm } from "./order-form";
import { getOrderStepValidationError, getOrderValidationError, orderValuesToInput } from "./order-input";
import { OrderPreview } from "./order-preview";
import { type OrderStep, orderSteps } from "./order-steps";

type OrderWorkspaceMode = "create" | "edit";
const editActionButtonClassName = "h-11 min-w-0 justify-center px-3 sm:h-8";

type OrderWorkspaceProps = {
  resolutionActions?: Record<string, React.ReactNode>;
  receiptActions?: Record<string, React.ReactNode>;
  recordSummary?: OrderListSummary;
  resolutions?: OrderResolutionRecord[];
  editPolicy?: OrderEditPolicy;
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
  statusBadge?: React.ReactNode;
  title: string;
};

export function OrderWorkspace({
  resolutionActions,
  receiptActions,
  recordSummary,
  resolutions = [],
  editPolicy,
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
  statusBadge,
  title,
}: OrderWorkspaceProps) {
  const router = useRouter();
  const [recordView, setRecordView] = React.useState<"order" | "resolutions">("order");
  const [selectedResolution, setSelectedResolution] = React.useState(resolutions[0]?.id ?? "");
  const recordPanelId = React.useId();
  const switchId = React.useId();
  const reduceMotion = useReducedMotion();
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
    if (!isCreate) {
      setActiveStep(target);
      setValidationAttempts(0);
      return;
    }
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
              {statusBadge}
              <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <PackagePlus className="size-4" />
              </span>
            </h1>
            <p className="text-muted-foreground text-sm">
              {recordView === "resolutions"
                ? "Review recorded cancellations, returns, and refunds."
                : isCreate || isReadOnly
                  ? description
                  : editPolicy?.financialLocked
                    ? "Update contact details and notes. Recorded transactions remain protected."
                    : "Update this order before payment or fulfillment starts."}
            </p>
          </div>
        </div>

        {headerActions ? <div className="flex flex-wrap items-center gap-2">{headerActions}</div> : null}
      </div>
      {operations}
      <div className="grid scroll-mt-20 gap-4">
        {!isCreate &&
        (resolutions.length > 0 || recordSummary?.hasResolutions || (recordSummary?.refunded ?? 0) > 0) ? (
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2">
            {resolutions.length > 0 ? (
              <LayoutGroup id={switchId}>
                <fieldset
                  className="isolate grid w-full shrink-0 grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:w-[28rem] sm:max-w-full"
                  aria-label="Order record view"
                >
                  {[
                    { id: "order" as const, label: "Original order" },
                    { id: "resolutions" as const, label: `Resolutions (${resolutions.length})` },
                  ].map((view) => (
                    <button
                      key={view.id}
                      type="button"
                      aria-pressed={recordView === view.id}
                      aria-controls={recordPanelId}
                      onClick={() => setRecordView(view.id)}
                      className={cn(
                        "relative flex min-h-10 items-center justify-center rounded-lg px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        recordView === view.id
                          ? "font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {recordView === view.id ? (
                        <motion.span
                          layoutId={reduceMotion ? undefined : "record-indicator"}
                          initial={false}
                          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                          className="pointer-events-none absolute inset-0 -z-10 rounded-lg border bg-background shadow-sm"
                        />
                      ) : null}
                      {view.label}
                    </button>
                  ))}
                </fieldset>
              </LayoutGroup>
            ) : null}
            {recordSummary ? (
              <section
                className="min-w-0 text-muted-foreground text-xs leading-relaxed"
                aria-label="Order resolution summary"
              >
                {[
                  recordSummary.cancelledUnits > 0 ? `${recordSummary.cancelledUnits} cancelled` : "",
                  recordSummary.returnedUnits > 0 ? `${recordSummary.returnedUnits} returned` : "",
                  recordSummary.refunded > 0 ? `${formatCurrency(recordSummary.refunded)} refunded` : "",
                  recordSummary.refundDue > 0 ? `${formatCurrency(recordSummary.refundDue)} refund due` : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "This order has recorded resolutions."}
              </section>
            ) : null}
          </div>
        ) : null}
        <FormProvider {...form}>
          <motion.div
            id={recordPanelId}
            key={recordView}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
          >
            {recordView === "resolutions" && orderId ? (
              <OrderResolutionPanel
                company={company}
                orderId={orderId}
                actions={resolutionActions}
                receiptActions={receiptActions}
                records={resolutions}
                selectedId={selectedResolution}
                onSelect={setSelectedResolution}
              />
            ) : (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,0.56fr)_minmax(380px,0.44fr)]">
                <OrderForm
                  toolbar={
                    !isCreate && canEdit ? (
                      <fieldset
                        className="flex min-w-0 flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between"
                        aria-label="Order editing controls"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          {locked ? (
                            <LockKeyhole className="size-4 text-muted-foreground" aria-hidden="true" />
                          ) : (
                            <Unlock className="size-4 text-muted-foreground" aria-hidden="true" />
                          )}
                          <span className="font-medium">Order details</span>
                          <span className="text-muted-foreground text-xs">
                            {locked ? "Read-only" : form.formState.isDirty ? "Unsaved changes" : "Editing"}
                          </span>
                        </div>
                        <div className={cn("grid gap-2 sm:flex sm:shrink-0", locked ? "grid-cols-1" : "grid-cols-2")}>
                          {locked ? (
                            <Button
                              type="button"
                              size="sm"
                              className={editActionButtonClassName}
                              onClick={() => {
                                setLocked(false);
                                toast.success("Order unlocked.");
                              }}
                            >
                              <Unlock />
                              Unlock Order
                            </Button>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={editActionButtonClassName}
                                aria-label="Discard Changes"
                                disabled={isSaving}
                                onClick={() => {
                                  form.reset();
                                  setLocked(true);
                                  toast.success("Changes discarded.");
                                }}
                              >
                                <Undo />
                                <span>
                                  Discard<span className="hidden sm:inline"> Changes</span>
                                </span>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className={editActionButtonClassName}
                                aria-label={isSaving ? "Saving changes" : "Save Changes"}
                                disabled={isSaving}
                                onClick={saveOrder}
                              >
                                <Save />
                                {isSaving ? (
                                  "Saving..."
                                ) : (
                                  <span>
                                    Save<span className="hidden sm:inline"> Changes</span>
                                  </span>
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </fieldset>
                    ) : undefined
                  }
                  editPolicy={editPolicy}
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
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                          getOrderTotal(order),
                        )}
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
                      originalDocument={resolutions.length > 0}
                      emailAction={previewActions}
                      order={
                        resolutions.length > 0
                          ? {
                              ...order,
                              adjustmentSummary: undefined,
                              items: order.items.map((item) => ({ ...item, cancelledQuantity: 0 })),
                            }
                          : order
                      }
                      orderId={orderId}
                    />
                  </div>
                </aside>
              </div>
            )}
          </motion.div>
        </FormProvider>
      </div>
    </div>
  );
}
