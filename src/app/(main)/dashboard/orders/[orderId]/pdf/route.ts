import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";

import { getOrderDocumentData, sanitizeOrderPdfFilename } from "../../_lib/order-document";
import { renderOrderPdfBuffer } from "../../_lib/order-pdf";

async function getAuthorizedOrderPdfMetadata(orderId: string) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      response: new NextResponse("Unauthorized", { status: 401 }),
    };
  }

  const data = await getOrderDocumentData(currentUser.id, orderId);

  if (!data) {
    return {
      response: new NextResponse("Order not found", { status: 404 }),
    };
  }

  return {
    data,
    filename: sanitizeOrderPdfFilename(data.orderNumber),
  };
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      orderId: string;
    }>;
  },
) {
  const { orderId } = await params;
  const result = await getAuthorizedOrderPdfMetadata(orderId);

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
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      orderId: string;
    }>;
  },
) {
  const { orderId } = await params;
  const result = await getAuthorizedOrderPdfMetadata(orderId);

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
