"use client";

import * as React from "react";

import { PackageCheck, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import type { ServiceTemplateRow } from "../types";

function formatMoney(value: string) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getSubtotal(items: Array<{ price: string }>) {
  return items.reduce((total, item) => total + Number(item.price || 0), 0);
}

function getSearchText(service: ServiceTemplateRow) {
  return [service.title, service.description, service.category, service.notes].filter(Boolean).join(" ").toLowerCase();
}

function getServiceTotals(service: ServiceTemplateRow) {
  const laborSubtotal = getSubtotal(service.laborItems);
  const materialsSubtotal = getSubtotal(service.materials);

  return {
    laborSubtotal,
    materialsSubtotal,
    total: laborSubtotal + materialsSubtotal,
  };
}

export function ServicePicker({
  onApply,
  services,
}: {
  onApply: (service: ServiceTemplateRow) => void;
  services: ServiceTemplateRow[];
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selectedService, setSelectedService] = React.useState<ServiceTemplateRow | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredServices = services.filter(
    (service) => !normalizedQuery || getSearchText(service).includes(normalizedQuery),
  );

  function handleApply(service: ServiceTemplateRow) {
    onApply(service);
    setOpen(false);
    setQuery("");
    setSelectedService(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSelectedService(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start sm:w-auto">
          <PackageCheck />
          Add service
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-hidden sm:max-w-2xl">
        {selectedService ? (
          <>
            <DialogHeader>
              <DialogTitle>Apply service?</DialogTitle>
              <DialogDescription>
                Review the selected service before it replaces this form&apos;s title, description, category, notes,
                labor, and materials.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 overflow-y-auto pr-1">
              <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-lg">{selectedService.title}</h3>
                    <p className="text-muted-foreground text-sm">
                      {selectedService.description || "No description saved."}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-background px-2 py-1 text-muted-foreground text-xs">
                    {selectedService.category}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(() => {
                    const totals = getServiceTotals(selectedService);

                    return (
                      <>
                        <div className="rounded-lg bg-sky-50 p-3 text-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
                          <div className="text-xs">Labor</div>
                          <div className="font-semibold">{formatMoney(totals.laborSubtotal.toFixed(2))}</div>
                        </div>
                        <div className="rounded-lg bg-amber-50 p-3 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                          <div className="text-xs">Materials</div>
                          <div className="font-semibold">{formatMoney(totals.materialsSubtotal.toFixed(2))}</div>
                        </div>
                        <div className="rounded-lg bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                          <div className="text-xs">Total</div>
                          <div className="font-semibold">{formatMoney(totals.total.toFixed(2))}</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                This will overwrite the current service details and line items on the form. Customer, dates, status, and
                location will stay as they are.
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setSelectedService(null)}>
                Back
              </Button>
              <Button type="button" onClick={() => handleApply(selectedService)}>
                Apply service
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Choose a service</DialogTitle>
              <DialogDescription>
                Search your saved services and apply one to quickly fill in the form details and line items.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search services..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="grid max-h-[55svh] gap-2 overflow-y-auto pr-1">
                {filteredServices.length ? (
                  filteredServices.map((service) => {
                    const totals = getServiceTotals(service);

                    return (
                      <button
                        key={service.id}
                        type="button"
                        className="grid gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/35"
                        onClick={() => setSelectedService(service)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{service.title}</div>
                            <div className="line-clamp-2 text-muted-foreground text-sm">
                              {service.description || "No description saved."}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-muted-foreground text-xs">
                            {service.category}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <span className="rounded-md bg-sky-50 px-2 py-1 text-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
                            Labor {formatMoney(totals.laborSubtotal.toFixed(2))}
                          </span>
                          <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                            Materials {formatMoney(totals.materialsSubtotal.toFixed(2))}
                          </span>
                          <span className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                            Total {formatMoney(totals.total.toFixed(2))}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-lg border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
                    No services match your search.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
