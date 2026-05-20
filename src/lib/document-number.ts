export function formatDocumentNumber(prefix: "EST" | "INV", sequence: number) {
  return `${prefix}${sequence.toString().padStart(4, "0")}`;
}
