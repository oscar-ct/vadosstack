import { NextResponse } from "next/server";

import { addDays, format } from "date-fns";

import { getCurrentUser } from "@/lib/auth";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { normalizeDocumentMessageAlign, renderDocumentMessage } from "@/lib/document-messages";
import { formatDocumentNumber } from "@/lib/document-number";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

import { parsePricingItems } from "../../../jobs/_components/pricing-items";
import { type InvoicePdfMaterial, renderInvoicePdfBuffer } from "../../_lib/invoice-pdf";

function parseInvoiceMaterials(value: string): InvoicePdfMaterial[] {
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

function sanitizePdfFilename(value: string) {
  return `${value.replace(/[^a-z0-9-]+/gi, "-")}.pdf`;
}

function money(value: { toString: () => string } | string | number) {
  return `$${Number(value.toString()).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      invoiceId: string;
    }>;
  },
) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { invoiceId } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: {
      id_ownerId: {
        id: invoiceId,
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
  });

  if (!invoice) {
    return new NextResponse("Invoice not found", { status: 404 });
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
  const dueDate = addDays(invoice.issuedAt, currentUser.invoiceDueDays);
  const companyLogoSrc = await getCompanyLogoSrc(currentUser.id);
  const taxableItemsLabel = invoice.job.jobType === "Commercial" ? "labor + materials" : "materials";
  const documentMessageAlign = normalizeDocumentMessageAlign(currentUser.invoiceMessageAlign);
  const documentMessage = currentUser.invoiceMessageEnabled
    ? renderDocumentMessage(currentUser.invoiceMessageText, {
        amountPaid: money(invoice.amountPaid),
        balanceDue: money(invoice.balanceDue),
        companyName: currentUser.companyName,
        customerName: invoice.customerName,
        dueDate: format(dueDate, "MMM d, yyyy"),
        finalCost: money(invoice.finalCost),
        invoiceNumber,
        jobTitle: invoice.jobTitle,
        serviceLocation: invoice.serviceLocation,
      })
    : "";
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
    documentMessageAlign,
    documentMessage,
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
    materials: parseInvoiceMaterials(invoice.materials),
    materialsSubtotal: invoice.materialsSubtotal,
    payments: invoice.job.payments,
    serviceLocation: invoice.serviceLocation,
    taxableItemsLabel,
  });
  const filename = sanitizePdfFilename(invoiceNumber);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      "Content-Type": "application/pdf",
    },
  });
}
