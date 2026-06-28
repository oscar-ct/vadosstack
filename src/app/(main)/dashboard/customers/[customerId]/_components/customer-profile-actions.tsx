"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";

import { DeleteCustomerDialog } from "../../_components/recent-customers-table/delete-customer-dialog";
import { EditCustomerDialog } from "../../_components/recent-customers-table/edit-customer-dialog";
import type { RecentCustomerRow } from "../../_components/recent-customers-table/schema";
import type { CustomerMutationState } from "../../actions";

export function CustomerProfileActions({
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
      <Button type="button" variant="outline" size="sm" onClick={() => setEditingCustomer(customer)}>
        <Pencil />
        Edit customer
      </Button>
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
