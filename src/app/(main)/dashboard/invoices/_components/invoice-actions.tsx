"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { CircleDollarSign, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmailDeliveryResult, type EmailDeliveryResultValue } from "@/components/email-delivery-result";
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
import { escapeHtml } from "@/lib/email-content";
import type { DocumentEmailTemplate } from "@/lib/email-templates";

import { DocumentEmailComposerDialog } from "../../_components/document-email-composer-dialog";
import type { JobMutationState } from "../../jobs/actions";
import type { InvoiceMutationState } from "../types";
import { InvoiceDetailsDialog, type InvoiceTableItem } from "./invoices-table";

type EmailInvoiceState = {
  success: boolean;
  message: string;
  reconnectRequired?: boolean;
  submittedAt?: number;
};

const deleteInitialState: InvoiceMutationState = {
  success: false,
  message: "",
};

function createInvoiceMessageHtml({
  balanceDue,
  companyName,
  customerName,
  dueDate,
  invoiceNumber,
}: {
  balanceDue: string;
  companyName: string;
  customerName?: string | null;
  dueDate: string;
  invoiceNumber: string;
}) {
  const greetingName = customerName?.trim() || "there";
  const safeBalanceDue = escapeHtml(balanceDue);
  const safeCompanyName = escapeHtml(companyName);
  const safeDueDate = escapeHtml(dueDate);
  const safeGreetingName = escapeHtml(greetingName);
  const safeInvoiceNumber = escapeHtml(invoiceNumber);

  return [
    `<p>Hi ${safeGreetingName},</p>`,
    `<p>Your invoice <strong>${safeInvoiceNumber}</strong> from ${safeCompanyName} is attached as a PDF.</p>`,
    `<p><span style="color:#be123c;font-size:22px"><strong>${safeBalanceDue}</strong></span><br><span style="color:#52525b">Balance due</span></p>`,
    `<p><strong>Due:</strong> ${safeDueDate}</p>`,
    "<p>Please review the attached invoice at your convenience. If you have any questions, reply to this email and we will be happy to help.</p>",
    `<p>Thank you,<br><strong>${safeCompanyName}</strong></p>`,
  ].join("");
}

export function InvoiceActions({
  action,
  balanceDue,
  companyName,
  customerEmail,
  customerName,
  dueDate,
  gmailConnected,
  gmailSenderEmail,
  invoiceNumber,
  invoiceId,
  notice,
  returnTo,
  templates,
}: {
  action: (state: EmailInvoiceState, formData: FormData) => Promise<EmailInvoiceState>;
  balanceDue: string;
  companyName: string;
  customerEmail?: string | null;
  customerName?: string | null;
  dueDate: string;
  gmailConnected: boolean;
  gmailSenderEmail?: string | null;
  invoiceNumber: string;
  invoiceId: string;
  notice?: {
    message: string;
    type: "error" | "success";
  } | null;
  returnTo: string;
  templates?: DocumentEmailTemplate[];
}) {
  const router = useRouter();
  const [result, setResult] = React.useState<EmailDeliveryResultValue | null>(null);
  const defaultSubject = React.useMemo(
    () => `Invoice ${invoiceNumber} from ${companyName}`,
    [companyName, invoiceNumber],
  );
  const defaultMessage = React.useMemo(
    () =>
      [
        `Hi ${customerName?.trim() || "there"},`,
        "",
        `Your invoice ${invoiceNumber} from ${companyName} is attached as a PDF.`,
        `Balance due: ${balanceDue}`,
        `Due: ${dueDate}`,
        "",
        "Please review the attached invoice at your convenience.",
        "",
        "Thank you.",
        companyName,
      ].join("\n"),
    [balanceDue, companyName, customerName, dueDate, invoiceNumber],
  );
  const defaultHtml = React.useMemo(
    () =>
      createInvoiceMessageHtml({
        balanceDue,
        companyName,
        customerName,
        dueDate,
        invoiceNumber,
      }),
    [balanceDue, companyName, customerName, dueDate, invoiceNumber],
  );

  React.useEffect(() => {
    if (!notice?.message) {
      return;
    }

    setResult({
      id: `notice-${notice.type}-${notice.message}`,
      message: notice.message,
      type: notice.type,
    });

    const timeout = window.setTimeout(() => {
      router.replace(returnTo, { scroll: false });
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [notice?.message, notice?.type, returnTo, router]);

  return (
    <div className="grid gap-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm">
          <Link href={`/dashboard/invoices/${invoiceId}/pdf`} prefetch={false}>
            <Download />
            Download PDF
          </Link>
        </Button>
        <DocumentEmailComposerDialog
          action={action}
          attachmentName={`${invoiceNumber}.pdf`}
          defaultHtml={defaultHtml}
          defaultSubject={defaultSubject}
          defaultText={defaultMessage}
          details={[
            { label: "Invoice", value: invoiceNumber },
            { label: "Recipient", value: customerEmail ?? "No email on file" },
            { label: "Customer", value: customerName ?? "No customer name" },
            { label: "Balance due", value: balanceDue, tone: "invoice" },
            { label: "Due date", value: dueDate },
          ]}
          documentId={invoiceId}
          documentIdField="invoiceId"
          documentLabel="invoice"
          gmailConnected={gmailConnected}
          recipientEmail={customerEmail}
          returnTo={returnTo}
          senderEmail={gmailSenderEmail}
          templates={templates}
        />
      </div>
      <EmailDeliveryResult result={result} onDone={() => setResult(null)} />
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
