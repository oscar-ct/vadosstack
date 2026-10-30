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
    where: {
      ownerId,
      ...(options.q
        ? {
            OR: [
              { orderNumber: { contains: options.q, mode: "insensitive" as const } },
              { customerName: { contains: options.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    take: 50,
    skip: ((options.page ?? 1) - 1) * 50,
    include: {
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
          refundAmount: true,
          refundStatus: true,
          returnNumber: true,
          refundState: true,
        },
        take: 1,
      },
    },
    orderBy: [{ orderDate: "desc" }, { id: "desc" }],
  });

  return orders.map((order) => {
    const orderReturn = order.returns[0];

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName ?? "Walk-in Customer",
      paymentStatus: order.paymentStatus as OrderTableItem["paymentStatus"],
      version: order.version,
      orderStatus: order.orderStatus,
      fulfillmentStatus: order.fulfillmentStatus as OrderFormValues["fulfillmentStatus"],
      itemCount: order._count.items,
      total: Number(order.total),
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
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!order) return null;

  const values: OrderFormValues = {
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
      updatedAt: item.updatedAt.toISOString(),
      inventoryItemId: item.inventoryItemId ?? undefined,
      product: item.product,
      quantity: item.quantity,
      taxable: item.taxable,
      taxRate: Number(item.taxRate),
      sku: item.sku ?? "",
      unitPrice: Number(item.unitPrice),
    })),
    orderDate: toDateInputValue(order.orderDate),
    orderNumber: order.orderNumber,
    paymentMethod: order.paymentMethod ?? "",
    paymentReference: order.paymentReference ?? "",
    paymentStatus: order.paymentStatus as OrderFormValues["paymentStatus"],
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
