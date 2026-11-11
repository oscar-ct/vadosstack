import { format as formatDate } from "date-fns";
import { Temporal } from "temporal-polyfill";

export const DEFAULT_BUSINESS_TIME_ZONE = "America/Chicago";

// A formatting projection, never a stored event. UTC getters keep date-fns from
// applying the execution host's DST rules to another business's wall-clock time.
class CalendarProjection extends Date {
  getFullYear() {
    return this.getUTCFullYear();
  }
  getMonth() {
    return this.getUTCMonth();
  }
  getDate() {
    return this.getUTCDate();
  }
  getDay() {
    return this.getUTCDay();
  }
  getHours() {
    return this.getUTCHours();
  }
  getMinutes() {
    return this.getUTCMinutes();
  }
  getSeconds() {
    return this.getUTCSeconds();
  }
  getMilliseconds() {
    return this.getUTCMilliseconds();
  }
  getTimezoneOffset() {
    return 0;
  }
  setFullYear(...args: [number, number?, number?]) {
    return this.setUTCFullYear(...args);
  }
  setMonth(...args: [number, number?]) {
    return this.setUTCMonth(...args);
  }
  setDate(value: number) {
    return this.setUTCDate(value);
  }
  setHours(...args: [number, number?, number?, number?]) {
    return this.setUTCHours(...args);
  }
  setMinutes(...args: [number, number?, number?]) {
    return this.setUTCMinutes(...args);
  }
  setSeconds(...args: [number, number?]) {
    return this.setUTCSeconds(...args);
  }
  setMilliseconds(value: number) {
    return this.setUTCMilliseconds(value);
  }
}

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return Boolean(value.trim());
  } catch {
    return false;
  }
}

export function businessDateKey(value = new Date(), timeZone = DEFAULT_BUSINESS_TIME_ZONE) {
  return Temporal.Instant.from(value.toISOString()).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}

export function businessDayStart(value: string, timeZone = DEFAULT_BUSINESS_TIME_ZONE) {
  return new Date(Temporal.PlainDate.from(value).toZonedDateTime({ timeZone, plainTime: "00:00" }).epochMilliseconds);
}

export function addCalendarDays(value: string, days: number) {
  return Temporal.PlainDate.from(value).add({ days }).toString();
}

export function calendarDateKey(value: Date | string) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : (typeof value === "string" ? new Date(value) : value).toISOString().slice(0, 10);
}

export function formatCalendarDate(value: Date | string, pattern = "MMM d, yyyy") {
  const day = Temporal.PlainDate.from(calendarDateKey(value));
  // Date-fns formats these projected calendar fields; the host timezone never
  // converts the original instant or determines the selected calendar day.
  return formatDate(new CalendarProjection(Date.UTC(day.year, day.month - 1, day.day, 12)), pattern);
}

export function formatBusinessDate(
  value: Date | string,
  pattern = "MMM d, yyyy 'at' h:mm a",
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
) {
  const date = typeof value === "string" ? new Date(value) : value;
  const wall = Temporal.Instant.from(date.toISOString()).toZonedDateTimeISO(timeZone);
  return formatDate(
    new CalendarProjection(
      Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second, wall.millisecond),
    ),
    pattern,
  );
}

export function invoiceDueDate(issuedAt: Date, days: number, timeZone = DEFAULT_BUSINESS_TIME_ZONE) {
  return new Date(`${addCalendarDays(businessDateKey(issuedAt, timeZone), days)}T00:00:00.000Z`);
}

export function isInvoiceOverdue(dueAt: Date | string, today = new Date(), timeZone = DEFAULT_BUSINESS_TIME_ZONE) {
  return calendarDateKey(dueAt) < businessDateKey(today, timeZone);
}

export function calendarDaysUntil(dueAt: Date | string, today = new Date(), timeZone = DEFAULT_BUSINESS_TIME_ZONE) {
  return Temporal.PlainDate.from(businessDateKey(today, timeZone)).until(
    Temporal.PlainDate.from(calendarDateKey(dueAt)),
  ).days;
}

export function addCalendarDate(value: Date, days: number) {
  return new Date(`${addCalendarDays(calendarDateKey(value), days)}T00:00:00.000Z`);
}
