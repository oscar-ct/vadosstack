import { addDays, format } from "date-fns";

import { AuthRequiredState } from "@/components/auth-required-state";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
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

function getVisibleJobDetails(value: unknown, permitted: boolean) {
  if (!permitted || !value || typeof value !== "object") return null;
  const job = value as Record<string, unknown>;
  if (typeof job.id !== "string" || typeof job.description !== "string") return null;
  const customer = job.customer && typeof job.customer === "object" ? (job.customer as Record<string, unknown>) : null;

  return {
    customer: customer && typeof customer.name === "string" ? { name: customer.name } : null,
    description: job.description,
    id: job.id,
  };
}

export default async function Page({ searchParams }: PageProps) {
  const authorization = await getPermittedDashboardAuthorization("time.view");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Sign in to view time tracking"
        description="Employee hours are private to each signed-in account."
      />
    );
  }
  const workspaceId = authorization.workspaceId;
  const canManageTime = can(authorization.membership, "time.manage");
  const canApproveTime = can(authorization.membership, "time.approve");
  const canLockTime = can(authorization.membership, "time.lock");
  const canExport = can(authorization.membership, "reports.export");
  const canViewJobs = can(authorization.membership, "jobs.view");

  const params = await searchParams;
  const { monthLabel, nextWeek, periodLabel, previousWeek, weekEnd, weekStart } = getTimeTrackingRange(params?.week);
  const [employees, entries, pendingRequests, jobs, timesheetLock, auditEvents] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ownerId: workspaceId,
      },
      select: {
        accentColor: true,
        active: true,
        department: true,
        employeeNumber: true,
        id: true,
        name: true,
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
        ownerId: workspaceId,
        workedOn: {
          gte: addDays(weekStart, -1),
          lt: weekEnd,
        },
      },
      include: {
        employee: true,
        job: canViewJobs ? { include: { customer: true } } : false,
      },
      orderBy: {
        workedOn: "asc",
      },
    }),
    canApproveTime
      ? prisma.timeEntryRequest.findMany({
          where: {
            ownerId: workspaceId,
            status: "Pending",
          },
          include: {
            employee: true,
            job: canViewJobs ? { include: { customer: true } } : false,
          },
          orderBy: {
            requestedAt: "desc",
          },
          take: 100,
        })
      : Promise.resolve([]),
    canViewJobs
      ? prisma.job.findMany({
          where: {
            ownerId: workspaceId,
          },
          select: {
            customer: { select: { name: true } },
            description: true,
            id: true,
          },
          orderBy: [{ dateBegin: "desc" }, { createdAt: "desc" }],
          take: 250,
        })
      : Promise.resolve([]),
    prisma.timesheetLock.findUnique({
      where: { ownerId_weekStart: { ownerId: workspaceId, weekStart } },
      select: { lockedAt: true },
    }),
    canManageTime || canApproveTime
      ? prisma.timeEntryAudit.findMany({
          where: { ownerId: workspaceId },
          orderBy: { createdAt: "desc" },
          select: {
            action: true,
            createdAt: true,
            employee: { select: { employeeNumber: true, name: true } },
            id: true,
            source: true,
          },
          take: 30,
        })
      : Promise.resolve([]),
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
          ownerId: workspaceId,
        },
        include: {
          job: canViewJobs ? { include: { customer: true } } : false,
        },
      })
    : [];
  const currentEntriesById = new Map(currentEntries.map((entry) => [entry.id, entry]));
  const entryRows = entries.map((entry) =>
    mapTimeEntry({ ...entry, job: getVisibleJobDetails(entry.job, canViewJobs) }),
  );
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
    const currentJob = getVisibleJobDetails(currentEntry?.job, canViewJobs);
    const requestedJob = getVisibleJobDetails(request.job, canViewJobs);

    return {
      id: request.id,
      action: request.action,
      currentEntry: currentEntry
        ? {
            deductLunch: currentEntry.deductLunch,
            endTime: currentEntry.endTime ?? undefined,
            hours: toHours(currentEntry.hours),
            jobCustomerName: currentJob?.customer?.name ?? undefined,
            jobId: currentJob?.id,
            jobTitle: currentJob?.description,
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
      jobCustomerName: requestedJob?.customer?.name ?? undefined,
      jobId: requestedJob?.id ?? undefined,
      jobTitle: requestedJob?.description ?? undefined,
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
      approveTimeEntryRequestAction={canApproveTime ? approveTimeEntryRequestAction : undefined}
      auditEvents={auditEvents.map((event) => ({
        action: event.action,
        createdAt: event.createdAt.toISOString(),
        employeeName: event.employee.name,
        employeeNumber: event.employee.employeeNumber,
        id: event.id,
        source: event.source,
      }))}
      carryInEntries={carryInEntries}
      canExport={canExport}
      canManage={canManageTime}
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
      lockTimesheetWeekAction={canLockTime ? lockTimesheetWeekAction : undefined}
      monthLabel={monthLabel}
      nextWeekHref={`/dashboard/time-tracking?week=${nextWeek}`}
      pendingRequests={pendingRequestRows}
      periodLabel={periodLabel}
      previousWeekHref={`/dashboard/time-tracking?week=${previousWeek}`}
      rejectTimeEntryRequestAction={canApproveTime ? rejectTimeEntryRequestAction : undefined}
      selectedRequestId={params?.request}
      unlockTimesheetWeekAction={canLockTime ? unlockTimesheetWeekAction : undefined}
      updateTimeEntryAction={updateTimeEntryAction}
      weekStart={format(weekStart, "yyyy-MM-dd")}
    />
  );
}
