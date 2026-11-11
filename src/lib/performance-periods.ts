import { Temporal } from "temporal-polyfill";

import {
  addCalendarDays,
  businessDateKey,
  businessDayStart,
  calendarDateKey,
  DEFAULT_BUSINESS_TIME_ZONE,
  formatCalendarDate,
  isInvoiceOverdue,
} from "./business-time";

export type PerformancePeriod = { key: string; label: string; start: Date; end: Date; timeZone?: string };

export function buildPerformancePeriods(
  today: Date,
  dates: Date[],
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
): PerformancePeriod[] {
  const day = Temporal.PlainDate.from(businessDateKey(today, timeZone));
  const endDay = day.add({ days: 1 }).toString();
  const end = businessDayStart(endDay, timeZone);
  const year = day.year;
  const valid = dates.filter((date) => Number.isFinite(date.getTime()) && date < end);
  const earliest = new Date(valid.reduce((earliest, date) => Math.min(earliest, date.getTime()), today.getTime()));
  const first = Temporal.PlainDate.from(businessDateKey(earliest, timeZone));
  function period(key: string, label: string, startDay: string, lastDay = endDay): PerformancePeriod {
    return {
      key,
      label,
      start: businessDayStart(startDay, timeZone),
      end: businessDayStart(lastDay, timeZone),
      timeZone,
    };
  }
  return [
    period("ytd", "Year to date", `${year}-01-01`),
    period("6", "Last 6 months", day.with({ day: 1 }).subtract({ months: 5 }).toString()),
    period("12", "Last 12 months", day.with({ day: 1 }).subtract({ months: 11 }).toString()),
    period("all", "All time", first.with({ day: 1 }).toString()),
    ...Array.from({ length: year - first.year + 1 }, (_, index) => {
      const selected = year - index;
      return period(
        String(selected),
        String(selected),
        `${selected}-01-01`,
        selected === year ? endDay : `${selected + 1}-01-01`,
      );
    }),
  ];
}

export function inPerformancePeriod(date: Date | null, period: PerformancePeriod, dateOnly = false) {
  if (!date) return false;
  if (dateOnly) {
    const timeZone = period.timeZone ?? DEFAULT_BUSINESS_TIME_ZONE;
    const key = calendarDateKey(date);
    return key >= businessDateKey(period.start, timeZone) && key < businessDateKey(period.end, timeZone);
  }
  return date >= period.start && date < period.end;
}

export function performancePeriodRange(period: PerformancePeriod) {
  const timeZone = period.timeZone ?? DEFAULT_BUSINESS_TIME_ZONE;
  return `${formatCalendarDate(businessDateKey(period.start, timeZone))} – ${formatCalendarDate(addCalendarDays(businessDateKey(period.end, timeZone), -1))}`;
}

export function isPerformanceInvoiceOverdue(dueAt: Date, today: Date, timeZone = DEFAULT_BUSINESS_TIME_ZONE) {
  return isInvoiceOverdue(dueAt, today, timeZone);
}
