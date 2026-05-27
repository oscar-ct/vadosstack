import { format } from "date-fns";

const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateInput(value: string) {
  const match = DATE_INPUT_PATTERN.exec(value.trim());

  if (!match) {
    return new Date(value);
  }

  const [, year, month, day] = match;

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
}

export function formatDateOnly(value: Date | string | null | undefined) {
  if (!value) return undefined;

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) return undefined;

  return format(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()), "MMM d, yyyy");
}

export function toDateInputValue(date = new Date()) {
  return format(date, "yyyy-MM-dd");
}
