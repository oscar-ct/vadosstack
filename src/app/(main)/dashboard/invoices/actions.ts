"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { addDays, format } from "date-fns";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { calculateOutstandingBalance } from "@/lib/customer-billing";
import { formatDocumentNumber } from "@/lib/document-number";
import { decryptGoogleToken, refreshGoogleAccessToken, sendGmailMessage } from "@/lib/google-mail";
import { prisma } from "@/lib/prisma";

import { calculateSignedMaterialTotal } from "../jobs/_components/materials";
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
};

type InvoiceMaterial = {
  description: string;
  type: "purchase" | "return";
  vendor: string;
  purchaseDate: string;
  quantity: string;
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
        unitPrice: String(material?.unitPrice ?? material?.price ?? "").trim(),
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

function formatMaybeDate(value: Date | null) {
  return value ? format(value, "MMM d, yyyy") : "Not scheduled";
}

function formatMaterialDate(value: string) {
  if (!value) return "";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "MMM d, yyyy");
}

function formatPlainList(items: Array<string | null | false | undefined>) {
  return items.filter(Boolean).join("\n");
}

function renderDetailCard(title: string, rows: Array<string | null | false | undefined>) {
  return `<td style="width:50%;padding:0 6px 12px 0;vertical-align:top;">
    <div style="font-size:12px;font-weight:700;color:#171412;margin-bottom:8px;">${escapeHtml(title)}</div>
    <div style="min-height:56px;border:1px solid #e5ded3;background:#faf8f3;border-radius:8px;padding:10px;font-size:12px;line-height:1.55;color:#3d352f;">
      ${rows
        .filter(Boolean)
        .map((row, index) =>
          index === 0
            ? `<div style="font-weight:700;color:#171412;">${escapeHtml(String(row))}</div>`
            : `<div style="color:#594431;">${escapeHtml(String(row))}</div>`,
        )
        .join("")}
    </div>
  </td>`;
}

function renderAmountRow(label: string, value: string, options: { strong?: boolean } = {}) {
  return `<tr>
    <td style="padding:8px 0;color:${options.strong ? "#171412" : "#594431"};font-weight:${options.strong ? "700" : "400"};">${escapeHtml(label)}</td>
    <td style="padding:8px 0;text-align:right;font-weight:${options.strong ? "800" : "700"};color:${options.strong ? "#be123c" : "#171412"};">${escapeHtml(value)}</td>
  </tr>`;
}

function createInvoiceEmailContent({
  companyName,
  companyEmail,
  companyPhone,
  dueDate,
  invoice,
  invoiceNumber,
  materials,
  payments,
}: {
  companyName: string;
  companyEmail: string;
  companyPhone: string | null;
  dueDate: Date;
  invoice: {
    amountPaid: { toString: () => string };
    balanceDue: { toString: () => string };
    customerName: string | null;
    finalCost: { toString: () => string };
    issuedAt: Date;
    customerEmail: string | null;
    customerPhone: string | null;
    dateBegin: Date | null;
    dateEnd: Date | null;
    jobDescription: string | null;
    jobStatus: string;
    jobTitle: string;
    laborCost: { toString: () => string };
    materialTaxRate: { toString: () => string };
    materialTaxAmount: { toString: () => string };
    materialsSubtotal: { toString: () => string };
    serviceLocation: string | null;
  };
  invoiceNumber: string;
  materials: InvoiceMaterial[];
  payments: Array<{
    amount: { toString: () => string };
    description: string;
    method: string;
    paidOn: Date;
  }>;
}) {
  const subject = `Invoice ${invoiceNumber} from ${companyName}`;
  const customerName = invoice.customerName ?? "there";
  const purchaseMaterials = materials.filter((material) => material.type !== "return");
  const returnMaterials = materials.filter((material) => material.type === "return");
  const returnTotal = returnMaterials.reduce((total, material) => total + Number(material.price || 0), 0);
  const text = [
    `Hi ${customerName},`,
    "",
    `Invoice ${invoiceNumber} from ${companyName}`,
    `Issued: ${format(invoice.issuedAt, "MMM d, yyyy")}`,
    `Due: ${format(dueDate, "MMM d, yyyy")}`,
    `Balance due: ${formatMoney(invoice.balanceDue)}`,
    "",
    "Bill To",
    formatPlainList([invoice.customerName ?? "No customer on file", invoice.customerEmail, invoice.customerPhone]),
    "",
    `Job: ${invoice.jobTitle}`,
    `Status: ${invoice.jobStatus}`,
    `Start: ${formatMaybeDate(invoice.dateBegin)}`,
    `End: ${formatMaybeDate(invoice.dateEnd)}`,
    `Service location: ${invoice.serviceLocation ?? "Not on file"}`,
    invoice.jobDescription ? `Description:\n${invoice.jobDescription}` : null,
    "",
    `Labor: ${formatMoney(invoice.laborCost)}`,
    purchaseMaterials.length
      ? `Materials:\n${purchaseMaterials
          .map((material) => `- ${material.description}: ${formatMoney(material.price || 0)}`)
          .join("\n")}`
      : "Materials: No material line items.",
    returnMaterials.length
      ? `Returns:\n${returnMaterials
          .map((material) => `- ${material.description}: -${formatMoney(material.price || 0)}`)
          .join("\n")}`
      : null,
    `Net materials: ${formatMoney(invoice.materialsSubtotal)}`,
    `Tax (${invoice.materialTaxRate.toString()}%): ${formatMoney(invoice.materialTaxAmount)}`,
    payments.length
      ? `Transaction History:\n${payments
          .map(
            (payment) =>
              `- ${format(payment.paidOn, "MMM d, yyyy")} ${payment.description} (${payment.method}): ${formatMoney(payment.amount)}`,
          )
          .join("\n")}`
      : "Transaction History: No payments recorded yet.",
    "",
    `Final cost: ${formatMoney(invoice.finalCost)}`,
    `Amount paid: ${formatMoney(invoice.amountPaid)}`,
    `Balance due: ${formatMoney(invoice.balanceDue)}`,
    "",
    invoice.jobDescription ? `Notes:\n${invoice.jobDescription}` : null,
    "",
    "Thank you.",
    companyName,
  ]
    .filter(Boolean)
    .join("\n");

  const purchaseRows = purchaseMaterials.length
    ? purchaseMaterials
        .map(
          (material) => `<tr>
            <td style="padding:8px;border-top:1px solid #eee7dd;">${escapeHtml(material.description)}</td>
            <td style="padding:8px;border-top:1px solid #eee7dd;color:#594431;">${escapeHtml(formatMaterialDate(material.purchaseDate) || "-")}</td>
            <td style="padding:8px;border-top:1px solid #eee7dd;color:#594431;">${escapeHtml(material.vendor || "-")}</td>
            <td style="padding:8px;border-top:1px solid #eee7dd;text-align:right;">${escapeHtml(material.quantity || "-")}</td>
            <td style="padding:8px;border-top:1px solid #eee7dd;text-align:right;">${material.unitPrice ? formatMoney(material.unitPrice) : "-"}</td>
            <td style="padding:8px;border-top:1px solid #eee7dd;text-align:right;font-weight:700;">${formatMoney(material.price || 0)}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="6" style="padding:10px;border-top:1px solid #eee7dd;color:#594431;">No material line items.</td></tr>`;
  const returnRows = returnMaterials
    .map(
      (material) => `<tr>
        <td style="padding:8px;border-top:1px solid #eee7dd;color:#594431;">${escapeHtml(formatMaterialDate(material.purchaseDate) || "-")}</td>
        <td style="padding:8px;border-top:1px solid #eee7dd;color:#594431;">${escapeHtml(material.vendor || "-")}</td>
        <td style="padding:8px;border-top:1px solid #eee7dd;">${escapeHtml(material.description)}</td>
        <td style="padding:8px;border-top:1px solid #eee7dd;text-align:right;font-weight:700;">-${formatMoney(material.price || 0)}</td>
      </tr>`,
    )
    .join("");
  const paymentRows = payments.length
    ? payments
        .map(
          (payment) => `<tr>
            <td style="padding:8px;border-top:1px solid #eee7dd;">${format(payment.paidOn, "MMM d, yyyy")}</td>
            <td style="padding:8px;border-top:1px solid #eee7dd;">${escapeHtml(payment.description)}</td>
            <td style="padding:8px;border-top:1px solid #eee7dd;color:#594431;">${escapeHtml(payment.method)}</td>
            <td style="padding:8px;border-top:1px solid #eee7dd;text-align:right;font-weight:700;">${formatMoney(payment.amount)}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" style="padding:10px;border-top:1px solid #eee7dd;color:#594431;">No payments recorded yet.</td></tr>`;
  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f1eb;color:#171412;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:780px;margin:0 auto;padding:24px 16px;">
      <div style="background:#ffffff;border:1px solid #e4ddd2;border-radius:10px;padding:20px 22px;margin-bottom:16px;box-shadow:0 8px 24px rgba(23,20,18,0.05);">
        <p style="margin:0 0 10px;font-size:15px;color:#171412;">Hello ${escapeHtml(customerName)},</p>
        <p style="margin:0;color:#3d352f;font-size:14px;line-height:1.65;">
          Your invoice from ${escapeHtml(companyName)} is ready and has a balance due of
          <strong style="color:#be123c;">${formatMoney(invoice.balanceDue)}</strong> by ${format(dueDate, "MMM d, yyyy")}.
          Please review the details below at your convenience.
        </p>
        <p style="margin:12px 0 0;color:#594431;font-size:13px;line-height:1.6;">
          If you have any questions about the work completed, payment status, or invoice details, reply to this email
          and we will be happy to help.
        </p>
      </div>
      <div style="background:#ffffff;border:1px solid #e4ddd2;border-radius:10px;padding:22px;box-shadow:0 8px 24px rgba(23,20,18,0.06);">
        <table style="width:100%;border-collapse:collapse;border-bottom:1px solid #e5ded3;padding-bottom:12px;margin-bottom:18px;">
          <tr>
            <td style="vertical-align:top;padding-bottom:16px;">
              <div style="font-size:19px;font-weight:800;line-height:1.1;">${escapeHtml(companyName)}</div>
              <div style="font-size:12px;color:#594431;margin-top:5px;">${escapeHtml(companyEmail)}</div>
              ${companyPhone ? `<div style="font-size:12px;color:#594431;margin-top:3px;">${escapeHtml(companyPhone)}</div>` : ""}
              <div style="font-size:20px;font-weight:800;margin-top:22px;">Invoice</div>
              <div style="font-size:12px;color:#594431;margin-top:8px;">Invoice #${escapeHtml(invoiceNumber)}</div>
              <div style="font-size:12px;color:#594431;margin-top:3px;">Issued ${format(invoice.issuedAt, "MMM d, yyyy")}</div>
            </td>
            <td style="width:190px;vertical-align:top;text-align:right;padding-bottom:16px;">
              <div style="border:1px solid #e5ded3;background:#faf8f3;border-radius:8px;padding:14px;">
                <div style="font-size:12px;color:#594431;">Balance due</div>
                <div style="font-size:27px;font-weight:800;color:#be123c;margin-top:4px;">${formatMoney(invoice.balanceDue)}</div>
                <div style="font-size:12px;color:#594431;margin-top:4px;">by ${format(dueDate, "MMM d, yyyy")}</div>
              </div>
            </td>
          </tr>
        </table>

        <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
          <tr>
            ${renderDetailCard("Bill To", [
              invoice.customerName ?? "No customer on file",
              invoice.customerEmail ?? "No email on file",
              invoice.customerPhone ?? "No phone on file",
            ])}
            ${renderDetailCard("Job", [invoice.jobTitle, `Status: ${invoice.jobStatus}`])}
          </tr>
          <tr>
            ${renderDetailCard("Schedule", [
              `Start: ${formatMaybeDate(invoice.dateBegin)}`,
              `End: ${formatMaybeDate(invoice.dateEnd)}`,
            ])}
            ${renderDetailCard("Service Location", [invoice.serviceLocation ?? "Not on file"])}
          </tr>
        </table>

        ${
          invoice.jobDescription
            ? `<div style="margin:2px 0 18px;">
                <div style="font-size:12px;font-weight:700;margin-bottom:8px;">Job Description</div>
                <div style="border:1px solid #e5ded3;background:#faf8f3;border-radius:8px;padding:10px;font-size:12px;line-height:1.55;color:#3d352f;">${escapeHtml(invoice.jobDescription).replace(/\n/g, "<br />")}</div>
              </div>`
            : ""
        }

        <div style="font-size:12px;font-weight:700;margin:0 0 8px;">Labor</div>
        <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e5ded3;border-radius:8px;overflow:hidden;margin-bottom:18px;font-size:12px;">
          <tr style="background:#faf8f3;">
            <th style="padding:9px;text-align:left;border-bottom:1px solid #e5ded3;">Description</th>
            <th style="padding:9px;text-align:right;border-bottom:1px solid #e5ded3;">Amount</th>
          </tr>
          <tr>
            <td style="padding:9px;">Labor</td>
            <td style="padding:9px;text-align:right;font-weight:700;">${formatMoney(invoice.laborCost)}</td>
          </tr>
        </table>

        <div style="font-size:12px;font-weight:700;margin:0 0 8px;">Materials</div>
        <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e5ded3;border-radius:8px;overflow:hidden;margin-bottom:10px;font-size:12px;">
          <tr style="background:#faf8f3;">
            <th style="padding:9px;text-align:left;border-bottom:1px solid #e5ded3;">Description</th>
            <th style="padding:9px;text-align:left;border-bottom:1px solid #e5ded3;">Date</th>
            <th style="padding:9px;text-align:left;border-bottom:1px solid #e5ded3;">Vendor</th>
            <th style="padding:9px;text-align:right;border-bottom:1px solid #e5ded3;">Qty</th>
            <th style="padding:9px;text-align:right;border-bottom:1px solid #e5ded3;">Rate</th>
            <th style="padding:9px;text-align:right;border-bottom:1px solid #e5ded3;">Amount</th>
          </tr>
          ${purchaseRows}
        </table>

        ${
          returnRows
            ? `<table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e5ded3;border-radius:8px;overflow:hidden;margin-bottom:10px;font-size:12px;">
                <tr style="background:#faf8f3;">
                  <th style="padding:9px;text-align:left;border-bottom:1px solid #e5ded3;">Date</th>
                  <th style="padding:9px;text-align:left;border-bottom:1px solid #e5ded3;">Vendor</th>
                  <th style="padding:9px;text-align:left;border-bottom:1px solid #e5ded3;">Returns</th>
                  <th style="padding:9px;text-align:right;border-bottom:1px solid #e5ded3;">Amount</th>
                </tr>
                ${returnRows}
              </table>`
            : ""
        }

        <table style="width:270px;margin-left:auto;border:1px solid #e5ded3;background:#faf8f3;border-radius:8px;padding:8px 12px;font-size:12px;margin-bottom:18px;">
          ${returnMaterials.length ? renderAmountRow("Minus returns", `-${formatMoney(returnTotal)}`) : ""}
          ${renderAmountRow("Net materials", formatMoney(invoice.materialsSubtotal))}
          ${renderAmountRow(`Tax (${invoice.materialTaxRate.toString()}%)`, formatMoney(invoice.materialTaxAmount))}
        </table>

        <div style="font-size:12px;font-weight:700;margin:0 0 8px;">Transaction History</div>
        <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e5ded3;border-radius:8px;overflow:hidden;margin-bottom:18px;font-size:12px;">
          <tr style="background:#faf8f3;">
            <th style="padding:9px;text-align:left;border-bottom:1px solid #e5ded3;">Date</th>
            <th style="padding:9px;text-align:left;border-bottom:1px solid #e5ded3;">Description</th>
            <th style="padding:9px;text-align:left;border-bottom:1px solid #e5ded3;">Method</th>
            <th style="padding:9px;text-align:right;border-bottom:1px solid #e5ded3;">Amount</th>
          </tr>
          ${paymentRows}
        </table>

        <table style="width:300px;margin-left:auto;border:1px solid #e5ded3;background:#faf8f3;border-radius:8px;padding:10px 14px;font-size:12px;">
          ${renderAmountRow("Final cost", formatMoney(invoice.finalCost))}
          ${renderAmountRow("Amount paid", formatMoney(invoice.amountPaid))}
          <tr><td colspan="2" style="border-top:1px solid #e5ded3;height:8px;"></td></tr>
          ${renderAmountRow("Balance due", formatMoney(invoice.balanceDue), { strong: true })}
        </table>

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

    if (job.status !== "Completed") {
      return {
        success: false,
        message: "Complete the job before creating an invoice.",
      };
    }

    const materials = parseInvoiceMaterials(job.materials);
    const materialsSubtotal = materials.reduce(
      (total, material) => total + Number(calculateSignedMaterialTotal(material)),
      0,
    );
    const laborCost = Number(job.laborCost ?? 0);
    const materialTaxRate = Number(job.materialTaxRate ?? 0);
    const materialTaxAmount = (laborCost + materialsSubtotal) * (materialTaxRate / 100);
    const balanceDue = calculateOutstandingBalance(job.status, job.finalCost?.toString(), job.amountPaid?.toString());

    await prisma.invoice.create({
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
        amountPaid: toMoney(job.amountPaid),
        balanceDue: balanceDue.toFixed(2),
        paymentStatus: job.paymentStatus,
        jobStatus: job.status,
      },
    });
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Invoice could not be created. Please try again.",
    };
  }

  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/invoices");

  return {
    success: true,
    message: "Invoice created.",
  };
}

export async function emailInvoiceAction(
  _previousState: EmailInvoiceState,
  formData: FormData,
): Promise<EmailInvoiceState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to email an invoice.",
    };
  }

  const parsed = emailInvoiceSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select an invoice and try again.",
    };
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
    return {
      success: false,
      message: "Invoice could not be found.",
    };
  }

  if (!invoice.customerEmail) {
    return {
      success: false,
      message: "Add an email address to this customer before sending the invoice.",
    };
  }

  if (!googleMailAccount) {
    return {
      success: false,
      message: "Connect Gmail before emailing invoices.",
    };
  }

  try {
    const invoiceSequence = await prisma.invoice.count({
      where: {
        ownerId: currentUser.id,
        issuedAt: {
          lte: invoice.issuedAt,
        },
      },
    });
    const invoiceNumber = formatDocumentNumber("INV", invoiceSequence);
    const dueDate = addDays(invoice.issuedAt, 15);
    const materials = parseInvoiceMaterials(invoice.materials);
    const { html, subject, text } = createInvoiceEmailContent({
      companyName: currentUser.companyName,
      companyEmail: currentUser.companyEmail ?? currentUser.email,
      companyPhone: currentUser.companyPhone,
      dueDate,
      invoice,
      invoiceNumber,
      materials,
      payments: invoice.job.payments,
    });
    const refreshToken = decryptGoogleToken(googleMailAccount.refreshTokenCipher);
    const accessToken = await refreshGoogleAccessToken(refreshToken);

    await sendGmailMessage(accessToken, {
      from: googleMailAccount.email,
      html,
      subject,
      text,
      to: invoice.customerEmail,
    });
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Invoice email could not be sent. Please try again.",
    };
  }

  return {
    success: true,
    message: `Invoice sent to ${invoice.customerEmail}.`,
  };
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
