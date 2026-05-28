"use client";

import { BriefcaseBusiness } from "lucide-react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { InvoiceMutationState } from "../../invoices/types";
import type { ServiceTemplateRow } from "../../services/types";
import type { JobMutationState } from "../actions";
import { CreateJobDialog } from "./create-job-dialog";
import type { JobCustomer, JobRow } from "./jobs-table/schema";
import { JobsTable } from "./jobs-table/table";

export function JobsOverview({
  createJobAction,
  createInvoiceAction,
  createJobPaymentAction,
  customers,
  data,
  deleteJobAction,
  deleteJobPaymentAction,
  initialSelectedJobId,
  services,
  updateJobAction,
}: {
  createJobAction: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  createInvoiceAction: (state: InvoiceMutationState, formData: FormData) => Promise<InvoiceMutationState>;
  createJobPaymentAction: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  customers: JobCustomer[];
  data: JobRow[];
  deleteJobAction: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  deleteJobPaymentAction: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  initialSelectedJobId?: string;
  services: ServiceTemplateRow[];
  updateJobAction: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 leading-none">
          <span className={"text-lg"}>Jobs</span>
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BriefcaseBusiness className="size-4 text-muted-foreground" />
          </div>
        </CardTitle>
        <CardDescription>
          Service jobs with title, description, customer, schedule, cost, location, and status details.
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <CreateJobDialog action={createJobAction} customers={customers} services={services} />
          <div id="jobs-export-action" />
        </CardAction>
      </CardHeader>

      <CardContent className="pt-0">
        <JobsTable
          customers={customers}
          data={data}
          createJobPaymentAction={createJobPaymentAction}
          createInvoiceAction={createInvoiceAction}
          deleteJobAction={deleteJobAction}
          deleteJobPaymentAction={deleteJobPaymentAction}
          initialSelectedJobId={initialSelectedJobId}
          exportSlotId="jobs-export-action"
          services={services}
          updateJobAction={updateJobAction}
        />
      </CardContent>
    </Card>
  );
}
