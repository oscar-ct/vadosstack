import { addDays, addMonths, format, isValid, parse, startOfDay, startOfMonth, startOfWeek } from "date-fns";

import type {
  EmployeeSummary,
  TimeEntryRow,
} from "@/app/(main)/dashboard/time-tracking/_components/time-tracking-dashboard";

export function toHours(value: { toString: () => string }) {
  return Number(value.toString());
}

export function getSelectedWeek(week?: string) {
  if (week) {
    const parsedWeek = parse(week, "yyyy-MM-dd", new Date());

    if (isValid(parsedWeek)) return startOfWeek(parsedWeek, { weekStartsOn: 1 });
  }

  return startOfWeek(startOfDay(new Date()), { weekStartsOn: 1 });
}

export function getTimeTrackingRange(week?: string) {
  const weekStart = getSelectedWeek(week);
  const weekEnd = addDays(weekStart, 7);
  const monthStart = startOfMonth(weekStart);
  const monthEnd = addMonths(monthStart, 1);

  return {
    monthEnd,
    monthLabel: format(monthStart, "MMMM yyyy"),
    monthStart,
    nextWeek: format(addDays(weekStart, 7), "yyyy-MM-dd"),
    periodLabel: `${format(weekStart, "MMM d")} - ${format(addDays(weekEnd, -1), "MMM d")}`,
    previousWeek: format(addDays(weekStart, -7), "yyyy-MM-dd"),
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
    lunchMinutes: hasTimeRange ? entry.lunchMinutes : 0,
    notes: entry.notes ?? undefined,
    startTime: entry.startTime ?? undefined,
    workedOn: format(entry.workedOn, "yyyy-MM-dd"),
  };
}

export function mapEmployeeSummary(employee: {
  id: string;
  email: string | null;
  employeeNumber: string;
  name: string;
  phone: string | null;
  timeEntries: Array<{
    hours: { toString: () => string };
    workedOn: Date;
  }>;
}): EmployeeSummary {
  const lastEntry = employee.timeEntries[0];

  return {
    id: employee.id,
    email: employee.email ?? undefined,
    employeeNumber: employee.employeeNumber,
    lastWorkedOn: lastEntry ? format(lastEntry.workedOn, "yyyy-MM-dd") : undefined,
    name: employee.name,
    phone: employee.phone ?? undefined,
    totalHours: employee.timeEntries.reduce((total, entry) => total + toHours(entry.hours), 0),
  };
}
