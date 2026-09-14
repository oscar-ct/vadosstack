import { Prisma } from "@prisma/client";
import { addDays, format, startOfWeek } from "date-fns";

import { TimeEntryUserError } from "@/lib/time-entry-errors";
import { getShiftInterval } from "@/lib/time-entry-rules";

type TimeEntryGuardClient = Pick<Prisma.TransactionClient, "$executeRaw" | "timeEntry" | "timesheetLock">;

export async function lockEmployeeTimeEntries(client: TimeEntryGuardClient, ownerId: string, employeeId: string) {
  await client.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`employee:${ownerId}:${employeeId}`}))`);
}

export async function lockTimesheetWeek(client: TimeEntryGuardClient, ownerId: string, workedOn: Date) {
  const weekStart = startOfWeek(workedOn, { weekStartsOn: 1 });
  const weekKey = format(weekStart, "yyyy-MM-dd");
  await client.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`week:${ownerId}:${weekKey}`}))`);
  return weekStart;
}

export async function assertTimesheetUnlocked(client: TimeEntryGuardClient, ownerId: string, workedOn: Date) {
  const weekStart = await lockTimesheetWeek(client, ownerId, workedOn);
  const lock = await client.timesheetLock.findUnique({
    where: {
      ownerId_weekStart: {
        ownerId,
        weekStart,
      },
    },
    select: { id: true },
  });

  if (lock) {
    throw new TimeEntryUserError("This week is locked for payroll. Unlock it before changing time entries.");
  }
}

export async function assertTimeEntryAvailable(
  client: TimeEntryGuardClient,
  input: {
    employeeId: string;
    endTime: string;
    excludeEntryId?: string;
    hours: number;
    ownerId: string;
    startTime: string;
    workedOn: Date;
  },
) {
  await lockEmployeeTimeEntries(client, input.ownerId, input.employeeId);
  const candidates = await client.timeEntry.findMany({
    where: {
      employeeId: input.employeeId,
      ownerId: input.ownerId,
      workedOn: {
        gte: addDays(input.workedOn, -1),
        lt: addDays(input.workedOn, 2),
      },
      ...(input.excludeEntryId ? { NOT: { id: input.excludeEntryId } } : {}),
    },
    select: {
      endTime: true,
      hours: true,
      id: true,
      startTime: true,
      workedOn: true,
    },
  });
  const proposed = getShiftInterval(input.workedOn, input.startTime, input.endTime);
  const overlap = candidates.find((entry) => {
    if (!entry.startTime || !entry.endTime) return false;
    const existing = getShiftInterval(entry.workedOn, entry.startTime, entry.endTime);
    return proposed.start < existing.end && existing.start < proposed.end;
  });

  if (overlap) {
    throw new TimeEntryUserError(
      "This shift overlaps another entry for the employee, including time that crosses midnight.",
    );
  }

  const sameDayHours = candidates
    .filter((entry) => entry.workedOn.getTime() === input.workedOn.getTime())
    .reduce((total, entry) => total + Number(entry.hours.toString()), 0);

  if (sameDayHours + input.hours > 18) {
    throw new TimeEntryUserError("The employee's total for this work date cannot exceed 18 hours.");
  }
}

export function timeEntrySnapshot(entry: {
  deductLunch: boolean;
  endTime: string | null;
  hours: { toString: () => string };
  jobId: string | null;
  lunchMinutes: number;
  notes: string | null;
  startTime: string | null;
  workedOn: Date;
}) {
  return {
    deductLunch: entry.deductLunch,
    endTime: entry.endTime,
    hours: entry.hours.toString(),
    jobId: entry.jobId,
    lunchMinutes: entry.lunchMinutes,
    notes: entry.notes,
    startTime: entry.startTime,
    workedOn: entry.workedOn.toISOString(),
  } satisfies Prisma.InputJsonValue;
}
