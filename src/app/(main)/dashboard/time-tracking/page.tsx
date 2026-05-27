import { addDays, format } from "date-fns";

import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTimeTrackingRange, mapEmployeeSummary, mapTimeEntry, toHours } from "@/lib/time-tracking";

import { type TimeEntryRequestRow, TimeTrackingDashboard } from "./_components/time-tracking-dashboard";
import {
  approveTimeEntryRequestAction,
  createEmployeeAction,
  createTimeEntryAction,
  deleteEmployeeAction,
  deleteTimeEntryAction,
  rejectTimeEntryRequestAction,
  updateEmployeeAction,
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
  const { monthEnd, monthLabel, monthStart, nextWeek, periodLabel, previousWeek, weekEnd, weekStart } =
    getTimeTrackingRange(params?.week);
  const [employees, entries, pendingRequests, jobs] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ownerId: currentUser.id,
        active: true,
      },
      include: {
        timeEntries: {
          where: {
            workedOn: {
              gte: monthStart,
              lt: monthEnd,
            },
          },
          orderBy: {
            workedOn: "desc",
          },
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
          gte: weekStart,
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
    }),
    prisma.job.findMany({
      where: {
        ownerId: currentUser.id,
      },
      include: {
        customer: true,
      },
      orderBy: [{ dateBegin: "desc" }, { createdAt: "desc" }],
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
  const dayGroups = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const dateKey = format(date, "yyyy-MM-dd");
    const dayEntries = entryRows.filter((entry) => entry.workedOn === dateKey);

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
            workedOn: format(currentEntry.workedOn, "yyyy-MM-dd"),
          }
        : undefined,
      deductLunch: request.deductLunch,
      employeeName: request.employee.name,
      employeeNumber: request.employee.employeeNumber,
      endTime: request.endTime ?? undefined,
      hours: request.hours ? toHours(request.hours) : undefined,
      jobCustomerName: request.job?.customer?.name ?? undefined,
      jobId: request.job?.id ?? undefined,
      jobTitle: request.job?.description ?? undefined,
      lunchMinutes: request.lunchMinutes,
      notes: request.notes ?? undefined,
      requestedAt: request.requestedAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString(),
      startTime: request.startTime ?? undefined,
      status: request.status,
      workedOn: request.workedOn ? format(request.workedOn, "yyyy-MM-dd") : undefined,
    };
  });

  return (
    <TimeTrackingDashboard
      approveTimeEntryRequestAction={approveTimeEntryRequestAction}
      createEmployeeAction={createEmployeeAction}
      createTimeEntryAction={createTimeEntryAction}
      dayGroups={dayGroups}
      deleteEmployeeAction={deleteEmployeeAction}
      deleteTimeEntryAction={deleteTimeEntryAction}
      employees={employeeSummaries}
      jobs={jobs.map((job) => ({
        customerName: job.customer?.name ?? undefined,
        id: job.id,
        title: job.description,
      }))}
      monthLabel={monthLabel}
      nextWeekHref={`/dashboard/time-tracking?week=${nextWeek}`}
      pendingRequests={pendingRequestRows}
      periodLabel={periodLabel}
      previousWeekHref={`/dashboard/time-tracking?week=${previousWeek}`}
      rejectTimeEntryRequestAction={rejectTimeEntryRequestAction}
      selectedRequestId={params?.request}
      updateEmployeeAction={updateEmployeeAction}
      updateTimeEntryAction={updateTimeEntryAction}
    />
  );
}
