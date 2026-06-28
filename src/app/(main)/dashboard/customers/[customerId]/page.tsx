import type { ReactNode } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";

import { addDays, format, formatDistanceToNowStrict } from "date-fns";
import {
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Mail,
  MapPin,
  ReceiptText,
  Send,
  UserRound,
} from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { BackButton } from "@/components/back-button";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { cn, formatCurrency } from "@/lib/utils";

import type { RecentCustomerRow } from "../_components/recent-customers-table/schema";
import { deleteCustomerAction, updateCustomerAction } from "../actions";
import { CustomerProfileActions } from "./_components/customer-profile-actions";

type CustomerPageProps = {
  params: Promise<{
    customerId: string;
  }>;
};

type ActivityTone = "amber" | "cyan" | "emerald" | "rose" | "slate";

type ActivityItem = {
  id: string;
  amount?: string;
  description: string;
  href?: string;
  occurredAt: Date;
  title: string;
  tone: ActivityTone;
  type: string;
};

function formatMoney(value: { toNumber: () => number } | { toString: () => string } | number | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const amount = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(amount) ? formatCurrency(amount) : undefined;
}

function formatAddress(address: {
  line1: string;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}) {
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(", ");
  return [address.line1, address.line2, cityLine, address.country].filter(Boolean).join("\n");
}

function activityToneClassName(tone: ActivityTone) {
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "cyan") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "rose") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function activityIcon(type: string) {
  if (type === "Estimate") return <FileText className="size-4" />;
  if (type === "Job") return <BriefcaseBusiness className="size-4" />;
  if (type === "Invoice") return <ReceiptText className="size-4" />;
  if (type === "Payment") return <BadgeDollarSign className="size-4" />;
  if (type === "Email") return <Send className="size-4" />;
  return <CalendarDays className="size-4" />;
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-sm">{value ?? "Not on file"}</span>
    </div>
  );
}

export default async function CustomerPage({ params }: CustomerPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view this customer"
        description="Customer records are private to each signed-in account."
      />
    );
  }

  const { customerId } = await params;

  const customer = await prisma.customer.findUnique({
    where: {
      id_ownerId: {
        id: customerId,
        ownerId: currentUser.id,
      },
    },
    include: {
      addresses: true,
      estimateRecords: {
        include: {
          printableEstimate: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      jobs: {
        include: {
          invoice: true,
          payments: {
            orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      phoneNumbers: true,
    },
  });

  if (!customer) {
    notFound();
  }

  const invoiceIds = customer.jobs.flatMap((job) => (job.invoice ? [job.invoice.id] : []));
  const estimateIds = customer.estimateRecords.flatMap((estimate) =>
    estimate.printableEstimate ? [estimate.printableEstimate.id] : [],
  );
  const documentIds = [...invoiceIds, ...estimateIds];
  const emailRecordFilters = [
    ...(documentIds.length
      ? [
          {
            documentId: {
              in: documentIds,
            },
          },
        ]
      : []),
    ...(customer.email
      ? [
          {
            recipientEmail: customer.email,
          },
        ]
      : []),
  ];
  const emailRecords = emailRecordFilters.length
    ? await prisma.emailRecord.findMany({
        where: {
          ownerId: currentUser.id,
          OR: emailRecordFilters,
        },
        orderBy: {
          sentAt: "desc",
        },
        take: 100,
      })
    : [];

  const invoices = customer.jobs.flatMap((job) => (job.invoice ? [{ ...job.invoice, jobTitle: job.description }] : []));
  const payments = customer.jobs.flatMap((job) =>
    job.payments.map((payment) => ({
      ...payment,
      jobTitle: job.description,
    })),
  );
  const totalOutstanding = invoices.reduce((total, invoice) => total + Number(invoice.balanceDue), 0);
  const totalBilled = invoices.reduce((total, invoice) => total + Number(invoice.finalCost), 0);
  const totalPaid = payments.reduce((total, payment) => total + Number(payment.amount), 0);
  const customerRow: RecentCustomerRow = {
    id: customer.id,
    name: customer.name,
    email: customer.email ?? "",
    billing: totalOutstanding > 0 ? "Outstanding Balance" : "No Balance",
    joined: customer.joinedAt.toISOString(),
    lastScheduledJobDate: customer.jobs
      .map((job) => job.dateBegin ?? job.createdAt)
      .sort((left, right) => right.getTime() - left.getTime())[0]
      ?.toISOString(),
    jobCount: customer.jobs.length,
    outstandingAmount: totalOutstanding > 0 ? formatCurrency(totalOutstanding) : undefined,
    addresses: customer.addresses.map((address) => ({
      label: address.label ?? undefined,
      line1: address.line1,
      line2: address.line2 ?? undefined,
      city: address.city ?? undefined,
      state: address.state ?? undefined,
      postalCode: address.postalCode ?? undefined,
      country: address.country ?? undefined,
    })),
    phoneNumbers: customer.phoneNumbers.map((phoneNumber) => ({
      label: phoneNumber.label ?? "Phone",
      value: formatPhoneNumber(phoneNumber.value),
    })),
    jobHistory: customer.jobs.map((job) => ({
      id: job.id,
      title: job.description,
      status: job.status,
      date: (job.dateBegin ?? job.createdAt).toISOString(),
      total: formatMoney(job.finalCost ?? job.estimatedCost),
      amountPaid: formatMoney(job.amountPaid),
      paymentStatus: job.paymentStatus,
      linkedJobId: job.id,
    })),
    unpaidJobs: invoices
      .filter((invoice) => Number(invoice.balanceDue) > 0)
      .map((invoice) => ({
        id: invoice.id,
        title: `Invoice ${invoice.id.slice(-6).toUpperCase()}`,
        status: invoice.paymentStatus,
        date: invoice.issuedAt.toISOString(),
        balance: formatMoney(invoice.balanceDue) ?? "$0.00",
        paymentStatus: invoice.paymentStatus,
        linkedInvoiceId: invoice.id,
      })),
    invoiceHistory: invoices.map((invoice) => ({
      id: invoice.id,
      status: invoice.paymentStatus,
      issuedAt: invoice.issuedAt.toISOString(),
      dueAt: addDays(invoice.issuedAt, currentUser.invoiceDueDays).toISOString(),
      total: formatMoney(invoice.finalCost) ?? "$0.00",
      balance: formatMoney(invoice.balanceDue),
    })),
    notes: customer.notes ?? undefined,
  };
  const lastActivityDate =
    [
      ...customer.jobs.map((job) => job.updatedAt),
      ...customer.estimateRecords.map((estimate) => estimate.updatedAt),
      ...invoices.map((invoice) => invoice.updatedAt),
      ...payments.map((payment) => payment.createdAt),
      ...emailRecords.map((record) => record.sentAt),
    ].sort((left, right) => right.getTime() - left.getTime())[0] ?? customer.updatedAt;

  const activity: ActivityItem[] = [
    ...customer.estimateRecords.map((estimate): ActivityItem => {
      if (estimate.printableEstimate) {
        return {
          id: `estimate-sent-${estimate.printableEstimate.id}`,
          amount: formatMoney(estimate.printableEstimate.estimatedTotal),
          description: estimate.customerId
            ? `${estimate.status} estimate record`
            : "Estimate record without a linked customer",
          href: `/dashboard/estimates/${estimate.printableEstimate.id}`,
          occurredAt: estimate.printableEstimate.issuedAt,
          title: estimate.description,
          tone: "cyan",
          type: "Estimate",
        };
      }

      return {
        id: `estimate-created-${estimate.id}`,
        amount: formatMoney(estimate.estimatedTotal),
        description: `${estimate.status} estimate record`,
        href: `/dashboard/estimates/records/${estimate.id}`,
        occurredAt: estimate.createdAt,
        title: estimate.description,
        tone: "slate",
        type: "Estimate",
      };
    }),
    ...customer.jobs.map((job) => ({
      id: `job-${job.id}`,
      amount: formatMoney(job.finalCost ?? job.estimatedCost),
      description: `${job.status} job created`,
      href: `/dashboard/jobs/${job.id}`,
      occurredAt: job.createdAt,
      title: job.description,
      tone: "amber" as const,
      type: "Job",
    })),
    ...invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      amount: formatMoney(invoice.finalCost),
      description: `${invoice.paymentStatus} - balance ${formatMoney(invoice.balanceDue) ?? "$0.00"}`,
      href: `/dashboard/invoices/${invoice.id}`,
      occurredAt: invoice.issuedAt,
      title: invoice.jobTitle,
      tone: Number(invoice.balanceDue) > 0 ? ("rose" as const) : ("emerald" as const),
      type: "Invoice",
    })),
    ...payments.map((payment) => ({
      id: `payment-${payment.id}`,
      amount: formatMoney(payment.amount),
      description: `${payment.description} - ${payment.method}`,
      href: `/dashboard/jobs/${payment.jobId}`,
      occurredAt: payment.paidOn,
      title: payment.jobTitle,
      tone: "emerald" as const,
      type: "Payment",
    })),
    ...emailRecords.map((record) => ({
      id: `email-${record.id}`,
      amount: formatMoney(record.documentTotal),
      description:
        record.status === "success"
          ? `${record.documentType} email sent to ${record.recipientEmail ?? "recipient"}`
          : record.errorMessage || `${record.documentType} email failed`,
      href:
        record.documentType === "invoice" && record.documentId
          ? `/dashboard/invoices/${record.documentId}`
          : record.documentType === "estimate" && record.documentId
            ? `/dashboard/estimates/${record.documentId}`
            : undefined,
      occurredAt: record.sentAt,
      title: record.subject || `${record.documentType} email`,
      tone: record.status === "success" ? ("cyan" as const) : ("rose" as const),
      type: "Email",
    })),
  ].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());

  return (
    <div className="@container/main mx-auto grid w-full max-w-7xl gap-5 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton fallbackHref="/dashboard/customers" />
        <div className="flex flex-wrap items-center gap-2">
          <CustomerProfileActions
            customer={customerRow}
            deleteCustomerAction={deleteCustomerAction}
            updateCustomerAction={updateCustomerAction}
          />
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="grid gap-5 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="grid gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-md border bg-muted text-muted-foreground">
                <UserRound className="size-5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-semibold text-2xl">{customer.name}</h1>
                <p className="mt-1 truncate text-muted-foreground text-sm">
                  {customer.email || "No email on file"} - customer since {format(customer.joinedAt, "MMM d, yyyy")}
                </p>
              </div>
            </div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,9.5rem),1fr))]">
              <SummaryTile label="Outstanding" value={formatCurrency(totalOutstanding)} />
              <SummaryTile label="Billed" value={formatCurrency(totalBilled)} />
              <SummaryTile label="Paid" value={formatCurrency(totalPaid)} />
            </div>
          </div>

          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2 font-medium text-sm">
              <CalendarDays className="size-4 text-muted-foreground" />
              Account snapshot
            </div>
            <div className="mt-4 grid gap-3">
              <DetailItem label="Last activity" value={`${formatDistanceToNowStrict(lastActivityDate)} ago`} />
              <DetailItem label="Jobs" value={`${customer.jobs.length} recorded`} />
              <DetailItem label="Estimates" value={`${customer.estimateRecords.length} recorded`} />
              <DetailItem label="Invoices" value={`${invoices.length} issued`} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
        <aside className="grid gap-5 xl:sticky xl:top-20">
          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Mail className="size-4 text-muted-foreground" />
              Contact
            </div>
            <div className="mt-4 grid gap-3">
              <DetailItem label="Email" value={customer.email} />
              <DetailItem label="Primary phone" value={formatPhoneNumber(customer.phoneNumbers[0]?.value)} />
              {customer.phoneNumbers.slice(1).map((phone) => (
                <DetailItem key={phone.id} label={phone.label ?? "Phone"} value={formatPhoneNumber(phone.value)} />
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 font-medium text-sm">
              <MapPin className="size-4 text-muted-foreground" />
              Addresses
            </div>
            <div className="mt-4 grid gap-2">
              {customer.addresses.length ? (
                customer.addresses.map((address, index) => (
                  <div key={address.id} className="grid gap-1 rounded-md border bg-muted/20 p-3">
                    <span className="font-medium text-xs">{address.label ?? `Address ${index + 1}`}</span>
                    <p className="whitespace-pre-line text-sm">{formatAddress(address)}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed bg-muted/20 p-3 text-muted-foreground text-sm">
                  No addresses on file.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 font-medium text-sm">
              <CreditCard className="size-4 text-muted-foreground" />
              Billing
            </div>
            <div className="mt-4 grid gap-3">
              <DetailItem label="Status" value={totalOutstanding > 0 ? "Outstanding balance" : "No balance"} />
              <DetailItem label="Outstanding amount" value={formatCurrency(totalOutstanding)} />
              <DetailItem label="Payment records" value={`${payments.length} recorded`} />
            </div>
          </section>
        </aside>

        <main className="grid min-w-0 gap-5">
          <section className="rounded-lg border bg-card">
            <div className="border-b p-4">
              <div className="flex items-center gap-2 font-medium text-sm">
                <CalendarDays className="size-4 text-muted-foreground" />
                Activity timeline
              </div>
              <p className="mt-1 text-muted-foreground text-xs">
                Estimates, jobs, invoices, payments, and email attempts for this customer.
              </p>
            </div>
            <div className="grid gap-0 p-4">
              {activity.length ? (
                activity.map((item) => <ActivityRow key={item.id} item={item} />)
              ) : (
                <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center">
                  <CheckCircle2 className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 font-medium text-sm">No activity yet</p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Estimate, job, invoice, payment, and email activity will appear here.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <DocumentList
              emptyLabel="No estimates yet."
              icon={<FileText className="size-4 text-muted-foreground" />}
              items={customer.estimateRecords.map((estimate) => ({
                amount: formatMoney(estimate.estimatedTotal),
                href: estimate.printableEstimate
                  ? `/dashboard/estimates/${estimate.printableEstimate.id}`
                  : `/dashboard/estimates/records/${estimate.id}`,
                meta: `${estimate.status} - ${format(estimate.createdAt, "MMM d, yyyy")}`,
                title: estimate.description,
              }))}
              title="Estimates"
            />
            <DocumentList
              emptyLabel="No invoices yet."
              icon={<ReceiptText className="size-4 text-muted-foreground" />}
              items={invoices.map((invoice) => ({
                amount: formatMoney(invoice.finalCost),
                href: `/dashboard/invoices/${invoice.id}`,
                meta: `${invoice.paymentStatus} - ${format(invoice.issuedAt, "MMM d, yyyy")}`,
                title: invoice.jobTitle,
              }))}
              title="Invoices"
            />
          </section>
        </main>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-background p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 min-w-0 truncate font-semibold text-lg tabular-nums">{value}</div>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const content = (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 border-b py-3 last:border-b-0">
      <span className={cn("mt-0.5 grid size-8 place-items-center rounded-md border", activityToneClassName(item.tone))}>
        {activityIcon(item.type)}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={activityToneClassName(item.tone)}>
            {item.type}
          </Badge>
          <span className="text-muted-foreground text-xs">{format(item.occurredAt, "MMM d, yyyy h:mm a")}</span>
        </div>
        <div className="mt-1 truncate font-medium text-sm">{item.title}</div>
        <p className="mt-0.5 line-clamp-2 text-muted-foreground text-xs">{item.description}</p>
      </div>
      <div className="flex items-start gap-2">
        {item.amount ? <span className="font-medium text-sm tabular-nums">{item.amount}</span> : null}
        {item.href ? <ArrowRight className="mt-0.5 size-4 text-muted-foreground" /> : null}
      </div>
    </div>
  );

  if (!item.href) {
    return content;
  }

  return (
    <Link href={item.href} prefetch={false} className="rounded-md transition-colors hover:bg-muted/40">
      {content}
    </Link>
  );
}

function DocumentList({
  emptyLabel,
  icon,
  items,
  title,
}: {
  emptyLabel: string;
  icon: ReactNode;
  items: Array<{
    amount?: string;
    href: string;
    meta: string;
    title: string;
  }>;
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b p-4 font-medium text-sm">
        {icon}
        {title}
      </div>
      <div className="grid gap-0 p-4">
        {items.length ? (
          items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b py-3 last:border-b-0 hover:bg-muted/30"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-sm">{item.title}</div>
                <div className="mt-0.5 text-muted-foreground text-xs">{item.meta}</div>
              </div>
              <span className="font-medium text-sm tabular-nums">{item.amount ?? "$0.00"}</span>
            </Link>
          ))
        ) : (
          <p className="rounded-md border border-dashed bg-muted/20 p-4 text-muted-foreground text-sm">{emptyLabel}</p>
        )}
      </div>
    </section>
  );
}
