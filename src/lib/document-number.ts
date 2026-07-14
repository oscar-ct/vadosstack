export type DocumentNumberPrefix = "EST" | "INV";
export type NumberedDocumentType = "estimate" | "invoice" | "order";

const documentNumberConfigs = {
  estimate: { padding: 4, prefix: "EST", separator: "" },
  invoice: { padding: 4, prefix: "INV", separator: "" },
  order: { padding: 4, prefix: "ORD", separator: "-" },
} as const satisfies Record<NumberedDocumentType, { padding: number; prefix: string; separator: string }>;

export function formatDocumentNumber(prefix: DocumentNumberPrefix, sequence: number) {
  return `${prefix}${Math.max(sequence, 0).toString().padStart(4, "0")}`;
}

export function formatTrackedDocumentNumber(type: NumberedDocumentType, sequence: number) {
  const config = documentNumberConfigs[type];
  return `${config.prefix}${config.separator}${Math.max(sequence, 0).toString().padStart(config.padding, "0")}`;
}

export function getDocumentNumberConfig(type: NumberedDocumentType) {
  return documentNumberConfigs[type];
}

export function parseTrackedDocumentNumber(type: NumberedDocumentType, value: string) {
  const config = documentNumberConfigs[type];
  const normalizedValue = value.trim().toUpperCase();
  const prefix = `${config.prefix}${config.separator}`;

  if (!normalizedValue.startsWith(prefix)) return null;

  const digits = normalizedValue.slice(prefix.length);

  if (!/^\d+$/.test(digits)) return null;

  const sequenceNumber = Number.parseInt(digits, 10);

  if (!Number.isSafeInteger(sequenceNumber) || sequenceNumber < 1) return null;

  return {
    documentNumber: formatTrackedDocumentNumber(type, sequenceNumber),
    sequenceNumber,
  };
}
