"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { addDays, format } from "date-fns";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { calculateOutstandingBalance } from "@/lib/customer-billing";
import { formatDocumentNumber, parseTrackedDocumentNumber } from "@/lib/document-number";
import {
  allocateDocumentNumber,
  attachDocumentNumber,
  recalculateNextDocumentNumber,
  recordDocumentNumberEvent,
} from "@/lib/document-numbering";
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
  numberDisposition: z.enum(["release", "void"]).optional(),
  redirectTo: z.string().trim().optional(),
});

const updateInvoiceNumberSchema = z.object({
  id: z.string().trim().min(1, "Invoice is required."),
  invoiceNumber: z.string().trim().min(1, "Enter an invoice number."),
  neverShared: z.literal("true", { error: "Confirm that this invoice has never been shared." }),
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

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumberAssignment = await allocateDocumentNumber(tx, currentUser.id, "invoice");
      const createdInvoice = await tx.invoice.create({
        data: {
          ownerId: currentUser.id,
          invoiceNumber: invoiceNumberAssignment.documentNumber,
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
      await attachDocumentNumber(tx, invoiceNumberAssignment.assignmentId, createdInvoice.id);
      return createdInvoice;
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
  const invoiceNumber = invoice.invoiceNumber ?? formatDocumentNumber("INV", invoiceSequence);
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
    numberDisposition: formData.get("numberDisposition") || undefined,
    redirectTo: formData.get("redirectTo"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select an invoice and try again.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: {
          id_ownerId: {
            id: parsed.data.id,
            ownerId: currentUser.id,
          },
        },
        select: {
          amountPaid: true,
          id: true,
          invoiceNumber: true,
        },
      });

      if (!invoice) throw new Error("Invoice could not be found.");

      const [successfulEmailCount, assignment] = await Promise.all([
        tx.emailRecord.count({
          where: {
            documentId: invoice.id,
            documentType: "invoice",
            ownerId: currentUser.id,
            status: "success",
          },
        }),
        tx.documentNumberAssignment.findFirst({
          where: {
            documentId: invoice.id,
            ownerId: currentUser.id,
            status: "assigned",
            type: "invoice",
          },
        }),
      ]);
      const numberIsLocked = successfulEmailCount > 0 || Number(invoice.amountPaid) > 0;

      if (!numberIsLocked && !parsed.data.numberDisposition) {
        throw new Error("Choose whether to release or permanently void this invoice number.");
      }

      const canRelease = !numberIsLocked && parsed.data.numberDisposition === "release";
      const now = new Date();

      if (assignment) {
        await tx.documentNumberAssignment.update({
          where: { id: assignment.id },
          data: {
            deletedAt: now,
            status: canRelease ? "released" : "voided",
            voidedAt: canRelease ? null : now,
          },
        });
        await recordDocumentNumberEvent(tx, {
          action: canRelease ? "released" : "voided",
          detail: canRelease
            ? "Unissued invoice deleted and its number released."
            : "Invoice deleted without releasing its number.",
          documentId: invoice.id,
          documentNumber: assignment.documentNumber,
          ownerId: currentUser.id,
          sequenceNumber: assignment.sequenceNumber,
          type: "invoice",
        });
      }

      await tx.invoice.delete({
        where: {
          id_ownerId: {
            id: invoice.id,
            ownerId: currentUser.id,
          },
        },
      });
      await recalculateNextDocumentNumber(tx, currentUser.id, "invoice");
    });
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Invoice could not be deleted. Please try again.",
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

export async function updateInvoiceNumberAction(
  _previousState: InvoiceMutationState,
  formData: FormData,
): Promise<InvoiceMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to edit an invoice number.",
    };
  }

  const parsed = updateInvoiceNumberSchema.safeParse({
    id: formData.get("id"),
    invoiceNumber: formData.get("invoiceNumber"),
    neverShared: formData.get("neverShared"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the invoice number and try again.",
    };
  }

  const requestedNumber = parseTrackedDocumentNumber("invoice", parsed.data.invoiceNumber);

  if (!requestedNumber) {
    return {
      success: false,
      message: "Use the invoice format INV followed by a number, such as INV0010.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: {
          id_ownerId: {
            id: parsed.data.id,
            ownerId: currentUser.id,
          },
        },
        select: {
          amountPaid: true,
          id: true,
          invoiceNumber: true,
        },
      });

      if (!invoice?.invoiceNumber) throw new Error("Invoice could not be found.");

      const currentNumber = parseTrackedDocumentNumber("invoice", invoice.invoiceNumber);

      if (!currentNumber) throw new Error("This invoice does not use the managed invoice number format.");
      if (requestedNumber.sequenceNumber === currentNumber.sequenceNumber) {
        throw new Error("Enter a different released invoice number.");
      }
      if (requestedNumber.sequenceNumber > currentNumber.sequenceNumber) {
        throw new Error("Choose a previously released invoice number below the current number.");
      }

      const successfulEmailCount = await tx.emailRecord.count({
        where: {
          documentId: invoice.id,
          documentType: "invoice",
          ownerId: currentUser.id,
          status: "success",
        },
      });

      if (successfulEmailCount > 0) {
        throw new Error("This invoice number is locked because the invoice was emailed successfully.");
      }

      if (Number(invoice.amountPaid) > 0) {
        throw new Error("This invoice number is locked because a payment or deposit has been recorded.");
      }

      const [currentAssignment, requestedAssignment, blockingAssignment] = await Promise.all([
        tx.documentNumberAssignment.findUnique({
          where: {
            ownerId_type_sequenceNumber: {
              ownerId: currentUser.id,
              sequenceNumber: currentNumber.sequenceNumber,
              type: "invoice",
            },
          },
        }),
        tx.documentNumberAssignment.findUnique({
          where: {
            ownerId_type_sequenceNumber: {
              ownerId: currentUser.id,
              sequenceNumber: requestedNumber.sequenceNumber,
              type: "invoice",
            },
          },
        }),
        tx.documentNumberAssignment.findFirst({
          where: {
            ownerId: currentUser.id,
            sequenceNumber: {
              gt: requestedNumber.sequenceNumber,
              lt: currentNumber.sequenceNumber,
            },
            status: { not: "released" },
            type: "invoice",
          },
          orderBy: { sequenceNumber: "asc" },
        }),
      ]);

      if (
        !currentAssignment ||
        currentAssignment.documentId !== invoice.id ||
        currentAssignment.status !== "assigned"
      ) {
        throw new Error("The current invoice number assignment could not be verified.");
      }

      if (!requestedAssignment || requestedAssignment.status !== "released") {
        throw new Error("That invoice number is not available for reuse.");
      }

      if (blockingAssignment) {
        throw new Error(
          `${blockingAssignment.documentNumber} is still reserved. Only the released end of the invoice sequence can be reclaimed.`,
        );
      }

      const now = new Date();

      await tx.invoice.update({
        where: {
          id_ownerId: {
            id: invoice.id,
            ownerId: currentUser.id,
          },
        },
        data: { invoiceNumber: requestedNumber.documentNumber },
      });
      await tx.documentNumberAssignment.update({
        where: { id: currentAssignment.id },
        data: {
          deletedAt: now,
          status: "released",
          voidedAt: null,
        },
      });
      await tx.documentNumberAssignment.update({
        where: { id: requestedAssignment.id },
        data: {
          assignedAt: now,
          deletedAt: null,
          documentId: invoice.id,
          status: "assigned",
          voidedAt: null,
        },
      });
      await recordDocumentNumberEvent(tx, {
        action: "released",
        detail: `Invoice reassigned to ${requestedNumber.documentNumber}.`,
        documentId: invoice.id,
        documentNumber: currentAssignment.documentNumber,
        ownerId: currentUser.id,
        sequenceNumber: currentAssignment.sequenceNumber,
        type: "invoice",
      });
      await recordDocumentNumberEvent(tx, {
        action: "reassigned",
        detail: `Invoice reassigned from ${currentAssignment.documentNumber}.`,
        documentId: invoice.id,
        documentNumber: requestedAssignment.documentNumber,
        ownerId: currentUser.id,
        sequenceNumber: requestedAssignment.sequenceNumber,
        type: "invoice",
      });
      await recalculateNextDocumentNumber(tx, currentUser.id, "invoice");
    });
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Invoice number could not be changed. Please try again.",
    };
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${parsed.data.id}`);

  return {
    success: true,
    message: `Invoice number changed to ${requestedNumber.documentNumber}.`,
  };
}
