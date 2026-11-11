"use client";

import { createContext, type ReactNode, useContext } from "react";

import { DEFAULT_BUSINESS_TIME_ZONE, formatBusinessDate, formatCalendarDate } from "@/lib/business-time";

const BusinessTimeZone = createContext(DEFAULT_BUSINESS_TIME_ZONE);
export function BusinessTimeProvider({ timeZone, children }: { timeZone: string; children: ReactNode }) {
  return <BusinessTimeZone.Provider value={timeZone}>{children}</BusinessTimeZone.Provider>;
}
export function useBusinessTimeZone() {
  return useContext(BusinessTimeZone);
}
export function BusinessDateTime({
  value,
  pattern = "MMM d, yyyy 'at' h:mm a",
  dateOnly = false,
}: {
  value: Date | string;
  pattern?: string;
  dateOnly?: boolean;
}) {
  const timeZone = useBusinessTimeZone();
  return <>{dateOnly ? formatCalendarDate(value, pattern) : formatBusinessDate(value, pattern, timeZone)}</>;
}
