"use client";

import { useActionState, useState } from "react";

import { Check, Copy, CreditCard, Link2, Mail, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { escapeHtml } from "@/lib/email-content";

import { DocumentEmailComposerDialog } from "../../_components/document-email-composer-dialog";
import {
  createInvoicePaymentLinkAction,
  type PaymentLinkMutationState,
  revokeInvoicePaymentLinkAction,
} from "../actions";

const initialState: PaymentLinkMutationState = { success: false, message: "" };

type EmailInvoiceState = {
  success: boolean;
  message: string;
  reconnectRequired?: boolean;
  submittedAt?: number;
};

type PaymentLinkEmailOptions = {
  action: (state: EmailInvoiceState, formData: FormData) => Promise<EmailInvoiceState>;
  balanceDue: string;
  canManageGmailAccount: boolean;
  companyName: string;
  customerEmail?: string | null;
  customerName?: string | null;
  dueDate: string;
  gmailConnected: boolean;
  gmailSenderEmail?: string | null;
  invoiceNumber: string;
  returnTo: string;
};

function createPaymentLinkMessageHtml({
  balanceDue,
  companyName,
  customerName,
  dueDate,
  invoiceNumber,
  paymentUrl,
}: Omit<
  PaymentLinkEmailOptions,
  "action" | "canManageGmailAccount" | "customerEmail" | "gmailConnected" | "gmailSenderEmail" | "returnTo"
> & {
  paymentUrl: string;
}) {
  const safeBalanceDue = escapeHtml(balanceDue);
  const safeCompanyName = escapeHtml(companyName);
  const safeCustomerName = escapeHtml(customerName?.trim() || "there");
  const safeDueDate = escapeHtml(dueDate);
  const safeInvoiceNumber = escapeHtml(invoiceNumber);
  const safePaymentUrl = escapeHtml(paymentUrl);

  return [
    `<p>Hi ${safeCustomerName},</p>`,
    `<p>Your invoice <strong>${safeInvoiceNumber}</strong> from ${safeCompanyName} is ready to review. A PDF copy is also attached for your records.</p>`,
    `<p><strong>Balance due:</strong> ${safeBalanceDue}<br><strong>Due:</strong> ${safeDueDate}</p>`,
    `<p>Use the button below to view the invoice and available payment options.</p>`,
    `<p><a href="${safePaymentUrl}" style="display:inline-block;background-color:#111827;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">View invoice</a></p>`,
    "<p>If you have any questions, reply to this email and we will be happy to help.</p>",
    `<p>Thank you,<br><strong>${safeCompanyName}</strong></p>`,
  ].join("");
}

export function PaymentLinkDialog({
  invoiceId,
  existingLink,
  email,
  stripeReady,
}: {
  invoiceId: string;
  existingLink?: { id: string; createdAt: string; paymentUrl?: string | null } | null;
  email: PaymentLinkEmailOptions;
  stripeReady: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [paymentUrlForEmail, setPaymentUrlForEmail] = useState<string | null>(null);

  const defaultSubject = `Invoice ${email.invoiceNumber} from ${email.companyName}`;
  const defaultText = paymentUrlForEmail
    ? [
        `Hi ${email.customerName?.trim() || "there"},`,
        "",
        `Your invoice ${email.invoiceNumber} from ${email.companyName} is ready to review. A PDF copy is also attached for your records.`,
        "",
        `Balance due: ${email.balanceDue}`,
        `Due: ${email.dueDate}`,
        "",
        "View the invoice and available payment options:",
        paymentUrlForEmail,
        "",
        "If you have any questions, reply to this email and we will be happy to help.",
        "",
        "Thank you,",
        email.companyName,
      ].join("\n")
    : "";
  const defaultHtml = paymentUrlForEmail
    ? createPaymentLinkMessageHtml({
        balanceDue: email.balanceDue,
        companyName: email.companyName,
        customerName: email.customerName,
        dueDate: email.dueDate,
        invoiceNumber: email.invoiceNumber,
        paymentUrl: paymentUrlForEmail,
      })
    : "";

  function openEmailComposer(paymentUrl: string) {
    setPaymentUrlForEmail(paymentUrl);
    setOpen(false);
    setEmailOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Link2 /> Payment Link
          </Button>
        </DialogTrigger>
        {open ? (
          <PaymentLinkDialogContent
            invoiceId={invoiceId}
            existingLink={existingLink}
            customerEmail={email.customerEmail}
            onEmail={openEmailComposer}
            stripeReady={stripeReady}
          />
        ) : null}
      </Dialog>
      {paymentUrlForEmail ? (
        <DocumentEmailComposerDialog
          action={email.action}
          attachmentName={`${email.invoiceNumber}.pdf`}
          canManageGmailAccount={email.canManageGmailAccount}
          defaultHtml={defaultHtml}
          defaultSubject={defaultSubject}
          defaultText={defaultText}
          details={[
            { label: "Invoice", value: email.invoiceNumber },
            { label: "Recipient", value: email.customerEmail ?? "No email on file" },
            { label: "Customer", value: email.customerName ?? "No customer name" },
            { label: "Balance due", value: email.balanceDue, tone: "invoice" },
            { label: "Due date", value: email.dueDate },
          ]}
          documentId={invoiceId}
          documentIdField="invoiceId"
          documentLabel="invoice"
          gmailConnected={email.gmailConnected}
          hideTrigger
          open={emailOpen}
          onOpenChange={setEmailOpen}
          recipientEmail={email.customerEmail}
          returnTo={email.returnTo}
          senderEmail={email.gmailSenderEmail}
        />
      ) : null}
    </>
  );
}

function PaymentLinkDialogContent({
  invoiceId,
  existingLink,
  customerEmail,
  onEmail,
  stripeReady,
}: {
  invoiceId: string;
  existingLink?: { id: string; createdAt: string; paymentUrl?: string | null } | null;
  customerEmail?: string | null;
  onEmail: (paymentUrl: string) => void;
  stripeReady: boolean;
}) {
  const [createState, createAction, creating] = useActionState(createInvoicePaymentLinkAction, initialState);
  const [revokeState, revokeAction, revoking] = useActionState(revokeInvoicePaymentLinkAction, initialState);
  const [copied, setCopied] = useState(false);
  const linkDisabled = revokeState.success;
  const currentPaymentUrl = linkDisabled
    ? undefined
    : (createState.paymentUrl ?? existingLink?.paymentUrl ?? undefined);
  const activeLinkId = linkDisabled ? undefined : (createState.linkId ?? existingLink?.id);
  const hasActiveLink = Boolean(activeLinkId);

  async function copyLink() {
    if (!currentPaymentUrl) return;
    await navigator.clipboard.writeText(currentPaymentUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Invoice payment link</DialogTitle>
        <DialogDescription>Create a secure customer link for the current outstanding balance.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        {!stripeReady ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Connect and finish setting up Stripe on the Payments page before creating a payment link.
          </div>
        ) : null}

        {currentPaymentUrl ? (
          <div className="grid gap-2">
            <label htmlFor="invoice-payment-url" className="font-medium text-sm">
              Share this link
            </label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <Input id="invoice-payment-url" readOnly value={currentPaymentUrl} />
              <Button type="button" variant="outline" onClick={copyLink}>
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!customerEmail}
                title={customerEmail ? "Email this payment link" : "Add a customer email address first"}
                onClick={() => onEmail(currentPaymentUrl)}
              >
                <Mail /> Email
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              This encrypted link remains available here until it is replaced or disabled.
            </p>
          </div>
        ) : hasActiveLink ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950 text-sm dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
            <div className="font-medium">Upgrade this existing link</div>
            <div className="mt-1 text-muted-foreground text-xs">
              This link was created before recoverable links were introduced, so its original URL cannot be displayed.
              Replacing it will disable the old URL and create one you can copy again later.
            </div>
          </div>
        ) : null}

        {!linkDisabled ? (
          <form action={createAction}>
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <Button
              type="submit"
              disabled={!stripeReady || creating}
              className="w-full"
              variant={currentPaymentUrl ? "outline" : "default"}
            >
              <CreditCard />{" "}
              {creating
                ? currentPaymentUrl
                  ? "Replacing…"
                  : "Generating…"
                : currentPaymentUrl
                  ? "Replace link"
                  : hasActiveLink
                    ? "Replace with copyable link"
                    : "Generate payment link"}
            </Button>
          </form>
        ) : null}
        {createState.message ? (
          <p className={createState.success ? "text-emerald-700 text-sm" : "text-destructive text-sm"}>
            {createState.message}
          </p>
        ) : null}
      </div>

      {activeLinkId || revokeState.message ? (
        <DialogFooter>
          {activeLinkId ? (
            <form action={revokeAction}>
              <input type="hidden" name="invoiceId" value={invoiceId} />
              <input type="hidden" name="linkId" value={activeLinkId} />
              <Button type="submit" variant="ghost" disabled={revoking}>
                <Unlink /> {revoking ? "Disabling…" : "Disable payment link"}
              </Button>
            </form>
          ) : null}
          {revokeState.message ? (
            <span className={revokeState.success ? "text-emerald-700 text-sm" : "text-destructive text-sm"}>
              {revokeState.message}
            </span>
          ) : null}
        </DialogFooter>
      ) : null}
    </DialogContent>
  );
}
