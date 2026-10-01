export const noWorkDayReasonValues = [
  "weather",
  "customer_cancellation",
  "no_work_scheduled",
  "company_closure",
  "material_or_equipment_delay",
  "personal",
  "other",
] as const;

export type NoWorkDayReason = (typeof noWorkDayReasonValues)[number];

export const noWorkDayReasons: ReadonlyArray<{ label: string; value: NoWorkDayReason }> = [
  { label: "Rain or weather", value: "weather" },
  { label: "Customer cancellation", value: "customer_cancellation" },
  { label: "No work scheduled", value: "no_work_scheduled" },
  { label: "Company closure", value: "company_closure" },
  { label: "Material or equipment delay", value: "material_or_equipment_delay" },
  { label: "Personal", value: "personal" },
  { label: "Other", value: "other" },
];

export function getNoWorkDayReasonLabel(reason: string) {
  return noWorkDayReasons.find((option) => option.value === reason)?.label ?? "Other";
}
