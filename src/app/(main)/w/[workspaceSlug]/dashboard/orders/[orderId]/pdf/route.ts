import { NextResponse } from "next/server";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";

import { getOrderDocumentData, sanitizeOrderPdfFilename } from "../../_lib/order-document";
import { renderOrderPdfBuffer } from "../../_lib/order-pdf";

async function getAuthorizedOrderPdfMetadata(orderId: string, originalDocument = false) {
  const authorization = await getPermittedDashboardAuthorization("orders.view");

  if (!authorization) {
    return {
      response: new NextResponse("Forbidden", { status: 403 }),
    };
  }

  const data = await getOrderDocumentData(authorization.workspaceId, orderId, originalDocument);

  if (!data) {
    return {
      response: new NextResponse("Order not found", { status: 404 }),
    };
  }

  return {
    data,
    filename: sanitizeOrderPdfFilename(originalDocument ? `${data.orderNumber}-original` : data.orderNumber),
  };
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      orderId: string;
    }>;
  },
) {
  const { orderId } = await params;
  const result = await getAuthorizedOrderPdfMetadata(
    orderId,
    new URL(request.url).searchParams.get("original") === "1",
  );

  if (result.response) {
    return result.response;
  }

  const pdfBuffer = await renderOrderPdfBuffer(result.data);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Content-Length": String(pdfBuffer.length),
      "Content-Type": "application/pdf",
    },
  });
}

export async function HEAD(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      orderId: string;
    }>;
  },
) {
  const { orderId } = await params;
  const result = await getAuthorizedOrderPdfMetadata(
    orderId,
    new URL(request.url).searchParams.get("original") === "1",
  );

  if (result.response) {
    return result.response;
  }

  return new NextResponse(null, {
    headers: {
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Content-Type": "application/pdf",
    },
  });
}

export async function POST() {
  return NextResponse.json({ message: "Order PDFs can only be downloaded with GET." }, { status: 405 });
}
