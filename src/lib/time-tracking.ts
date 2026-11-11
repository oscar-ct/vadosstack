import { Temporal } from "temporal-polyfill";

import type {
  EmployeeSummary,
  TimeEntryRow,
} from "@/app/(main)/w/[workspaceSlug]/dashboard/time-tracking/_components/time-tracking-dashboard";
import { businessDateKey, calendarDateKey, DEFAULT_BUSINESS_TIME_ZONE, formatCalendarDate } from "@/lib/business-time";

export function toHours(value: { toString: () => string }) {
  return Number(value.toString());
}

export function getSelectedWeek(week?: string, timeZone = DEFAULT_BUSINESS_TIME_ZONE) {
  let day = Temporal.PlainDate.from(businessDateKey(new Date(), timeZone));
  if (week) {
    try {
      day = Temporal.PlainDate.from(week);
    } catch {
      /* Invalid bookmarks use the current business week. */
    }
  }
  return new Date(`${day.subtract({ days: day.dayOfWeek - 1 }).toString()}T00:00:00.000Z`);
}
export function getTimeTrackingRange(week?: string, timeZone = DEFAULT_BUSINESS_TIME_ZONE) {
  const weekStart = getSelectedWeek(week, timeZone);
  const day = Temporal.PlainDate.from(calendarDateKey(weekStart));
  const asDate = (d: typeof day) => new Date(`${d.toString()}T00:00:00.000Z`);
  const weekEnd = asDate(day.add({ days: 7 }));
  const monthStart = asDate(day.with({ day: 1 }));
  const monthEnd = asDate(day.with({ day: 1 }).add({ months: 1 }));
  const last = asDate(day.add({ days: 6 }));
  const monthLabel =
    formatCalendarDate(weekStart, "yyyy-MM") === formatCalendarDate(last, "yyyy-MM")
      ? formatCalendarDate(weekStart, "MMMM yyyy")
      : `${formatCalendarDate(weekStart, "MMM yyyy")} - ${formatCalendarDate(last, "MMM yyyy")}`;
  return {
    monthEnd,
    monthLabel,
    monthStart,
    nextWeek: day.add({ days: 7 }).toString(),
    previousWeek: day.subtract({ days: 7 }).toString(),
    periodLabel: `${formatCalendarDate(weekStart, "MMM d")} - ${formatCalendarDate(last, "MMM d")}`,
    weekEnd,
    weekStart,
  };
}

export function mapTimeEntry(entry: {
  id: string;
  deductLunch: boolean;
  employee: {
    employeeNumber: string;
    name: string;
  };
  employeeId: string;
  endTime: string | null;
  hours: { toString: () => string };
  lunchMinutes: number;
  notes: string | null;
  startTime: string | null;
  workedOn: Date;
  job?: {
    customer?: {
      name: string;
    } | null;
    description: string;
    id: string;
  } | null;
}): TimeEntryRow {
  const hasTimeRange = Boolean(entry.startTime && entry.endTime);

  return {
    id: entry.id,
    deductLunch: hasTimeRange ? entry.deductLunch : false,
    employeeId: entry.employeeId,
    employeeName: entry.employee.name,
    employeeNumber: entry.employee.employeeNumber,
    endTime: entry.endTime ?? undefined,
    hours: toHours(entry.hours),
    jobCustomerName: entry.job?.customer?.name ?? undefined,
    jobId: entry.job?.id,
    jobTitle: entry.job?.description,
    lunchMinutes: hasTimeRange ? entry.lunchMinutes : 0,
    notes: entry.notes ?? undefined,
    startTime: entry.startTime ?? undefined,
    workedOn: calendarDateKey(entry.workedOn),
  };
}

export function mapEmployeeSummary(employee: {
  accentColor: string;
  active: boolean;
  department: string | null;
  id: string;
  employeeNumber: string;
  name: string;
  timeEntries: Array<{
    hours: { toString: () => string };
    workedOn: Date;
  }>;
}): EmployeeSummary {
  const lastEntry = employee.timeEntries[0];

  return {
    accentColor: employee.accentColor,
    active: employee.active,
    department: employee.department ?? undefined,
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    lastWorkedOn: lastEntry ? calendarDateKey(lastEntry.workedOn) : undefined,
    name: employee.name,
    totalHours: employee.timeEntries.reduce((total, entry) => total + toHours(entry.hours), 0),
  };
}
