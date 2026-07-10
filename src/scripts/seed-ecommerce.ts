import { Prisma } from "@prisma/client";

import { mockInventoryItems } from "../app/(main)/dashboard/inventory/_lib/mock-inventory";
import { prisma } from "../lib/prisma";

const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
const seedOrderNumbers = [
  "ORD-2401",
  "ORD-2402",
  "ORD-2403",
  "ORD-2404",
  "ORD-2405",
  "ORD-2406",
  "ORD-2407",
  "ORD-2408",
  "ORD-2385",
  "ORD-2386",
  "ORD-2387",
  "ORD-2388",
];
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
    orderNumber: "ORD-2401",
    customerIndex: 0,
    orderDate: "2026-07-01T10:15:00-05:00",
    estimatedDelivery: "2026-07-03T12:00:00-05:00",
    paymentStatus: "Paid",
    fulfillmentStatus: "Fulfilled",
    paymentMethod: "Visa ending in 4242",
    paymentReference: "AUTH-2401",
    shippingAmount: 18,
    shippingService: "UPS Ground",
    trackingNumber: "DEMO-TRACK-2401",
    customerNotes: "Fictional order created for VadosStack product screenshots.",
    items: [
      { inventorySku: "HVAC-205", quantity: 2 },
      { inventorySku: "PLB-420", quantity: 1 },
    ],
  },
  {
    orderNumber: "ORD-2402",
    customerIndex: 1,
    orderDate: "2026-07-02T13:40:00-05:00",
    estimatedDelivery: "2026-07-05T12:00:00-05:00",
    paymentStatus: "Paid",
    fulfillmentStatus: "Fulfilled",
    paymentMethod: "Mastercard ending in 1881",
    paymentReference: "AUTH-2402",
    shippingAmount: 0,
    shippingService: "Local delivery",
    trackingNumber: "DEMO-TRACK-2402",
    items: [{ inventorySku: "ELC-620", quantity: 2 }],
  },
  {
    orderNumber: "ORD-2403",
    customerIndex: 2,
    orderDate: "2026-07-03T09:20:00-05:00",
    estimatedDelivery: "2026-07-07T12:00:00-05:00",
    paymentStatus: "Paid",
    fulfillmentStatus: "Fulfilled",
    paymentMethod: "Visa ending in 4242",
    paymentReference: "AUTH-2403",
    shippingAmount: 16,
    shippingService: "UPS Ground",
    trackingNumber: "DEMO-TRACK-2403",
    items: [
      { inventorySku: "PLB-310", quantity: 1 },
      { inventorySku: "PLB-515", quantity: 2 },
    ],
  },
  {
    orderNumber: "ORD-2404",
    customerIndex: 3,
    orderDate: "2026-07-04T15:05:00-05:00",
    paymentStatus: "Pending",
    fulfillmentStatus: "Unfulfilled",
    shippingAmount: 18,
    shippingService: "UPS Ground",
    items: [{ inventorySku: "HVAC-101", quantity: 1 }],
  },
  {
    orderNumber: "ORD-2405",
    customerIndex: 4,
    orderDate: "2026-07-05T11:30:00-05:00",
    paymentStatus: "Paid",
    fulfillmentStatus: "Fulfilled",
    paymentMethod: "Visa ending in 4242",
    paymentReference: "AUTH-2405",
    shippingAmount: 0,
    shippingService: "Local pickup",
    items: [
      { inventorySku: "ACC-810", quantity: 2 },
      { inventorySku: "ACC-925", quantity: 1 },
    ],
  },
  {
    orderNumber: "ORD-2406",
    customerIndex: 5,
    orderDate: "2026-07-06T16:10:00-05:00",
    paymentStatus: "Paid",
    fulfillmentStatus: "Fulfilled",
    paymentMethod: "Mastercard ending in 1881",
    paymentReference: "AUTH-2406",
    shippingAmount: 18,
    shippingService: "UPS Ground",
    items: [
      { inventorySku: "PLB-420", quantity: 4 },
      { inventorySku: "PLB-515", quantity: 2 },
    ],
  },
  {
    orderNumber: "ORD-2407",
    customerIndex: 6,
    orderDate: "2026-07-08T08:45:00-05:00",
    paymentStatus: "Paid",
    fulfillmentStatus: "Unfulfilled",
    paymentMethod: "Visa ending in 4242",
    paymentReference: "AUTH-2407",
    shippingAmount: 18,
    shippingService: "UPS Ground",
    items: [
      { inventorySku: "ELC-735", quantity: 3 },
      { inventorySku: "ELC-620", quantity: 1 },
    ],
  },
  {
    orderNumber: "ORD-2408",
    customerIndex: 7,
    orderDate: "2026-07-10T09:10:00-05:00",
    paymentStatus: "Pending",
    fulfillmentStatus: "Unfulfilled",
    shippingAmount: 18,
    shippingService: "UPS Ground",
    items: [
      { inventorySku: "HVAC-205", quantity: 3 },
      { inventorySku: "PLB-310", quantity: 1 },
    ],
  },
  {
    orderNumber: "ORD-2385",
    customerIndex: 0,
    orderDate: "2026-06-05T10:00:00-05:00",
    paymentStatus: "Paid",
    fulfillmentStatus: "Fulfilled",
    paymentMethod: "Visa ending in 4242",
    paymentReference: "AUTH-2385",
    shippingAmount: 18,
    items: [{ inventorySku: "HVAC-205", quantity: 2 }],
  },
  {
    orderNumber: "ORD-2386",
    customerIndex: 2,
    orderDate: "2026-06-10T14:20:00-05:00",
    paymentStatus: "Paid",
    fulfillmentStatus: "Fulfilled",
    paymentMethod: "Visa ending in 4242",
    paymentReference: "AUTH-2386",
    shippingAmount: 18,
    items: [
      { inventorySku: "PLB-310", quantity: 1 },
      { inventorySku: "PLB-420", quantity: 2 },
    ],
  },
  {
    orderNumber: "ORD-2387",
    customerIndex: 4,
    orderDate: "2026-06-18T09:35:00-05:00",
    paymentStatus: "Paid",
    fulfillmentStatus: "Fulfilled",
    paymentMethod: "Mastercard ending in 1881",
    paymentReference: "AUTH-2387",
    shippingAmount: 0,
    items: [
      { inventorySku: "ELC-620", quantity: 1 },
      { inventorySku: "ELC-735", quantity: 2 },
    ],
  },
  {
    orderNumber: "ORD-2388",
    customerIndex: 6,
    orderDate: "2026-06-27T16:15:00-05:00",
    paymentStatus: "Pending",
    fulfillmentStatus: "Unfulfilled",
    shippingAmount: 18,
    items: [{ inventorySku: "HVAC-101", quantity: 1 }],
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
  if (!ownerEmail) throw new Error("Set SEED_OWNER_EMAIL before seeding e-commerce data.");
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
