"use client";

import * as React from "react";

import Link from "next/link";

import { ArrowRight, Hammer, Package, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export function ServicesDashboard({ services }: { services: ServiceTemplateRow[] }) {
  const [query, setQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState("All");
  const normalizedQuery = query.trim().toLowerCase();
  const categoryCounts = services.reduce((counts, service) => {
    counts.set(service.category, (counts.get(service.category) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const categories = [...categoryCounts.entries()].sort(([first], [second]) => first.localeCompare(second));
  const filteredServices = services.filter(
    (service) =>
      (activeCategory === "All" || service.category === activeCategory) &&
      (!normalizedQuery || getSearchText(service).includes(normalizedQuery)),
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button
            type="button"
            variant={activeCategory === "All" ? "default" : "outline"}
            size="sm"
            className="h-8"
            onClick={() => setActiveCategory("All")}
          >
            All
            <span className="tabular-nums">{services.length}</span>
          </Button>
          {categories.map(([category, count]) => (
            <Button
              key={category}
              type="button"
              variant={activeCategory === category ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => setActiveCategory(category)}
            >
              {category}
              <span className="tabular-nums">{count}</span>
            </Button>
          ))}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8"
            placeholder="Search services..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      {filteredServices.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredServices.map((service) => {
            const laborSubtotal = getSubtotal(service.laborItems);
            const materialsSubtotal = getSubtotal(service.materials);
            const total = laborSubtotal + materialsSubtotal;

            return (
              <Link
                key={service.id}
                prefetch={false}
                href={`/dashboard/services/${service.id}/edit`}
                className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card className="h-full overflow-hidden rounded-lg transition-colors group-hover:bg-muted/20" size="sm">
                  <CardContent className="grid h-full min-w-0 grid-cols-[minmax(0,1fr)] gap-4 overflow-hidden p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-sm">{service.title}</div>
                        <p className="line-clamp-2 text-muted-foreground text-sm">
                          {service.description || "No description saved yet."}
                        </p>
                      </div>
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-transform group-hover:translate-x-0.5">
                        <ArrowRight className="size-4" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{service.category}</Badge>
                      <Badge variant="outline" className="gap-1">
                        <Hammer className="size-3" />
                        {service.laborItems.length}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Package className="size-3" />
                        {service.materials.length}
                      </Badge>
                    </div>
                    <div className="mt-auto grid min-w-0 grid-cols-3 gap-2 rounded-md bg-muted/20 p-3 text-sm">
                      <div className="grid min-w-0 gap-1">
                        <span className="text-muted-foreground text-xs">Labor</span>
                        <span className="truncate font-medium tabular-nums">
                          {formatMoney(laborSubtotal.toFixed(2))}
                        </span>
                      </div>
                      <div className="grid min-w-0 gap-1">
                        <span className="text-muted-foreground text-xs">Materials</span>
                        <span className="truncate font-medium tabular-nums">
                          {formatMoney(materialsSubtotal.toFixed(2))}
                        </span>
                      </div>
                      <div className="grid min-w-0 gap-1">
                        <span className="text-muted-foreground text-xs">Template</span>
                        <span className="truncate font-semibold tabular-nums">{formatMoney(total.toFixed(2))}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid place-items-center rounded-lg border bg-muted/20 p-8 text-center">
          <div className="grid max-w-sm gap-2">
            <div className="mx-auto flex size-10 items-center justify-center rounded-md bg-background text-muted-foreground">
              <Package className="size-5" />
            </div>
            <div className="font-medium text-sm">
              {services.length ? "No services match your filters." : "No services yet."}
            </div>
            <p className="text-muted-foreground text-sm">
              {services.length
                ? "Try another category, title, note, or description from the service."
                : "Create a reusable scope once, then pull it into jobs and estimates whenever it fits."}
            </p>
            {!services.length ? (
              <Button asChild className="mt-2">
                <Link prefetch={false} href="/dashboard/services/create">
                  Create service
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
