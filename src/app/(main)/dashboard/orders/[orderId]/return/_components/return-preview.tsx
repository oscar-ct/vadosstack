"use client";

import * as React from "react";

import Image from "next/image";

import { Download, Mail, Package, Printer } from "lucide-react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { formatPhoneNumber } from "@/lib/phone";
import { cn, formatCurrency } from "@/lib/utils";

import type { OrderCompany } from "../../../create/_components/data";
import {
  ORDER_RECEIPT_PAPER_HEIGHT,
  ORDER_RECEIPT_PAPER_SCALE,
  ORDER_RECEIPT_PAPER_WIDTH,
} from "../../../create/_components/data";
import { useVisibleCenterPosition } from "../../../create/_components/use-visible-center-position";
import {
  getDefaultRefundAmount,
  getReturnDispositionLabel,
  getReturnedItemsSubtotal,
  type ReturnRefundFormValues,
} from "../_lib/return-data";

function formatReturnDate(value: string) {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value || "Date pending";

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function downloadReturnReceipt(orderId: string) {
  const link = document.createElement("a");

  link.href = `/dashboard/orders/${orderId}/return/pdf`;
  link.rel = "noopener noreferrer";
  link.target = "_blank";

  document.body.appendChild(link);
  link.click();
  link.remove();
}

function handlePrint() {
  window.print();
}

function ReceiptSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("border-neutral-200 border-t px-5 py-3.5", className)}>{children}</section>;
}

function getLineRefund(item: ReturnRefundFormValues["items"][number]) {
  return item.returnQuantity * item.unitPrice;
}

function ReturnReceiptPaper({ company, values }: { company: OrderCompany; values: ReturnRefundFormValues }) {
  const returnedItems = values.items.filter((item) => item.returnQuantity > 0);
  const returnedSubtotal = getReturnedItemsSubtotal(values);
  const refundAmount = getDefaultRefundAmount(values);
  const addressLines = values.shippingAddressLines.length ? values.shippingAddressLines : ["Customer address pending"];

  return (
    <article
      data-print-paper
      style={{ height: ORDER_RECEIPT_PAPER_HEIGHT, width: ORDER_RECEIPT_PAPER_WIDTH }}
      className="relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-950 shadow-xl"
    >
      <header className="grid justify-items-center px-5 pt-4 pb-3 text-center">
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
          <h3 className="font-medium text-base">Return Receipt</h3>
          <span className="text-neutral-500 text-xs">Refund and return confirmation</span>
        </div>
      </header>

      <ReceiptSection className="grid grid-cols-2 gap-4 py-3">
        <div className="grid gap-1">
          <span className="font-medium text-[11px] text-neutral-500">Return Receipt</span>
          <span className="font-medium text-sm">{values.returnNumber || "RET-0000"}</span>
        </div>
        <div className="grid gap-1 text-right">
          <span className="font-medium text-[11px] text-neutral-500">Return Date</span>
          <span className="font-medium text-sm">{formatReturnDate(values.returnDate)}</span>
        </div>
        <div className="grid gap-1">
          <span className="font-medium text-[11px] text-neutral-500">Original Order</span>
          <span className="font-medium text-sm">{values.orderNumber}</span>
        </div>
        <div className="grid gap-1 text-right">
          <span className="font-medium text-[11px] text-neutral-500">Order Date</span>
          <span className="font-medium text-sm">{formatReturnDate(values.orderDate)}</span>
        </div>
      </ReceiptSection>

      <div className="divide-y divide-neutral-200 border-neutral-200 border-t">
        {returnedItems.length ? (
          returnedItems.map((item) => (
            <div
              key={item.orderItemId}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3"
            >
              <div className="grid size-9 place-items-center rounded-lg bg-neutral-100 text-neutral-500">
                <Package className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium text-sm">{item.product || "Product"}</div>
                <div className="truncate text-[11px] text-neutral-500">
                  {[item.sku, item.category || "Category"].filter(Boolean).join(" · ")}
                </div>
                <div className="truncate text-[11px] text-neutral-500">
                  Qty {item.returnQuantity} of {item.orderedQuantity} · {getReturnDispositionLabel(item.disposition)}
                </div>
              </div>
              <div className="font-medium text-sm tabular-nums">{formatCurrency(getLineRefund(item))}</div>
            </div>
          ))
        ) : (
          <div className="px-5 py-10 text-center text-neutral-500 text-sm">Resolved items will appear here.</div>
        )}
      </div>

      <ReceiptSection className="grid grid-cols-2 gap-5 py-3.5">
        <div>
          <div className="font-medium text-[11px] text-neutral-500">Customer</div>
          <div className="mt-1.5 grid gap-0.5">
            <div className="font-medium text-sm">{values.customerName || "Customer name"}</div>
            {addressLines.map((line) => (
              <div key={line} className="text-[11px] text-neutral-500">
                {line}
              </div>
            ))}
            <div className="text-[11px] text-neutral-500">{formatPhoneNumber(values.customerPhone) || "Phone"}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-medium text-[11px] text-neutral-500">Refund</div>
          <div className="mt-1.5 grid gap-0.5">
            <span className="font-medium text-sm">{values.refundStatus}</span>
            <span className="text-[11px] text-neutral-500">{values.refundMethod || "Refund method pending"}</span>
            {values.refundReference ? (
              <span className="break-all text-[11px] text-neutral-500">Ref # {values.refundReference}</span>
            ) : null}
          </div>
        </div>
      </ReceiptSection>

      <ReceiptSection className="grid gap-1.5 py-2.5">
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="text-neutral-500">Resolved item value</span>
          <span className="tabular-nums">{formatCurrency(returnedSubtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="text-neutral-500">Original order total</span>
          <span className="tabular-nums">{formatCurrency(values.originalTotal)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-4 border-neutral-200 border-t pt-2">
          <span className="font-medium">Refund Amount</span>
          <span className="font-medium text-base tabular-nums">{formatCurrency(refundAmount)}</span>
        </div>
      </ReceiptSection>

      <footer className="mt-auto grid min-h-24 place-items-center border-neutral-200 border-t px-5 py-2">
        <p className="line-clamp-4 whitespace-pre-line text-center text-[11px] text-neutral-500 leading-relaxed">
          {values.customerNote ||
            values.reason ||
            "Please keep this receipt for your records. Refund timing may vary by payment provider."}
        </p>
      </footer>
    </article>
  );
}

function PrintReturnReceipt({ company, values }: { company: OrderCompany; values: ReturnRefundFormValues }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div data-print-root>
      <ReturnReceiptPaper company={company} values={values} />
    </div>,
    document.body,
  );
}

export function ReturnRefundPreview({
  actionsDisabled,
  company,
  emailAction,
  orderId,
  values,
}: {
  actionsDisabled: boolean;
  company: OrderCompany;
  emailAction?: React.ReactNode;
  orderId: string;
  values: ReturnRefundFormValues;
}) {
  const previewBodyRef = React.useRef<HTMLDivElement>(null);
  const paperLayout = useVisibleCenterPosition(previewBodyRef, {
    fitHeight: false,
    height: ORDER_RECEIPT_PAPER_HEIGHT,
    maxScale: ORDER_RECEIPT_PAPER_SCALE,
    width: ORDER_RECEIPT_PAPER_WIDTH,
  });

  return (
    <>
      <PrintReturnReceipt company={company} values={values} />
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
            ) : (
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled>
                <Mail data-icon="inline-start" className="size-3.5" />
                Email
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={actionsDisabled}
              onClick={() => downloadReturnReceipt(orderId)}
            >
              <Download data-icon="inline-start" className="size-3.5" />
              Download
            </Button>
          </div>
        </div>

        <div
          ref={previewBodyRef}
          style={{
            minHeight: paperLayout ? ORDER_RECEIPT_PAPER_HEIGHT * paperLayout.scale + 32 : undefined,
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
              height: paperLayout ? ORDER_RECEIPT_PAPER_HEIGHT * paperLayout.scale : ORDER_RECEIPT_PAPER_HEIGHT,
              top: paperLayout?.top ?? "50%",
              transform: paperLayout === null ? "translate(-50%, -50%)" : "translateX(-50%)",
              width: paperLayout ? ORDER_RECEIPT_PAPER_WIDTH * paperLayout.scale : ORDER_RECEIPT_PAPER_WIDTH,
            }}
            className="absolute left-1/2 opacity-0 data-[ready=true]:opacity-100"
            data-ready={paperLayout !== null}
          >
            <div
              style={{ transform: `scale(${paperLayout?.scale ?? ORDER_RECEIPT_PAPER_SCALE})` }}
              className="origin-top-left"
            >
              <ReturnReceiptPaper company={company} values={values} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
