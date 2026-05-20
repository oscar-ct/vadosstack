"use client";

import * as React from "react";

import { Pencil, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import type { ServiceTemplateMutationState } from "../actions";
import type { ServiceTemplateRow } from "../types";
import { DeleteServiceDialog, EditServiceDialog } from "./service-dialogs";

function formatMoney(value: string) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getSubtotal(items: Array<{ price: string }>) {
  return items.reduce((total, item) => total + Number(item.price || 0), 0);
}

function getSearchText(service: ServiceTemplateRow) {
  return [service.title, service.description, service.category, service.notes].filter(Boolean).join(" ").toLowerCase();
}

export function ServicesDashboard({
  deleteServiceTemplateAction,
  services,
  updateServiceTemplateAction,
}: {
  deleteServiceTemplateAction: (
    state: ServiceTemplateMutationState,
    formData: FormData,
  ) => Promise<ServiceTemplateMutationState>;
  services: ServiceTemplateRow[];
  updateServiceTemplateAction: (
    state: ServiceTemplateMutationState,
    formData: FormData,
  ) => Promise<ServiceTemplateMutationState>;
}) {
  const [query, setQuery] = React.useState("");
  const [serviceToDelete, setServiceToDelete] = React.useState<ServiceTemplateRow | null>(null);
  const [serviceToEdit, setServiceToEdit] = React.useState<ServiceTemplateRow | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredServices = services.filter(
    (service) => !normalizedQuery || getSearchText(service).includes(normalizedQuery),
  );

  return (
    <>
      <DeleteServiceDialog
        action={deleteServiceTemplateAction}
        service={serviceToDelete}
        open={!!serviceToDelete}
        onOpenChange={(open) => {
          if (!open) setServiceToDelete(null);
        }}
      />
      <EditServiceDialog
        action={updateServiceTemplateAction}
        service={serviceToEdit}
        onDeleteService={setServiceToDelete}
        open={!!serviceToEdit}
        onOpenChange={(open) => {
          if (!open) setServiceToEdit(null);
        }}
      />
      <div className="grid gap-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8"
            placeholder="Search services..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {filteredServices.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredServices.map((service) => {
              const laborSubtotal = getSubtotal(service.laborItems);
              const materialsSubtotal = getSubtotal(service.materials);
              const total = laborSubtotal + materialsSubtotal;

              return (
                <Card
                  key={service.id}
                  className="cursor-pointer overflow-hidden transition-colors hover:bg-muted/20"
                  size="sm"
                  onClick={() => setServiceToEdit(service)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setServiceToEdit(service);
                    }
                  }}
                >
                  <CardContent className="grid gap-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-base">{service.title}</h3>
                        <p className="line-clamp-2 text-muted-foreground text-sm">
                          {service.description || "No description saved."}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          setServiceToEdit(service);
                        }}
                      >
                        <Pencil />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{service.category}</Badge>
                      <Badge variant="outline">{service.laborItems.length} labor</Badge>
                      <Badge variant="outline">{service.materials.length} materials</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/20 p-3 text-sm">
                      <div className="grid gap-1">
                        <span className="text-muted-foreground text-xs">Labor</span>
                        <span className="font-medium">{formatMoney(laborSubtotal.toFixed(2))}</span>
                      </div>
                      <div className="grid gap-1">
                        <span className="text-muted-foreground text-xs">Materials</span>
                        <span className="font-medium">{formatMoney(materialsSubtotal.toFixed(2))}</span>
                      </div>
                      <div className="grid gap-1">
                        <span className="text-muted-foreground text-xs">Template</span>
                        <span className="font-semibold">{formatMoney(total.toFixed(2))}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
            No services match your search.
          </div>
        )}
      </div>
    </>
  );
}
