export const leadStatuses = ["New", "Contacted", "Estimate Needed", "Estimate Sent", "Won", "Lost"] as const;

export const leadPriorities = ["Low", "Normal", "High"] as const;

export const leadSources = ["Website", "Referral", "Phone", "Facebook", "Google", "Repeat Customer", "Other"] as const;

export const leadServiceTypes = ["Repair", "Installation", "Other"] as const;

export type LeadStatus = (typeof leadStatuses)[number];
export type LeadPriority = (typeof leadPriorities)[number];
