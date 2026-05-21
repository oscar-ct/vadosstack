"use client";

import * as React from "react";

import Link from "next/link";

import { Mail, Printer } from "lucide-react";

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

type EmailInvoiceState = {
  success: boolean;
  message: string;
};

const initialState: EmailInvoiceState = {
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
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [open, setOpen] = React.useState(false);
  const [showStateMessage, setShowStateMessage] = React.useState(false);

  React.useEffect(() => {
    if (!state.message) {
      return;
    }

    setShowStateMessage(true);
    const timeout = window.setTimeout(() => {
      setShowStateMessage(false);

      if (state.success) {
        setOpen(false);
      }
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [state.message, state.success]);

  return (
    <div className="grid gap-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => window.print()}>
          <Printer />
          Print / Save PDF
        </Button>
        {gmailConnected ? (
          <>
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
                  Email invoice
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
                    <Button type="submit" disabled={isPending}>
                      <Mail />
                      {isPending ? "Sending..." : "Send invoice"}
                    </Button>
                  </form>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {showStateMessage && state.message && !state.success ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/api/auth/google/mail?returnTo=${encodeURIComponent(returnTo)}`}>Reconnect Gmail</Link>
              </Button>
            ) : null}
          </>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={`/api/auth/google/mail?returnTo=${encodeURIComponent(returnTo)}`}>
              <Mail />
              Connect Gmail
            </Link>
          </Button>
        )}
      </div>
      {gmailConnected && !customerEmail ? (
        <p className="max-w-sm text-muted-foreground text-xs">Add a customer email before sending this invoice.</p>
      ) : null}
      {notice ? (
        <p
          className={
            notice.type === "success" ? "max-w-sm text-emerald-600 text-xs" : "max-w-sm text-destructive text-xs"
          }
        >
          {notice.message}
        </p>
      ) : null}
    </div>
  );
}
