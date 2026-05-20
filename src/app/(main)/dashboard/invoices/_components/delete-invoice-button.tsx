"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import type { InvoiceMutationState } from "../types";

const initialState: InvoiceMutationState = {
  success: false,
  message: "",
};

export function DeleteInvoiceButton({
  action,
  invoiceId,
  redirectTo,
}: {
  action: (state: InvoiceMutationState, formData: FormData) => Promise<InvoiceMutationState>;
  invoiceId: string;
  redirectTo?: string;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;

    setOpen(false);
    if (redirectTo) {
      router.replace(redirectTo);
      return;
    }

    router.refresh();
  }, [redirectTo, router, state.success]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Trash2 />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the invoice snapshot. You can create a new invoice from the job after updating the balance.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={invoiceId} />
          <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
        </form>

        {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }}
          >
            {isPending ? "Deleting..." : "Delete invoice"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
