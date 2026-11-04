export const salesViews = [
  { value: "lifetime", label: "Lifetime" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "365", label: "Last 12 months" },
] as const;
export type SalesView = (typeof salesViews)[number]["value"];
