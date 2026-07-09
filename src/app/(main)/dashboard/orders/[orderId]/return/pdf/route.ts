import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";

import { getReturnRefundDocumentData, sanitizeReturnReceiptFilename } from "../_lib/return-data";
import { renderReturnReceiptPdfBuffer } from "../_lib/return-pdf";

async function getAuthorizedReturnReceipt(orderId: string) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      response: new NextResponse("Unauthorized", { status: 401 }),
    };
  }

  const data = await getReturnRefundDocumentData(currentUser.id, orderId);

  if (!data) {
    return {
      response: new NextResponse("Return receipt not found", { status: 404 }),
    };
  }

  return {
    data,
    filename: sanitizeReturnReceiptFilename(data.returnNumber),
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
  const result = await getAuthorizedReturnReceipt(orderId);

  if (result.response) {
    return result.response;
  }

  const pdfBuffer = await renderReturnReceiptPdfBuffer(result.data);

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
  const result = await getAuthorizedReturnReceipt(orderId);

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
