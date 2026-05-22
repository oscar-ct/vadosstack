import { Download, ReceiptText } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatDocumentNumber } from "@/lib/document-number";
import { prisma } from "@/lib/prisma";

import { InvoicesTable, type InvoiceTableItem } from "./_components/invoices-table";

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view invoices"
        description="Invoice records are private to each signed-in account."
      />
    );
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      ownerId: currentUser.id,
    },
    orderBy: {
      issuedAt: "desc",
    },
  });

  const invoiceNumbers = new Map(
    [...invoices]
      .sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime())
      .map((invoice, index) => [invoice.id, formatDocumentNumber("INV", index + 1)]),
  );

  const invoiceItems: InvoiceTableItem[] = invoices.map((invoice) => ({
    customerName: invoice.customerName ?? undefined,
    invoiceNumber: invoiceNumbers.get(invoice.id) ?? formatDocumentNumber("INV", 1),
    href: `/dashboard/invoices/${invoice.id}?from=invoices`,
    issuedAt: invoice.issuedAt.toISOString(),
    jobTitle: invoice.jobTitle,
    total: invoice.finalCost.toString(),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 leading-none">
          <span className={"text-lg"}>Invoices</span>
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ReceiptText className="size-4 text-muted-foreground" />
          </div>
        </CardTitle>
        <CardDescription>A simple index of invoices. Select an invoice number to view it.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" className="hidden w-7 px-0 sm:w-auto sm:px-2.5 sm:flex">
            <Download />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <InvoicesTable invoices={invoiceItems} />
      </CardContent>
    </Card>
  );
}
