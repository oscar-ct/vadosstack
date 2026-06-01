"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { CircleDollarSign, Mail, Printer, Trash2 } from "lucide-react";
import { siGmail } from "simple-icons";
import { toast } from "sonner";

import { SimpleIcon } from "@/components/simple-icon";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import type { JobMutationState } from "../../jobs/actions";
import type { InvoiceMutationState } from "../types";
import { InvoiceDetailsDialog, type InvoiceTableItem } from "./invoices-table";

type EmailInvoiceState = {
  success: boolean;
  message: string;
  reconnectRequired?: boolean;
  submittedAt?: number;
};

const initialState: EmailInvoiceState = {
  success: false,
  message: "",
};

const deleteInitialState: InvoiceMutationState = {
  success: false,
  message: "",
};

export function InvoiceActions({
  action,
  balanceDue,
  customerEmail,
  customerName,
  dueDate,
  gmailConnected,
  invoiceNumber,
  invoiceId,
  notice,
  returnTo,
}: {
  action: (state: EmailInvoiceState, formData: FormData) => Promise<EmailInvoiceState>;
  balanceDue: string;
  customerEmail?: string | null;
  customerName?: string | null;
  dueDate: string;
  gmailConnected: boolean;
  invoiceNumber: string;
  invoiceId: string;
  notice?: {
    message: string;
    type: "error" | "success";
  } | null;
  returnTo: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [open, setOpen] = React.useState(false);
  const [showStateMessage, setShowStateMessage] = React.useState(false);
  const stateSubmittedAt = state.submittedAt;
  const canSendEmail = gmailConnected && (!state.reconnectRequired || open);
  const gmailConnectLabel = state.reconnectRequired ? "Reconnect Gmail" : "Connect Gmail";

  React.useEffect(() => {
    if (!notice?.message) {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (notice.type === "success") {
        toast.success(notice.message);
      } else {
        toast.error(notice.message);
      }

      router.replace(returnTo, { scroll: false });
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [notice?.message, notice?.type, returnTo, router]);

  React.useEffect(() => {
    if (!state.message || !stateSubmittedAt) {
      return;
    }

    setShowStateMessage(true);

    if (state.reconnectRequired) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowStateMessage(false);

      if (state.success) {
        setOpen(false);
      }
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [state.message, state.reconnectRequired, state.success, stateSubmittedAt]);

  return (
    <div className="grid gap-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => window.print()}>
          <Printer />
          Print / Save PDF
        </Button>
        {canSendEmail ? (
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);

              if (nextOpen) {
                setShowStateMessage(false);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={!customerEmail}>
                <Mail />
                Email
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send invoice?</DialogTitle>
                <DialogDescription>
                  Review the details before emailing this invoice from your connected Gmail account.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-medium">{invoiceNumber}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Recipient</span>
                  <span className="max-w-56 truncate font-medium">{customerEmail}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="max-w-56 truncate font-medium">{customerName ?? "No customer name"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Balance due</span>
                  <span className="font-semibold text-rose-700 dark:text-rose-400">{balanceDue}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Due date</span>
                  <span className="font-medium">{dueDate}</span>
                </div>
              </div>

              {showStateMessage && state.message ? (
                <p
                  className={
                    state.success
                      ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 text-sm dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm"
                  }
                >
                  {state.message}
                </p>
              ) : null}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isPending}>
                    Cancel
                  </Button>
                </DialogClose>
                <form action={formAction}>
                  <input type="hidden" name="invoiceId" value={invoiceId} />
                  <Button type="submit" disabled={isPending || state.success || state.reconnectRequired}>
                    <Mail />
                    {isPending ? "Sending..." : "Send invoice"}
                  </Button>
                </form>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={`/api/auth/google/mail?returnTo=${encodeURIComponent(returnTo)}`}>
              <SimpleIcon icon={siGmail} className="size-3.5 fill-current" />
              {gmailConnectLabel}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={
          "border-emerald-200 bg-emerald-50 px-2 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950"
        }
      >
        <CircleDollarSign />
        Manage
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
  const [state, formAction, isPending] = React.useActionState(action, deleteInitialState);

  React.useEffect(() => {
    if (!state.success) return;

    setOpen(false);
    toast.success(state.message || "Invoice deleted.");
    if (redirectTo) {
      router.replace(redirectTo);
      return;
    }

    router.refresh();
  }, [redirectTo, router, state]);

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
            variant={"destructive"}
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
