import { NextResponse } from "next/server";

import { addDays, format } from "date-fns";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { normalizeDocumentMessageAlign, renderDocumentMessage } from "@/lib/document-messages";
import { formatDocumentNumber } from "@/lib/document-number";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { formatServiceAddress } from "@/lib/service-address";

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
  const authorization = await getPermittedDashboardAuthorization("invoices.view");

  if (!authorization) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const workspaceId = authorization.workspaceId;

  const { invoiceId } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: {
      id_ownerId: {
        id: invoiceId,
        ownerId: workspaceId,
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

  const [invoiceSequence, workspace] = await Promise.all([
    prisma.invoice.count({
      where: { ownerId: workspaceId, issuedAt: { lte: invoice.issuedAt } },
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { legacyOwner: { select: { email: true } } },
    }),
  ]);
  if (!workspace) return new NextResponse("Workspace not found", { status: 404 });
  const invoiceNumber = invoice.invoiceNumber ?? formatDocumentNumber("INV", invoiceSequence);
  const dueDate = addDays(invoice.issuedAt, workspace.invoiceDueDays);
  const companyLogoSrc = await getCompanyLogoSrc(workspaceId);
  const taxableItemsLabel = invoice.job.jobType === "Commercial" ? "labor + materials" : "materials";
  const serviceLocation = formatServiceAddress(invoice);
  const documentMessageAlign = normalizeDocumentMessageAlign(workspace.invoiceMessageAlign);
  const documentMessage = workspace.invoiceMessageEnabled
    ? renderDocumentMessage(workspace.invoiceMessageText, {
        amountPaid: money(invoice.amountPaid),
        balanceDue: money(invoice.balanceDue),
        companyName: workspace.name,
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
    companyAddress: workspace.companyAddress,
    companyEmail: workspace.companyEmail ?? workspace.legacyOwner?.email ?? authorization.principal.user.email,
    companyLogoSrc,
    companyName: workspace.name,
    companyPhone: workspace.companyPhone ? formatPhoneNumber(workspace.companyPhone) : null,
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
    serviceLocation,
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
