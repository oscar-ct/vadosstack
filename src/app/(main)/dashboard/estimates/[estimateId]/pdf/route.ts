import { NextResponse } from "next/server";

import { addDays } from "date-fns";

import { getCurrentUser } from "@/lib/auth";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { formatDocumentNumber } from "@/lib/document-number";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

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
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { estimateId } = await params;
  const estimate = await prisma.estimate.findUnique({
    where: {
      id_ownerId: {
        id: estimateId,
        ownerId: currentUser.id,
      },
    },
    include: {
      estimateRecord: true,
    },
  });

  if (!estimate) {
    return new NextResponse("Estimate not found", { status: 404 });
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
  const validThrough = addDays(estimate.issuedAt, currentUser.estimateValidDays);
  const companyLogoSrc = await getCompanyLogoSrc(currentUser.id);
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
  const filename = sanitizePdfFilename(estimateNumber);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      "Content-Type": "application/pdf",
    },
  });
}
