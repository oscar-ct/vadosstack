import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { addDays, format, subDays } from "date-fns";

import {
  type TimeEntryRequestRow,
  TimeTrackingDashboard,
} from "@/app/(main)/dashboard/time-tracking/_components/time-tracking-dashboard";
import { prisma } from "@/lib/prisma";
import { getTimeTrackingRange, mapEmployeeSummary, mapTimeEntry, toHours } from "@/lib/time-tracking";

import vadosstackLogoSmall from "../../../../media/vadosstack-logo-transparent-small.png";
import {
  disabledEmployeePortalAction,
  employeeCreateTimeEntryAction,
  employeeDeleteTimeEntryAction,
  employeeDeleteTimeEntryRequestAction,
  employeeLogoutAction,
  employeeUpdateTimeEntryAction,
  employeeUpdateTimeEntryRequestAction,
  getEmployeePortalSession,
} from "../actions";

type PageProps = {
  searchParams?: Promise<{
    week?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const employee = await getEmployeePortalSession();

  if (!employee) {
    redirect("/employee-portal");
  }

  const params = await searchParams;
  const { monthEnd, monthLabel, monthStart, nextWeek, periodLabel, previousWeek, weekEnd, weekStart } =
    getTimeTrackingRange(params?.week);

  const [employeeWithMonthEntries, entries, requests, jobs] = await Promise.all([
    prisma.employee.findUniqueOrThrow({
      where: {
        id_ownerId: {
          id: employee.id,
          ownerId: employee.ownerId,
        },
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
    }),
    prisma.timeEntry.findMany({
      where: {
        employeeId: employee.id,
        ownerId: employee.ownerId,
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
        employeeId: employee.id,
        ownerId: employee.ownerId,
      },
      include: {
        job: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: {
        requestedAt: "desc",
      },
      take: 25,
    }),
    prisma.job.findMany({
      where: {
        ownerId: employee.ownerId,
        OR: [
          {
            status: {
              notIn: ["Completed", "Cancelled"],
            },
          },
          {
            status: "Completed",
            updatedAt: {
              gte: subDays(new Date(), 30),
            },
          },
        ],
      },
      select: {
        description: true,
        id: true,
      },
      orderBy: [{ dateBegin: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const requestEntryIds = requests
    .map((request) => request.timeEntryId)
    .filter((entryId): entryId is string => Boolean(entryId));
  const requestCurrentEntries = requestEntryIds.length
    ? await prisma.timeEntry.findMany({
        where: {
          id: {
            in: requestEntryIds,
          },
          employeeId: employee.id,
          ownerId: employee.ownerId,
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
  const currentEntriesById = new Map(requestCurrentEntries.map((entry) => [entry.id, entry]));
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
  const employeeSummary = mapEmployeeSummary(employeeWithMonthEntries);
  const requestRows: TimeEntryRequestRow[] = requests.map((request) => {
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
      employeeName: employee.name,
      employeeNumber: employee.employeeNumber,
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
    <div className="min-h-svh bg-[linear-gradient(180deg,#f7f5ff_0,#ffffff_22rem)] text-[#303030] selection:bg-[#6f78f7] selection:text-white">
      <header className="border-black/5 border-b bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <Link
            href="/"
            aria-label="VadosStack home"
            className="inline-flex items-center gap-2.5 font-semibold text-lg tracking-[-0.03em]"
          >
            <Image src={vadosstackLogoSmall} alt="" aria-hidden="true" className="h-auto w-7 object-contain" priority />
            VadosStack
          </Link>
          <span className="rounded-full bg-[#efedff] px-3 py-1.5 font-medium text-[#5964dd] text-xs">
            Employee Portal
          </span>
        </div>
      </header>
      <main className="p-4 md:p-6">
        <div className="mx-auto w-full max-w-7xl">
          <TimeTrackingDashboard
            createEmployeeAction={disabledEmployeePortalAction}
            createTimeEntryAction={employeeCreateTimeEntryAction}
            dayGroups={dayGroups}
            deleteEmployeeTimeRequestAction={employeeDeleteTimeEntryRequestAction}
            deleteEmployeeAction={disabledEmployeePortalAction}
            deleteTimeEntryAction={employeeDeleteTimeEntryAction}
            employeeLogoutAction={employeeLogoutAction}
            employeeTimeRequests={requestRows}
            employees={[employeeSummary]}
            jobs={jobs.map((job) => ({
              id: job.id,
              title: job.description,
            }))}
            headerDescription={`Review your hours for ${periodLabel}, submit changes for manager approval, and track request status.`}
            monthLabel={monthLabel}
            nextWeekHref={`/employee-portal/timesheet?week=${nextWeek}`}
            periodLabel={periodLabel}
            previousWeekHref={`/employee-portal/timesheet?week=${previousWeek}`}
            requiresManagerApproval
            secondaryStatLabel="Employee ID"
            secondaryStatValue={employee.employeeNumber}
            showEmployeeControls={false}
            updateEmployeeAction={disabledEmployeePortalAction}
            updateEmployeeTimeRequestAction={employeeUpdateTimeEntryRequestAction}
            updateTimeEntryAction={employeeUpdateTimeEntryAction}
          />
        </div>
      </main>
    </div>
  );
}
