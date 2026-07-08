"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Lock, PackagePlus, Save, Send, Unlock } from "lucide-react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";

import type { InventoryItem } from "../../../inventory/_components/inventory-table";
import { createOrderWithInventoryAdjustments, updateOrderWithInventoryAdjustments } from "../../actions";
import { clampOrderFooterMessage, type OrderCompany, type OrderCustomer, type OrderFormValues } from "./data";
import { OrderForm } from "./order-form";
import { OrderPreview } from "./order-preview";

type OrderWorkspaceMode = "create" | "edit";
const headerActionButtonClassName = "min-w-32 justify-center";

type OrderWorkspaceProps = {
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

function parseOrderDate(value: string) {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function optionalString(value: string) {
  const text = value.trim();

  return text || null;
}

function orderValuesToInput(order: OrderFormValues) {
  return {
    customerEmail: optionalString(order.customerEmail),
    customerName: optionalString(order.customerName),
    customerNotes: optionalString(order.customerNotes),
    customerPhone: optionalString(order.customerPhone),
    discountAmount: Number.isFinite(order.discount) ? order.discount : 0,
    estimatedDelivery: order.deliveryRange ? parseOrderDate(order.deliveryRange) : null,
    footerMessage: clampOrderFooterMessage(order.footerMessage),
    fulfillmentStatus: order.fulfillmentStatus,
    items: order.items.map((item) => ({
      category: optionalString(item.category),
      inventoryItemId: item.inventoryItemId ?? null,
      product: item.product,
      quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
      sku: optionalString(item.sku ?? ""),
      unitPrice: Number.isFinite(item.unitPrice) ? item.unitPrice : 0,
    })),
    orderDate: parseOrderDate(order.orderDate),
    orderNumber: order.orderNumber,
    paymentMethod: optionalString(order.paymentMethod),
    paymentReference: optionalString(order.paymentReference),
    paymentStatus: order.paymentStatus,
    shippingAmount: Number.isFinite(order.shipping) ? order.shipping : 0,
    shippingCity: optionalString(order.city),
    shippingLine1: optionalString(order.streetAddress),
    shippingLine2: optionalString(order.apartment),
    shippingPostalCode: optionalString(order.zip),
    shippingService: optionalString(order.deliveryCompany),
    shippingState: optionalString(order.state),
    taxRate: Number.isFinite(order.tax) ? order.tax : 0,
    trackingNumber: optionalString(order.trackingNumber),
  };
}

function getOrderValidationError(order: OrderFormValues) {
  if (!order.orderDate?.trim()) return "Order date is required.";
  if (!order.customerName?.trim()) return "Customer name is required.";
  if (!order.streetAddress?.trim() || !order.city?.trim() || !order.state?.trim() || !order.zip?.trim()) {
    return "Shipping address is required.";
  }
  if (!order.items.length) return "Add at least one item.";

  const invalidItemIndex = order.items.findIndex((item) => {
    const hasProduct = Boolean(item.product?.trim());
    const hasQuantity = Number.isFinite(item.quantity) && item.quantity > 0;
    const hasPrice = Number.isFinite(item.unitPrice) && item.unitPrice >= 0;

    return !hasProduct || !hasQuantity || !hasPrice;
  });

  if (invalidItemIndex !== -1) {
    return `Item ${invalidItemIndex + 1} needs a product, quantity above 0, and a valid price.`;
  }

  return null;
}

export function OrderWorkspace({
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
  const [locked, setLocked] = React.useState(mode === "edit");
  const [isSaving, setIsSaving] = React.useState(false);
  const form = useForm<OrderFormValues>({
    defaultValues,
  });
  const order = useWatch({ control: form.control }) as OrderFormValues;
  const isCreate = mode === "create";
  const isReadOnly = !isCreate && locked;

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
        const createdOrder = await createOrderWithInventoryAdjustments(input);
        toast.success("Order created.");
        router.push(`/dashboard/orders/${createdOrder.id}/edit`);
        router.refresh();
        return;
      }

      if (!orderId) {
        toast.error("Order id is missing.");
        return;
      }

      await updateOrderWithInventoryAdjustments(orderId, input);
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
            <BackButton fallbackHref={"/dashboard/orders"} />
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
          ) : locked ? (
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
          ) : (
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
                <Lock />
                Cancel & Lock
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
          )}
        </div>
      </div>
      {/*xl:grid-cols-[minmax(0,0.95fr)_minmax(28rem,1.05fr)]*/}
      <FormProvider {...form}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.56fr)_minmax(380px,0.44fr)]">
          <OrderForm customers={customers} disabled={isReadOnly} inventoryItems={inventoryItems} />
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
