"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { addDays, format } from "date-fns";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { formatDocumentNumber } from "@/lib/document-number";
import { logEmailRecord } from "@/lib/email-records";
import {
  decryptGoogleToken,
  GMAIL_REFRESH_ERROR_MESSAGE,
  refreshGoogleAccessToken,
  sendGmailMessage,
} from "@/lib/google-mail";
import { prisma } from "@/lib/prisma";

import { parseMaterials as parseJobMaterials } from "../jobs/_components/materials";
import { parsePricingItems } from "../jobs/_components/pricing-items";
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

function formatDash(value?: string) {
  return value?.trim() ? value : "-";
}

function formatOptionalMoney(value?: string) {
  return value ? formatMoney(value) : "-";
}

function formatLineMeta(item: { quantity?: string; unit?: string; unitPrice?: string }) {
  return [
    item.quantity?.trim() ? `Qty: ${item.quantity}` : null,
    item.unit?.trim() ? `Unit: ${item.unit}` : null,
    item.unitPrice?.trim() ? `Rate: ${formatOptionalMoney(item.unitPrice)}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function formatMaybeDate(value: Date | null) {
  return value ? format(value, "MMM d, yyyy") : "Not scheduled";
}

function formatEstimateSchedule(dateBegin: Date | null, dateEnd: Date | null) {
  if (!dateBegin && !dateEnd) {
    return "Unscheduled";
  }

  return `Begin: ${formatMaybeDate(dateBegin)}${dateEnd ? `\nEnd: ${formatMaybeDate(dateEnd)}` : ""}`;
}

function formatPlainList(items: Array<string | null | false | undefined>) {
  return items.filter(Boolean).join("\n");
}

function renderDetailCard(title: string, rows: Array<string | null | false | undefined>) {
  return `<td class="detail-card-cell" style="width:50%;padding:0 6px 12px 0;vertical-align:top;">
    <div style="font-size:12px;font-weight:700;color:#171412;margin-bottom:8px;">${escapeHtml(title)}</div>
    <div style="min-height:56px;border:1px solid #e5ded3;background:#faf8f3;border-radius:8px;padding:10px;font-size:12px;line-height:1.55;color:#3d352f;">
      ${rows
        .filter(Boolean)
        .map((row, index) =>
          index === 0
            ? `<div style="font-weight:700;color:#171412;">${escapeHtml(String(row))}</div>`
            : `<div style="color:#594431;white-space:pre-line;">${escapeHtml(String(row)).replace(/\n/g, "<br />")}</div>`,
        )
        .join("")}
    </div>
  </td>`;
}

function renderAmountRow(label: string, value: string, options: { strong?: boolean } = {}) {
  return `<tr>
    <td style="padding:8px 0;color:${options.strong ? "#171412" : "#594431"};font-weight:${options.strong ? "700" : "400"};">${escapeHtml(label)}</td>
    <td style="padding:8px 0;text-align:right;font-weight:${options.strong ? "800" : "700"};color:${options.strong ? "#0369a1" : "#171412"};">${escapeHtml(value)}</td>
  </tr>`;
}

function createEstimateEmailContent({
  companyName,
  companyEmail,
  companyPhone,
  estimate,
  estimateNumber,
  laborItems,
  materialItems,
  validThrough,
}: {
  companyName: string;
  companyEmail: string;
  companyPhone: string | null;
  estimate: {
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    dateBegin: Date | null;
    dateEnd: Date | null;
    estimatedTotal: { toString: () => string };
    issuedAt: Date;
    jobDescription: string | null;
    jobTitle: string;
    materialTaxAmount: { toString: () => string };
    materialTaxRate: { toString: () => string };
    materialsSubtotal: { toString: () => string };
    serviceLocation: string | null;
  };
  estimateNumber: string;
  laborItems: EstimateLineItem[];
  materialItems: EstimateLineItem[];
  validThrough: Date;
}) {
  const subject = `Estimate ${estimateNumber} from ${companyName}`;
  const customerName = estimate.customerName ?? "there";
  const paymentAmount = Number(estimate.estimatedTotal.toString()) / 2;
  const text = [
    `Hello ${customerName},`,
    "",
    `Your estimate from ${companyName} is ready. The estimated total is ${formatMoney(
      estimate.estimatedTotal,
    )} and the estimate is valid through ${format(validThrough, "MMM d, yyyy")}.`,
    "If you have any questions about the estimate details, reply to this email and we will be happy to help.",
    "",
    `Estimate ${estimateNumber}`,
    `Issued: ${format(estimate.issuedAt, "MMM d, yyyy")}`,
    `Valid through: ${format(validThrough, "MMM d, yyyy")}`,
    "",
    "Prepared For",
    formatPlainList([estimate.customerName ?? "No customer on file", estimate.customerEmail, estimate.customerPhone]),
    "",
    `Job: ${estimate.jobTitle}`,
    `Schedule: ${formatEstimateSchedule(estimate.dateBegin, estimate.dateEnd)}`,
    `Service location: ${estimate.serviceLocation ?? "Not on file"}`,
    estimate.jobDescription ? `Description:\n${estimate.jobDescription}` : null,
    "",
    laborItems.length
      ? `Labor:\n${laborItems
          .map(
            (item) =>
              `- ${formatDash(item.description)} | Qty: ${formatDash(item.quantity)} | Unit: ${formatDash(item.unit)} | Rate: ${formatOptionalMoney(item.unitPrice)} | Amount: ${formatMoney(item.price || 0)}`,
          )
          .join("\n")}`
      : "Labor: No labor line items.",
    materialItems.length
      ? `Materials:\n${materialItems
          .map(
            (item) =>
              `- ${formatDash(item.description)} | Qty: ${formatDash(item.quantity)} | Unit: ${formatDash(item.unit)} | Rate: ${formatOptionalMoney(item.unitPrice)} | Amount: ${formatMoney(item.price || 0)}`,
          )
          .join("\n")}`
      : "Materials: No material line items.",
    "",
    `Materials subtotal: ${formatMoney(estimate.materialsSubtotal)}`,
    `Tax (${estimate.materialTaxRate.toString()}%): ${formatMoney(estimate.materialTaxAmount)}`,
    `Estimated total: ${formatMoney(estimate.estimatedTotal)}`,
    "",
    "Payment Schedule",
    `1st payment due before work begins: ${formatMoney(paymentAmount)}`,
    `2nd payment due when the job is completed: ${formatMoney(paymentAmount)}`,
    "Any additional work or materials not included in this estimate will be reviewed with the customer and billed as an extra charge.",
    `Please make all checks payable to: ${companyName}`,
    "",
    "Thank you for your business.",
    companyName,
  ]
    .filter(Boolean)
    .join("\n");

  const laborRows = laborItems.length
    ? laborItems
        .map(
          (item) => `<tr>
            <td style="padding:9px;border-top:1px solid #eee7dd;">
              <div>${escapeHtml(formatDash(item.description))}</div>
              ${
                formatLineMeta(item)
                  ? `<div style="margin-top:3px;color:#594431;font-size:11px;line-height:1.4;">${escapeHtml(formatLineMeta(item))}</div>`
                  : ""
              }
            </td>
            <td style="padding:9px;border-top:1px solid #eee7dd;text-align:right;font-weight:700;">${formatMoney(item.price || 0)}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="2" style="padding:10px;border-top:1px solid #eee7dd;color:#594431;">No labor line items.</td></tr>`;
  const materialRows = materialItems.length
    ? materialItems
        .map(
          (item) => `<tr>
            <td style="padding:9px;border-top:1px solid #eee7dd;">
              <div>${escapeHtml(formatDash(item.description))}</div>
              ${
                formatLineMeta(item)
                  ? `<div style="margin-top:3px;color:#594431;font-size:11px;line-height:1.4;">${escapeHtml(formatLineMeta(item))}</div>`
                  : ""
              }
            </td>
            <td style="padding:9px;border-top:1px solid #eee7dd;text-align:right;font-weight:700;">${formatMoney(item.price || 0)}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="2" style="padding:10px;border-top:1px solid #eee7dd;color:#594431;">No material line items.</td></tr>`;
  const html = `<!doctype html>
<html>
  <head>
    <style>
      @media only screen and (max-width: 600px) {
        .email-shell { padding: 16px 10px !important; }
        .email-card { padding: 16px !important; }
        .estimate-total-panel { width: 160px !important; }
        .estimate-total-amount { font-size: 21px !important; line-height: 1.1 !important; }
        .detail-card-cell { display: block !important; width: 100% !important; padding: 0 0 10px 0 !important; }
        .detail-card-row { display: block !important; width: 100% !important; }
        .estimate-summary-table { width: 100% !important; margin-left: 0 !important; box-sizing: border-box !important; }
      }
    </style>
  </head>
  <body style="margin:0;background:#f4f1eb;color:#171412;font-family:Arial,Helvetica,sans-serif;">
    <div class="email-shell" style="max-width:780px;margin:0 auto;padding:24px 16px;">
      <div style="background:#ffffff;border:1px solid #e4ddd2;border-radius:10px;padding:20px 22px;margin-bottom:16px;box-shadow:0 8px 24px rgba(23,20,18,0.05);">
        <p style="margin:0 0 10px;font-size:15px;color:#171412;">Hello ${escapeHtml(customerName)},</p>
        <p style="margin:0;color:#3d352f;font-size:14px;line-height:1.65;">
          Your estimate from ${escapeHtml(companyName)} is ready. The estimated total is
          <strong style="color:#0369a1;">${formatMoney(estimate.estimatedTotal)}</strong>, and this estimate is valid through
          ${format(validThrough, "MMM d, yyyy")}. Please review the details below at your convenience.
        </p>
        <p style="margin:12px 0 0;color:#594431;font-size:13px;line-height:1.6;">
          If you have any questions about the estimate, scope, timing, or pricing, reply to this email and we will be happy to help.
        </p>
      </div>
      <div class="email-card" style="background:#ffffff;border:1px solid #e4ddd2;border-radius:10px;padding:22px;box-shadow:0 8px 24px rgba(23,20,18,0.06);">
        <table style="width:100%;border-collapse:collapse;border-bottom:1px solid #e5ded3;padding-bottom:12px;margin-bottom:18px;">
          <tr>
            <td style="vertical-align:top;padding-bottom:16px;">
              <div style="font-size:19px;font-weight:800;line-height:1.1;">${escapeHtml(companyName)}</div>
              <div style="font-size:12px;color:#594431;margin-top:5px;">${escapeHtml(companyEmail)}</div>
              ${companyPhone ? `<div style="font-size:12px;color:#594431;margin-top:3px;">${escapeHtml(companyPhone)}</div>` : ""}
              <div style="font-size:20px;font-weight:800;margin-top:22px;">Estimate</div>
              <div style="font-size:12px;color:#594431;margin-top:8px;">Estimate #${escapeHtml(estimateNumber)}</div>
              <div style="font-size:12px;color:#594431;margin-top:3px;">Issued ${format(estimate.issuedAt, "MMM d, yyyy")}</div>
              <div style="font-size:12px;color:#594431;margin-top:3px;">Valid through ${format(validThrough, "MMM d, yyyy")}</div>
            </td>
            <td class="estimate-total-panel" style="width:210px;vertical-align:top;text-align:right;padding-bottom:16px;">
              <div style="border:1px solid #e5ded3;background:#faf8f3;border-radius:8px;padding:14px;">
                <div style="font-size:12px;color:#594431;">Estimated total</div>
                <div class="estimate-total-amount" style="font-size:27px;font-weight:800;color:#0369a1;margin-top:4px;">${formatMoney(estimate.estimatedTotal)}</div>
                <div style="font-size:12px;color:#594431;margin-top:4px;">valid through ${format(validThrough, "MMM d, yyyy")}</div>
              </div>
            </td>
          </tr>
        </table>

        <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
          <tr class="detail-card-row">
            ${renderDetailCard("Prepared For", [
              estimate.customerName ?? "No customer on file",
              estimate.customerEmail ?? "No email on file",
              estimate.customerPhone ?? "No phone on file",
            ])}
            ${renderDetailCard("Job", [estimate.jobTitle])}
          </tr>
          <tr class="detail-card-row">
            ${renderDetailCard("Schedule", [formatEstimateSchedule(estimate.dateBegin, estimate.dateEnd)])}
            ${renderDetailCard("Service Location", [estimate.serviceLocation ?? "Not on file"])}
          </tr>
        </table>

        ${
          estimate.jobDescription
            ? `<div style="margin:2px 0 18px;">
                <div style="font-size:12px;font-weight:700;margin-bottom:8px;">Job Description</div>
                <div style="border:1px solid #e5ded3;background:#faf8f3;border-radius:8px;padding:10px;font-size:12px;line-height:1.55;color:#3d352f;">${escapeHtml(estimate.jobDescription).replace(/\n/g, "<br />")}</div>
              </div>`
            : ""
        }

        <div style="font-size:12px;font-weight:700;margin:0 0 8px;">Labor</div>
        <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e5ded3;border-radius:8px;overflow:hidden;margin-bottom:18px;font-size:12px;">
          <tr style="background:#faf8f3;">
            <th style="padding:9px;text-align:left;border-bottom:1px solid #e5ded3;">Description</th>
            <th style="padding:9px;text-align:right;border-bottom:1px solid #e5ded3;">Amount</th>
          </tr>
          ${laborRows}
        </table>

        <div style="font-size:12px;font-weight:700;margin:0 0 8px;">Materials</div>
        <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e5ded3;border-radius:8px;overflow:hidden;margin-bottom:10px;font-size:12px;">
          <tr style="background:#faf8f3;">
            <th style="padding:9px;text-align:left;border-bottom:1px solid #e5ded3;">Description</th>
            <th style="padding:9px;text-align:right;border-bottom:1px solid #e5ded3;">Amount</th>
          </tr>
          ${materialRows}
        </table>

        <table class="estimate-summary-table" style="width:300px;margin-left:auto;border:1px solid #e5ded3;background:#faf8f3;border-radius:8px;padding:10px 14px;font-size:12px;margin-top:18px;">
          ${renderAmountRow("Materials subtotal", formatMoney(estimate.materialsSubtotal))}
          ${renderAmountRow(`Tax (${estimate.materialTaxRate.toString()}%)`, formatMoney(estimate.materialTaxAmount))}
          <tr><td colspan="2" style="border-top:1px solid #e5ded3;height:8px;"></td></tr>
          ${renderAmountRow("Estimated total", formatMoney(estimate.estimatedTotal), { strong: true })}
        </table>

        <div style="margin-top:18px;border:1px solid #e5ded3;background:#faf8f3;border-radius:8px;padding:12px;font-size:12px;line-height:1.6;color:#3d352f;">
          <div style="font-weight:800;color:#171412;margin-bottom:6px;">Payment Schedule</div>
          <div><span>1st payment due before work begins (half of estimate amount)</span><span style="float:right;font-weight:700;">${formatMoney(paymentAmount)}</span></div>
          <div><span>2nd payment due when the job is completed</span><span style="float:right;font-weight:700;">${formatMoney(paymentAmount)}</span></div>
          <div style="clear:both;border-top:1px solid #e5ded3;margin:10px 0;"></div>
          <div>Any additional work or materials not included in this estimate will be reviewed with the customer and billed as an extra charge.</div>
          <div style="font-weight:700;margin-top:8px;color:#171412;">Please make all checks payable to: ${escapeHtml(companyName)}</div>
          <div style="font-weight:800;margin-top:8px;color:#171412;">Thank you for your business!</div>
        </div>

        <div style="margin-top:22px;border-top:1px solid #e5ded3;padding-top:16px;color:#594431;font-size:12px;line-height:1.5;">
          Thank you,<br />
          <strong style="color:#171412;">${escapeHtml(companyName)}</strong>
        </div>
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
        estimateRecord: true,
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
  const estimateNumber = formatDocumentNumber("EST", estimateSequence);
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
    const emailContent = createEstimateEmailContent({
      companyName: currentUser.companyName,
      companyEmail: currentUser.companyEmail ?? currentUser.email,
      companyPhone: currentUser.companyPhone,
      estimate,
      estimateNumber,
      laborItems,
      materialItems,
      validThrough,
    });
    subject = emailContent.subject;
    const refreshToken = decryptGoogleToken(googleMailAccount.refreshTokenCipher);
    const accessToken = await refreshGoogleAccessToken(refreshToken);

    await sendGmailMessage(accessToken, {
      from: googleMailAccount.email,
      html: emailContent.html,
      subject: emailContent.subject,
      text: emailContent.text,
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

    if (statusUpdates.length) {
      await prisma.$transaction(statusUpdates);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Estimate email could not be sent. Please try again.";
    const reconnectRequired = message === GMAIL_REFRESH_ERROR_MESSAGE;

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

    return createEmailEstimateState(false, message, reconnectRequired);
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
