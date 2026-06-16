import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";

import { EmployeesDashboard } from "./_components/employees-dashboard";
import { getEmployees } from "./_lib/employee-data";
import { createEmployeeAction, deleteEmployeeAction, updateEmployeeAction } from "./actions";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{
    week?: string;
  }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view employees"
        description="Employee records are private to each signed-in account."
      />
    );
  }

  const params = await searchParams;
  const employees = await getEmployees(currentUser.id, params?.week);

  return (
    <EmployeesDashboard
      createAction={createEmployeeAction}
      deleteAction={deleteEmployeeAction}
      employees={employees}
      updateAction={updateEmployeeAction}
    />
  );
}
