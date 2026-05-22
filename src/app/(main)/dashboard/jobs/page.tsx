import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";
import { calculateOutstandingBalance } from "@/lib/customer-billing";
import { prisma } from "@/lib/prisma";

import { createInvoiceAction } from "../invoices/actions";
import type { ServiceTemplateRow } from "../services/types";
import { JobsOverview } from "./_components/jobs-overview";
import type { JobCustomer, JobRow } from "./_components/jobs-table/schema";
import { parseMaterials } from "./_components/materials";
import { parsePricingItems } from "./_components/pricing-items";
import {
  createJobAction,
  createJobPaymentAction,
  deleteJobAction,
  deleteJobPaymentAction,
  updateJobAction,
} from "./actions";

function formatMoney(value: { toString: () => string } | null) {
  return value === null ? undefined : value.toString();
}

function normalizeJobStatus(status: string) {
  return status === "In Progress" ? "Scheduled" : status;
}

async function getJobs(ownerId: string): Promise<JobRow[]> {
  const jobs = await prisma.job.findMany({
    where: {
      ownerId,
    },
    include: {
      customer: true,
      estimate: true,
      invoice: true,
      payments: {
        orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }, { dateBegin: "desc" }],
  });

  return jobs.map((job) => {
    const status = normalizeJobStatus(job.status);

    return {
      id: job.id,
      customerId: job.customerId ?? undefined,
      customerName: job.customer?.name ?? undefined,
      description: job.description,
      serviceLocation: job.serviceLocation ?? undefined,
      dateBegin: job.dateBegin?.toISOString(),
      dateEnd: job.dateEnd?.toISOString(),
      estimatedCost: formatMoney(job.estimatedCost),
      laborCost: formatMoney(job.laborCost),
      laborItems: parsePricingItems(job.laborItems),
      materialTaxRate: formatMoney(job.materialTaxRate),
      materials: parseMaterials(job.materials),
      paymentStatus: job.paymentStatus,
      depositPaid: formatMoney(job.depositPaid),
      amountPaid: formatMoney(job.amountPaid),
      outstandingBalance: formatMoney(
        calculateOutstandingBalance(status, job.finalCost?.toString(), job.amountPaid?.toString()),
      ),
      finalCost: formatMoney(job.finalCost),
      scope: job.scope ?? undefined,
      category: job.category,
      status,
      pictures: job.pictures,
      notes: job.notes ?? undefined,
      payments: job.payments.map((payment) => ({
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
      invoiceId: job.invoice?.id,
      invoiceIssuedAt: job.invoice?.issuedAt.toISOString(),
      estimateId: job.estimate?.id,
      estimateIssuedAt: job.estimate?.issuedAt.toISOString(),
      createdAt: job.createdAt.toISOString(),
    };
  });
}

async function getCustomers(ownerId: string): Promise<JobCustomer[]> {
  const customers = await prisma.customer.findMany({
    where: {
      ownerId,
    },
    include: {
      addresses: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    addresses: customer.addresses.map((address) => ({
      id: address.id,
      label: address.label ?? undefined,
      line1: address.line1,
      line2: address.line2 ?? undefined,
      city: address.city ?? undefined,
      state: address.state ?? undefined,
      postalCode: address.postalCode ?? undefined,
      country: address.country ?? undefined,
    })),
  }));
}

async function getServices(ownerId: string): Promise<ServiceTemplateRow[]> {
  const services = await prisma.serviceTemplate.findMany({
    where: {
      ownerId,
    },
    orderBy: {
      title: "asc",
    },
  });

  return services.map((service) => ({
    id: service.id,
    title: service.title,
    description: service.description ?? undefined,
    category: service.category,
    notes: service.notes ?? undefined,
    laborItems: parsePricingItems(service.laborItems),
    materialTaxRate: service.materialTaxRate.toString(),
    materials: parseMaterials(service.materials),
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  }));
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{
    job?: string;
  }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view jobs"
        description="Job records are private to each signed-in account."
      />
    );
  }

  const [jobs, customers, services, resolvedSearchParams] = await Promise.all([
    getJobs(currentUser.id),
    getCustomers(currentUser.id),
    getServices(currentUser.id),
    searchParams,
  ]);

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <JobsOverview
        createJobAction={createJobAction}
        createInvoiceAction={createInvoiceAction}
        createJobPaymentAction={createJobPaymentAction}
        customers={customers}
        data={jobs}
        deleteJobAction={deleteJobAction}
        deleteJobPaymentAction={deleteJobPaymentAction}
        initialSelectedJobId={resolvedSearchParams?.job}
        services={services}
        updateJobAction={updateJobAction}
      />
    </div>
  );
}
