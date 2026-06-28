"use client";

import * as React from "react";

import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { CustomerMutationState } from "../../actions";
import type { RecentCustomerRow } from "./schema";

const initialState: CustomerMutationState = {
  success: false,
  message: "",
};

export function DeleteCustomerDialog({
  action,
  customer,
  onDeleted,
  open,
  onOpenChange,
  redirectTo,
}: {
  action: (state: CustomerMutationState, formData: FormData) => Promise<CustomerMutationState>;
  customer: RecentCustomerRow | null;
  onDeleted?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectTo?: string;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;

    onOpenChange(false);
    toast.success(state.message || "Customer deleted.");
    onDeleted?.();
  }, [onDeleted, onOpenChange, state]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete customer?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {customer?.name ?? "this customer"} and their linked customer details from the dashboard.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={customer?.id ?? ""} />
          <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
        </form>

        {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }}
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
