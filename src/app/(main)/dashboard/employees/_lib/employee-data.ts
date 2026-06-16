import { format } from "date-fns";

import { prisma } from "@/lib/prisma";
import { getTimeTrackingRange, toHours } from "@/lib/time-tracking";

import type { EmployeeRow } from "../types";

function formatDecimal(value: { toString: () => string } | null) {
  return value ? Number(value.toString()).toFixed(2) : undefined;
}

function dateToInput(value: Date | null) {
  return value ? format(value, "yyyy-MM-dd") : undefined;
}

function mapEmployee(employee: {
  id: string;
  employeeNumber: string;
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  employmentType: string;
  payType: string;
  payRate: { toString: () => string } | null;
  startDate: Date | null;
  endDate: Date | null;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRelation: string | null;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  timeEntries: Array<{
    hours: { toString: () => string };
    workedOn: Date;
  }>;
}): EmployeeRow {
  const lastEntry = employee.timeEntries[0];

  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    name: employee.name,
    email: employee.email ?? undefined,
    phone: employee.phone ?? undefined,
    jobTitle: employee.jobTitle ?? undefined,
    department: employee.department ?? undefined,
    employmentType: employee.employmentType,
    payType: employee.payType,
    payRate: formatDecimal(employee.payRate),
    startDate: dateToInput(employee.startDate),
    endDate: dateToInput(employee.endDate),
    address: employee.address ?? undefined,
    emergencyName: employee.emergencyName ?? undefined,
    emergencyPhone: employee.emergencyPhone ?? undefined,
    emergencyRelation: employee.emergencyRelation ?? undefined,
    notes: employee.notes ?? undefined,
    active: employee.active,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
    lastWorkedOn: lastEntry ? format(lastEntry.workedOn, "yyyy-MM-dd") : undefined,
    totalHours: employee.timeEntries.reduce((total, entry) => total + toHours(entry.hours), 0),
  };
}

export async function getEmployees(ownerId: string, week?: string) {
  const { monthEnd, monthStart } = getTimeTrackingRange(week);
  const employees = await prisma.employee.findMany({
    where: {
      ownerId,
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
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return employees.map(mapEmployee);
}
