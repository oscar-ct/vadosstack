import { PackageCheck } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { parseMaterials } from "../jobs/_components/materials";
import { parsePricingItems } from "../jobs/_components/pricing-items";
import { CreateServiceDialog } from "./_components/service-dialogs";
import { ServicesDashboard } from "./_components/services-dashboard";
import { createServiceTemplateAction, deleteServiceTemplateAction, updateServiceTemplateAction } from "./actions";
import type { ServiceTemplateRow } from "./types";

function formatMoney(value: { toString: () => string } | null) {
  return value ? value.toString() : "0";
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
    materialTaxRate: formatMoney(service.materialTaxRate),
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
        title="Sign in to view services"
        description="Reusable service templates are private to each signed-in account."
      />
    );
  }

  const services = await getServices(currentUser.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 leading-none">
          <span className={"text-lg"}>Services</span>
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <PackageCheck className="size-4 text-muted-foreground" />
          </div>
        </CardTitle>
        <CardDescription>
          Build reusable job and estimate templates with saved titles, descriptions, labor, and materials.
        </CardDescription>
        <CardAction>
          <CreateServiceDialog action={createServiceTemplateAction} />
        </CardAction>
      </CardHeader>
      <CardContent className="pt-0">
        <ServicesDashboard
          services={services}
          deleteServiceTemplateAction={deleteServiceTemplateAction}
          updateServiceTemplateAction={updateServiceTemplateAction}
        />
      </CardContent>
    </Card>
  );
}
