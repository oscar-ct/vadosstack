"use client";

import * as React from "react";

import Link from "next/link";

import { format, parseISO } from "date-fns";
import { ExternalLink, NotebookText, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { EstimateMutationState } from "../types";
import { DeleteEstimateButton } from "./delete-estimate-button";

export type EstimateListItem = {
  id: string;
  customerName?: string;
  jobTitle: string;
  estimatedTotal: string;
  jobStatus: string;
  issuedAt: string;
};

function formatMoney(value: string) {
  return `$${Number(value).toFixed(2)}`;
}

function getSearchText(estimate: EstimateListItem) {
  return [
    estimate.id,
    estimate.customerName,
    estimate.jobTitle,
    estimate.estimatedTotal,
    estimate.jobStatus,
    format(parseISO(estimate.issuedAt), "MMM d, yyyy"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function EstimatesList({
  deleteEstimateAction,
  estimates,
}: {
  deleteEstimateAction: (state: EstimateMutationState, formData: FormData) => Promise<EstimateMutationState>;
  estimates: EstimateListItem[];
}) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredEstimates = React.useMemo(() => {
    if (!normalizedQuery) {
      return estimates;
    }

    return estimates.filter((estimate) => getSearchText(estimate).includes(normalizedQuery));
  }, [estimates, normalizedQuery]);

  return (
    <div className="grid gap-3">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 pl-8"
          placeholder="Search estimates..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      {filteredEstimates.length ? (
        filteredEstimates.map((estimate) => (
          <div key={estimate.id} className="grid gap-3 rounded-md border bg-card p-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid min-w-0 gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md border bg-muted">
                  <NotebookText className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-sm">{estimate.jobTitle}</h3>
                  <p className="truncate text-muted-foreground text-xs">
                    {estimate.customerName ?? "No customer"} - Issued{" "}
                    {format(parseISO(estimate.issuedAt), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Estimate {formatMoney(estimate.estimatedTotal)}</Badge>
                <Badge variant="outline">{estimate.jobStatus}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <Button asChild variant="outline" size="sm">
                <Link prefetch={false} href={`/dashboard/estimates/${estimate.id}`}>
                  View
                  <ExternalLink />
                </Link>
              </Button>
              <DeleteEstimateButton action={deleteEstimateAction} estimateId={estimate.id} />
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-md border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
          {estimates.length
            ? "No estimates match your search."
            : "No estimates yet. Open a job and create an estimate when you are ready to quote."}
        </div>
      )}
    </div>
  );
}
