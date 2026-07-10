"use client";

import Link from "next/link";

import { Users } from "lucide-react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WorkspaceMode } from "@/lib/workspace-mode";

import type { CreateCustomerState } from "../actions";
import { CreateCustomerDialog } from "./create-customer-dialog";
import type { RecentCustomerRow } from "./recent-customers-table/schema";
import { RecentCustomersTable } from "./recent-customers-table/table";

export function SubscriberOverview({
  createCustomerAction,
  data,
  view,
  workspaceMode,
}: {
  createCustomerAction: (state: CreateCustomerState, formData: FormData) => Promise<CreateCustomerState>;
  data: RecentCustomerRow[];
  view: "orders" | "work";
  workspaceMode: WorkspaceMode;
}) {
  const showViewSwitcher = workspaceMode === "both";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 leading-none">
          <span className={"text-lg"}>Customers</span>
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Users className="size-4 text-muted-foreground" />
          </div>
        </CardTitle>
        <CardDescription>
          {view === "orders"
            ? "Customer records with order totals, returns, and recent purchase activity."
            : "Customer records with job, estimate, invoice, and billing activity."}
        </CardDescription>
        <CardAction className="flex flex-wrap items-center gap-2">
          <CreateCustomerDialog action={createCustomerAction} />
          <div id="customers-export-action" />
        </CardAction>
        {showViewSwitcher ? (
          <div className="col-span-full flex justify-center pt-2">
            <CustomerViewSwitcher view={view} />
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="pt-0">
        <RecentCustomersTable key={view} data={data} exportSlotId="customers-export-action" view={view} />
      </CardContent>
    </Card>
  );
}

function CustomerViewSwitcher({ view }: { view: "orders" | "work" }) {
  return (
    <div className="inline-grid h-8 grid-cols-2 rounded-lg bg-muted p-1 text-sm">
      {(["work", "orders"] as const).map((option) => (
        <Link
          key={option}
          href={`/dashboard/customers?view=${option}`}
          className={cn(
            "grid min-w-20 place-items-center rounded-md px-3 font-medium transition-colors",
            view === option ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option === "work" ? "Work" : "Orders"}
        </Link>
      ))}
    </div>
  );
}
