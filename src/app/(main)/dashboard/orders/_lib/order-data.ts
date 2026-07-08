import { prisma } from "@/lib/prisma";

import type { InventoryItem } from "../../inventory/_components/inventory-table";
import type { OrderTableItem } from "../_components/orders-table";
import {
  defaultOrderFooterMessage,
  defaultOrderTaxRate,
  type OrderCustomer,
  type OrderFormValues,
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

export async function getOrderTableItems(ownerId: string): Promise<OrderTableItem[]> {
  const orders = await prisma.order.findMany({
    where: {
      ownerId,
    },
    include: {
      _count: {
        select: {
          items: true,
        },
      },
    },
    orderBy: {
      orderDate: "desc",
    },
  });

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName ?? "Walk-in Customer",
    paymentStatus:
      order.paymentStatus === "Pending" ? "Pending" : order.paymentStatus === "Refunded" ? "Refunded" : "Paid",
    fulfillmentStatus:
      order.fulfillmentStatus === "Fulfilled"
        ? "Fulfilled"
        : order.fulfillmentStatus === "Returned"
          ? "Returned"
          : "Unfulfilled",
    itemCount: order._count.items,
    total: Number(order.total),
    orderedAt: order.orderDate.toISOString(),
  }));
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
    sku: item.sku,
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
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!order) return null;

  return {
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
    fulfillmentStatus:
      order.fulfillmentStatus === "Fulfilled"
        ? "Fulfilled"
        : order.fulfillmentStatus === "Returned"
          ? "Returned"
          : "Unfulfilled",
    items: order.items.map((item) => ({
      category: item.category ?? "",
      id: item.id,
      inventoryItemId: item.inventoryItemId ?? undefined,
      product: item.product,
      quantity: item.quantity,
      sku: item.sku ?? "",
      unitPrice: Number(item.unitPrice),
    })),
    orderDate: toDateInputValue(order.orderDate),
    orderNumber: order.orderNumber,
    paymentMethod: order.paymentMethod ?? "",
    paymentReference: order.paymentReference ?? "",
    paymentStatus: order.paymentStatus === "Pending" ? "Pending" : "Paid",
    shipping: Number(order.shippingAmount),
    state: order.shippingState ?? "",
    streetAddress: order.shippingLine1 ?? "",
    tax: Number(order.taxRate) || defaultOrderTaxRate,
    trackingNumber: order.trackingNumber ?? "",
    zip: order.shippingPostalCode ?? "",
  };
}
