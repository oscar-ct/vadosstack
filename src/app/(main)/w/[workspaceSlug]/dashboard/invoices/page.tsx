import { addDays } from "date-fns";
import { ReceiptText } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { formatDocumentNumber } from "@/lib/document-number";
import { prisma } from "@/lib/prisma";
import { formatServiceAddress } from "@/lib/service-address";

import { InvoicesTable, type InvoiceTableItem } from "./_components/invoices-table";

export default async function Page() {
  const authorization = await getPermittedDashboardAuthorization("invoices.view");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Sign in to view invoices"
        description="Invoice records are private to each signed-in account."
      />
    );
  }

  const workspaceId = authorization.workspaceId;
  const [invoices, workspace] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        ownerId: workspaceId,
      },
      include: {
        job: {
          include: {
            payments: {
              orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
            },
          },
        },
      },
      orderBy: {
        issuedAt: "desc",
      },
    }),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { invoiceDueDays: true } }),
  ]);

  if (!workspace) {
    return <AuthRequiredState title="Workspace unavailable" description="This workspace could not be loaded." />;
  }
  const canExport = can(authorization.membership, "reports.export");

  const invoiceNumbers = new Map(
    [...invoices]
      .sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime())
      .map((invoice, index) => [invoice.id, formatDocumentNumber("INV", index + 1)]),
  );

  const invoiceItems: InvoiceTableItem[] = invoices.map((invoice) => ({
    id: invoice.id,
    jobId: invoice.jobId,
    customerId: invoice.customerId ?? undefined,
    customerName: invoice.customerName ?? undefined,
    invoiceNumber: invoice.invoiceNumber ?? invoiceNumbers.get(invoice.id) ?? formatDocumentNumber("INV", 1),
    href: `/dashboard/invoices/${invoice.id}`,
    issuedAt: invoice.issuedAt.toISOString(),
    dueAt: addDays(invoice.issuedAt, workspace.invoiceDueDays).toISOString(),
    jobTitle: invoice.jobTitle,
    jobDescription: invoice.jobDescription ?? undefined,
    jobNumber: invoice.jobId.slice(-6).toUpperCase(),
    jobHref: `/dashboard/jobs/${invoice.jobId}`,
    jobServiceLocation: formatServiceAddress(invoice) ?? undefined,
    paymentStatus: invoice.paymentStatus,
    laborCost: invoice.laborCost.toString(),
    materialsSubtotal: invoice.materialsSubtotal.toString(),
    materialTaxAmount: invoice.materialTaxAmount.toString(),
    depositPaid: invoice.depositPaid.toString(),
    amountPaid: invoice.amountPaid.toString(),
    balanceDue: invoice.balanceDue.toString(),
    total: invoice.finalCost.toString(),
    payments: invoice.job.payments.map((payment) => ({
      id: payment.id,
      paidOn: payment.paidOn.toISOString(),
      amount: payment.amount.toString(),
      paymentType: payment.paymentType,
      method: payment.method,
      referenceNumber: payment.referenceNumber ?? undefined,
      description: payment.description,
      notes: payment.notes ?? undefined,
      createdAt: payment.createdAt.toISOString(),
    })),
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
        <CardAction className="flex items-center gap-2">
          {canExport ? <div id="invoices-export-action" /> : null}
        </CardAction>
      </CardHeader>
      <CardContent>
        <InvoicesTable
          canExport={canExport}
          exportSlotId={canExport ? "invoices-export-action" : undefined}
          invoices={invoiceItems}
        />
      </CardContent>
    </Card>
  );
}
