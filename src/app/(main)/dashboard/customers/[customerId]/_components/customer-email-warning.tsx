"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { MailWarning } from "lucide-react";

import { Button } from "@/components/ui/button";

import { DeleteCustomerDialog } from "../../_components/recent-customers-table/delete-customer-dialog";
import { EditCustomerDialog } from "../../_components/recent-customers-table/edit-customer-dialog";
import type { RecentCustomerRow } from "../../_components/recent-customers-table/schema";
import type { CustomerMutationState } from "../../actions";

export function CustomerEmailWarning({
  customer,
  deleteCustomerAction,
  updateCustomerAction,
}: {
  customer: RecentCustomerRow;
  deleteCustomerAction: (state: CustomerMutationState, formData: FormData) => Promise<CustomerMutationState>;
  updateCustomerAction: (state: CustomerMutationState, formData: FormData) => Promise<CustomerMutationState>;
}) {
  const router = useRouter();
  const [editingCustomer, setEditingCustomer] = React.useState<RecentCustomerRow | null>(null);
  const [deletingCustomer, setDeletingCustomer] = React.useState<RecentCustomerRow | null>(null);

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex items-start gap-3">
          <MailWarning className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <div className="font-semibold text-sm">Email missing</div>
            <p className="mt-1 text-amber-900/80 text-sm dark:text-amber-100/80">
              Estimates, jobs, and invoices are still available, but this customer cannot receive email until an address
              is added.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 bg-background"
          onClick={() => setEditingCustomer(customer)}
        >
          Add email
        </Button>
      </div>

      <EditCustomerDialog
        action={updateCustomerAction}
        customer={editingCustomer}
        onDeleteCustomer={(nextCustomer) => {
          setEditingCustomer(null);
          setDeletingCustomer(nextCustomer);
        }}
        open={!!editingCustomer}
        onOpenChange={(open) => {
          if (!open) setEditingCustomer(null);
        }}
      />
      <DeleteCustomerDialog
        action={deleteCustomerAction}
        customer={deletingCustomer}
        onDeleted={() => {
          router.push("/dashboard/customers");
          router.refresh();
        }}
        open={!!deletingCustomer}
        redirectTo="/dashboard/customers"
        onOpenChange={(open) => {
          if (!open) setDeletingCustomer(null);
        }}
      />
    </>
  );
}
