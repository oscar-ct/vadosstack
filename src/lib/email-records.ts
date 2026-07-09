import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type EmailRecordStatus = "success" | "error";

type LogEmailRecordInput = {
  ownerId: string;
  documentType: "estimate" | "general" | "invoice" | "lead" | "order" | "return-receipt";
  documentId?: string | null;
  documentNumber?: string;
  documentTotal?: { toString: () => string } | number | string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  senderEmail?: string | null;
  subject?: string | null;
  status: EmailRecordStatus;
  errorMessage?: string | null;
};

export async function logEmailRecord(input: LogEmailRecordInput) {
  try {
    const documentTotal =
      input.documentTotal === null || input.documentTotal === undefined ? null : input.documentTotal.toString();

    const record = await prisma.emailRecord.create({
      data: {
        ownerId: input.ownerId,
        documentType: input.documentType,
        documentId: input.documentId,
        documentNumber: input.documentNumber,
        recipientName: input.recipientName?.trim() || null,
        recipientEmail: input.recipientEmail?.trim() || null,
        senderEmail: input.senderEmail?.trim() || null,
        subject: input.subject?.trim() || null,
        status: input.status,
        errorMessage: input.errorMessage?.trim() || null,
      },
    });

    if (documentTotal !== null) {
      await prisma.$executeRaw`
        UPDATE "email_records"
        SET "documentTotal" = ${new Prisma.Decimal(documentTotal)}
        WHERE "id" = ${record.id}
      `;
    }
  } catch (error) {
    console.error("Email record could not be saved", error);
  }
}
