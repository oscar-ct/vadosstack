"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { addDays, format } from "date-fns";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { calculateOutstandingBalance } from "@/lib/customer-billing";
import { formatDocumentNumber } from "@/lib/document-number";
import { plainTextToEmailHtml, sanitizeEmailHtml } from "@/lib/email-content";
import { logEmailRecord } from "@/lib/email-records";
import {
  decryptGoogleToken,
  GMAIL_REFRESH_ERROR_MESSAGE,
  refreshGoogleAccessToken,
  sendGmailMessage,
} from "@/lib/google-mail";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

import { calculateSignedMaterialTotal } from "../jobs/_components/materials";
import { parsePricingItems } from "../jobs/_components/pricing-items";
import { renderInvoicePdfBuffer } from "./_lib/invoice-pdf";
import type { InvoiceMutationState } from "./types";

const invoiceJobSchema = z.object({
  jobId: z.string().trim().min(1, "Job is required."),
});

const deleteInvoiceSchema = z.object({
  id: z.string().trim().min(1, "Invoice is required."),
  redirectTo: z.string().trim().optional(),
});

const emailInvoiceSchema = z.object({
  invoiceId: z.string().trim().min(1, "Invoice is required."),
});

type EmailInvoiceState = {
  success: boolean;
  message: string;
  reconnectRequired?: boolean;
  submittedAt?: number;
};

function createEmailInvoiceState(success: boolean, message: string, reconnectRequired = false): EmailInvoiceState {
  return {
    success,
    message,
    reconnectRequired,
    submittedAt: Date.now(),
  };
}

type InvoiceMaterial = {
  description: string;
  type: "purchase" | "return";
  vendor: string;
  purchaseDate: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  price: string;
};

function parseInvoiceMaterials(value: string): InvoiceMaterial[] {
  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((material) => ({
        description: String(material?.description ?? "").trim(),
        type: material?.type === "return" ? ("return" as const) : ("purchase" as const),
        vendor: String(material?.vendor ?? "").trim(),
        purchaseDate: String(material?.purchaseDate ?? "").trim(),
        quantity: String(material?.quantity ?? "").trim(),
        unit: String(material?.unit ?? "").trim(),
        unitPrice: String(material?.unitPrice ?? "").trim(),
        price: String(material?.price ?? "").trim(),
      }))
      .filter((material) => material.description && material.price);
  } catch {
    return [];
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toMoney(value: { toString: () => string } | null | undefined) {
  return value?.toString() ?? "0";
}

function formatMoney(value: { toString: () => string } | string | number) {
  return `$${Number(value.toString()).toFixed(2)}`;
}

function getSubmittedEmailContent(formData: FormData, fallback: { html: string; subject: string; text: string }) {
  const subject = String(formData.get("subject") ?? "").trim() || fallback.subject;
  const text = String(formData.get("message") ?? "").trim() || fallback.text;
  const html = sanitizeEmailHtml(String(formData.get("html") ?? "").trim());

  return {
    html: html || (text === fallback.text ? fallback.html : plainTextToEmailHtml(text)),
    subject,
    text,
  };
}

function createInvoiceEmailContent({
  balanceDue,
  companyName,
  customerName,
  dueDate,
  invoiceNumber,
}: {
  balanceDue: string;
  companyName: string;
  customerName: string | null;
  dueDate: Date;
  invoiceNumber: string;
}) {
  const subject = `Invoice ${invoiceNumber} from ${companyName}`;
  const greetingName = customerName?.trim() || "there";
  const text = [
    `Hi ${greetingName},`,
    "",
    `Your invoice ${invoiceNumber} from ${companyName} is attached as a PDF.`,
    `Balance due: ${balanceDue}`,
    `Due: ${format(dueDate, "MMM d, yyyy")}`,
    "",
    "Please review the attached invoice at your convenience.",
    "",
    "Thank you.",
    companyName,
  ].join("\n");
  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f1eb;color:#171412;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
      <div style="background:#ffffff;border:1px solid #e4ddd2;border-radius:10px;padding:22px;box-shadow:0 8px 24px rgba(23,20,18,0.05);">
        <p style="margin:0 0 10px;font-size:15px;color:#171412;">Hello ${escapeHtml(greetingName)},</p>
        <p style="margin:0;color:#3d352f;font-size:14px;line-height:1.65;">
          Your invoice <strong>${escapeHtml(invoiceNumber)}</strong> from ${escapeHtml(companyName)} is attached as a PDF.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr>
            <td style="padding:8px 0;color:#594431;border-top:1px solid #eee7dd;">Balance due</td>
            <td style="padding:8px 0;text-align:right;font-weight:700;border-top:1px solid #eee7dd;color:#be123c;">${escapeHtml(balanceDue)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#594431;border-top:1px solid #eee7dd;">Due</td>
            <td style="padding:8px 0;text-align:right;font-weight:700;border-top:1px solid #eee7dd;">${format(dueDate, "MMM d, yyyy")}</td>
          </tr>
        </table>
        <p style="margin:0;color:#594431;font-size:13px;line-height:1.6;">
          Please review the attached invoice at your convenience. If you have any questions, reply to this email and we will be happy to help.
        </p>
        <p style="margin:18px 0 0;color:#3d352f;font-size:14px;line-height:1.6;">
          Thank you,<br />
          <strong>${escapeHtml(companyName)}</strong>
        </p>
      </div>
    </div>
  </body>
</html>`;

  return { html, subject, text };
}

export async function createInvoiceAction(
  _previousState: InvoiceMutationState,
  formData: FormData,
): Promise<InvoiceMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to create an invoice.",
    };
  }

  const parsed = invoiceJobSchema.safeParse({
    jobId: formData.get("jobId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select a job and try again.",
    };
  }

  let invoiceId: string;

  try {
    const job = await prisma.job.findUnique({
      where: {
        id_ownerId: {
          id: parsed.data.jobId,
          ownerId: currentUser.id,
        },
      },
      include: {
        customer: {
          include: {
            phoneNumbers: true,
          },
        },
        invoice: true,
      },
    });

    if (!job) {
      return {
        success: false,
        message: "Job could not be found.",
      };
    }

    if (job.invoice) {
      return {
        success: false,
        message: "This job already has an invoice. Delete the existing invoice before creating a new one.",
      };
    }

    if (!job.customerId) {
      return {
        success: false,
        message: "Add a customer to this job before creating an invoice.",
      };
    }

    if (Number(job.finalCost ?? 0) <= 0) {
      return {
        success: false,
        message: "Add billable totals before creating an invoice.",
      };
    }

    const materials = parseInvoiceMaterials(job.materials);
    const materialsSubtotal = materials.reduce(
      (total, material) => total + Number(calculateSignedMaterialTotal(material)),
      0,
    );
    const laborCost = Number(job.laborCost ?? 0);
    const materialTaxRate = Number(job.materialTaxRate ?? 0);
    const taxableSubtotal = materialsSubtotal + (job.jobType === "Commercial" ? laborCost : 0);
    const materialTaxAmount = taxableSubtotal * (materialTaxRate / 100);
    const balanceDue = calculateOutstandingBalance(job.status, job.finalCost?.toString(), job.amountPaid?.toString());
    const depositPaid = job.depositPaid?.toString() ?? "0";

    const invoice = await prisma.invoice.create({
      data: {
        ownerId: currentUser.id,
        jobId: job.id,
        customerId: job.customerId,
        customerName: job.customer?.name,
        customerEmail: job.customer?.email,
        customerPhone: job.customer?.phoneNumbers[0]?.value,
        jobTitle: job.description,
        jobDescription: job.scope,
        serviceLocation: job.serviceLocation,
        dateBegin: job.dateBegin,
        dateEnd: job.dateEnd,
        laborCost: toMoney(job.laborCost),
        materialTaxRate: toMoney(job.materialTaxRate),
        materials: JSON.stringify(materials),
        materialsSubtotal: materialsSubtotal.toFixed(2),
        materialTaxAmount: materialTaxAmount.toFixed(2),
        finalCost: toMoney(job.finalCost),
        depositPaid,
        amountPaid: toMoney(job.amountPaid),
        balanceDue: balanceDue.toFixed(2),
        paymentStatus: job.paymentStatus,
        jobStatus: job.status,
      },
    });
    invoiceId = invoice.id;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Invoice could not be created. Please try again.",
    };
  }

  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/invoices");
  redirect(`/dashboard/invoices/${invoiceId}?from=jobs`);
}

export async function emailInvoiceAction(
  _previousState: EmailInvoiceState,
  formData: FormData,
): Promise<EmailInvoiceState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return createEmailInvoiceState(false, "You must be signed in to email an invoice.");
  }

  const parsed = emailInvoiceSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
  });

  if (!parsed.success) {
    return createEmailInvoiceState(false, parsed.error.issues[0]?.message ?? "Select an invoice and try again.");
  }

  const [invoice, googleMailAccount] = await Promise.all([
    prisma.invoice.findUnique({
      where: {
        id_ownerId: {
          id: parsed.data.invoiceId,
          ownerId: currentUser.id,
        },
      },
      include: {
        job: {
          include: {
            payments: {
              orderBy: [{ paidOn: "asc" }, { createdAt: "asc" }],
            },
          },
        },
      },
    }),
    prisma.googleMailAccount.findUnique({
      where: {
        userId: currentUser.id,
      },
    }),
  ]);

  if (!invoice) {
    return createEmailInvoiceState(false, "Invoice could not be found.");
  }

  const invoiceSequence = await prisma.invoice.count({
    where: {
      ownerId: currentUser.id,
      issuedAt: {
        lte: invoice.issuedAt,
      },
    },
  });
  const invoiceNumber = formatDocumentNumber("INV", invoiceSequence);
  const emailRecordBase = {
    ownerId: currentUser.id,
    documentType: "invoice" as const,
    documentId: invoice.id,
    documentNumber: invoiceNumber,
    documentTotal: invoice.balanceDue,
    recipientName: invoice.customerName,
    recipientEmail: invoice.customerEmail,
    senderEmail: googleMailAccount?.email,
  };

  if (!invoice.customerEmail) {
    await logEmailRecord({
      ...emailRecordBase,
      status: "error",
      errorMessage: "Add an email address to this customer before sending the invoice.",
    });

    return createEmailInvoiceState(false, "Add an email address to this customer before sending the invoice.");
  }

  if (!googleMailAccount) {
    await logEmailRecord({
      ...emailRecordBase,
      status: "error",
      errorMessage: "Connect Gmail before emailing invoices.",
    });

    return createEmailInvoiceState(false, "Connect Gmail before emailing invoices.", true);
  }

  let subject: string | undefined;

  try {
    const dueDate = addDays(invoice.issuedAt, currentUser.invoiceDueDays);
    const laborItems = parsePricingItems(invoice.job.laborItems);
    const materials = parseInvoiceMaterials(invoice.materials);
    const companyLogoSrc = await getCompanyLogoSrc(currentUser.id);
    const taxableItemsLabel = invoice.job.jobType === "Commercial" ? "labor + materials" : "materials";
    const emailContent = createInvoiceEmailContent({
      balanceDue: formatMoney(invoice.balanceDue),
      companyName: currentUser.companyName,
      customerName: invoice.customerName,
      dueDate,
      invoiceNumber,
    });
    const submittedEmailContent = getSubmittedEmailContent(formData, emailContent);
    const pdfBuffer = await renderInvoicePdfBuffer({
      amountPaid: invoice.amountPaid,
      balanceDue: invoice.balanceDue,
      companyAddress: currentUser.companyAddress,
      companyEmail: currentUser.companyEmail ?? currentUser.email,
      companyLogoSrc,
      companyName: currentUser.companyName,
      companyPhone: currentUser.companyPhone ? formatPhoneNumber(currentUser.companyPhone) : null,
      customerEmail: invoice.customerEmail,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone ? formatPhoneNumber(invoice.customerPhone) : null,
      dateBegin: invoice.dateBegin,
      dateEnd: invoice.dateEnd,
      depositPaid: invoice.depositPaid,
      dueDate,
      finalCost: invoice.finalCost,
      invoiceNumber,
      issuedAt: invoice.issuedAt,
      jobDescription: invoice.jobDescription,
      jobTitle: invoice.jobTitle,
      laborCost: invoice.laborCost,
      laborItems,
      materialTaxAmount: invoice.materialTaxAmount,
      materialTaxRate: invoice.materialTaxRate,
      materials,
      materialsSubtotal: invoice.materialsSubtotal,
      payments: invoice.job.payments,
      serviceLocation: invoice.serviceLocation,
      taxableItemsLabel,
    });
    const pdfFilename = `${invoiceNumber.replace(/[^a-z0-9-]+/gi, "-")}.pdf`;
    subject = submittedEmailContent.subject;
    const refreshToken = decryptGoogleToken(googleMailAccount.refreshTokenCipher);
    const accessToken = await refreshGoogleAccessToken(refreshToken);

    await sendGmailMessage(accessToken, {
      attachments: [
        {
          content: pdfBuffer,
          contentType: "application/pdf",
          filename: pdfFilename,
        },
      ],
      from: googleMailAccount.email,
      html: submittedEmailContent.html,
      subject: submittedEmailContent.subject,
      text: submittedEmailContent.text,
      to: invoice.customerEmail,
    });

    await logEmailRecord({
      ...emailRecordBase,
      senderEmail: googleMailAccount.email,
      subject,
      status: "success",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invoice email could not be sent. Please try again.";
    const reconnectRequired = message === GMAIL_REFRESH_ERROR_MESSAGE;
    const responseMessage = reconnectRequired ? `${message} Please reconnect to continue.` : message;

    if (reconnectRequired) {
      await prisma.googleMailAccount.deleteMany({
        where: {
          userId: currentUser.id,
        },
      });
    }

    await logEmailRecord({
      ...emailRecordBase,
      senderEmail: googleMailAccount.email,
      subject,
      status: "error",
      errorMessage: message,
    });

    return createEmailInvoiceState(false, responseMessage, reconnectRequired);
  }

  revalidatePath("/dashboard/email-history");

  return createEmailInvoiceState(true, `Invoice sent to ${invoice.customerEmail}.`);
}

export async function deleteInvoiceAction(
  _previousState: InvoiceMutationState,
  formData: FormData,
): Promise<InvoiceMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to delete an invoice.",
    };
  }

  const parsed = deleteInvoiceSchema.safeParse({
    id: formData.get("id"),
    redirectTo: formData.get("redirectTo"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select an invoice and try again.",
    };
  }

  try {
    await prisma.invoice.delete({
      where: {
        id_ownerId: {
          id: parsed.data.id,
          ownerId: currentUser.id,
        },
      },
    });
  } catch {
    return {
      success: false,
      message: "Invoice could not be deleted. Please try again.",
    };
  }

  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/invoices");

  if (parsed.data.redirectTo?.startsWith("/dashboard/")) {
    redirect(parsed.data.redirectTo);
  }

  return {
    success: true,
    message: "Invoice deleted.",
  };
}
