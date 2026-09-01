export const leadStatuses = ["New", "In Progress", "Won", "Lost"] as const;

export const leadPriorities = ["Normal", "High"] as const;

export const leadSources = ["Website", "Referral", "Phone", "Facebook", "Google", "Repeat Customer", "Other"] as const;

export const leadServiceTypes = ["Repair", "Installation", "Other"] as const;

export type LeadStatus = (typeof leadStatuses)[number];
export type LeadPriority = (typeof leadPriorities)[number];

export function getLeadStatusForEstimateStatus(status: string, convertedJobId?: string | null): LeadStatus {
  if (convertedJobId || status === "Won") return "Won";
  if (status === "Lost") return "Lost";
  return "In Progress";
}

export function normalizeStandaloneLeadStatus(status: string): LeadStatus {
  return leadStatuses.includes(status as LeadStatus) ? (status as LeadStatus) : "New";
}
