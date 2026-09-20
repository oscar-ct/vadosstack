import { notFound } from "next/navigation";

import { AuthRequiredState } from "@/components/auth-required-state";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";

import { getEmployee, getEmployeeColorUsageCounts } from "../_lib/employee-data";
import { deleteEmployeeAction, updateEmployeeAccentAction, updateEmployeeAction } from "../actions";
import { EmployeeProfile } from "./_components/employee-profile";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{
    employeeId: string;
  }>;
}) {
  const authorization = await getPermittedDashboardAuthorization("employees.view");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Sign in to view this employee"
        description="Employee records are private to each signed-in account."
      />
    );
  }

  const { employeeId } = await params;
  const canManage = can(authorization.membership, "employees.manage");
  const canManageCompensation = can(authorization.membership, "employees.compensation.manage");
  const canViewCompensation = canManageCompensation || can(authorization.membership, "employees.compensation.view");
  const canManageAccess = can(authorization.membership, "roles.manage");
  const [employee, usageCounts] = await Promise.all([
    getEmployee(authorization.workspaceId, employeeId, canViewCompensation, canManageAccess),
    canManage ? getEmployeeColorUsageCounts(authorization.workspaceId) : Promise.resolve({}),
  ]);

  if (!employee) {
    notFound();
  }

  return (
    <EmployeeProfile
      deleteAction={deleteEmployeeAction}
      employee={employee}
      canManage={canManage}
      canManageAccess={canManageAccess}
      canManageCompensation={canManageCompensation}
      canViewCompensation={canViewCompensation}
      updateAccentAction={updateEmployeeAccentAction}
      updateAction={updateEmployeeAction}
      usageCounts={usageCounts}
    />
  );
}
