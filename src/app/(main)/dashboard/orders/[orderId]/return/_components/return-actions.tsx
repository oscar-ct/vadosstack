"use client";

import * as React from "react";

import { escapeHtml } from "@/lib/email-content";
import type { DocumentEmailTemplate } from "@/lib/email-templates";

import { DocumentEmailComposerDialog } from "../../../../_components/document-email-composer-dialog";

type EmailReturnReceiptState = {
  message: string;
  reconnectRequired?: boolean;
  submittedAt?: number;
  success: boolean;
};

function createReturnReceiptHtml({
  companyName,
  customerName,
  refundAmount,
  returnDate,
  returnNumber,
}: {
  companyName: string;
  customerName?: string | null;
  refundAmount: string;
  returnDate: string;
  returnNumber: string;
}) {
  const greetingName = customerName?.trim() || "there";

  return [
    `<p>Hi ${escapeHtml(greetingName)},</p>`,
    `<p>Your return receipt <strong>${escapeHtml(returnNumber)}</strong> from ${escapeHtml(companyName)} is attached as a PDF.</p>`,
    `<p><span style="color:#18181b;font-size:22px"><strong>${escapeHtml(refundAmount)}</strong></span><br><span style="color:#52525b">Refund amount</span></p>`,
    `<p><strong>Return date:</strong> ${escapeHtml(returnDate)}</p>`,
    "<p>Please keep this for your records. If you have any questions, reply to this email and we will be happy to help.</p>",
    `<p>Thank you,<br><strong>${escapeHtml(companyName)}</strong></p>`,
  ].join("");
}

export function ReturnReceiptActions({
  action,
  companyName,
  customerEmail,
  customerName,
  gmailConnected,
  gmailSenderEmail,
  orderId,
  refundAmount,
  returnDate,
  returnNumber,
  returnTo,
  templates = [],
}: {
  action: (state: EmailReturnReceiptState, formData: FormData) => Promise<EmailReturnReceiptState>;
  companyName: string;
  customerEmail?: string | null;
  customerName?: string | null;
  gmailConnected: boolean;
  gmailSenderEmail?: string | null;
  orderId: string;
  refundAmount: string;
  returnDate: string;
  returnNumber: string;
  returnTo: string;
  templates?: DocumentEmailTemplate[];
}) {
  const defaultSubject = `Return Receipt ${returnNumber} from ${companyName}`;
  const defaultText = [
    `Hi ${customerName?.trim() || "there"},`,
    "",
    `Your return receipt ${returnNumber} from ${companyName} is attached as a PDF.`,
    `Refund amount: ${refundAmount}`,
    `Return date: ${returnDate}`,
    "",
    "Please keep this for your records.",
    "",
    "Thank you.",
    companyName,
  ].join("\n");
  const defaultHtml = React.useMemo(
    () =>
      createReturnReceiptHtml({
        companyName,
        customerName,
        refundAmount,
        returnDate,
        returnNumber,
      }),
    [companyName, customerName, refundAmount, returnDate, returnNumber],
  );

  return (
    <DocumentEmailComposerDialog
      action={action}
      attachmentName={`${returnNumber}.pdf`}
      defaultHtml={defaultHtml}
      defaultSubject={defaultSubject}
      defaultText={defaultText}
      details={[
        { label: "Return receipt", value: returnNumber },
        { label: "Recipient", value: customerEmail ?? "No email on file" },
        { label: "Customer", value: customerName ?? "No customer name" },
        { label: "Refund amount", value: refundAmount },
        { label: "Return date", value: returnDate },
      ]}
      documentId={orderId}
      documentIdField="orderId"
      documentLabel="return receipt"
      gmailConnected={gmailConnected}
      recipientEmail={customerEmail}
      returnTo={returnTo}
      senderEmail={gmailSenderEmail}
      templates={templates}
    />
  );
}
