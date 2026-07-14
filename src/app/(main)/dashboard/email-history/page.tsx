import { CheckCircle2, Clock3, MailCheck, MailWarning, Send, UserRound } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { CustomerLink } from "@/components/customer-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn, formatCurrency } from "@/lib/utils";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "America/Chicago",
    year: "numeric",
  }).format(value);
}

function formatDocumentType(value: string) {
  if (value === "return-receipt") return "Return receipt";

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAmount(value: { toNumber: () => number } | null) {
  return value ? formatCurrency(value.toNumber()) : "No amount";
}

function StatusBadge({ status }: { status: string }) {
  const isSuccess = status === "success";

  return (
    <Badge
      variant={isSuccess ? "secondary" : "destructive"}
      className={cn(isSuccess && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300")}
    >
      {isSuccess ? <CheckCircle2 /> : <MailWarning />}
      {isSuccess ? "Sent" : "Error"}
    </Badge>
  );
}

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view email history"
        description="Email records are private to each signed-in account."
      />
    );
  }

  const [records, totalCount, successCount, errorCount] = await Promise.all([
    prisma.emailRecord.findMany({
      where: {
        ownerId: currentUser.id,
      },
      orderBy: {
        sentAt: "desc",
      },
      take: 200,
    }),
    prisma.emailRecord.count({
      where: {
        ownerId: currentUser.id,
      },
    }),
    prisma.emailRecord.count({
      where: {
        ownerId: currentUser.id,
        status: "success",
      },
    }),
    prisma.emailRecord.count({
      where: {
        ownerId: currentUser.id,
        status: "error",
      },
    }),
  ]);

  const invoiceDocumentIds = records
    .filter((record) => record.documentType === "invoice" && record.documentId)
    .map((record) => record.documentId as string);
  const estimateDocumentIds = records
    .filter((record) => record.documentType === "estimate" && record.documentId)
    .map((record) => record.documentId as string);
  const orderDocumentIds = records
    .filter(
      (record) => (record.documentType === "order" || record.documentType === "return-receipt") && record.documentId,
    )
    .map((record) => record.documentId as string);
  const [invoiceCustomerLinks, estimateCustomerLinks, orderCustomerLinks] = await Promise.all([
    invoiceDocumentIds.length
      ? prisma.invoice.findMany({
          where: {
            ownerId: currentUser.id,
            id: {
              in: invoiceDocumentIds,
            },
          },
          select: {
            customerId: true,
            id: true,
          },
        })
      : [],
    estimateDocumentIds.length
      ? prisma.estimate.findMany({
          where: {
            ownerId: currentUser.id,
            id: {
              in: estimateDocumentIds,
            },
          },
          select: {
            customerId: true,
            id: true,
          },
        })
      : [],
    orderDocumentIds.length
      ? prisma.order.findMany({
          where: {
            ownerId: currentUser.id,
            id: {
              in: orderDocumentIds,
            },
          },
          select: {
            customerId: true,
            id: true,
          },
        })
      : [],
  ]);
  const invoiceCustomerIdByDocumentId = new Map(
    invoiceCustomerLinks.map((invoice) => [invoice.id, invoice.customerId]),
  );
  const estimateCustomerIdByDocumentId = new Map(
    estimateCustomerLinks.map((estimate) => [estimate.id, estimate.customerId]),
  );
  const orderCustomerIdByDocumentId = new Map(orderCustomerLinks.map((order) => [order.id, order.customerId]));

  function getRecordCustomerId(record: (typeof records)[number]) {
    if (!record.documentId) return undefined;
    if (record.documentType === "invoice") return invoiceCustomerIdByDocumentId.get(record.documentId) ?? undefined;
    if (record.documentType === "estimate") return estimateCustomerIdByDocumentId.get(record.documentId) ?? undefined;
    if (record.documentType === "order" || record.documentType === "return-receipt") {
      return orderCustomerIdByDocumentId.get(record.documentId) ?? undefined;
    }
    return undefined;
  }

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 text-card-foreground">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-muted-foreground text-sm">Total emails</p>
            <Send className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 font-semibold text-2xl tracking-tight">{totalCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-card-foreground">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-muted-foreground text-sm">Successful</p>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-semibold text-2xl tracking-tight">{successCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-card-foreground">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-muted-foreground text-sm">Needs attention</p>
            <MailWarning className="size-4 text-destructive" />
          </div>
          <p className="mt-2 font-semibold text-2xl tracking-tight">{errorCount}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 leading-none">
            <span className="text-lg">Email History</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <MailCheck className="size-4 text-muted-foreground" />
            </div>
          </CardTitle>
          <CardDescription>Recent document email attempts, including successful sends and errors.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {records.length ? (
            <>
              <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
                <Table>
                  <TableHeader className="bg-muted/15">
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Sender</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => {
                      const customerId = getRecordCustomerId(record);

                      return (
                        <TableRow key={record.id}>
                          <TableCell>
                            <StatusBadge status={record.status} />
                          </TableCell>
                          <TableCell>
                            <div className="truncate font-medium">
                              {record.documentNumber ?? formatDocumentType(record.documentType)}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {formatDocumentType(record.documentType)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <CustomerLink
                              customerId={customerId}
                              name={record.recipientName}
                              fallback="No name"
                              className="block max-w-48 truncate font-medium"
                            />
                            <div className="max-w-48 truncate text-muted-foreground text-xs">
                              {record.recipientEmail || "No email"}
                            </div>
                          </TableCell>
                          <TableCell className="truncate font-medium">{formatAmount(record.documentTotal)}</TableCell>
                          <TableCell className="max-w-48 truncate text-muted-foreground">
                            {record.senderEmail || "Not connected"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {formatDate(record.sentAt)}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-72 truncate text-muted-foreground">
                              {record.status === "success"
                                ? record.subject || "Email sent"
                                : record.errorMessage || "Send failed"}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 md:hidden">
                {records.map((record) => {
                  const customerId = getRecordCustomerId(record);

                  return (
                    <div
                      key={record.id}
                      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden rounded-lg border bg-background p-3"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium leading-6">
                            {record.documentNumber ?? formatDocumentType(record.documentType)}
                          </div>
                          <div className="text-muted-foreground text-xs">{formatDocumentType(record.documentType)}</div>
                        </div>
                        <StatusBadge status={record.status} />
                      </div>

                      <div className="grid min-w-0 gap-2 text-sm">
                        <div className="flex min-w-0 items-start gap-2">
                          <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <CustomerLink
                              customerId={customerId}
                              name={record.recipientName}
                              fallback="No name"
                              className="block truncate font-medium"
                            />
                            <div className="truncate text-muted-foreground text-xs">
                              {record.recipientEmail || "No email"}
                            </div>
                          </div>
                        </div>
                        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                          <Send className="size-4 shrink-0" />
                          <span className="truncate">{record.senderEmail || "Not connected"}</span>
                        </div>
                        <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2">
                          <span className="font-medium text-muted-foreground text-xs uppercase">Amount</span>
                          <span className="shrink-0 font-semibold">{formatAmount(record.documentTotal)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock3 className="size-4 shrink-0" />
                          <span>{formatDate(record.sentAt)}</span>
                        </div>
                      </div>

                      <div className="rounded-md bg-muted/50 px-3 py-2 text-muted-foreground text-sm">
                        {record.status === "success"
                          ? record.subject || "Email sent"
                          : record.errorMessage || "Send failed"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
              <MailCheck className="size-10 text-muted-foreground" />
              <h2 className="mt-3 font-semibold text-base">No emailed records yet</h2>
              <p className="mt-1 max-w-md text-muted-foreground text-sm">
                Sent estimates, invoices, and orders will appear here with the delivery result, recipient, and time.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
