"use client";

import { BriefcaseBusiness, Plus } from "lucide-react";

import { PermissionDisabledButton } from "@/components/permission-disabled-button";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceLink as Link } from "@/components/workspace-path-provider";

import type { InvoiceMutationState } from "../../invoices/types";
import type { JobRow } from "./jobs-table/schema";
import { JobsTable } from "./jobs-table/table";

export function JobsOverview({
  canCreate,
  canCreateInvoice,
  canEdit,
  canExport,
  createInvoiceAction,
  data,
}: {
  canCreate: boolean;
  canCreateInvoice: boolean;
  canEdit: boolean;
  canExport: boolean;
  createInvoiceAction: (state: InvoiceMutationState, formData: FormData) => Promise<InvoiceMutationState>;
  data: JobRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 leading-none">
          <span className="text-lg">Jobs</span>
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BriefcaseBusiness className="size-4 text-muted-foreground" />
          </div>
        </CardTitle>
        <CardDescription>
          Service jobs with title, description, customer, schedule, cost, location, and status details.
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          {canCreate ? (
            <Button asChild size="sm">
              <Link prefetch={false} href="/dashboard/jobs/create">
                <Plus />
                Create job
              </Link>
            </Button>
          ) : (
            <PermissionDisabledButton size="sm" reason="Your role can view jobs but cannot create them.">
              <Plus />
              Create job
            </PermissionDisabledButton>
          )}
          {canExport ? <div id="jobs-export-action" /> : null}
        </CardAction>
      </CardHeader>

      <CardContent className="pt-0">
        <JobsTable
          canCreateInvoice={canCreateInvoice}
          canEdit={canEdit}
          canExport={canExport}
          createInvoiceAction={createInvoiceAction}
          data={data}
          exportSlotId={canExport ? "jobs-export-action" : undefined}
        />
      </CardContent>
    </Card>
  );
}
