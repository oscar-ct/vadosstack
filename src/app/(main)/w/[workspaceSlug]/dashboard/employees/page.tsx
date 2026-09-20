import { AuthRequiredState } from "@/components/auth-required-state";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";

import { EmployeesDashboard } from "./_components/employees-dashboard";
import { getEmployees } from "./_lib/employee-data";
import { createEmployeeAction, updateEmployeeAccentAction, updateEmployeeStatusAction } from "./actions";

export default async function Page() {
  const authorization = await getPermittedDashboardAuthorization("employees.view");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Sign in to view employees"
        description="Employee records are private to each signed-in account."
      />
    );
  }

  const canManage = can(authorization.membership, "employees.manage");
  const canManageCompensation = can(authorization.membership, "employees.compensation.manage");
  const canViewCompensation = canManageCompensation || can(authorization.membership, "employees.compensation.view");
  const canManageAccess = can(authorization.membership, "roles.manage");
  const employees = await getEmployees(authorization.workspaceId, canViewCompensation, canManageAccess);

  return (
    <EmployeesDashboard
      createAction={createEmployeeAction}
      canManage={canManage}
      canManageCompensation={canManageCompensation}
      canManageAccess={canManageAccess}
      employees={employees}
      updateAccentAction={updateEmployeeAccentAction}
      updateStatusAction={updateEmployeeStatusAction}
    />
  );
}
