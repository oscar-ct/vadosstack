"use client";

import * as React from "react";

import Link from "next/link";

import { format, parseISO } from "date-fns";
import { ExternalLink, ReceiptText, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { InvoiceMutationState } from "../types";
import { DeleteInvoiceButton } from "./delete-invoice-button";

export type InvoiceListItem = {
  id: string;
  customerName?: string;
  jobTitle: string;
  balanceDue: string;
  paymentStatus: string;
  issuedAt: string;
};

function formatMoney(value: string) {
  return `$${Number(value).toFixed(2)}`;
}

function getSearchText(invoice: InvoiceListItem) {
  return [
    invoice.id,
    invoice.customerName,
    invoice.jobTitle,
    invoice.balanceDue,
    invoice.paymentStatus,
    format(parseISO(invoice.issuedAt), "MMM d, yyyy"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function InvoicesList({
  deleteInvoiceAction,
  invoices,
}: {
  deleteInvoiceAction: (state: InvoiceMutationState, formData: FormData) => Promise<InvoiceMutationState>;
  invoices: InvoiceListItem[];
}) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredInvoices = React.useMemo(() => {
    if (!normalizedQuery) {
      return invoices;
    }

    return invoices.filter((invoice) => getSearchText(invoice).includes(normalizedQuery));
  }, [invoices, normalizedQuery]);

  return (
    <div className="grid gap-3">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 pl-8"
          placeholder="Search invoices..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      {filteredInvoices.length ? (
        filteredInvoices.map((invoice) => (
          <div key={invoice.id} className="grid gap-3 rounded-md border bg-card p-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid min-w-0 gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md border bg-muted">
                  <ReceiptText className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-sm">{invoice.jobTitle}</h3>
                  <p className="truncate text-muted-foreground text-xs">
                    {invoice.customerName ?? "No customer"} - Issued {format(parseISO(invoice.issuedAt), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Balance {formatMoney(invoice.balanceDue)}</Badge>
                <Badge variant="outline">{invoice.paymentStatus}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <Button asChild variant="outline" size="sm">
                <Link prefetch={false} href={`/dashboard/invoices/${invoice.id}`}>
                  View
                  <ExternalLink />
                </Link>
              </Button>
              <DeleteInvoiceButton action={deleteInvoiceAction} invoiceId={invoice.id} />
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-md border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
          {invoices.length
            ? "No invoices match your search."
            : "No invoices yet. Open a job and create an invoice when you are ready to bill."}
        </div>
      )}
    </div>
  );
}
