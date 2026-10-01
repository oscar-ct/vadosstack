import Image from "next/image";

import { BriefcaseBusiness, CalendarDays, Mail, MapPin, Phone, ReceiptText, UserRound } from "lucide-react";

import { formatPaymentReference } from "@/lib/payments/presentation";

type LineItem = {
  amount: string;
  description: string;
  quantity?: string;
  rate?: string;
  unit?: string;
};

type PaymentLine = {
  amount: string;
  date: string;
  description: string;
  id: string;
  method: string;
  referenceNumber?: string | null;
};

type InvoicePreviewProps = {
  amountPaid: string;
  balanceDue: string;
  companyAddress?: string | null;
  companyEmail?: string | null;
  companyLogoSrc?: string | null;
  companyName: string;
  companyPhone?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  dateBegin: string;
  dateEnd: string;
  dueDate: string;
  finalCost: string;
  invoiceNumber: string;
  issuedAt: string;
  jobDescription?: string | null;
  jobTitle: string;
  laborItems: LineItem[];
  laborTotal: string;
  materialTaxAmount: string;
  materialTaxRate: string;
  materials: LineItem[];
  materialsTotal: string;
  message?: string | null;
  messageAlign?: "center" | "left" | "right";
  payments: PaymentLine[];
  serviceLocation?: string | null;
  subtotal: string;
};

function LineItemsTable({ fallbackLabel, items, total }: { fallbackLabel: string; items: LineItem[]; total: string }) {
  const rows = items.length ? items : [{ amount: total, description: fallbackLabel }];

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="hidden grid-cols-[minmax(0,1fr)_3.5rem_4rem_5rem_5.5rem] gap-2 border-b bg-muted/40 px-3 py-2 font-medium text-muted-foreground text-xs sm:grid">
        <span>Description</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Unit</span>
        <span className="text-right">Rate</span>
        <span className="text-right">Amount</span>
      </div>
      {rows.map((item) => (
        <div
          className="grid gap-1 border-b px-3 py-2.5 text-xs last:border-b-0 sm:grid-cols-[minmax(0,1fr)_3.5rem_4rem_5rem_5.5rem] sm:gap-2"
          key={[item.description, item.amount, item.quantity, item.unit, item.rate].join("-")}
        >
          <span className="font-medium sm:font-normal">{item.description || fallbackLabel}</span>
          <span className="hidden text-right tabular-nums sm:block">{item.quantity || "–"}</span>
          <span className="hidden text-right sm:block">{item.unit || "–"}</span>
          <span className="hidden text-right tabular-nums sm:block">{item.rate || "–"}</span>
          <span className="text-right font-medium tabular-nums sm:font-normal">{item.amount}</span>
          {item.quantity || item.unit || item.rate ? (
            <span className="text-muted-foreground text-xs sm:hidden">
              {[item.quantity ? `Qty ${item.quantity}` : null, item.unit, item.rate ? `Rate ${item.rate}` : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function InvoicePreview(props: InvoicePreviewProps) {
  return (
    <article
      data-public-invoice
      className="grid gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-7 print:gap-3 print:rounded-none print:border print:border-neutral-400 print:p-5 print:shadow-none"
    >
      <header className="grid gap-5 border-b pb-5 sm:grid-cols-[1fr_auto] print:gap-3 print:pb-3">
        <div>
          <div className="flex items-start gap-3">
            {props.companyLogoSrc ? (
              <Image
                alt={`${props.companyName} logo`}
                className="size-12 rounded-lg object-contain"
                height={48}
                src={props.companyLogoSrc}
                unoptimized
                width={48}
              />
            ) : (
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <ReceiptText className="size-5" />
              </span>
            )}
            <div>
              <h2 className="font-semibold text-xl tracking-tight">{props.companyName}</h2>
              {props.companyAddress ? (
                <p className="mt-1 whitespace-pre-line text-muted-foreground text-xs leading-5">
                  {props.companyAddress}
                </p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs">
                {props.companyEmail ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-3" />
                    {props.companyEmail}
                  </span>
                ) : null}
                {props.companyPhone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3" />
                    {props.companyPhone}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 font-semibold text-xl">
            <ReceiptText className="size-5 text-muted-foreground" /> Invoice
          </div>
          <div className="mt-1 grid gap-0.5 text-muted-foreground text-xs">
            <span>Invoice #{props.invoiceNumber}</span>
            <span>Issued {props.issuedAt}</span>
          </div>
        </div>
        <div className="grid min-w-36 content-center gap-1 rounded-xl border bg-muted/30 p-4 sm:text-right">
          <span className="text-muted-foreground text-xs">Balance due</span>
          <span className="font-semibold text-2xl text-rose-700 tabular-nums dark:text-rose-400">
            {props.balanceDue}
          </span>
          <span className="text-muted-foreground text-xs">by {props.dueDate}</span>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border bg-muted/20 text-xs">
        <div className="grid sm:grid-cols-2">
          <div className="grid gap-1 border-b p-3 sm:border-r">
            <div className="flex items-center gap-2 font-medium text-muted-foreground text-xs">
              <UserRound className="size-3.5" />
              Bill To
            </div>
            <div className="font-medium">{props.customerName ?? "Customer"}</div>
            {props.customerEmail ? <div className="text-muted-foreground text-xs">{props.customerEmail}</div> : null}
            {props.customerPhone ? <div className="text-muted-foreground text-xs">{props.customerPhone}</div> : null}
          </div>
          <div className="grid gap-1 border-b p-3">
            <div className="flex items-center gap-2 font-medium text-muted-foreground text-xs">
              <BriefcaseBusiness className="size-3.5" />
              Job
            </div>
            <div className="font-medium">{props.jobTitle}</div>
          </div>
          <div className="grid gap-1 border-b p-3 sm:border-r sm:border-b-0">
            <div className="flex items-center gap-2 font-medium text-muted-foreground text-xs">
              <CalendarDays className="size-3.5" />
              Schedule
            </div>
            <div className="text-xs">Start: {props.dateBegin}</div>
            <div className="text-xs">End: {props.dateEnd}</div>
          </div>
          <div className="grid gap-1 p-3">
            <div className="flex items-center gap-2 font-medium text-muted-foreground text-xs">
              <MapPin className="size-3.5" />
              Service Location
            </div>
            <div className="text-xs">{props.serviceLocation ?? "Not provided"}</div>
          </div>
        </div>
      </section>

      {props.jobDescription ? (
        <section>
          <h3 className="font-medium text-xs">Job description</h3>
          <p className="mt-2 whitespace-pre-line rounded-lg border bg-muted/20 p-3 text-xs leading-5">
            {props.jobDescription}
          </p>
        </section>
      ) : null}

      <section className="grid gap-2">
        <h3 className="font-medium text-xs">Labor</h3>
        <LineItemsTable fallbackLabel="Labor" items={props.laborItems} total={props.laborTotal} />
      </section>

      <section className="grid gap-2">
        <h3 className="font-medium text-xs">Materials</h3>
        <LineItemsTable fallbackLabel="Materials" items={props.materials} total={props.materialsTotal} />
      </section>

      <section className="ml-auto grid w-full max-w-sm gap-1.5 rounded-md border bg-muted/20 p-3 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Labor</span>
          <span className="tabular-nums">{props.laborTotal}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Materials</span>
          <span className="tabular-nums">{props.materialsTotal}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{props.subtotal}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Material tax ({props.materialTaxRate})</span>
          <span className="tabular-nums">{props.materialTaxAmount}</span>
        </div>
        <div className="flex justify-between border-t pt-2 font-semibold">
          <span>Invoice total</span>
          <span className="tabular-nums">{props.finalCost}</span>
        </div>
      </section>

      <section className="grid gap-2" data-print-keep>
        <h3 className="font-medium text-xs">Transaction History</h3>
        <div className="grid gap-2 sm:hidden">
          {props.payments.length ? (
            props.payments.map((payment) => (
              <div key={payment.id} className="rounded-md border bg-muted/20 p-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium leading-snug">{payment.description}</div>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground">
                      <span>{payment.date}</span>
                      <span>{payment.method}</span>
                      <span title={payment.referenceNumber ?? undefined}>
                        Ref #{formatPaymentReference(payment.referenceNumber) ?? "-"}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 font-semibold tabular-nums">{payment.amount}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border bg-muted/20 p-3 text-muted-foreground text-xs">
              No payments recorded yet.
            </div>
          )}
        </div>
        <div className="hidden overflow-hidden rounded-md border sm:block">
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_5rem_7rem_5.5rem] gap-2 border-b bg-muted/20 px-2 py-1.5 font-medium text-xs">
            <span>Date</span>
            <span>Description</span>
            <span>Method</span>
            <span>Ref #</span>
            <span className="text-right">Amount</span>
          </div>
          {props.payments.length ? (
            props.payments.map((payment) => (
              <div
                key={payment.id}
                className="grid grid-cols-[5.5rem_minmax(0,1fr)_5rem_7rem_5.5rem] gap-2 border-b px-2 py-1.5 text-xs last:border-b-0"
              >
                <span>{payment.date}</span>
                <span>{payment.description}</span>
                <span className="text-muted-foreground">{payment.method}</span>
                <span className="truncate text-muted-foreground" title={payment.referenceNumber ?? undefined}>
                  {formatPaymentReference(payment.referenceNumber) ?? "-"}
                </span>
                <span className="text-right font-medium tabular-nums">{payment.amount}</span>
              </div>
            ))
          ) : (
            <div className="px-2 py-1.5 text-muted-foreground text-xs">No payments recorded yet.</div>
          )}
        </div>
      </section>

      <section className="grid justify-end gap-2" data-print-keep>
        <div className="grid min-w-64 gap-1.5 rounded-md border bg-muted/20 p-3 text-xs">
          <div className="flex justify-between gap-6">
            <span className="text-muted-foreground">Invoice total</span>
            <span className="font-medium tabular-nums">{props.finalCost}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-muted-foreground">Amount paid</span>
            <span className="font-medium tabular-nums">{props.amountPaid}</span>
          </div>
          <div className="flex justify-between gap-6 border-t pt-2 font-semibold">
            <span>Balance due</span>
            <span className="text-rose-700 tabular-nums dark:text-rose-400">{props.balanceDue}</span>
          </div>
        </div>
      </section>

      {props.message ? (
        <p
          data-print-keep
          className="whitespace-pre-line rounded-md border p-3 text-xs leading-5"
          style={{ textAlign: props.messageAlign }}
        >
          {props.message}
        </p>
      ) : null}
    </article>
  );
}
