"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { addDays, format } from "date-fns";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { getCompanyLogoSrc } from "@/lib/company-logo";
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

import { parseMaterials as parseJobMaterials } from "../jobs/_components/materials";
import { parsePricingItems } from "../jobs/_components/pricing-items";
import { renderEstimatePdfBuffer } from "./_lib/estimate-pdf";
import type { EstimateMutationState } from "./types";

const deleteEstimateSchema = z.object({
  id: z.string().trim().min(1, "Estimate is required."),
  redirectTo: z.string().trim().optional(),
});

const emailEstimateSchema = z.object({
  estimateId: z.string().trim().min(1, "Estimate is required."),
});

type EmailEstimateState = {
  success: boolean;
  message: string;
  reconnectRequired?: boolean;
  submittedAt?: number;
};

function createEmailEstimateState(success: boolean, message: string, reconnectRequired = false): EmailEstimateState {
  return {
    success,
    message,
    reconnectRequired,
    submittedAt: Date.now(),
  };
}

type EstimateLineItem = {
  description: string;
  quantity?: string;
  unit?: string;
  type?: "labor" | "material";
  unitPrice?: string;
  price: string;
};

function parseEstimateMaterials(value: string): EstimateLineItem[] {
  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((material) => ({
        description: String(material?.description ?? "").trim(),
        quantity: material?.quantity === undefined ? undefined : String(material.quantity).trim(),
        unit: material?.unit === undefined ? undefined : String(material.unit).trim(),
        unitPrice: material?.unitPrice === undefined ? undefined : String(material.unitPrice).trim(),
        price: String(material?.price ?? "0").trim(),
        type: material?.type === "labor" ? ("labor" as const) : ("material" as const),
      }))
      .filter((material) => material.description || material.price);
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

function createEstimateAttachmentEmailContent({
  companyName,
  customerName,
  estimateNumber,
  estimatedTotal,
  validThrough,
}: {
  companyName: string;
  customerName: string | null;
  estimateNumber: string;
  estimatedTotal: string;
  validThrough: Date;
}) {
  const subject = `Estimate ${estimateNumber} from ${companyName}`;
  const greetingName = customerName?.trim() || "there";
  const text = [
    `Hi ${greetingName},`,
    "",
    `Your estimate ${estimateNumber} from ${companyName} is attached as a PDF.`,
    `Estimated total: ${estimatedTotal}`,
    `Valid through: ${format(validThrough, "MMM d, yyyy")}`,
    "",
    "Please review the attached estimate at your convenience.",
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
          Your estimate <strong>${escapeHtml(estimateNumber)}</strong> from ${escapeHtml(companyName)} is attached as a PDF.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr>
            <td style="padding:8px 0;color:#594431;border-top:1px solid #eee7dd;">Estimated total</td>
            <td style="padding:8px 0;text-align:right;font-weight:700;border-top:1px solid #eee7dd;color:#0369a1;">${escapeHtml(estimatedTotal)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#594431;border-top:1px solid #eee7dd;">Valid through</td>
            <td style="padding:8px 0;text-align:right;font-weight:700;border-top:1px solid #eee7dd;">${format(validThrough, "MMM d, yyyy")}</td>
          </tr>
        </table>
        <p style="margin:0;color:#594431;font-size:13px;line-height:1.6;">
          Please review the attached estimate at your convenience. If you have any questions, reply to this email and we will be happy to help.
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

export async function emailEstimateAction(
  _previousState: EmailEstimateState,
  formData: FormData,
): Promise<EmailEstimateState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return createEmailEstimateState(false, "You must be signed in to email an estimate.");
  }

  const parsed = emailEstimateSchema.safeParse({
    estimateId: formData.get("estimateId"),
  });

  if (!parsed.success) {
    return createEmailEstimateState(false, parsed.error.issues[0]?.message ?? "Select an estimate and try again.");
  }

  const [estimate, googleMailAccount] = await Promise.all([
    prisma.estimate.findUnique({
      where: {
        id_ownerId: {
          id: parsed.data.estimateId,
          ownerId: currentUser.id,
        },
      },
      include: {
        estimateRecord: {
          include: {
            lead: true,
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

  if (!estimate) {
    return createEmailEstimateState(false, "Estimate could not be found.");
  }

  const estimateSequence = await prisma.estimate.count({
    where: {
      ownerId: currentUser.id,
      issuedAt: {
        lte: estimate.issuedAt,
      },
    },
  });
  const estimateNumber = estimate.estimateNumber ?? formatDocumentNumber("EST", estimateSequence);
  const emailRecordBase = {
    ownerId: currentUser.id,
    documentType: "estimate" as const,
    documentId: estimate.id,
    documentNumber: estimateNumber,
    documentTotal: estimate.estimatedTotal,
    recipientName: estimate.customerName,
    recipientEmail: estimate.customerEmail,
    senderEmail: googleMailAccount?.email,
  };

  if (!estimate.customerEmail) {
    await logEmailRecord({
      ...emailRecordBase,
      status: "error",
      errorMessage: "Add an email address to this customer before sending the estimate.",
    });

    return createEmailEstimateState(false, "Add an email address to this customer before sending the estimate.");
  }

  if (!googleMailAccount) {
    await logEmailRecord({
      ...emailRecordBase,
      status: "error",
      errorMessage: "Connect Gmail before emailing estimates.",
    });

    return createEmailEstimateState(false, "Connect Gmail before emailing estimates.", true);
  }

  let subject: string | undefined;

  try {
    const validThrough = addDays(estimate.issuedAt, currentUser.estimateValidDays);
    const snapshotMaterials = parseEstimateMaterials(estimate.materials);
    const laborItems = estimate.estimateRecord
      ? parsePricingItems(estimate.estimateRecord.laborItems)
      : snapshotMaterials.filter((item) => item.type === "labor");
    const materialItems = estimate.estimateRecord
      ? parseJobMaterials(estimate.estimateRecord.materials).map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          price: item.price,
        }))
      : snapshotMaterials.filter((item) => item.type !== "labor");
    const companyLogoSrc = await getCompanyLogoSrc(currentUser.id);
    const taxableItemsLabel = estimate.estimateRecord?.jobType === "Commercial" ? "labor + materials" : "materials";
    const emailContent = createEstimateAttachmentEmailContent({
      companyName: currentUser.companyName,
      customerName: estimate.customerName,
      estimatedTotal: formatMoney(estimate.estimatedTotal),
      estimateNumber,
      validThrough,
    });
    const submittedEmailContent = getSubmittedEmailContent(formData, emailContent);
    const pdfBuffer = await renderEstimatePdfBuffer({
      companyEmail: currentUser.companyEmail ?? currentUser.email,
      companyLogoSrc,
      companyName: currentUser.companyName,
      companyPhone: currentUser.companyPhone ? formatPhoneNumber(currentUser.companyPhone) : null,
      customerEmail: estimate.customerEmail,
      customerName: estimate.customerName,
      customerPhone: estimate.customerPhone ? formatPhoneNumber(estimate.customerPhone) : null,
      dateBegin: estimate.dateBegin,
      dateEnd: estimate.dateEnd,
      estimatedTotal: estimate.estimatedTotal,
      estimateNumber,
      issuedAt: estimate.issuedAt,
      jobDescription: estimate.jobDescription,
      jobTitle: estimate.jobTitle,
      laborCost: estimate.laborCost,
      laborItems,
      materialItems,
      materialTaxAmount: estimate.materialTaxAmount,
      materialTaxRate: estimate.materialTaxRate,
      materialsSubtotal: estimate.materialsSubtotal,
      serviceLocation: estimate.serviceLocation,
      taxableItemsLabel,
      validThrough,
    });
    const pdfFilename = `${estimateNumber.replace(/[^a-z0-9-]+/gi, "-")}.pdf`;
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
      to: estimate.customerEmail,
    });

    await logEmailRecord({
      ...emailRecordBase,
      senderEmail: googleMailAccount.email,
      subject,
      status: "success",
    });

    const statusUpdates = [];

    if (
      estimate.jobStatus === "Draft" ||
      estimate.jobStatus === "Ready to Send" ||
      estimate.jobStatus === "Estimate Provided"
    ) {
      statusUpdates.push(
        prisma.estimate.update({
          where: {
            id_ownerId: {
              id: estimate.id,
              ownerId: currentUser.id,
            },
          },
          data: {
            jobStatus: "Waiting on Customer",
          },
        }),
      );
    }

    if (
      estimate.estimateRecord?.status === "Draft" ||
      estimate.estimateRecord?.status === "Ready to Send" ||
      estimate.estimateRecord?.status === "Estimate Provided"
    ) {
      statusUpdates.push(
        prisma.estimateRecord.update({
          where: {
            id_ownerId: {
              id: estimate.estimateRecord.id,
              ownerId: currentUser.id,
            },
          },
          data: {
            status: "Waiting on Customer",
          },
        }),
      );
    }

    if (
      estimate.estimateRecord?.lead &&
      estimate.estimateRecord.lead.status !== "Won" &&
      estimate.estimateRecord.lead.status !== "Lost"
    ) {
      statusUpdates.push(
        prisma.lead.update({
          where: {
            id_ownerId: {
              id: estimate.estimateRecord.lead.id,
              ownerId: currentUser.id,
            },
          },
          data: {
            status: "Estimate Sent",
          },
        }),
      );
    }

    if (statusUpdates.length) {
      await prisma.$transaction(statusUpdates);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Estimate email could not be sent. Please try again.";
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

    return createEmailEstimateState(false, responseMessage, reconnectRequired);
  }

  revalidatePath("/dashboard/estimates");
  revalidatePath(`/dashboard/estimates/${estimate.id}`);
  revalidatePath("/dashboard/email-history");

  return createEmailEstimateState(true, `Estimate sent to ${estimate.customerEmail}.`);
}

export async function deleteEstimateAction(
  _previousState: EstimateMutationState,
  formData: FormData,
): Promise<EstimateMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to delete an estimate.",
    };
  }

  const parsed = deleteEstimateSchema.safeParse({
    id: formData.get("id"),
    redirectTo: formData.get("redirectTo"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select an estimate and try again.",
    };
  }

  try {
    await prisma.estimate.delete({
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
      message: "Estimate could not be deleted. Please try again.",
    };
  }

  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/estimates");

  if (parsed.data.redirectTo?.startsWith("/dashboard/")) {
    redirect(parsed.data.redirectTo);
  }

  return {
    success: true,
    message: "Estimate deleted.",
  };
}
