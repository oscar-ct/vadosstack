import { Prisma } from "@prisma/client";

import { formatTrackedDocumentNumber, getDocumentNumberConfig, type NumberedDocumentType } from "@/lib/document-number";
import { prisma } from "@/lib/prisma";

type DocumentNumberTransaction = Prisma.TransactionClient;

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function parseSequenceNumber(documentNumber: string | null | undefined) {
  const numberText = documentNumber?.replace(/\D/g, "") ?? "";
  const sequenceNumber = Number.parseInt(numberText, 10);
  return Number.isFinite(sequenceNumber) ? sequenceNumber : 0;
}

async function getCurrentMaxSequence(tx: DocumentNumberTransaction, ownerId: string, type: NumberedDocumentType) {
  if (type === "invoice") {
    const assignment = await tx.documentNumberAssignment.findFirst({
      where: {
        ownerId,
        type,
        status: { not: "released" },
      },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });

    return assignment?.sequenceNumber ?? 0;
  }

  if (type === "estimate") {
    const estimates = await tx.estimate.findMany({
      where: {
        ownerId,
        estimateNumber: {
          not: null,
        },
      },
      select: {
        estimateNumber: true,
      },
    });

    return Math.max(0, ...estimates.map((estimate) => parseSequenceNumber(estimate.estimateNumber)));
  }

  const orders = await tx.order.findMany({
    where: {
      ownerId,
    },
    select: {
      orderNumber: true,
    },
  });

  return Math.max(0, ...orders.map((order) => parseSequenceNumber(order.orderNumber)));
}

async function ensureSequence(tx: DocumentNumberTransaction, ownerId: string, type: NumberedDocumentType) {
  const config = getDocumentNumberConfig(type);
  const existingSequence = await tx.documentSequence.findUnique({
    where: {
      ownerId_type: {
        ownerId,
        type,
      },
    },
  });

  if (existingSequence) {
    const currentMaxSequence = await getCurrentMaxSequence(tx, ownerId, type);
    const nextNumber =
      type === "invoice" ? currentMaxSequence + 1 : Math.max(existingSequence.nextNumber, currentMaxSequence + 1);

    if (
      existingSequence.prefix === config.prefix &&
      existingSequence.padding === config.padding &&
      existingSequence.nextNumber === nextNumber
    ) {
      return existingSequence;
    }

    const updated = await tx.documentSequence.updateMany({
      where: {
        id: existingSequence.id,
        nextNumber: existingSequence.nextNumber,
      },
      data: {
        prefix: config.prefix,
        padding: config.padding,
        nextNumber,
      },
    });

    if (updated.count !== 1) {
      const refreshedSequence = await tx.documentSequence.findUnique({
        where: {
          id: existingSequence.id,
        },
      });

      if (refreshedSequence) return refreshedSequence;
    }

    return {
      ...existingSequence,
      prefix: config.prefix,
      padding: config.padding,
      nextNumber,
    };
  }

  try {
    const currentMaxSequence = await getCurrentMaxSequence(tx, ownerId, type);

    return await tx.documentSequence.create({
      data: {
        ownerId,
        type,
        prefix: config.prefix,
        padding: config.padding,
        nextNumber: currentMaxSequence + 1,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const sequence = await tx.documentSequence.findUnique({
      where: {
        ownerId_type: {
          ownerId,
          type,
        },
      },
    });

    if (!sequence) throw error;
    return sequence;
  }
}

export async function allocateDocumentNumber(
  tx: DocumentNumberTransaction,
  ownerId: string,
  type: NumberedDocumentType,
  documentId?: string,
) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const sequence = await ensureSequence(tx, ownerId, type);
    const sequenceNumber = sequence.nextNumber;
    const documentNumber = formatTrackedDocumentNumber(type, sequenceNumber);
    const updated = await tx.documentSequence.updateMany({
      where: {
        id: sequence.id,
        nextNumber: sequenceNumber,
      },
      data: {
        nextNumber: {
          increment: 1,
        },
      },
    });

    if (updated.count !== 1) continue;

    const existingAssignment = await tx.documentNumberAssignment.findUnique({
      where: {
        ownerId_type_sequenceNumber: {
          ownerId,
          type,
          sequenceNumber,
        },
      },
    });

    if (existingAssignment) {
      if (existingAssignment.status !== "released") continue;

      const reclaimed = await tx.documentNumberAssignment.updateMany({
        where: {
          id: existingAssignment.id,
          status: "released",
        },
        data: {
          assignedAt: new Date(),
          deletedAt: null,
          documentId,
          status: "assigned",
          voidedAt: null,
        },
      });

      if (reclaimed.count !== 1) continue;

      await recordDocumentNumberEvent(tx, {
        action: "reclaimed",
        detail: "Released document number assigned again.",
        documentId,
        documentNumber,
        ownerId,
        sequenceNumber,
        type,
      });

      return {
        assignmentId: existingAssignment.id,
        documentNumber,
        sequenceNumber,
      };
    }

    try {
      const assignment = await tx.documentNumberAssignment.create({
        data: {
          ownerId,
          sequenceId: sequence.id,
          type,
          sequenceNumber,
          documentNumber,
          documentId,
        },
      });

      await recordDocumentNumberEvent(tx, {
        action: "assigned",
        documentId,
        documentNumber,
        ownerId,
        sequenceNumber,
        type,
      });

      return {
        assignmentId: assignment.id,
        documentNumber,
        sequenceNumber,
      };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }

  throw new Error("A document number could not be assigned. Please try again.");
}

export async function attachDocumentNumber(tx: DocumentNumberTransaction, assignmentId: string, documentId: string) {
  const assignment = await tx.documentNumberAssignment.update({
    where: {
      id: assignmentId,
    },
    data: {
      documentId,
    },
  });

  await recordDocumentNumberEvent(tx, {
    action: "attached",
    documentId,
    documentNumber: assignment.documentNumber,
    ownerId: assignment.ownerId,
    sequenceNumber: assignment.sequenceNumber,
    type: assignment.type as NumberedDocumentType,
  });
}

export async function recordDocumentNumberEvent(
  tx: DocumentNumberTransaction,
  input: {
    action: string;
    detail?: string;
    documentId?: string | null;
    documentNumber: string;
    ownerId: string;
    sequenceNumber: number;
    type: NumberedDocumentType;
  },
) {
  await tx.documentNumberEvent.create({
    data: {
      action: input.action,
      detail: input.detail,
      documentId: input.documentId,
      documentNumber: input.documentNumber,
      ownerId: input.ownerId,
      sequenceNumber: input.sequenceNumber,
      type: input.type,
    },
  });
}

export async function recalculateNextDocumentNumber(
  tx: DocumentNumberTransaction,
  ownerId: string,
  type: NumberedDocumentType,
) {
  const currentMaxSequence = await getCurrentMaxSequence(tx, ownerId, type);
  const nextNumber = currentMaxSequence + 1;

  await tx.documentSequence.updateMany({
    where: { ownerId, type },
    data: { nextNumber },
  });

  return nextNumber;
}

export async function peekNextDocumentNumber(ownerId: string, type: NumberedDocumentType) {
  const sequence = await prisma.documentSequence.findUnique({
    where: {
      ownerId_type: {
        ownerId,
        type,
      },
    },
    select: {
      nextNumber: true,
    },
  });

  return formatTrackedDocumentNumber(type, sequence?.nextNumber ?? 1);
}
