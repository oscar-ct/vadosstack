export function normalizePhoneNumber(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits;
}

export function isValidOptionalPhoneNumber(value?: string | null) {
  const digits = normalizePhoneNumber(value);
  return !digits || digits.length === 10;
}

export function formatPhoneNumber(value?: string | null) {
  const digits = normalizePhoneNumber(value);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}
