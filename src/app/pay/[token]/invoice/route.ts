import { NextResponse } from "next/server";

import { addDays, format } from "date-fns";

import {
  type InvoicePdfMaterial,
  renderInvoicePdfBuffer,
} from "@/app/(main)/w/[workspaceSlug]/dashboard/invoices/_lib/invoice-pdf";
import { parsePricingItems } from "@/app/(main)/w/[workspaceSlug]/dashboard/jobs/_components/pricing-items";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { normalizeDocumentMessageAlign, renderDocumentMessage } from "@/lib/document-messages";
import { resolveInvoicePaymentLink } from "@/lib/payments/payment-links";
import { getPaymentDisplayMethod, getPaymentDisplayReference } from "@/lib/payments/presentation";
import { formatPhoneNumber } from "@/lib/phone";
import { formatServiceAddress } from "@/lib/service-address";

function parsePublicMaterials(value: string): InvoicePdfMaterial[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((material) => ({
        description: String(material?.description ?? "").trim(),
        price: String(material?.price ?? "").trim(),
        purchaseDate: "",
        quantity: String(material?.quantity ?? "").trim(),
        type: material?.type === "return" ? ("return" as const) : ("purchase" as const),
        unit: String(material?.unit ?? "").trim(),
        unitPrice: String(material?.unitPrice ?? "").trim(),
        vendor: "",
      }))
      .filter((material) => material.description && material.price);
  } catch {
    return [];
  }
}

function money(value: { toString: () => string } | string | number) {
  return `$${Number(value.toString()).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function pdfFilename(value: string) {
  return `${value.replace(/[^a-z0-9-]+/gi, "-")}.pdf`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await resolveInvoicePaymentLink(token);
  if (!link) return new NextResponse("Invoice not found", { status: 404 });

  const invoice = link.invoice;
  const company = invoice.owner;
  const invoiceNumber = invoice.invoiceNumber ?? invoice.id.slice(-6).toUpperCase();
  const dueDate = addDays(invoice.issuedAt, company.invoiceDueDays);
  const serviceLocation = formatServiceAddress(invoice);
  const companyEmail = company.companyEmail ?? company.legacyOwner?.email ?? "";
  const rawCompanyLogoSrc = await getCompanyLogoSrc(invoice.ownerId);
  const companyLogoSrc = rawCompanyLogoSrc.startsWith("/dashboard/") ? null : rawCompanyLogoSrc;
  const documentMessage = company.invoiceMessageEnabled
    ? renderDocumentMessage(company.invoiceMessageText, {
        amountPaid: money(invoice.amountPaid),
        balanceDue: money(invoice.balanceDue),
        companyName: company.name,
        customerName: invoice.customerName,
        dueDate: format(dueDate, "MMM d, yyyy"),
        finalCost: money(invoice.finalCost),
        invoiceNumber,
        jobTitle: invoice.jobTitle,
        serviceLocation,
      })
    : "";

  const pdfBuffer = await renderInvoicePdfBuffer({
    amountPaid: invoice.amountPaid,
    balanceDue: invoice.balanceDue,
    companyAddress: company.companyAddress,
    companyEmail,
    companyLogoSrc,
    companyName: company.name,
    companyPhone: company.companyPhone ? formatPhoneNumber(company.companyPhone) : null,
    customerEmail: invoice.customerEmail,
    customerName: invoice.customerName,
    customerPhone: invoice.customerPhone ? formatPhoneNumber(invoice.customerPhone) : null,
    dateBegin: invoice.dateBegin,
    dateEnd: invoice.dateEnd,
    depositPaid: invoice.depositPaid,
    documentMessage,
    documentMessageAlign: normalizeDocumentMessageAlign(company.invoiceMessageAlign),
    dueDate,
    finalCost: invoice.finalCost,
    invoiceNumber,
    issuedAt: invoice.issuedAt,
    jobDescription: invoice.jobDescription,
    jobTitle: invoice.jobTitle,
    laborCost: invoice.laborCost,
    laborItems: parsePricingItems(invoice.job.laborItems),
    materialTaxAmount: invoice.materialTaxAmount,
    materialTaxRate: invoice.materialTaxRate,
    otherFeesEnabled: invoice.otherFeesEnabled,
    otherFeesRate: invoice.otherFeesRate,
    otherFeesAmount: invoice.otherFeesAmount,
    materials: parsePublicMaterials(invoice.materials),
    materialsSubtotal: invoice.materialsSubtotal,
    payments: invoice.job.payments.map((payment) => ({
      amount: payment.amount,
      description: payment.description,
      method: getPaymentDisplayMethod(payment),
      paidOn: payment.paidOn,
      referenceNumber: getPaymentDisplayReference(payment),
    })),
    serviceLocation,
    taxableItemsLabel: invoice.job.jobType === "Commercial" ? "labor + materials" : "materials",
  });
  const filename = pdfFilename(invoiceNumber);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      "Content-Type": "application/pdf",
    },
  });
}
