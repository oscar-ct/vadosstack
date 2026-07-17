export type ServiceAddressFields = {
  serviceAddressLine1?: string | null;
  serviceAddressLine2?: string | null;
  serviceCity?: string | null;
  serviceState?: string | null;
  servicePostalCode?: string | null;
};

export type ServiceAddressFormFields = {
  serviceAddressLine1: string;
  serviceAddressLine2: string;
  serviceCity: string;
  serviceState: string;
  servicePostalCode: string;
};

export type ServiceLocationRecord = ServiceAddressFields & {
  serviceLocation?: string | null;
};

const emptyServiceAddress: ServiceAddressFormFields = {
  serviceAddressLine1: "",
  serviceAddressLine2: "",
  serviceCity: "",
  servicePostalCode: "",
  serviceState: "",
};

function clean(value: FormDataEntryValue | null | undefined) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

export function toServiceAddressFormFields(record?: ServiceAddressFields | null): ServiceAddressFormFields {
  return {
    serviceAddressLine1: record?.serviceAddressLine1 ?? "",
    serviceAddressLine2: record?.serviceAddressLine2 ?? "",
    serviceCity: record?.serviceCity ?? "",
    servicePostalCode: record?.servicePostalCode ?? "",
    serviceState: record?.serviceState ?? "",
  };
}

export function hasStructuredServiceAddress(record?: ServiceAddressFields | null) {
  return Boolean(
    record?.serviceAddressLine1?.trim() ||
      record?.serviceAddressLine2?.trim() ||
      record?.serviceCity?.trim() ||
      record?.serviceState?.trim() ||
      record?.servicePostalCode?.trim(),
  );
}

export function formatServiceAddress(record?: ServiceLocationRecord | null) {
  if (!record) return null;

  const city = record.serviceCity?.trim();
  const state = record.serviceState?.trim();
  const postalCode = record.servicePostalCode?.trim();
  const cityState = city && state ? `${city}, ${state}` : (city ?? state);
  const cityLine = [cityState, postalCode].filter(Boolean).join(" ");
  const structured = [record.serviceAddressLine1, record.serviceAddressLine2, cityLine]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");

  return structured || record.serviceLocation?.trim() || null;
}

export function getServiceAddressPayload(formData: FormData) {
  const fields = {
    serviceAddressLine1: clean(formData.get("serviceAddressLine1")),
    serviceAddressLine2: clean(formData.get("serviceAddressLine2")),
    serviceCity: clean(formData.get("serviceCity")),
    servicePostalCode: clean(formData.get("servicePostalCode")),
    serviceState: clean(formData.get("serviceState")),
  };
  const serviceLocation = formatServiceAddress(fields);

  return {
    ...fields,
    serviceLocation: clean(formData.get("serviceLocation")) ?? serviceLocation ?? undefined,
  };
}

export function emptyServiceAddressFields() {
  return { ...emptyServiceAddress };
}
