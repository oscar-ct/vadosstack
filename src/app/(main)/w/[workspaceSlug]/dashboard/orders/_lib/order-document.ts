import { format } from "date-fns";

import { adjustmentCredit } from "@/lib/commerce/order-cancellation";
import { hasOrderShipping } from "@/lib/commerce/order-customer";
import { getRecordedPaymentStatus } from "@/lib/commerce/payment-status";
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

export async function getOrderDocumentData(
  ownerId: string,
  orderId: string,
  originalDocument = false,
): Promise<OrderPdfData | null> {
  const [order, workspace] = await Promise.all([
    prisma.order.findFirst({
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
    }),
    prisma.workspace.findUnique({
      where: {
        id: ownerId,
      },
      include: {
        legacyOwner: {
          select: { email: true },
        },
      },
    }),
  ]);

  if (!order || !workspace) return null;

  const companyLogoSrc = await getCompanyLogoSrc(workspace.id);
  const cityState = [order.shippingCity, order.shippingState].filter(Boolean).join(", ");
  const cityStateZip = [cityState, order.shippingPostalCode].filter(Boolean).join(" ");
  const streetLine = [order.shippingLine1, order.shippingLine2].filter(Boolean).join(", ");
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
  const paymentStatus = getRecordedPaymentStatus({ paid, refunded, due: Math.max(effectiveTotal - paid, 0) });
  const isPaid = paymentStatus === "Paid";

  return {
    originalDocument,
    showShipping: hasOrderShipping({ ...order, shippingAmount: Number(order.shippingAmount) }),
    companyEmail: workspace.companyEmail ?? workspace.legacyOwner?.email ?? "",
    companyLogoSrc,
    companyName: workspace.name,
    companyPhone: workspace.companyPhone ? formatPhoneNumber(workspace.companyPhone) : null,
    customerEmail: order.customerEmail,
    customerName: order.customerName ?? "Customer",
    customerPhone: order.customerPhone ? formatPhoneNumber(order.customerPhone) : null,
    discountAmount: money(order.discountAmount),
    estimatedDelivery: optionalDate(order.estimatedDelivery),
    footerMessage: order.footerMessage,
    isPaid,
    paymentStatus,
    items: order.items.map((item) => ({
      category: item.category ?? null,
      id: item.id,
      cancelledQuantity: originalDocument
        ? 0
        : item.adjustmentItems.reduce(
            (sum, entry) => sum + (entry.adjustment.kind === "Cancellation" ? entry.quantity : 0),
            0,
          ),
      lineTotal: money(
        originalDocument
          ? item.lineTotal
          : Math.max(
              Number(item.lineTotal) -
                item.adjustmentItems.reduce(
                  (sum, entry) => sum + (entry.adjustment.kind === "Cancellation" ? Number(entry.grossAmount) : 0),
                  0,
                ),
              0,
            ),
      ),
      product: item.product,
      description: item.description,
      unit: item.unit,
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
    total: money(originalDocument ? order.total : effectiveTotal),
    adjustmentSummary:
      !originalDocument && order.adjustments.length
        ? {
            originalTotal: money(order.total),
            credited: money(credited),
            effectiveSubtotal: money(Math.max(Number(order.subtotal) - creditedMerchandise, 0)),
            effectiveDiscount: money(Math.max(Number(order.discountAmount) - creditedDiscount, 0)),
            effectiveTax: money(Math.max(Number(order.taxAmount) - creditedTax, 0)),
            effectiveShipping: money(Math.max(Number(order.shippingAmount) - creditedShipping, 0)),
            effectiveTotal: money(effectiveTotal),
            paid: money(paid),
            refunded: money(refunded),
            creditOwed: money(Math.max(paid - refunded - effectiveTotal, 0)),
          }
        : undefined,
    trackingNumber: order.trackingNumber,
  };
}
