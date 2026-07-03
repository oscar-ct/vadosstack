"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Download, Trash2 } from "lucide-react";
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
  const defaultSubject = React.useMemo(
    () => `Estimate ${estimateNumber} from ${companyName}`,
    [companyName, estimateNumber],
  );
  const defaultMessage = React.useMemo(
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
  const defaultHtml = React.useMemo(
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
          <Link href={`/dashboard/estimates/${estimateId}/pdf`} prefetch={false}>
            <Download />
            Download PDF
          </Link>
        </Button>
        <DocumentMessageDialog
          action={updateDocumentMessageAction}
          align={estimateMessageAlign}
          documentType="estimate"
          enabled={estimateMessageEnabled}
          messageText={estimateMessageText}
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

export function DeleteEstimateButton({
  action,
  estimateId,
  redirectTo,
}: {
  action: (state: EstimateMutationState, formData: FormData) => Promise<EstimateMutationState>;
  estimateId: string;
  redirectTo?: string;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(action, deleteInitialState);

  React.useEffect(() => {
    if (!state.success) return;

    setOpen(false);
    toast.success(state.message || "Estimate deleted.");
    if (redirectTo) {
      router.replace(redirectTo);
      return;
    }

    router.refresh();
  }, [redirectTo, router, state]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm">
          <Trash2 />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete estimate?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the estimate snapshot. You can create a new estimate from the job after updating details.
          </AlertDialogDescription>
        </AlertDialogHeader>

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
