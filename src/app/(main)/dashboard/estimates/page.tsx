import { Download, NotebookText } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import type { JobCustomer } from "../jobs/_components/jobs-table/schema";
import { parseMaterials } from "../jobs/_components/materials";
import { parsePricingItems } from "../jobs/_components/pricing-items";
import type { ServiceTemplateRow } from "../services/types";
import { CreateEstimateRecordDialog } from "./_components/estimate-record-dialogs";
import { EstimateRecordsTable } from "./_components/estimate-records-table";
import type { EstimateRecordRow } from "./_components/schema";
import {
  convertEstimateToJobAction,
  createEstimateRecordAction,
  createPrintableEstimateAction,
  deleteEstimateRecordAction,
  updateEstimateRecordAction,
} from "./records-actions";

function formatMoney(value: { toString: () => string } | null) {
  return value ? value.toString() : undefined;
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

async function getEstimateRecords(ownerId: string): Promise<EstimateRecordRow[]> {
  const estimates = await prisma.estimateRecord.findMany({
    where: {
      ownerId,
    },
    include: {
      customer: true,
      printableEstimate: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return estimates.map((estimate) => ({
    id: estimate.id,
    convertedJobId: estimate.convertedJobId ?? undefined,
    printableEstimateId: estimate.printableEstimate?.id,
    customerId: estimate.customerId ?? undefined,
    customerName: estimate.customer?.name ?? undefined,
    description: estimate.description,
    serviceLocation: estimate.serviceLocation ?? undefined,
    dateBegin: estimate.dateBegin?.toISOString(),
    dateEnd: estimate.dateEnd?.toISOString(),
    laborCost: formatMoney(estimate.laborCost),
    laborItems: parsePricingItems(estimate.laborItems),
    materialTaxRate: formatMoney(estimate.materialTaxRate),
    materials: parseMaterials(estimate.materials),
    estimatedTotal: formatMoney(estimate.estimatedTotal),
    scope: estimate.scope ?? undefined,
    category: estimate.category,
    status: estimate.status,
    notes: estimate.notes ?? undefined,
    createdAt: estimate.createdAt.toISOString(),
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

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view estimates"
        description="Estimate records are private to each signed-in account."
      />
    );
  }

  const [customers, estimates, services] = await Promise.all([
    getCustomers(currentUser.id),
    getEstimateRecords(currentUser.id),
    getServices(currentUser.id),
  ]);

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 leading-none">
            <span className={"text-lg"}>Estimates</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <NotebookText className="size-4 text-muted-foreground" />
            </div>
          </CardTitle>
          <CardDescription>Track requested estimates, estimate value, status, and conversion to jobs.</CardDescription>
          <CardAction className="flex items-center gap-2">
            <CreateEstimateRecordDialog action={createEstimateRecordAction} customers={customers} services={services} />
            <Button variant="outline" size="sm" className="w-7 px-0 sm:w-auto sm:px-2.5">
              <Download />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="pt-0">
          <EstimateRecordsTable
            convertEstimateToJobAction={convertEstimateToJobAction}
            createPrintableEstimateAction={createPrintableEstimateAction}
            customers={customers}
            data={estimates}
            deleteEstimateRecordAction={deleteEstimateRecordAction}
            services={services}
            updateEstimateRecordAction={updateEstimateRecordAction}
          />
        </CardContent>
      </Card>
    </div>
  );
}
