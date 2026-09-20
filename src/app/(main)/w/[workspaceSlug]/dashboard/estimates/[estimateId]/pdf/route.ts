import { NextResponse } from "next/server";

import { addDays, format } from "date-fns";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { normalizeDocumentMessageAlign, renderDocumentMessage } from "@/lib/document-messages";
import { formatDocumentNumber } from "@/lib/document-number";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { formatServiceAddress } from "@/lib/service-address";

import { parseMaterials as parseJobMaterials } from "../../../jobs/_components/materials";
import { parsePricingItems } from "../../../jobs/_components/pricing-items";
import { type EstimatePdfLineItem, renderEstimatePdfBuffer } from "../../_lib/estimate-pdf";

function parseEstimateMaterials(value: string): EstimatePdfLineItem[] {
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
      estimateId: string;
    }>;
  },
) {
  const authorization = await getPermittedDashboardAuthorization("estimates.view");

  if (!authorization) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const workspaceId = authorization.workspaceId;

  const { estimateId } = await params;
  const estimate = await prisma.estimate.findUnique({
    where: {
      id_ownerId: {
        id: estimateId,
        ownerId: workspaceId,
      },
    },
    include: {
      estimateRecord: true,
    },
  });

  if (!estimate) {
    return new NextResponse("Estimate not found", { status: 404 });
  }

  const [estimateSequence, workspace] = await Promise.all([
    prisma.estimate.count({
      where: { ownerId: workspaceId, issuedAt: { lte: estimate.issuedAt } },
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { legacyOwner: { select: { email: true } } },
    }),
  ]);
  if (!workspace) return new NextResponse("Workspace not found", { status: 404 });
  const estimateNumber = estimate.estimateNumber ?? formatDocumentNumber("EST", estimateSequence);
  const serviceLocation = formatServiceAddress(estimate);
  const validThrough = addDays(estimate.issuedAt, workspace.estimateValidDays);
  const companyLogoSrc = await getCompanyLogoSrc(workspaceId);
  const paymentAmount = Number(estimate.estimatedTotal.toString()) / 2;
  const documentMessageAlign = normalizeDocumentMessageAlign(workspace.estimateMessageAlign);
  const documentMessage = workspace.estimateMessageEnabled
    ? renderDocumentMessage(workspace.estimateMessageText, {
        companyName: workspace.name,
        customerName: estimate.customerName,
        estimateHalfTotal: money(paymentAmount),
        estimateNumber,
        estimateTotal: money(estimate.estimatedTotal),
        jobTitle: estimate.jobTitle,
        serviceLocation,
        validThrough: format(validThrough, "MMM d, yyyy"),
      })
    : "";
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
  const taxableItemsLabel = estimate.estimateRecord?.jobType === "Commercial" ? "labor + materials" : "materials";
  const pdfBuffer = await renderEstimatePdfBuffer({
    companyEmail: workspace.companyEmail ?? workspace.legacyOwner?.email ?? authorization.principal.user.email,
    companyLogoSrc,
    companyName: workspace.name,
    companyPhone: workspace.companyPhone ? formatPhoneNumber(workspace.companyPhone) : null,
    customerEmail: estimate.customerEmail,
    customerName: estimate.customerName,
    customerPhone: estimate.customerPhone ? formatPhoneNumber(estimate.customerPhone) : null,
    dateBegin: estimate.dateBegin,
    dateEnd: estimate.dateEnd,
    documentMessageAlign,
    documentMessage,
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
    serviceLocation,
    taxableItemsLabel,
    validThrough,
  });
  const filename = sanitizePdfFilename(estimateNumber);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      "Content-Type": "application/pdf",
    },
  });
}
