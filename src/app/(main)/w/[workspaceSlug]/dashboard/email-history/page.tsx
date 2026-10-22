import type { Prisma } from "@prisma/client";
import { MailCheck } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

import {
  EmailHistoryDashboard,
  type EmailHistoryItem,
  type EmailHistorySort,
} from "./_components/email-history-dashboard";

const defaultPageSize = 20;
const pageSizeOptions = [20, 30, 40, 50] as const;

type EmailHistoryStatus = "all" | "error" | "success";
type PageProps = {
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    q?: string;
    sort?: string;
    status?: string;
  }>;
};

function formatDocumentType(value: string) {
  if (value === "return-receipt") return "Return receipt";

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parsePage(value?: string) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSize(value?: string) {
  const parsed = Number.parseInt(value ?? String(defaultPageSize), 10);
  return pageSizeOptions.includes(parsed as (typeof pageSizeOptions)[number]) ? parsed : defaultPageSize;
}

function parseStatus(value?: string): EmailHistoryStatus {
  return value === "success" || value === "error" ? value : "all";
}

function parseSort(value?: string): EmailHistorySort {
  const options: EmailHistorySort[] = [
    "amount-asc",
    "amount-desc",
    "recipient-asc",
    "recipient-desc",
    "sent-asc",
    "sent-desc",
    "status-asc",
    "status-desc",
  ];

  return options.includes(value as EmailHistorySort) ? (value as EmailHistorySort) : "sent-desc";
}

export default async function Page({ searchParams }: PageProps) {
  const authorization = await getPermittedDashboardAuthorization("email.history.view");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Sign in to view email history"
        description="Email records are private to each signed-in account."
      />
    );
  }

  const params = await searchParams;
  const workspaceId = authorization.workspaceId;
  const query = params?.q?.trim().slice(0, 120) ?? "";
  const status = parseStatus(params?.status);
  const sort = parseSort(params?.sort);
  const requestedPage = parsePage(params?.page);
  const pageSize = parsePageSize(params?.pageSize);
  const filteredWhere: Prisma.EmailRecordWhereInput = {
    ownerId: workspaceId,
    ...(status === "all" ? {} : { status }),
    ...(query
      ? {
          OR: [
            { documentNumber: { contains: query, mode: "insensitive" } },
            { documentType: { contains: query, mode: "insensitive" } },
            { recipientName: { contains: query, mode: "insensitive" } },
            { recipientEmail: { contains: query, mode: "insensitive" } },
            { sentByName: { contains: query, mode: "insensitive" } },
            { sentByEmail: { contains: query, mode: "insensitive" } },
            { senderEmail: { contains: query, mode: "insensitive" } },
            { subject: { contains: query, mode: "insensitive" } },
            { bodyText: { contains: query, mode: "insensitive" } },
            { errorMessage: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [totalCount, successCount, errorCount, filteredCount] = await Promise.all([
    prisma.emailRecord.count({ where: { ownerId: workspaceId } }),
    prisma.emailRecord.count({ where: { ownerId: workspaceId, status: "success" } }),
    prisma.emailRecord.count({ where: { ownerId: workspaceId, status: "error" } }),
    prisma.emailRecord.count({ where: filteredWhere }),
  ]);
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const records = await prisma.emailRecord.findMany({
    where: filteredWhere,
    orderBy:
      sort === "sent-asc"
        ? [{ sentAt: "asc" }, { id: "asc" }]
        : sort === "amount-asc"
          ? [{ documentTotal: { sort: "asc", nulls: "last" } }, { sentAt: "desc" }]
          : sort === "amount-desc"
            ? [{ documentTotal: { sort: "desc", nulls: "last" } }, { sentAt: "desc" }]
            : sort === "recipient-asc"
              ? [{ recipientName: { sort: "asc", nulls: "last" } }, { sentAt: "desc" }]
              : sort === "recipient-desc"
                ? [{ recipientName: { sort: "desc", nulls: "last" } }, { sentAt: "desc" }]
                : sort === "status-asc"
                  ? [{ status: "asc" }, { sentAt: "desc" }]
                  : sort === "status-desc"
                    ? [{ status: "desc" }, { sentAt: "desc" }]
                    : [{ sentAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

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
  const leadDocumentIds = records
    .filter((record) => record.documentType === "lead" && record.documentId)
    .map((record) => record.documentId as string);

  const [invoices, estimates, orders, leads] = await Promise.all([
    invoiceDocumentIds.length
      ? prisma.invoice.findMany({
          where: { id: { in: invoiceDocumentIds }, ownerId: workspaceId },
          select: { customerId: true, id: true },
        })
      : [],
    estimateDocumentIds.length
      ? prisma.estimate.findMany({
          where: { id: { in: estimateDocumentIds }, ownerId: workspaceId },
          select: { customerId: true, id: true },
        })
      : [],
    orderDocumentIds.length
      ? prisma.order.findMany({
          where: { id: { in: orderDocumentIds }, ownerId: workspaceId },
          select: {
            customerId: true,
            id: true,
            returns: { select: { returnNumber: true } },
          },
        })
      : [],
    leadDocumentIds.length
      ? prisma.lead.findMany({
          where: { id: { in: leadDocumentIds }, ownerId: workspaceId },
          select: { customerId: true, id: true },
        })
      : [],
  ]);

  const invoiceCustomerIdByDocumentId = new Map(invoices.map((record) => [record.id, record.customerId]));
  const estimateCustomerIdByDocumentId = new Map(estimates.map((record) => [record.id, record.customerId]));
  const orderCustomerIdByDocumentId = new Map(orders.map((record) => [record.id, record.customerId]));
  const leadCustomerIdByDocumentId = new Map(leads.map((record) => [record.id, record.customerId]));
  const canViewInvoices = can(authorization.membership, "invoices.view");
  const canViewEstimates = can(authorization.membership, "estimates.view");
  const canViewOrders = can(authorization.membership, "orders.view");
  const canManageReturns = can(authorization.membership, "orders.returns.manage");
  const canViewLeads = can(authorization.membership, "leads.view");

  function getRecordCustomerId(record: (typeof records)[number]) {
    if (!record.documentId) return undefined;
    if (record.documentType === "invoice") return invoiceCustomerIdByDocumentId.get(record.documentId) ?? undefined;
    if (record.documentType === "estimate") return estimateCustomerIdByDocumentId.get(record.documentId) ?? undefined;
    if (record.documentType === "lead") return leadCustomerIdByDocumentId.get(record.documentId) ?? undefined;
    if (record.documentType === "order" || record.documentType === "return-receipt") {
      return orderCustomerIdByDocumentId.get(record.documentId) ?? undefined;
    }
    return undefined;
  }

  function getDocumentHref(record: (typeof records)[number]) {
    if (!record.documentId) return undefined;
    if (record.documentType === "invoice" && canViewInvoices && invoices.some(({ id }) => id === record.documentId)) {
      return `/dashboard/invoices/${record.documentId}`;
    }
    if (
      record.documentType === "estimate" &&
      canViewEstimates &&
      estimates.some(({ id }) => id === record.documentId)
    ) {
      return `/dashboard/estimates/${record.documentId}`;
    }
    if (record.documentType === "order" && canViewOrders && orders.some(({ id }) => id === record.documentId)) {
      return `/dashboard/orders/${record.documentId}/edit`;
    }
    if (
      record.documentType === "return-receipt" &&
      canManageReturns &&
      orders.some(
        (order) =>
          order.id === record.documentId &&
          order.returns.some(({ returnNumber }) => !record.documentNumber || returnNumber === record.documentNumber),
      )
    ) {
      return `/dashboard/orders/${record.documentId}/return`;
    }
    if (record.documentType === "lead" && canViewLeads && leads.some(({ id }) => id === record.documentId)) {
      return `/dashboard/leads/${record.documentId}`;
    }
    return undefined;
  }

  const historyItems: EmailHistoryItem[] = records.map((record) => ({
    id: record.id,
    bodyText: record.bodyText ?? undefined,
    customerId: getRecordCustomerId(record) ?? undefined,
    documentHref: getDocumentHref(record),
    documentNumber: record.documentNumber ?? formatDocumentType(record.documentType),
    documentTotal: record.documentTotal ? formatCurrency(record.documentTotal.toNumber()) : "No amount",
    documentType: formatDocumentType(record.documentType),
    errorMessage: record.errorMessage ?? undefined,
    recipientEmail: record.recipientEmail ?? undefined,
    recipientName: record.recipientName ?? undefined,
    senderEmail: record.senderEmail ?? undefined,
    sentAt: record.sentAt.toISOString(),
    sentByEmail: record.sentByEmail ?? undefined,
    sentByName: record.sentByName ?? undefined,
    status: record.status === "success" ? "success" : "error",
    subject: record.subject ?? undefined,
  }));

  return (
    <Card className="min-w-0 md:overflow-visible">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 leading-none">
          <span className="text-xl">Email History</span>
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <MailCheck className="size-4 text-muted-foreground" />
          </div>
        </CardTitle>
        <CardDescription>Search sent messages, inspect delivery errors, and open related records.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 overflow-hidden pt-0 md:overflow-visible">
        <EmailHistoryDashboard
          errorCount={errorCount}
          filteredCount={filteredCount}
          initialQuery={query}
          initialSort={sort}
          initialStatus={status}
          page={page}
          pageSize={pageSize}
          records={historyItems}
          successCount={successCount}
          totalCount={totalCount}
          totalPages={totalPages}
        />
      </CardContent>
    </Card>
  );
}
