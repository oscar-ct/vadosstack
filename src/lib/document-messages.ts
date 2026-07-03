export type DocumentMessageType = "estimate" | "invoice";

export type DocumentMessageAlign = "left" | "center" | "right";

export type DocumentMessageContext = Record<string, string | null | undefined>;

export type DocumentMessageVariable = {
  label: string;
  value: string;
};

export const documentMessageVariables: Record<DocumentMessageType, DocumentMessageVariable[]> = {
  estimate: [
    { label: "Company name", value: "companyName" },
    { label: "Customer name", value: "customerName" },
    { label: "Estimate number", value: "estimateNumber" },
    { label: "Estimated total", value: "estimateTotal" },
    { label: "Half total", value: "estimateHalfTotal" },
    { label: "Valid through", value: "validThrough" },
    { label: "Job title", value: "jobTitle" },
    { label: "Service location", value: "serviceLocation" },
  ],
  invoice: [
    { label: "Company name", value: "companyName" },
    { label: "Customer name", value: "customerName" },
    { label: "Invoice number", value: "invoiceNumber" },
    { label: "Final cost", value: "finalCost" },
    { label: "Amount paid", value: "amountPaid" },
    { label: "Balance due", value: "balanceDue" },
    { label: "Due date", value: "dueDate" },
    { label: "Job title", value: "jobTitle" },
    { label: "Service location", value: "serviceLocation" },
  ],
};

export const documentMessageAlignments: Array<{
  label: string;
  value: DocumentMessageAlign;
}> = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
];

export function normalizeDocumentMessageAlign(value?: string | null): DocumentMessageAlign {
  return value === "center" || value === "right" ? value : "left";
}

export function getDocumentMessageAlignClass(align: DocumentMessageAlign) {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

function getMessageValue(context: DocumentMessageContext, key: string) {
  return context[key]?.trim() ?? "";
}

export function renderDocumentMessage(message: string, context: DocumentMessageContext) {
  return message.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_token, key: string) => getMessageValue(context, key));
}

export function getDocumentMessageLines(message: string) {
  return message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function getDocumentMessageLineItems(message: string) {
  const counts = new Map<string, number>();

  return getDocumentMessageLines(message).map((line) => {
    const count = counts.get(line) ?? 0;
    counts.set(line, count + 1);

    return {
      id: count ? `${line}-${count}` : line,
      line,
    };
  });
}
