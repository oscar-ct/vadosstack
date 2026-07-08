import { format } from "date-fns";

import { getCompanyLogoSrc } from "@/lib/company-logo";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

import type { OrderPdfData } from "./order-pdf";

function money(value: { toString: () => string } | string | number) {
  return `$${Number(value.toString()).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function optionalDate(value?: Date | null) {
  return value ? format(value, "MMM d, yyyy") : null;
}

export function sanitizeOrderPdfFilename(value: string) {
  return `${value.replace(/[^a-z0-9-]+/gi, "-")}.pdf`;
}

export async function getOrderDocumentData(ownerId: string, orderId: string): Promise<OrderPdfData | null> {
  const [order, owner] = await Promise.all([
    prisma.order.findFirst({
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
    }),
    prisma.user.findUnique({
      where: {
        id: ownerId,
      },
    }),
  ]);

  if (!order || !owner) return null;

  const companyLogoSrc = await getCompanyLogoSrc(owner.id);
  const isPaid = order.paymentStatus === "Paid";
  const cityState = [order.shippingCity, order.shippingState].filter(Boolean).join(", ");
  const cityStateZip = [cityState, order.shippingPostalCode].filter(Boolean).join(" ");
  const streetLine = [order.shippingLine1, order.shippingLine2].filter(Boolean).join(", ");

  return {
    companyEmail: owner.companyEmail ?? owner.email,
    companyLogoSrc,
    companyName: owner.companyName,
    companyPhone: owner.companyPhone ? formatPhoneNumber(owner.companyPhone) : null,
    customerEmail: order.customerEmail,
    customerName: order.customerName ?? "Customer",
    customerPhone: order.customerPhone ? formatPhoneNumber(order.customerPhone) : null,
    discountAmount: money(order.discountAmount),
    estimatedDelivery: optionalDate(order.estimatedDelivery),
    footerMessage: order.footerMessage,
    isPaid,
    items: order.items.map((item) => ({
      category: item.category ?? null,
      lineTotal: money(item.lineTotal),
      product: item.product,
      quantity: item.quantity,
      sku: item.sku ?? null,
      unitPrice: money(item.unitPrice),
    })),
    orderDate: format(order.orderDate, "MMM d, yyyy"),
    orderNumber: order.orderNumber,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    shippingAddressLines: [streetLine, cityStateZip].filter(Boolean),
    shippingAmount: money(order.shippingAmount),
    shippingService: order.shippingService,
    subtotal: money(order.subtotal),
    taxAmount: money(order.taxAmount),
    taxRate: `${Number(order.taxRate.toString()).toLocaleString("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: Number(order.taxRate.toString()) % 1 === 0 ? 0 : 2,
    })}%`,
    total: money(order.total),
    trackingNumber: order.trackingNumber,
  };
}
