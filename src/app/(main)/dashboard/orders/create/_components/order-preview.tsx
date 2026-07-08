"use client";

import * as React from "react";

import Image from "next/image";

import { Download, Package, Printer, Truck } from "lucide-react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { formatPhoneNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";

import {
  clampOrderFooterMessage,
  getLineAmount,
  getOrderSubtotal,
  getOrderTaxAmount,
  getOrderTotal,
  ORDER_RECEIPT_PAPER_HEIGHT,
  ORDER_RECEIPT_PAPER_SCALE,
  ORDER_RECEIPT_PAPER_WIDTH,
  type OrderCompany,
  type OrderFormValues,
} from "./data";
import { useVisibleCenterPosition } from "./use-visible-center-position";

function formatOrderCurrency(value: number, options?: { cents?: boolean }) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: options?.cents === false ? 0 : 2,
    minimumFractionDigits: options?.cents === false ? 0 : 2,
    style: "currency",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatOrderDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTaxRate(value: number) {
  if (!Number.isFinite(value)) return "0%";

  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  })}%`;
}

function downloadOrderPdf(orderId: string) {
  const link = document.createElement("a");

  link.href = `/dashboard/orders/${orderId}/pdf`;
  link.rel = "noopener noreferrer";
  link.target = "_blank";

  document.body.appendChild(link);
  link.click();
  link.remove();
}

function formatCityStateZip(order: OrderFormValues) {
  const cityState = [order.city, order.state].filter(Boolean).join(", ");
  return [cityState, order.zip].filter(Boolean).join(" ");
}

function OrderReceiptSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("border-neutral-200 border-t px-5 py-3.5", className)}>{children}</section>;
}

function handlePrint() {
  window.print();
}

const RECEIPT_PAGE_GAP = 16;
const RECEIPT_HEADER_HEIGHT = 104;
const RECEIPT_META_HEIGHT = 52;
const RECEIPT_ITEM_HEIGHT = 68;
const RECEIPT_DELIVERY_HEIGHT = 64;
const RECEIPT_ADDRESS_PAYMENT_HEIGHT = 84;
const RECEIPT_TOTALS_HEIGHT = 118;
const RECEIPT_FOOTER_HEIGHT = 80;
const FINAL_PAGE_ITEM_LIMIT = 4;

type ReceiptPage = {
  items: OrderFormValues["items"];
  pageNumber: number;
  showSummary: boolean;
};

function getReceiptItemCapacity({ isPaid, showSummary }: { isPaid: boolean; showSummary: boolean }) {
  const reservedHeight =
    RECEIPT_HEADER_HEIGHT +
    RECEIPT_META_HEIGHT +
    (showSummary
      ? (isPaid ? RECEIPT_DELIVERY_HEIGHT : 0) +
        RECEIPT_ADDRESS_PAYMENT_HEIGHT +
        RECEIPT_TOTALS_HEIGHT +
        RECEIPT_FOOTER_HEIGHT
      : 0);

  const capacity = Math.max(1, Math.floor((ORDER_RECEIPT_PAPER_HEIGHT - reservedHeight) / RECEIPT_ITEM_HEIGHT));

  return showSummary ? Math.min(FINAL_PAGE_ITEM_LIMIT, capacity) : capacity;
}

function paginateReceiptItems(items: OrderFormValues["items"], isPaid: boolean): ReceiptPage[] {
  const finalPageItemLimit = getReceiptItemCapacity({ isPaid, showSummary: true });
  const nonFinalPageItemLimit = getReceiptItemCapacity({ isPaid, showSummary: false });

  if (items.length <= finalPageItemLimit) {
    return [
      {
        items,
        pageNumber: 1,
        showSummary: true,
      },
    ];
  }

  const pages: ReceiptPage[] = [];
  let remainingItems = items;

  while (remainingItems.length > finalPageItemLimit) {
    const takeCount = Math.min(nonFinalPageItemLimit, remainingItems.length - finalPageItemLimit);

    pages.push({
      items: remainingItems.slice(0, takeCount),
      pageNumber: pages.length + 1,
      showSummary: false,
    });

    remainingItems = remainingItems.slice(takeCount);
  }

  pages.push({
    items: remainingItems,
    pageNumber: pages.length + 1,
    showSummary: true,
  });

  return pages;
}

function getReceiptStackHeight(pageCount: number) {
  return pageCount * ORDER_RECEIPT_PAPER_HEIGHT + Math.max(pageCount - 1, 0) * RECEIPT_PAGE_GAP;
}

function PrintOrderReceipt({ company, order }: { company: OrderCompany; order: OrderFormValues }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const pages = paginateReceiptItems(order.items, order.paymentStatus === "Paid");

  return createPortal(
    <div data-print-root>
      {pages.map((page) => (
        <OrderReceiptPaper key={page.pageNumber} company={company} order={order} page={page} pageCount={pages.length} />
      ))}
    </div>,
    document.body,
  );
}

function OrderReceiptPaper({
  company,
  order,
  page,
  pageCount,
}: {
  company: OrderCompany;
  order: OrderFormValues;
  page: ReceiptPage;
  pageCount: number;
}) {
  const subtotal = getOrderSubtotal(order);
  const shipping = Number.isFinite(order.shipping) ? order.shipping : 0;
  const tax = getOrderTaxAmount(order);
  const taxRate = Number.isFinite(order.tax) ? order.tax : 0;
  const discount = Number.isFinite(order.discount) ? order.discount : 0;
  const total = getOrderTotal(order);
  const cityStateZip = formatCityStateZip(order);
  const streetLine = [order.streetAddress, order.apartment].filter(Boolean).join(", ");
  const footerMessage = clampOrderFooterMessage(order.footerMessage).trim();
  const isPaid = order.paymentStatus === "Paid";

  return (
    <article
      data-print-paper
      style={{ height: ORDER_RECEIPT_PAPER_HEIGHT, width: ORDER_RECEIPT_PAPER_WIDTH }}
      className="relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-950 shadow-xl"
    >
      {pageCount > 1 ? (
        <div className="absolute top-4 right-5 text-[10px] text-neutral-500">
          Page {page.pageNumber} of {pageCount}
        </div>
      ) : null}
      <header className="grid justify-items-center px-5 pt-3 pb-2 text-center">
        <div className="grid size-10 place-items-center overflow-hidden rounded-lg bg-white">
          <Image
            src={company.logoSrc}
            alt={`${company.name} logo`}
            width={48}
            height={48}
            unoptimized
            className="size-full object-contain"
          />
        </div>

        <div className="mt-1.5 grid justify-items-center gap-0.5">
          <h3 className="font-medium text-base">{isPaid ? "Order Receipt" : "Order Confirmation"}</h3>
          <span className="text-neutral-500 text-xs">
            {isPaid ? "Thank you for your purchase." : "Thank you for your order."}
          </span>
        </div>
      </header>

      <OrderReceiptSection className="grid grid-cols-2 gap-4 py-3">
        <div className="grid gap-1">
          <span className="font-medium text-[11px] text-neutral-500">Order Number</span>
          <span className="font-medium text-sm">{order.orderNumber || "ORD-0000"}</span>
        </div>
        <div className="grid gap-1 text-right">
          <span className="font-medium text-[11px] text-neutral-500">Order Date</span>
          <span className="font-medium text-sm">
            {order.orderDate ? formatOrderDate(order.orderDate) : "Order date pending"}
          </span>
        </div>
      </OrderReceiptSection>

      <div className="divide-y divide-neutral-200 border-neutral-200 border-t">
        {page.items.map((item) => (
          <div key={item.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
            <div className="grid size-9 place-items-center rounded-lg bg-neutral-100 text-neutral-500">
              <Package className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium text-sm">{item.product || "Product name"}</div>
              <div className="truncate text-[11px] text-neutral-500">
                {[item.sku, item.category || "Category"].filter(Boolean).join(" · ")}
              </div>
              <div className="truncate text-[11px] text-neutral-500">
                {Number.isFinite(item.quantity) ? item.quantity : 0} x {formatOrderCurrency(item.unitPrice)}
              </div>
            </div>
            <div className="font-medium text-sm tabular-nums">{formatOrderCurrency(getLineAmount(item))}</div>
          </div>
        ))}
      </div>

      {page.showSummary ? (
        <>
          {isPaid ? (
            <OrderReceiptSection className="grid grid-cols-2 gap-4 py-3">
              <div className="grid min-w-0 gap-1">
                <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                  <Truck className="size-3.5" />
                  <span className="font-medium">Estimated Delivery</span>
                </div>
                <div className="font-medium text-sm">
                  {order.deliveryRange ? formatOrderDate(order.deliveryRange) : "Delivery date pending"}
                </div>
              </div>
              <div className="grid min-w-0 gap-0.5 text-right">
                <span className="font-medium text-[11px] text-neutral-500">Tracking</span>
                <span className="truncate font-medium text-sm">
                  {order.deliveryCompany || "Shipping service pending"}
                </span>
                <span className="break-all text-[11px] text-neutral-500 leading-snug">
                  {order.trackingNumber || "Tracking number pending"}
                </span>
              </div>
            </OrderReceiptSection>
          ) : null}

          <OrderReceiptSection className="grid grid-cols-2 gap-5 py-3.5">
            <div>
              <div className="font-medium text-[11px] text-neutral-500">Shipping Address</div>
              <div className="mt-1.5 grid gap-0.5">
                <div className="font-medium text-sm">{order.customerName || "Customer name"}</div>
                <div className="text-[11px] text-neutral-500">{streetLine || "Street address"}</div>
                <div className="text-[11px] text-neutral-500">{cityStateZip || "City state ZIP"}</div>
                <div className="text-[11px] text-neutral-500">{formatPhoneNumber(order.customerPhone) || "Phone"}</div>
              </div>
            </div>

            {isPaid ? (
              <div className={"text-right"}>
                <div className="font-medium text-[11px] text-neutral-500">Payment Method</div>
                <div className="mt-1.5 grid gap-0.5">
                  <span className="font-medium text-sm">{order.paymentMethod || "Payment method pending"}</span>
                  {order.paymentReference ? (
                    <span className="text-[11px] text-neutral-500">Ref # {order.paymentReference}</span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className={"text-right"}>
                <div className="font-medium text-[11px] text-neutral-500">Status</div>
                <div className="mt-1.5 font-medium text-sm">Payment pending</div>
              </div>
            )}
          </OrderReceiptSection>

          <OrderReceiptSection className="grid gap-1.5 py-2.5">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-neutral-500">Subtotal</span>
              <span className="tabular-nums">{formatOrderCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-neutral-500">Shipping</span>
              <span className="tabular-nums">{formatOrderCurrency(shipping)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-neutral-500">Tax ({formatTaxRate(taxRate)})</span>
              <span className="tabular-nums">{formatOrderCurrency(tax)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-neutral-500">Discount</span>
              <span className="text-emerald-600 tabular-nums">-{formatOrderCurrency(discount)}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-4 border-neutral-200 border-t pt-2">
              <span className="font-medium">{isPaid ? "Total Paid" : "Order Total"}</span>
              <span className="font-medium text-base tabular-nums">{formatOrderCurrency(total)}</span>
            </div>
          </OrderReceiptSection>

          <footer className="grid min-h-20 shrink-0 place-items-center border-neutral-200 border-t px-5 py-2">
            {footerMessage ? (
              <p className="line-clamp-3 whitespace-pre-line text-center text-[11px] text-neutral-500 leading-relaxed">
                {footerMessage}
              </p>
            ) : (
              <p className="text-center text-[11px] text-neutral-500">Footer message will appear here.</p>
            )}
          </footer>
        </>
      ) : null}
    </article>
  );
}

export function OrderPreview({
  actionsDisabled = false,
  company,
  emailAction,
  order,
  orderId,
}: {
  actionsDisabled?: boolean;
  company: OrderCompany;
  emailAction?: React.ReactNode;
  order: OrderFormValues;
  orderId?: string;
}) {
  const pages = paginateReceiptItems(order.items, order.paymentStatus === "Paid");
  const receiptStackHeight = getReceiptStackHeight(pages.length);
  const previewBodyRef = React.useRef<HTMLDivElement>(null);
  const paperLayout = useVisibleCenterPosition(previewBodyRef, {
    fitHeight: false,
    height: receiptStackHeight,
    maxScale: ORDER_RECEIPT_PAPER_SCALE,
    width: ORDER_RECEIPT_PAPER_WIDTH,
  });

  return (
    <>
      <PrintOrderReceipt company={company} order={order} />
      <div className="flex min-w-0 flex-col rounded-xl border bg-card xl:sticky xl:top-4 xl:self-start">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <h2 className="font-medium text-base">Preview</h2>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={actionsDisabled}
              onClick={handlePrint}
            >
              <Printer data-icon="inline-start" className="size-3.5" />
              Print
            </Button>
            {emailAction ? (
              <fieldset
                disabled={actionsDisabled}
                className="m-0 border-0 p-0 [&>button]:h-7 [&>button]:px-2 [&>button]:text-xs"
              >
                {emailAction}
              </fieldset>
            ) : null}
            {orderId && !actionsDisabled ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => downloadOrderPdf(orderId)}
              >
                <Download data-icon="inline-start" className="size-3.5" />
                Download
              </Button>
            ) : (
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled>
                <Download data-icon="inline-start" className="size-3.5" />
                Download
              </Button>
            )}
          </div>
        </div>

        <div
          ref={previewBodyRef}
          style={{
            minHeight: paperLayout ? receiptStackHeight * paperLayout.scale + RECEIPT_PAGE_GAP * 2 : undefined,
          }}
          className="@container/preview relative min-h-[480px] flex-1 overflow-hidden rounded-b-xl bg-neutral-200 p-4 md:min-h-[620px] 2xl:min-h-[760px] dark:bg-neutral-800"
        >
          {paperLayout === null ? (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">
              Loading Preview
            </div>
          ) : null}
          <div
            style={{
              height: paperLayout
                ? receiptStackHeight * paperLayout.scale
                : receiptStackHeight * ORDER_RECEIPT_PAPER_SCALE,
              top: paperLayout?.top ?? "50%",
              transform: paperLayout === null ? "translate(-50%, -50%)" : "translateX(-50%)",
              width: paperLayout
                ? ORDER_RECEIPT_PAPER_WIDTH * paperLayout.scale
                : ORDER_RECEIPT_PAPER_WIDTH * ORDER_RECEIPT_PAPER_SCALE,
            }}
            className="absolute left-1/2 opacity-0 data-[ready=true]:opacity-100"
            data-ready={paperLayout !== null}
          >
            <div
              style={{ transform: `scale(${paperLayout?.scale ?? ORDER_RECEIPT_PAPER_SCALE})` }}
              className="flex origin-top-left flex-col gap-4"
            >
              {pages.map((page) => (
                <OrderReceiptPaper
                  key={page.pageNumber}
                  company={company}
                  order={order}
                  page={page}
                  pageCount={pages.length}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
