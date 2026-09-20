"use client";

import * as React from "react";

import { Pencil } from "lucide-react";

import { PermissionDisabledButton } from "@/components/permission-disabled-button";
import { Button } from "@/components/ui/button";
import { useWorkspaceRouter as useRouter } from "@/components/workspace-path-provider";

import { DeleteCustomerDialog } from "../../_components/recent-customers-table/delete-customer-dialog";
import { EditCustomerDialog } from "../../_components/recent-customers-table/edit-customer-dialog";
import type { RecentCustomerRow } from "../../_components/recent-customers-table/schema";
import type { CustomerMutationState } from "../../actions";

export function CustomerProfileActions({
  canDelete,
  canUpdate,
  customer,
  deleteCustomerAction,
  updateCustomerAction,
}: {
  canDelete: boolean;
  canUpdate: boolean;
  customer: RecentCustomerRow;
  deleteCustomerAction: (state: CustomerMutationState, formData: FormData) => Promise<CustomerMutationState>;
  updateCustomerAction: (state: CustomerMutationState, formData: FormData) => Promise<CustomerMutationState>;
}) {
  const router = useRouter();
  const [editingCustomer, setEditingCustomer] = React.useState<RecentCustomerRow | null>(null);
  const [deletingCustomer, setDeletingCustomer] = React.useState<RecentCustomerRow | null>(null);

  return (
    <>
      {canUpdate ? (
        <Button type="button" size="sm" onClick={() => setEditingCustomer(customer)}>
          <Pencil />
          Edit customer
        </Button>
      ) : (
        <PermissionDisabledButton size="sm" reason="Your role can view customers but cannot edit them.">
          <Pencil />
          Edit customer
        </PermissionDisabledButton>
      )}
      <EditCustomerDialog
        action={updateCustomerAction}
        customer={editingCustomer}
        onDeleteCustomer={
          canDelete
            ? (nextCustomer) => {
                setEditingCustomer(null);
                setDeletingCustomer(nextCustomer);
              }
            : undefined
        }
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
