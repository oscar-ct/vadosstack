import { format } from "date-fns";

import { prisma } from "@/lib/prisma";
import { toHours } from "@/lib/time-tracking";

import type { EmployeeRow } from "../types";

function formatDecimal(value: { toString: () => string } | null) {
  return value ? Number(value.toString()).toFixed(2) : undefined;
}

function dateToInput(value: Date | null) {
  return value ? format(value, "yyyy-MM-dd") : undefined;
}

function mapEmployee(
  employee: {
    accentColor: string;
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
      workedOn: Date;
    }>;
  },
  totalHours: number,
  includeCompensation: boolean,
  dashboardAccess?: EmployeeRow["dashboardAccess"],
): EmployeeRow {
  const lastEntry = employee.timeEntries[0];

  return {
    accentColor: employee.accentColor,
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    name: employee.name,
    email: employee.email ?? undefined,
    phone: employee.phone ?? undefined,
    jobTitle: employee.jobTitle ?? undefined,
    department: employee.department ?? undefined,
    employmentType: employee.employmentType,
    payType: includeCompensation ? employee.payType : "Restricted",
    payRate: includeCompensation ? formatDecimal(employee.payRate) : undefined,
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
    totalHours,
    dashboardAccess,
  };
}

export async function getEmployees(ownerId: string, includeCompensation = true, includeDashboardAccess = false) {
  const [employees, hourTotals, memberships, invitations] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ownerId,
      },
      include: {
        timeEntries: {
          orderBy: {
            workedOn: "desc",
          },
          select: {
            workedOn: true,
          },
          take: 1,
        },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.timeEntry.groupBy({
      by: ["employeeId"],
      where: {
        ownerId,
      },
      _sum: {
        hours: true,
      },
    }),
    includeDashboardAccess
      ? prisma.workspaceMembership.findMany({
          where: { workspaceId: ownerId, employeeId: { not: null } },
          select: {
            employeeId: true,
            status: true,
            role: { select: { isProtected: true, name: true } },
          },
        })
      : Promise.resolve([]),
    includeDashboardAccess
      ? prisma.workspaceInvitation.findMany({
          where: {
            workspaceId: ownerId,
            employeeId: { not: null },
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
          select: {
            employeeId: true,
            role: { select: { isProtected: true, name: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const hoursByEmployee = new Map(
    hourTotals.map((total) => [total.employeeId, total._sum.hours ? toHours(total._sum.hours) : 0]),
  );

  const membershipsByEmployee = new Map(memberships.map((membership) => [membership.employeeId, membership]));
  const invitationsByEmployee = new Map(
    invitations.map((invitation) => [invitation.employeeId, invitation] as const).reverse(),
  );

  return employees.map((employee) => {
    const membership = membershipsByEmployee.get(employee.id);
    const invitation = invitationsByEmployee.get(employee.id);
    const dashboardAccess: EmployeeRow["dashboardAccess"] = membership
      ? {
          isCustomRole: !membership.role.isProtected,
          roleName: membership.role.name,
          status:
            membership.status === "Active" ? "Active" : membership.status === "Suspended" ? "Suspended" : "Removed",
        }
      : invitation
        ? {
            isCustomRole: !invitation.role.isProtected,
            roleName: invitation.role.name,
            status: "Invitation pending",
          }
        : { isCustomRole: false, status: "No access" };

    return mapEmployee(
      employee,
      hoursByEmployee.get(employee.id) ?? 0,
      includeCompensation,
      includeDashboardAccess ? dashboardAccess : undefined,
    );
  });
}

export async function getEmployee(
  ownerId: string,
  employeeId: string,
  includeCompensation = true,
  includeDashboardAccess = false,
) {
  const [employee, hourTotal, membership, invitation] = await Promise.all([
    prisma.employee.findUnique({
      where: {
        id_ownerId: {
          id: employeeId,
          ownerId,
        },
      },
      include: {
        timeEntries: {
          orderBy: {
            workedOn: "desc",
          },
          select: {
            workedOn: true,
          },
          take: 1,
        },
      },
    }),
    prisma.timeEntry.aggregate({
      where: {
        employeeId,
        ownerId,
      },
      _sum: {
        hours: true,
      },
    }),
    includeDashboardAccess
      ? prisma.workspaceMembership.findFirst({
          where: { workspaceId: ownerId, employeeId },
          select: { status: true, role: { select: { isProtected: true, name: true } } },
        })
      : null,
    includeDashboardAccess
      ? prisma.workspaceInvitation.findFirst({
          where: {
            workspaceId: ownerId,
            employeeId,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
          select: { role: { select: { isProtected: true, name: true } } },
        })
      : null,
  ]);

  if (!employee) return null;

  const dashboardAccess: EmployeeRow["dashboardAccess"] = membership
    ? {
        isCustomRole: !membership.role.isProtected,
        roleName: membership.role.name,
        status: membership.status === "Active" ? "Active" : membership.status === "Suspended" ? "Suspended" : "Removed",
      }
    : invitation
      ? {
          isCustomRole: !invitation.role.isProtected,
          roleName: invitation.role.name,
          status: "Invitation pending",
        }
      : { isCustomRole: false, status: "No access" };

  return mapEmployee(
    employee,
    hourTotal._sum.hours ? toHours(hourTotal._sum.hours) : 0,
    includeCompensation,
    includeDashboardAccess ? dashboardAccess : undefined,
  );
}

export async function getEmployeeColorUsageCounts(ownerId: string) {
  const employees = await prisma.employee.findMany({
    where: {
      ownerId,
    },
    select: {
      accentColor: true,
    },
  });

  return employees.reduce<Record<string, number>>((counts, employee) => {
    counts[employee.accentColor] = (counts[employee.accentColor] ?? 0) + 1;
    return counts;
  }, {});
}
