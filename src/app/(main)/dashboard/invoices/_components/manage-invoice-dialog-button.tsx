"use client";

import * as React from "react";

import { CircleDollarSign } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { JobMutationState } from "../../jobs/actions";
import { InvoiceDetailsDialog, type InvoiceTableItem } from "./invoices-table";

export function ManageInvoiceDialogButton({
  createJobPaymentAction,
  deleteJobPaymentAction,
  invoice,
}: {
  createJobPaymentAction: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  deleteJobPaymentAction: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  invoice: InvoiceTableItem;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CircleDollarSign />
        Manage invoice
      </Button>
      <InvoiceDetailsDialog
        createJobPaymentAction={createJobPaymentAction}
        deleteJobPaymentAction={deleteJobPaymentAction}
        invoice={invoice}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
