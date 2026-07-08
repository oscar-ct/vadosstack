"use client";

import * as React from "react";

import { escapeHtml } from "@/lib/email-content";
import type { DocumentEmailTemplate } from "@/lib/email-templates";

import { DocumentEmailComposerDialog } from "../../_components/document-email-composer-dialog";

type EmailOrderState = {
  success: boolean;
  message: string;
  reconnectRequired?: boolean;
  submittedAt?: number;
};

function createOrderMessageHtml({
  companyName,
  customerName,
  orderDate,
  orderNumber,
  orderTitle,
  orderTotal,
}: {
  companyName: string;
  customerName?: string | null;
  orderDate: string;
  orderNumber: string;
  orderTitle: string;
  orderTotal: string;
}) {
  const greetingName = customerName?.trim() || "there";

  return [
    `<p>Hi ${escapeHtml(greetingName)},</p>`,
    `<p>Your ${escapeHtml(orderTitle.toLowerCase())} <strong>${escapeHtml(orderNumber)}</strong> from ${escapeHtml(companyName)} is attached as a PDF.</p>`,
    `<p><span style="color:#18181b;font-size:22px"><strong>${escapeHtml(orderTotal)}</strong></span><br><span style="color:#52525b">Order total</span></p>`,
    `<p><strong>Order date:</strong> ${escapeHtml(orderDate)}</p>`,
    "<p>Please review the attached document at your convenience. If you have any questions, reply to this email and we will be happy to help.</p>",
    `<p>Thank you,<br><strong>${escapeHtml(companyName)}</strong></p>`,
  ].join("");
}

export function OrderActions({
  action,
  companyName,
  customerEmail,
  customerName,
  fulfillmentStatus,
  gmailConnected,
  gmailSenderEmail,
  orderDate,
  orderId,
  orderNumber,
  orderTitle,
  orderTotal,
  paymentStatus,
  returnTo,
  templates,
}: {
  action: (state: EmailOrderState, formData: FormData) => Promise<EmailOrderState>;
  companyName: string;
  customerEmail?: string | null;
  customerName?: string | null;
  fulfillmentStatus: string;
  gmailConnected: boolean;
  gmailSenderEmail?: string | null;
  orderDate: string;
  orderId: string;
  orderNumber: string;
  orderTitle: string;
  orderTotal: string;
  paymentStatus: string;
  returnTo: string;
  templates?: DocumentEmailTemplate[];
}) {
  const fallbackSubject = React.useMemo(
    () => `${orderTitle} ${orderNumber} from ${companyName}`,
    [companyName, orderNumber, orderTitle],
  );
  const fallbackMessage = React.useMemo(
    () =>
      [
        `Hi ${customerName?.trim() || "there"},`,
        "",
        `Your ${orderTitle.toLowerCase()} ${orderNumber} from ${companyName} is attached as a PDF.`,
        `Order total: ${orderTotal}`,
        `Order date: ${orderDate}`,
        "",
        "Please review the attached document at your convenience.",
        "",
        "Thank you.",
        companyName,
      ].join("\n"),
    [companyName, customerName, orderDate, orderNumber, orderTitle, orderTotal],
  );
  const fallbackHtml = React.useMemo(
    () =>
      createOrderMessageHtml({
        companyName,
        customerName,
        orderDate,
        orderNumber,
        orderTitle,
        orderTotal,
      }),
    [companyName, customerName, orderDate, orderNumber, orderTitle, orderTotal],
  );
  const defaultTemplate = templates?.[0];
  const defaultSubject = defaultTemplate?.subject ?? fallbackSubject;
  const defaultMessage = defaultTemplate?.bodyText ?? fallbackMessage;
  const defaultHtml = defaultTemplate?.bodyHtml ?? fallbackHtml;

  return (
    <DocumentEmailComposerDialog
      action={action}
      attachmentName={`${orderNumber}.pdf`}
      defaultHtml={defaultHtml}
      defaultSubject={defaultSubject}
      defaultText={defaultMessage}
      details={[
        { label: "Order", value: orderNumber },
        { label: "Recipient", value: customerEmail ?? "No email on file" },
        { label: "Customer", value: customerName ?? "No customer name" },
        { label: "Order total", value: orderTotal },
        { label: "Order date", value: orderDate },
        { label: "Payment", value: paymentStatus },
        { label: "Fulfillment", value: fulfillmentStatus },
      ]}
      documentId={orderId}
      documentIdField="orderId"
      documentLabel="order"
      gmailConnected={gmailConnected}
      recipientEmail={customerEmail}
      returnTo={returnTo}
      senderEmail={gmailSenderEmail}
      templates={templates}
    />
  );
}
