import { Prisma } from "@prisma/client";

import { mockInventoryItems } from "../app/(main)/dashboard/inventory/_lib/mock-inventory";
import { prisma } from "../lib/prisma";

const ownerEmail = "oscar.a.castro818@gmail.com";
const seedOrderNumbers = ["ORD-0001", "ORD-0002", "ORD-0003"];
const seedMovementReason = "Seed order adjustment";

type SeedOrderItem = {
  category?: string;
  inventorySku?: string;
  product?: string;
  quantity: number;
  sku?: string;
  taxRate?: number;
  taxable?: boolean;
  unitPrice?: number;
};

type SeedOrder = {
  customerIndex: number;
  customerNotes?: string;
  discountAmount?: number;
  estimatedDelivery?: string;
  fulfillmentStatus: "Fulfilled" | "Unfulfilled";
  items: SeedOrderItem[];
  orderDate: string;
  orderNumber: string;
  paymentMethod?: string;
  paymentReference?: string;
  paymentStatus: "Paid" | "Pending";
  shippingAmount: number;
  shippingService?: string;
  trackingNumber?: string;
};

const seedOrders: SeedOrder[] = [
  {
    orderNumber: "ORD-0001",
    customerIndex: 0,
    orderDate: "2026-07-02T15:30:00.000Z",
    estimatedDelivery: "2026-07-08T12:00:00.000Z",
    paymentStatus: "Paid",
    fulfillmentStatus: "Unfulfilled",
    paymentMethod: "Visa ending in 4242",
    paymentReference: "AUTH-8427",
    shippingAmount: 12,
    shippingService: "UPS Ground",
    trackingNumber: "1Z999AA10123456784",
    customerNotes: "Please leave the order at the front desk if no one answers.",
    items: [
      { inventorySku: "WH-1001", quantity: 1 },
      { inventorySku: "HS-8034", quantity: 2 },
    ],
  },
  {
    orderNumber: "ORD-0002",
    customerIndex: 1,
    orderDate: "2026-07-03T18:10:00.000Z",
    paymentStatus: "Pending",
    fulfillmentStatus: "Unfulfilled",
    shippingAmount: 0,
    customerNotes: "Customer wants to confirm pickup timing before paying.",
    items: [
      {
        sku: "CUSTOM-001",
        product: "Custom setup kit",
        category: "Custom",
        quantity: 1,
        unitPrice: 185,
        taxRate: 8.25,
      },
    ],
  },
  {
    orderNumber: "ORD-0003",
    customerIndex: 2,
    orderDate: "2026-07-04T13:45:00.000Z",
    estimatedDelivery: "2026-07-10T12:00:00.000Z",
    paymentStatus: "Paid",
    fulfillmentStatus: "Fulfilled",
    paymentMethod: "Mastercard ending in 8841",
    paymentReference: "AUTH-6219",
    shippingAmount: 18,
    shippingService: "USPS Priority",
    trackingNumber: "9400111202555830000000",
    discountAmount: 25,
    items: [
      { inventorySku: "DS-6078", quantity: 1 },
      { inventorySku: "KB-2045", quantity: 2 },
    ],
  },
];

function toDecimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function getSnapshot(customer?: {
  addresses: Array<{
    city: string | null;
    line1: string;
    line2: string | null;
    postalCode: string | null;
    state: string | null;
  }>;
  email: string | null;
  name: string;
  phoneNumbers: Array<{ value: string }>;
}) {
  const address = customer?.addresses[0];

  return {
    customerName: customer?.name ?? "Walk-in Customer",
    customerEmail: customer?.email ?? null,
    customerPhone: customer?.phoneNumbers[0]?.value ?? null,
    shippingLine1: address?.line1 ?? null,
    shippingLine2: address?.line2 ?? null,
    shippingCity: address?.city ?? null,
    shippingState: address?.state ?? null,
    shippingPostalCode: address?.postalCode ?? null,
  };
}

async function main() {
  const owner = await prisma.user.findUnique({
    where: {
      email: ownerEmail,
    },
    select: {
      id: true,
      orderMessageText: true,
    },
  });

  if (!owner) {
    throw new Error("Run setup:auth before seeding e-commerce data.");
  }

  const categories = new Map<string, string>();
  const locations = new Map<string, string>();

  for (const name of Array.from(new Set(mockInventoryItems.map((item) => item.category))).sort()) {
    const category = await prisma.inventoryCategory.upsert({
      where: {
        ownerId_name: {
          ownerId: owner.id,
          name,
        },
      },
      update: {},
      create: {
        ownerId: owner.id,
        name,
      },
      select: {
        id: true,
      },
    });
    categories.set(name, category.id);
  }

  for (const name of Array.from(new Set(mockInventoryItems.map((item) => item.location))).sort()) {
    const location = await prisma.inventoryLocation.upsert({
      where: {
        ownerId_name: {
          ownerId: owner.id,
          name,
        },
      },
      update: {},
      create: {
        ownerId: owner.id,
        name,
      },
      select: {
        id: true,
      },
    });
    locations.set(name, location.id);
  }

  for (const item of mockInventoryItems) {
    await prisma.inventoryItem.upsert({
      where: {
        ownerId_sku: {
          ownerId: owner.id,
          sku: item.sku,
        },
      },
      update: {
        id: item.id,
        categoryId: categories.get(item.category) ?? null,
        locationId: locations.get(item.location) ?? null,
        product: item.product,
        description: item.description,
        stock: item.stock,
        reorderPoint: item.reorderPoint,
        maxStock: item.maxStock,
        unit: item.unit,
        cost: item.cost,
        unitPrice: item.unitPrice,
        taxable: item.taxable,
        taxRate: item.taxRate,
        itemStatus: item.itemStatus,
        barcode: item.barcode ?? null,
        vendor: item.vendor ?? null,
        notes: item.notes ?? null,
      },
      create: {
        id: item.id,
        ownerId: owner.id,
        categoryId: categories.get(item.category) ?? null,
        locationId: locations.get(item.location) ?? null,
        sku: item.sku,
        product: item.product,
        description: item.description,
        stock: item.stock,
        reorderPoint: item.reorderPoint,
        maxStock: item.maxStock,
        unit: item.unit,
        cost: item.cost,
        unitPrice: item.unitPrice,
        taxable: item.taxable,
        taxRate: item.taxRate,
        itemStatus: item.itemStatus,
        barcode: item.barcode ?? null,
        vendor: item.vendor ?? null,
        notes: item.notes ?? null,
      },
    });
  }

  const oldOrders = await prisma.order.findMany({
    where: {
      ownerId: owner.id,
      orderNumber: {
        in: seedOrderNumbers,
      },
    },
    select: {
      id: true,
    },
  });

  await prisma.inventoryStockMovement.deleteMany({
    where: {
      ownerId: owner.id,
      OR: [
        {
          orderId: {
            in: oldOrders.map((order) => order.id),
          },
        },
        {
          reason: seedMovementReason,
        },
      ],
    },
  });
  await prisma.order.deleteMany({
    where: {
      ownerId: owner.id,
      orderNumber: {
        in: seedOrderNumbers,
      },
    },
  });

  const customers = await prisma.customer.findMany({
    where: {
      ownerId: owner.id,
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
      joinedAt: "asc",
    },
    take: 3,
  });

  for (const seedOrder of seedOrders) {
    const customer = customers[seedOrder.customerIndex];
    const snapshot = getSnapshot(customer);
    const preparedItems = [];

    for (const seedItem of seedOrder.items) {
      const inventoryItem = seedItem.inventorySku
        ? await prisma.inventoryItem.findUnique({
            where: {
              ownerId_sku: {
                ownerId: owner.id,
                sku: seedItem.inventorySku,
              },
            },
            include: {
              category: true,
            },
          })
        : null;
      const quantity = seedItem.quantity;
      const unitPrice = inventoryItem ? Number(inventoryItem.unitPrice) : (seedItem.unitPrice ?? 0);
      const taxable = inventoryItem?.taxable ?? seedItem.taxable ?? true;
      const taxRate = Number(inventoryItem?.taxRate ?? seedItem.taxRate ?? 0);
      const lineTotal = quantity * unitPrice;

      preparedItems.push({
        inventoryItem,
        quantity,
        sku: inventoryItem?.sku ?? seedItem.sku ?? null,
        product: inventoryItem?.product ?? seedItem.product ?? "Custom item",
        category: inventoryItem?.category?.name ?? seedItem.category ?? null,
        unitPrice,
        lineTotal,
        taxable,
        taxRate,
      });
    }

    const subtotal = preparedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const taxAmount = preparedItems.reduce(
      (sum, item) => sum + (item.taxable ? item.lineTotal * (item.taxRate / 100) : 0),
      0,
    );
    const discountAmount = seedOrder.discountAmount ?? 0;
    const total = Math.max(subtotal + seedOrder.shippingAmount + taxAmount - discountAmount, 0);

    const order = await prisma.order.create({
      data: {
        ownerId: owner.id,
        customerId: customer?.id ?? null,
        orderNumber: seedOrder.orderNumber,
        paymentStatus: seedOrder.paymentStatus,
        fulfillmentStatus: seedOrder.fulfillmentStatus,
        orderDate: new Date(seedOrder.orderDate),
        estimatedDelivery: seedOrder.estimatedDelivery ? new Date(seedOrder.estimatedDelivery) : null,
        shippingService: seedOrder.shippingService ?? null,
        trackingNumber: seedOrder.trackingNumber ?? null,
        paymentMethod: seedOrder.paymentMethod ?? null,
        paymentReference: seedOrder.paymentReference ?? null,
        customerNotes: seedOrder.customerNotes ?? null,
        ...snapshot,
        subtotal: toDecimal(subtotal),
        shippingAmount: toDecimal(seedOrder.shippingAmount),
        taxRate: toDecimal(8.25),
        taxAmount: toDecimal(taxAmount),
        discountAmount: toDecimal(discountAmount),
        total: toDecimal(total),
        footerMessage: owner.orderMessageText,
      },
    });

    for (const item of preparedItems) {
      const orderItem = await prisma.orderItem.create({
        data: {
          ownerId: owner.id,
          orderId: order.id,
          inventoryItemId: item.inventoryItem?.id ?? null,
          sku: item.sku,
          product: item.product,
          category: item.category,
          quantity: item.quantity,
          unitPrice: toDecimal(item.unitPrice),
          lineTotal: toDecimal(item.lineTotal),
          taxable: item.taxable,
          taxRate: toDecimal(item.taxRate),
        },
      });

      if (item.inventoryItem) {
        await prisma.inventoryItem.update({
          where: {
            id: item.inventoryItem.id,
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
        await prisma.inventoryStockMovement.create({
          data: {
            ownerId: owner.id,
            inventoryItemId: item.inventoryItem.id,
            orderId: order.id,
            orderItemId: orderItem.id,
            quantityChange: -item.quantity,
            reason: seedMovementReason,
            notes: `Seeded ${seedOrder.orderNumber}`,
          },
        });
      }
    }
  }

  console.info(`Seeded ${mockInventoryItems.length} inventory items and ${seedOrders.length} orders.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
