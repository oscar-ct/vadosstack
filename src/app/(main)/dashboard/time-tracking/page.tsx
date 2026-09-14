import { addDays, format } from "date-fns";

import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTimeTrackingRange, mapEmployeeSummary, mapTimeEntry, toHours } from "@/lib/time-tracking";

import { type TimeEntryRequestRow, TimeTrackingDashboard } from "./_components/time-tracking-dashboard";
import {
  approveTimeEntryRequestAction,
  createTimeEntryAction,
  deleteTimeEntryAction,
  lockTimesheetWeekAction,
  rejectTimeEntryRequestAction,
  unlockTimesheetWeekAction,
  updateTimeEntryAction,
} from "./actions";

type PageProps = {
  searchParams?: Promise<{
    request?: string;
    week?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view time tracking"
        description="Employee hours are private to each signed-in account."
      />
    );
  }

  const params = await searchParams;
  const { monthLabel, nextWeek, periodLabel, previousWeek, weekEnd, weekStart } = getTimeTrackingRange(params?.week);
  const [employees, entries, pendingRequests, jobs, timesheetLock, auditEvents] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ownerId: currentUser.id,
      },
      select: {
        accentColor: true,
        active: true,
        department: true,
        email: true,
        employeeNumber: true,
        id: true,
        name: true,
        phone: true,
        timeEntries: {
          orderBy: {
            workedOn: "desc",
          },
          select: { hours: true, workedOn: true },
          take: 1,
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        ownerId: currentUser.id,
        workedOn: {
          gte: addDays(weekStart, -1),
          lt: weekEnd,
        },
      },
      include: {
        employee: true,
        job: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: {
        workedOn: "asc",
      },
    }),
    prisma.timeEntryRequest.findMany({
      where: {
        ownerId: currentUser.id,
        status: "Pending",
      },
      include: {
        employee: true,
        job: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: {
        requestedAt: "desc",
      },
      take: 100,
    }),
    prisma.job.findMany({
      where: {
        ownerId: currentUser.id,
      },
      select: {
        customer: { select: { name: true } },
        description: true,
        id: true,
      },
      orderBy: [{ dateBegin: "desc" }, { createdAt: "desc" }],
      take: 250,
    }),
    prisma.timesheetLock.findUnique({
      where: { ownerId_weekStart: { ownerId: currentUser.id, weekStart } },
      select: { lockedAt: true },
    }),
    prisma.timeEntryAudit.findMany({
      where: { ownerId: currentUser.id },
      orderBy: { createdAt: "desc" },
      select: {
        action: true,
        createdAt: true,
        employee: { select: { employeeNumber: true, name: true } },
        id: true,
        source: true,
      },
      take: 30,
    }),
  ]);

  const currentEntryIds = pendingRequests
    .map((request) => request.timeEntryId)
    .filter((entryId): entryId is string => Boolean(entryId));
  const currentEntries = currentEntryIds.length
    ? await prisma.timeEntry.findMany({
        where: {
          id: {
            in: currentEntryIds,
          },
          ownerId: currentUser.id,
        },
        include: {
          job: {
            include: {
              customer: true,
            },
          },
        },
      })
    : [];
  const currentEntriesById = new Map(currentEntries.map((entry) => [entry.id, entry]));
  const entryRows = entries.map(mapTimeEntry);
  const weekStartKey = format(weekStart, "yyyy-MM-dd");
  const carryInEntries = entryRows.filter(
    (entry) => entry.workedOn < weekStartKey && entry.startTime && entry.endTime && entry.endTime < entry.startTime,
  );
  const weekEntryRows = entryRows.filter((entry) => entry.workedOn >= weekStartKey);
  const dayGroups = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const dateKey = format(date, "yyyy-MM-dd");
    const dayEntries = weekEntryRows.filter((entry) => entry.workedOn === dateKey);

    return {
      date: dateKey,
      entries: dayEntries,
      totalHours: dayEntries.reduce((total, entry) => total + entry.hours, 0),
    };
  });
  const employeeSummaries = employees.map(mapEmployeeSummary);
  const pendingRequestRows: TimeEntryRequestRow[] = pendingRequests.map((request) => {
    const currentEntry = request.timeEntryId ? currentEntriesById.get(request.timeEntryId) : undefined;

    return {
      id: request.id,
      action: request.action,
      currentEntry: currentEntry
        ? {
            deductLunch: currentEntry.deductLunch,
            endTime: currentEntry.endTime ?? undefined,
            hours: toHours(currentEntry.hours),
            jobCustomerName: currentEntry.job?.customer?.name ?? undefined,
            jobId: currentEntry.job?.id,
            jobTitle: currentEntry.job?.description,
            lunchMinutes: currentEntry.lunchMinutes,
            notes: currentEntry.notes ?? undefined,
            startTime: currentEntry.startTime ?? undefined,
            updatedAt: currentEntry.updatedAt.toISOString(),
            workedOn: format(currentEntry.workedOn, "yyyy-MM-dd"),
          }
        : undefined,
      deductLunch: request.deductLunch,
      employeeAccentColor: request.employee.accentColor,
      employeeName: request.employee.name,
      employeeNumber: request.employee.employeeNumber,
      hasConflict: Boolean(
        currentEntry &&
          (!request.baseEntryUpdatedAt || currentEntry.updatedAt.getTime() !== request.baseEntryUpdatedAt.getTime()),
      ),
      endTime: request.endTime ?? undefined,
      hours: request.hours ? toHours(request.hours) : undefined,
      jobCustomerName: request.job?.customer?.name ?? undefined,
      jobId: request.job?.id ?? undefined,
      jobTitle: request.job?.description ?? undefined,
      lunchMinutes: request.lunchMinutes,
      notes: request.notes ?? undefined,
      requestedAt: request.requestedAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString(),
      reviewReason: request.reviewReason ?? undefined,
      startTime: request.startTime ?? undefined,
      status: request.status,
      workedOn: request.workedOn ? format(request.workedOn, "yyyy-MM-dd") : undefined,
    };
  });

  return (
    <TimeTrackingDashboard
      approveTimeEntryRequestAction={approveTimeEntryRequestAction}
      auditEvents={auditEvents.map((event) => ({
        action: event.action,
        createdAt: event.createdAt.toISOString(),
        employeeName: event.employee.name,
        employeeNumber: event.employee.employeeNumber,
        id: event.id,
        source: event.source,
      }))}
      carryInEntries={carryInEntries}
      createTimeEntryAction={createTimeEntryAction}
      dayGroups={dayGroups}
      deleteTimeEntryAction={deleteTimeEntryAction}
      employees={employeeSummaries}
      jobs={jobs.map((job) => ({
        customerName: job.customer?.name ?? undefined,
        id: job.id,
        title: job.description,
      }))}
      isWeekLocked={Boolean(timesheetLock)}
      lockTimesheetWeekAction={lockTimesheetWeekAction}
      monthLabel={monthLabel}
      nextWeekHref={`/dashboard/time-tracking?week=${nextWeek}`}
      pendingRequests={pendingRequestRows}
      periodLabel={periodLabel}
      previousWeekHref={`/dashboard/time-tracking?week=${previousWeek}`}
      rejectTimeEntryRequestAction={rejectTimeEntryRequestAction}
      selectedRequestId={params?.request}
      unlockTimesheetWeekAction={unlockTimesheetWeekAction}
      updateTimeEntryAction={updateTimeEntryAction}
      weekStart={format(weekStart, "yyyy-MM-dd")}
    />
  );
}
