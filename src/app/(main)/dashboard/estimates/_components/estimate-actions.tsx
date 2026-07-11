"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Download, FilePenLine, Mail, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { escapeHtml } from "@/lib/email-content";
import type { DocumentEmailTemplate } from "@/lib/email-templates";

import { DocumentEmailComposerDialog } from "../../_components/document-email-composer-dialog";
import { DocumentMessageDialog } from "../../_components/document-message-dialog";
import { updateDocumentMessageAction } from "../../document-messages/actions";
import type { EstimateMutationState } from "../types";

type EmailEstimateState = {
  success: boolean;
  message: string;
  reconnectRequired?: boolean;
  submittedAt?: number;
};

const deleteInitialState: EstimateMutationState = {
  success: false,
  message: "",
};

type DeleteEstimateSnapshot = {
  customerName?: string | null;
  estimateNumber?: string;
  estimatedTotal?: string;
  jobTitle?: string | null;
  serviceLocation?: string | null;
  validThrough?: string;
};

function DeleteSnapshotRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value?.trim() || "-"}</dd>
    </div>
  );
}

function createEstimateMessageHtml({
  companyName,
  customerName,
  estimateNumber,
  estimatedTotal,
  validThrough,
}: {
  companyName: string;
  customerName?: string | null;
  estimateNumber: string;
  estimatedTotal: string;
  validThrough: string;
}) {
  const greetingName = customerName?.trim() || "there";
  const safeCompanyName = escapeHtml(companyName);
  const safeEstimateNumber = escapeHtml(estimateNumber);
  const safeEstimatedTotal = escapeHtml(estimatedTotal);
  const safeGreetingName = escapeHtml(greetingName);
  const safeValidThrough = escapeHtml(validThrough);

  return [
    `<p>Hi ${safeGreetingName},</p>`,
    `<p>Your estimate <strong>${safeEstimateNumber}</strong> from ${safeCompanyName} is attached as a PDF.</p>`,
    `<p><span style="color:#0369a1;font-size:22px"><strong>${safeEstimatedTotal}</strong></span><br><span style="color:#52525b">Estimated total</span></p>`,
    `<p><strong>Valid through:</strong> ${safeValidThrough}</p>`,
    "<p>Please review the attached estimate at your convenience. If you have any questions, reply to this email and we will be happy to help.</p>",
    `<p>Thank you,<br><strong>${safeCompanyName}</strong></p>`,
  ].join("");
}

export function EstimateActions({
  action,
  companyName,
  customerEmail,
  customerName,
  deleteAction,
  deleteRedirectTo,
  deleteSnapshot,
  editHref,
  editLabel = "Edit estimate",
  estimateId,
  estimateMessageAlign,
  estimateMessageEnabled,
  estimateMessageText,
  estimateNumber,
  estimatedTotal,
  gmailConnected,
  gmailSenderEmail,
  notice,
  returnTo,
  templates,
  validThrough,
}: {
  action: (state: EmailEstimateState, formData: FormData) => Promise<EmailEstimateState>;
  companyName: string;
  customerEmail?: string | null;
  customerName?: string | null;
  deleteAction: (state: EstimateMutationState, formData: FormData) => Promise<EstimateMutationState>;
  deleteRedirectTo?: string;
  deleteSnapshot?: DeleteEstimateSnapshot;
  editHref?: string | null;
  editLabel?: string;
  estimateId: string;
  estimateMessageAlign: "left" | "center" | "right";
  estimateMessageEnabled: boolean;
  estimateMessageText: string;
  estimateNumber: string;
  estimatedTotal: string;
  gmailConnected: boolean;
  gmailSenderEmail?: string | null;
  notice?: {
    message: string;
    type: "error" | "success";
  } | null;
  returnTo: string;
  templates?: DocumentEmailTemplate[];
  validThrough: string;
}) {
  const router = useRouter();
  const [result, setResult] = React.useState<EmailDeliveryResultValue | null>(null);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [estimateNoteOpen, setEstimateNoteOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const fallbackSubject = React.useMemo(
    () => `Estimate ${estimateNumber} from ${companyName}`,
    [companyName, estimateNumber],
  );
  const fallbackMessage = React.useMemo(
    () =>
      [
        `Hi ${customerName?.trim() || "there"},`,
        "",
        `Your estimate ${estimateNumber} from ${companyName} is attached as a PDF.`,
        `Estimated total: ${estimatedTotal}`,
        `Valid through: ${validThrough}`,
        "",
        "Please review the attached estimate at your convenience.",
        "",
        "Thank you.",
        companyName,
      ].join("\n"),
    [companyName, customerName, estimateNumber, estimatedTotal, validThrough],
  );
  const fallbackHtml = React.useMemo(
    () =>
      createEstimateMessageHtml({
        companyName,
        customerName,
        estimatedTotal,
        estimateNumber,
        validThrough,
      }),
    [companyName, customerName, estimateNumber, estimatedTotal, validThrough],
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
          <Link href={`/dashboard/estimates/${estimateId}/pdf`} prefetch={false}>
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
            <DropdownMenuLabel>Estimate actions</DropdownMenuLabel>
            <DropdownMenuItem className="sm:hidden" disabled={!customerEmail} onSelect={() => setEmailOpen(true)}>
              <Mail />
              Email estimate
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="sm:hidden">
              <Link href={`/dashboard/estimates/${estimateId}/pdf`} prefetch={false}>
                <Download />
                Download
              </Link>
            </DropdownMenuItem>
            {editHref ? (
              <DropdownMenuItem asChild>
                <Link href={editHref}>
                  <Pencil />
                  {editLabel}
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => setEstimateNoteOpen(true)}>
              <FilePenLine />
              Estimate note
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              <Trash2 />
              Delete estimate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DocumentMessageDialog
          action={updateDocumentMessageAction}
          align={estimateMessageAlign}
          documentType="estimate"
          enabled={estimateMessageEnabled}
          hideTrigger
          messageText={estimateMessageText}
          open={estimateNoteOpen}
          onOpenChange={setEstimateNoteOpen}
          returnTo={returnTo}
        />
        <DocumentEmailComposerDialog
          action={action}
          attachmentName={`${estimateNumber}.pdf`}
          defaultHtml={defaultHtml}
          defaultSubject={defaultSubject}
          defaultText={defaultMessage}
          details={[
            { label: "Estimate", value: estimateNumber },
            { label: "Recipient", value: customerEmail ?? "No email on file" },
            { label: "Customer", value: customerName ?? "No customer name" },
            { label: "Estimated total", value: estimatedTotal, tone: "estimate" },
            { label: "Valid through", value: validThrough },
          ]}
          documentId={estimateId}
          documentIdField="estimateId"
          documentLabel="estimate"
          gmailConnected={gmailConnected}
          hideTrigger
          open={emailOpen}
          onOpenChange={setEmailOpen}
          recipientEmail={customerEmail}
          returnTo={returnTo}
          senderEmail={gmailSenderEmail}
          templates={templates}
        />
        <DeleteEstimateButton
          action={deleteAction}
          estimateId={estimateId}
          hideTrigger
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          redirectTo={deleteRedirectTo}
          snapshot={deleteSnapshot}
        />
      </div>
      <EmailDeliveryResult result={result} onDone={() => setResult(null)} />
    </div>
  );
}

export function DeleteEstimateButton({
  action,
  estimateId,
  hideTrigger = false,
  onOpenChange,
  open: controlledOpen,
  redirectTo,
  snapshot,
}: {
  action: (state: EstimateMutationState, formData: FormData) => Promise<EstimateMutationState>;
  estimateId: string;
  hideTrigger?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  redirectTo?: string;
  snapshot?: DeleteEstimateSnapshot;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(action, deleteInitialState);
  const open = controlledOpen ?? uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange?.(nextOpen);
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen);
      }
    },
    [controlledOpen, onOpenChange],
  );

  React.useEffect(() => {
    if (!state.success) return;

    handleOpenChange(false);
    toast.success(state.message || "Estimate deleted.");
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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete estimate?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the estimate snapshot. You can create a new estimate from the job after updating details.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {snapshot ? (
          <dl className="grid gap-2 rounded-md border bg-muted/30 p-3">
            <DeleteSnapshotRow label="Estimate" value={snapshot.estimateNumber} />
            <DeleteSnapshotRow label="Customer" value={snapshot.customerName} />
            <DeleteSnapshotRow label="Job" value={snapshot.jobTitle} />
            <DeleteSnapshotRow label="Location" value={snapshot.serviceLocation} />
            <DeleteSnapshotRow label="Valid" value={snapshot.validThrough} />
            <DeleteSnapshotRow label="Total" value={snapshot.estimatedTotal} />
          </dl>
        ) : null}

        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={estimateId} />
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
            {isPending ? "Deleting..." : "Delete estimate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
