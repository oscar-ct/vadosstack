import { adjustmentCredit, cancellableQuantity } from "@/lib/commerce/order-cancellation";
import { hasOrderShipping, isWalkInOrder } from "@/lib/commerce/order-customer";
import { orderListWhere } from "@/lib/commerce/order-filter";
import { getOrderListSummary } from "@/lib/commerce/order-list-summary";
import { getRecordedPaymentStatus } from "@/lib/commerce/payment-status";
import { prisma } from "@/lib/prisma";

import type { InventoryItem } from "../../inventory/_components/inventory-table";
import type { OrderTableItem } from "../_components/orders-table";
import {
  defaultOrderFooterMessage,
  type OrderCustomer,
  type OrderFormValues,
  pricingSignature,
} from "../create/_components/data";

export async function getOrderCustomers(ownerId: string): Promise<OrderCustomer[]> {
  const customers = await prisma.customer.findMany({
    where: {
      ownerId,
    },
    include: {
      addresses: {
        orderBy: {
          createdAt: "asc",
        },
      },
      phoneNumbers: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    email: customer.email ?? "",
    phone: customer.phoneNumbers[0]?.value ?? "",
    addresses: customer.addresses.map((address) => ({
      id: address.id,
      label: address.label ?? "Address",
      streetAddress: address.line1,
      apartment: address.line2 ?? "",
      city: address.city ?? "",
      state: address.state ?? "",
      zip: address.postalCode ?? "",
    })),
  }));
}

export async function getOrderTableItems(
  ownerId: string,
  options: { q?: string; page?: number } = {},
): Promise<OrderTableItem[]> {
  const orders = await prisma.order.findMany({
    where: orderListWhere(ownerId, options.q),
    take: 50,
    skip: ((options.page ?? 1) - 1) * 50,
    include: {
      items: {
        select: {
          id: true,
          product: true,
          quantity: true,
          shippedQuantity: true,
          returnItems: { select: { orderReturnId: true, returnQuantity: true, disposition: true } },
          physicalReturnItems: { select: { receivedQuantity: true, receipt: { select: { orderReturnId: true } } } },
          adjustmentItems: { select: { quantity: true, adjustment: { select: { kind: true } } } },
        },
      },
      payments: { select: { amount: true } },
      refunds: { where: { status: "succeeded" }, select: { amount: true, orderReturnId: true } },
      adjustments: {
        select: {
          kind: true,
          merchandiseAmount: true,
          discountAmount: true,
          taxAmount: true,
          shippingAmount: true,
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
      returns: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          refundAmount: true,
          refundStatus: true,
          returnNumber: true,
          refundState: true,
        },
      },
    },
    orderBy: [{ orderDate: "desc" }, { id: "desc" }],
  });

  return orders.map((order) => {
    const orderReturn = order.returns[0];
    const summary = getOrderListSummary(order);
    const fulfillmentItems = order.items
      .map((item) => ({
        id: item.id,
        product: item.product,
        remaining: cancellableQuantity({
          quantity: item.quantity,
          shippedQuantity: item.shippedQuantity,
          returnedQuantity: item.returnItems.reduce((sum, entry) => sum + entry.returnQuantity, 0),
          cancelledQuantity: item.adjustmentItems.reduce(
            (sum, entry) => sum + (entry.adjustment.kind === "Cancellation" ? entry.quantity : 0),
            0,
          ),
        }),
      }))
      .filter((item) => item.remaining > 0);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName ?? "Walk-in Customer",
      paymentStatus: summary.paymentStatus,
      version: order.version,
      orderStatus: order.orderStatus,
      fulfillmentStatus: order.fulfillmentStatus as OrderFormValues["fulfillmentStatus"],
      itemCount: order._count.items,
      primaryProduct: order.items[0]?.product ?? null,
      fulfillmentItems,
      total: Number(order.total),
      summary,
      originalValue: summary.effectiveTotal,
      discounts: summary.balance,
      collected: summary.netPaid,
      creditOwed: summary.creditOwed,
      nextAction: summary.nextAction,
      orderedAt: order.orderDate.toISOString(),
      returnNumber: orderReturn?.returnNumber ?? null,
      returnRefundAmount: orderReturn?.refundState === "succeeded" ? Number(orderReturn.refundAmount) : null,
      returnRefundStatus:
        orderReturn?.refundState === "succeeded"
          ? orderReturn.refundStatus
          : orderReturn
            ? `Refund ${orderReturn.refundState}`
            : null,
    };
  });
}

export async function getOrderCount(ownerId: string) {
  return prisma.order.count({
    where: {
      ownerId,
    },
  });
}

export async function getOrderInventoryItems(ownerId: string): Promise<InventoryItem[]> {
  const items = await prisma.inventoryItem.findMany({
    where: {
      ownerId,
      itemStatus: "Active",
    },
    include: {
      category: true,
      location: true,
    },
    orderBy: {
      product: "asc",
    },
  });

  return items.map((item) => ({
    id: item.id,
    updatedAt: item.updatedAt.toISOString(),
    sku: item.sku ?? "",
    product: item.product,
    category: item.category?.name ?? "Uncategorized",
    description: item.description ?? "",
    stock: item.stock,
    reorderPoint: item.reorderPoint,
    maxStock: item.maxStock,
    location: item.location?.name ?? "Unassigned",
    unit: item.unit,
    cost: Number(item.cost),
    unitPrice: Number(item.unitPrice),
    taxable: item.taxable,
    taxRate: Number(item.taxRate),
    itemStatus: item.itemStatus === "Inactive" ? "Inactive" : "Active",
    barcode: item.barcode ?? undefined,
    vendor: item.vendor ?? undefined,
    notes: item.notes ?? undefined,
  }));
}

function toDateInputValue(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export async function getOrderFormValues(ownerId: string, orderId: string): Promise<OrderFormValues | null> {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      ownerId,
    },
    include: {
      items: {
        include: {
          adjustmentItems: { include: { adjustment: { select: { kind: true } } } },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      adjustments: true,
      payments: { select: { amount: true } },
      refunds: { where: { status: "succeeded" }, select: { amount: true } },
    },
  });

  if (!order) return null;

  const credited = order.adjustments.reduce(
    (sum, adjustment) =>
      sum +
      adjustmentCredit({
        merchandiseAmount: Number(adjustment.merchandiseAmount),
        discountAmount: Number(adjustment.discountAmount),
        taxAmount: Number(adjustment.taxAmount),
        shippingAmount: Number(adjustment.shippingAmount),
      }),
    0,
  );
  const creditedMerchandise = order.adjustments.reduce(
    (sum, adjustment) => sum + Number(adjustment.merchandiseAmount),
    0,
  );
  const creditedDiscount = order.adjustments.reduce((sum, adjustment) => sum + Number(adjustment.discountAmount), 0);
  const creditedTax = order.adjustments.reduce((sum, adjustment) => sum + Number(adjustment.taxAmount), 0);
  const creditedShipping = order.adjustments.reduce((sum, adjustment) => sum + Number(adjustment.shippingAmount), 0);
  const paid = order.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const refunded = order.refunds.reduce((sum, refund) => sum + Number(refund.amount), 0);
  const effectiveTotal = Math.max(Number(order.total) - credited, 0);

  const values: OrderFormValues = {
    adjustmentSummary: order.adjustments.length
      ? {
          originalTotal: Number(order.total),
          credited,
          effectiveSubtotal: Math.max(Number(order.subtotal) - creditedMerchandise, 0),
          effectiveDiscount: Math.max(Number(order.discountAmount) - creditedDiscount, 0),
          effectiveTax: Math.max(Number(order.taxAmount) - creditedTax, 0),
          effectiveShipping: Math.max(Number(order.shippingAmount) - creditedShipping, 0),
          effectiveTotal,
          paid,
          refunded,
          creditOwed: Math.max(paid - refunded - effectiveTotal, 0),
        }
      : undefined,
    customerId: order.customerId,
    customerMode: isWalkInOrder(order) ? "walk_in" : "customer",
    deliveryMethod: hasOrderShipping({ ...order, shippingAmount: Number(order.shippingAmount) })
      ? "delivery"
      : "pickup",
    expectedVersion: order.version,
    apartment: order.shippingLine2 ?? "",
    city: order.shippingCity ?? "",
    customerEmail: order.customerEmail ?? "",
    customerName: order.customerName ?? "",
    customerNotes: order.customerNotes ?? "",
    customerPhone: order.customerPhone ?? "",
    deliveryCompany: order.shippingService ?? "",
    deliveryRange: toDateInputValue(order.estimatedDelivery),
    discount: Number(order.discountAmount),
    footerMessage: order.footerMessage || defaultOrderFooterMessage,
    fulfillmentStatus: order.fulfillmentStatus as OrderFormValues["fulfillmentStatus"],
    items: order.items.map((item) => ({
      category: item.category ?? "",
      description: item.description,
      unit: item.unit,
      id: item.id,
      cancelledQuantity: item.adjustmentItems.reduce(
        (sum, entry) => sum + (entry.adjustment.kind === "Cancellation" ? entry.quantity : 0),
        0,
      ),
      updatedAt: item.updatedAt.toISOString(),
      inventoryItemId: item.inventoryItemId ?? undefined,
      product: item.product,
      quantity: item.quantity,
      taxable: item.taxable,
      taxRate: Number(item.taxRate),
      sku: item.sku ?? "",
      unitPrice: Number(item.unitPrice),
      catalogUnitPrice: item.catalogUnitPrice == null ? null : Number(item.catalogUnitPrice),
      priceOverrideReason: item.priceOverrideReason,
      savedUnitPrice: Number(item.unitPrice),
      savedPriceOverrideReason: item.priceOverrideReason,
    })),
    orderDate: toDateInputValue(order.orderDate),
    orderNumber: order.orderNumber,
    paymentMethod: order.paymentMethod ?? "",
    paymentReference: order.paymentReference ?? "",
    paymentStatus: getRecordedPaymentStatus({ paid, refunded, due: Math.max(effectiveTotal - paid, 0) }),
    shipping: Number(order.shippingAmount),
    state: order.shippingState ?? "",
    streetAddress: order.shippingLine1 ?? "",
    tax: Number(order.taxRate),
    trackingNumber: order.trackingNumber ?? "",
    zip: order.shippingPostalCode ?? "",
  };
  values.persistedTotals = {
    signature: pricingSignature(values),
    subtotal: Number(order.subtotal),
    taxAmount: Number(order.taxAmount),
    total: Number(order.total),
  };
  return values;
}
