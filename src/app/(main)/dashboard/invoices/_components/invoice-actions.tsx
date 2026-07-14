"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { CircleDollarSign, Download, FilePenLine, Mail, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { escapeHtml } from "@/lib/email-content";
import type { DocumentEmailTemplate } from "@/lib/email-templates";

import { DocumentEmailComposerDialog } from "../../_components/document-email-composer-dialog";
import { DocumentMessageDialog } from "../../_components/document-message-dialog";
import { updateDocumentMessageAction } from "../../document-messages/actions";
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

type DeleteInvoiceSnapshot = {
  balanceDue?: string;
  customerName?: string | null;
  dueDate?: string;
  invoiceNumber?: string;
  jobTitle?: string | null;
  serviceLocation?: string | null;
};

function DeleteSnapshotRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value?.trim() || "-"}</dd>
    </div>
  );
}

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
  deleteAction,
  deleteRedirectTo,
  deleteSnapshot,
  dueDate,
  gmailConnected,
  gmailSenderEmail,
  invoiceNumber,
  invoiceNumberLockReason,
  invoiceNumberMutable,
  invoiceId,
  invoiceMessageAlign,
  invoiceMessageEnabled,
  invoiceMessageText,
  jobId,
  notice,
  returnTo,
  templates,
  updateNumberAction,
}: {
  action: (state: EmailInvoiceState, formData: FormData) => Promise<EmailInvoiceState>;
  balanceDue: string;
  companyName: string;
  customerEmail?: string | null;
  customerName?: string | null;
  deleteAction: (state: InvoiceMutationState, formData: FormData) => Promise<InvoiceMutationState>;
  deleteRedirectTo?: string;
  deleteSnapshot?: DeleteInvoiceSnapshot;
  dueDate: string;
  gmailConnected: boolean;
  gmailSenderEmail?: string | null;
  invoiceNumber: string;
  invoiceNumberLockReason?: string;
  invoiceNumberMutable: boolean;
  invoiceId: string;
  invoiceMessageAlign: "left" | "center" | "right";
  invoiceMessageEnabled: boolean;
  invoiceMessageText: string;
  jobId: string;
  notice?: {
    message: string;
    type: "error" | "success";
  } | null;
  returnTo: string;
  templates?: DocumentEmailTemplate[];
  updateNumberAction: (state: InvoiceMutationState, formData: FormData) => Promise<InvoiceMutationState>;
}) {
  const router = useRouter();
  const [result, setResult] = React.useState<EmailDeliveryResultValue | null>(null);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [invoiceNoteOpen, setInvoiceNoteOpen] = React.useState(false);
  const [numberOpen, setNumberOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const fallbackSubject = React.useMemo(
    () => `Invoice ${invoiceNumber} from ${companyName}`,
    [companyName, invoiceNumber],
  );
  const fallbackMessage = React.useMemo(
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
  const fallbackHtml = React.useMemo(
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
  const defaultTemplate = templates?.[0];
  const defaultSubject = defaultTemplate?.subject ?? fallbackSubject;
  const defaultMessage = defaultTemplate?.bodyText ?? fallbackMessage;
  const defaultHtml = defaultTemplate?.bodyHtml ?? fallbackHtml;

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
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!customerEmail}
          className="hidden sm:inline-flex"
          onClick={() => setEmailOpen(true)}
        >
          <Mail />
          Email
        </Button>
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href={`/dashboard/invoices/${invoiceId}/pdf`} prefetch={false}>
            <Download />
            Download
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-1.5">
              <MoreHorizontal />
              <span>More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Invoice actions</DropdownMenuLabel>
            <DropdownMenuItem className="sm:hidden" disabled={!customerEmail} onSelect={() => setEmailOpen(true)}>
              <Mail />
              Email invoice
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="sm:hidden">
              <Link href={`/dashboard/invoices/${invoiceId}/pdf`} prefetch={false}>
                <Download />
                Download
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/jobs/${jobId}/edit`}>
                <Pencil />
                Edit job/invoice
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setNumberOpen(true)}>
              <Pencil />
              Edit invoice number
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setInvoiceNoteOpen(true)}>
              <FilePenLine />
              Invoice note
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              <Trash2 />
              Delete invoice
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DocumentMessageDialog
          action={updateDocumentMessageAction}
          align={invoiceMessageAlign}
          documentType="invoice"
          enabled={invoiceMessageEnabled}
          hideTrigger
          messageText={invoiceMessageText}
          open={invoiceNoteOpen}
          onOpenChange={setInvoiceNoteOpen}
          returnTo={returnTo}
        />
        {numberOpen ? (
          <EditInvoiceNumberDialog
            action={updateNumberAction}
            invoiceId={invoiceId}
            invoiceNumber={invoiceNumber}
            lockReason={invoiceNumberLockReason}
            mutable={invoiceNumberMutable}
            open={numberOpen}
            onOpenChange={setNumberOpen}
          />
        ) : null}
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
          hideTrigger
          open={emailOpen}
          onOpenChange={setEmailOpen}
          recipientEmail={customerEmail}
          returnTo={returnTo}
          senderEmail={gmailSenderEmail}
          templates={templates}
        />
        <DeleteInvoiceButton
          action={deleteAction}
          hideTrigger
          invoiceId={invoiceId}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          redirectTo={deleteRedirectTo}
          snapshot={deleteSnapshot}
          numberLockReason={invoiceNumberLockReason}
          numberReleasable={invoiceNumberMutable}
        />
      </div>
      <EmailDeliveryResult result={result} onDone={() => setResult(null)} />
    </div>
  );
}

function EditInvoiceNumberDialog({
  action,
  invoiceId,
  invoiceNumber,
  lockReason,
  mutable,
  onOpenChange,
  open,
}: {
  action: (state: InvoiceMutationState, formData: FormData) => Promise<InvoiceMutationState>;
  invoiceId: string;
  invoiceNumber: string;
  lockReason?: string;
  mutable: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(action, deleteInitialState);

  React.useEffect(() => {
    if (!state.success) return;

    onOpenChange(false);
    toast.success(state.message);
    router.refresh();
  }, [onOpenChange, router, state]);

  React.useEffect(() => {
    if (!open) setConfirmed(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit invoice number</DialogTitle>
          <DialogDescription>
            Reclaim a previously released number from the end of the draft invoice sequence.
          </DialogDescription>
        </DialogHeader>

        {mutable ? (
          <form action={formAction} className="grid gap-4">
            <input type="hidden" name="id" value={invoiceId} />
            <input type="hidden" name="neverShared" value={confirmed ? "true" : "false"} />
            <div className="grid gap-2">
              <Label htmlFor="invoice-number">Invoice number</Label>
              <Input
                id="invoice-number"
                name="invoiceNumber"
                defaultValue={invoiceNumber}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                disabled={isPending}
              />
              <p className="text-muted-foreground text-xs">
                Use INV followed by a number, such as INV0010. The requested number must already be released.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-md border p-3">
              <Checkbox
                id="invoice-number-never-shared"
                checked={confirmed}
                disabled={isPending}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
              />
              <Label htmlFor="invoice-number-never-shared" className="font-normal leading-relaxed">
                I confirm this invoice has never been downloaded, printed, or otherwise shared.
              </Label>
            </div>
            {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
            <DialogFooter showCloseButton={false}>
              <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!confirmed || isPending}>
                {isPending ? "Saving..." : "Save invoice number"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="grid gap-4">
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {lockReason ?? "This invoice number is locked and cannot be changed."}
            </p>
            <DialogFooter showCloseButton={false}>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
  hideTrigger = false,
  invoiceId,
  numberLockReason,
  numberReleasable = false,
  onOpenChange,
  open: controlledOpen,
  redirectTo,
  snapshot,
}: {
  action: (state: InvoiceMutationState, formData: FormData) => Promise<InvoiceMutationState>;
  hideTrigger?: boolean;
  invoiceId: string;
  numberLockReason?: string;
  numberReleasable?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  redirectTo?: string;
  snapshot?: DeleteInvoiceSnapshot;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [numberDisposition, setNumberDisposition] = React.useState<"release" | "void" | "">("");
  const [state, formAction, isPending] = React.useActionState(action, deleteInitialState);
  const open = controlledOpen ?? uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange?.(nextOpen);
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen);
      }
      if (!nextOpen) setNumberDisposition("");
    },
    [controlledOpen, onOpenChange],
  );

  React.useEffect(() => {
    if (!state.success) return;

    handleOpenChange(false);
    toast.success(state.message || "Invoice deleted.");
    if (redirectTo) {
      router.replace(redirectTo);
      return;
    }

    router.refresh();
  }, [handleOpenChange, redirectTo, router, state]);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      {hideTrigger ? null : (
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" size="sm">
            <Trash2 />
            Delete
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent className="max-h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain sm:max-h-none sm:w-full sm:overflow-visible">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the invoice snapshot. You can create a new invoice from the job after updating the balance.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {snapshot ? (
          <dl className="grid gap-2 rounded-md border bg-muted/30 p-3">
            <DeleteSnapshotRow label="Invoice" value={snapshot.invoiceNumber} />
            <DeleteSnapshotRow label="Customer" value={snapshot.customerName} />
            <DeleteSnapshotRow label="Job" value={snapshot.jobTitle} />
            <DeleteSnapshotRow label="Location" value={snapshot.serviceLocation} />
            <DeleteSnapshotRow label="Due" value={snapshot.dueDate} />
            <DeleteSnapshotRow label="Balance" value={snapshot.balanceDue} />
          </dl>
        ) : null}

        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={invoiceId} />
          <input type="hidden" name="numberDisposition" value={numberReleasable ? numberDisposition : "void"} />
          <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
        </form>

        {numberReleasable ? (
          <div className="grid gap-2">
            <p className="font-medium text-sm">What should happen to {snapshot?.invoiceNumber}?</p>
            <RadioGroup
              value={numberDisposition}
              onValueChange={(value) => setNumberDisposition(value as "release" | "void")}
              disabled={isPending}
              aria-label="Invoice number disposition"
            >
              <Label
                htmlFor="release-invoice-number"
                className={`items-start rounded-md border p-3 font-normal leading-relaxed ${numberDisposition === "release" ? "border-primary bg-primary/5" : ""}`}
              >
                <RadioGroupItem id="release-invoice-number" value="release" className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className="font-medium">Draft only — release number</span>
                  <span className="text-muted-foreground text-xs">
                    It was never downloaded, printed, or shared. Make {snapshot?.invoiceNumber} available again.
                  </span>
                </span>
              </Label>
              <Label
                htmlFor="void-invoice-number"
                className={`items-start rounded-md border p-3 font-normal leading-relaxed ${numberDisposition === "void" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : ""}`}
              >
                <RadioGroupItem id="void-invoice-number" value="void" className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className="font-medium">Shared elsewhere — permanently void number</span>
                  <span className="text-muted-foreground text-xs">
                    Reserve {snapshot?.invoiceNumber} permanently because the invoice may have reached the customer.
                  </span>
                </span>
              </Label>
            </RadioGroup>
            {!numberDisposition ? (
              <p className="text-muted-foreground text-xs">Choose one option to continue.</p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {numberLockReason ?? "This invoice number will be voided and cannot be reused."}
          </p>
        )}

        {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={"destructive"}
            disabled={isPending || (numberReleasable && !numberDisposition)}
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
