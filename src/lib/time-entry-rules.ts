import { Temporal } from "temporal-polyfill";
import { z } from "zod";

import { addCalendarDays, businessDateKey, calendarDateKey } from "@/lib/business-time";
import { TimeEntryUserError } from "@/lib/time-entry-errors";

export const timeEntryIdSchema = z.string().trim().min(1).max(64);
export const timeValueSchema = z
  .string()
  .trim()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time.");

export const workDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid work date.")
  .refine((value) => {
    try {
      return Temporal.PlainDate.from(value).toString() === value;
    } catch {
      return false;
    }
  }, "Enter a valid work date.");

export function managerWorkDateSchemaFor(timeZone?: string) {
  return workDateSchema.refine(
    (value) => value <= businessDateKey(new Date(), timeZone),
    "Work date cannot be in the future.",
  );
}
export function employeeWorkDateSchemaFor(timeZone?: string) {
  return managerWorkDateSchemaFor(timeZone).refine(
    (value) => value >= addCalendarDays(businessDateKey(new Date(), timeZone), -90),
    "Work date must be within the last 90 days and cannot be in the future.",
  );
}
export const managerWorkDateSchema = managerWorkDateSchemaFor();
export const employeeWorkDateSchema = employeeWorkDateSchemaFor();

export const checkboxBooleanSchema = z.preprocess((value) => value === "true" || value === true, z.boolean());
export const lunchMinutesSchema = z.coerce
  .number()
  .int("Lunch must be a whole number of minutes.")
  .min(0)
  .max(240, "Lunch cannot exceed 240 minutes.");
export const timeEntryNotesSchema = z.string().trim().max(1000, "Notes must be 1,000 characters or fewer.").optional();

export const timeEntryFieldsSchema = z.object({
  jobId: z.string().trim().max(64).optional(),
  startTime: timeValueSchema,
  endTime: timeValueSchema,
  deductLunch: checkboxBooleanSchema,
  lunchMinutes: lunchMinutesSchema,
  notes: timeEntryNotesSchema,
});

export function parseWorkDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function getMinutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function calculateShift(input: {
  deductLunch?: boolean;
  endTime: string;
  lunchMinutes: number;
  startTime: string;
}) {
  const startMinutes = getMinutesFromTime(input.startTime);
  const rawEndMinutes = getMinutesFromTime(input.endTime);

  if (rawEndMinutes === startMinutes) {
    throw new TimeEntryUserError("Start and end time cannot be the same. Split a 24-hour shift into separate entries.");
  }

  const crossesMidnight = rawEndMinutes < startMinutes;
  const endMinutes = rawEndMinutes + (crossesMidnight ? 24 * 60 : 0);
  const grossMinutes = endMinutes - startMinutes;
  const lunchMinutes = input.deductLunch === false ? 0 : input.lunchMinutes;
  const workedMinutes = grossMinutes - lunchMinutes;

  if (grossMinutes > 18 * 60) {
    throw new TimeEntryUserError("A single shift cannot exceed 18 hours. Split the time into separate entries.");
  }

  if (lunchMinutes >= grossMinutes || workedMinutes <= 0) {
    throw new TimeEntryUserError("Worked time must be greater than 0 after lunch is deducted.");
  }

  return {
    crossesMidnight,
    grossMinutes,
    hours: (workedMinutes / 60).toFixed(2),
    lunchMinutes,
    workedMinutes,
  };
}

export function getShiftInterval(workedOn: Date, startTime: string, endTime: string) {
  const dayStart = new Date(`${calendarDateKey(workedOn)}T00:00:00.000Z`).getTime();
  const startMinutes = getMinutesFromTime(startTime);
  const rawEndMinutes = getMinutesFromTime(endTime);
  const endMinutes = rawEndMinutes + (rawEndMinutes < startMinutes ? 24 * 60 : 0);

  return {
    end: dayStart + endMinutes * 60_000,
    start: dayStart + startMinutes * 60_000,
  };
}

export function workWeekStart(value: Date) {
  const day = Temporal.PlainDate.from(calendarDateKey(value));
  return parseWorkDate(day.subtract({ days: day.dayOfWeek - 1 }).toString());
}
