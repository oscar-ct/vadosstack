import { notFound } from "next/navigation";

import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";

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
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view this employee"
        description="Employee records are private to each signed-in account."
      />
    );
  }

  const { employeeId } = await params;
  const [employee, usageCounts] = await Promise.all([
    getEmployee(currentUser.id, employeeId),
    getEmployeeColorUsageCounts(currentUser.id),
  ]);

  if (!employee) {
    notFound();
  }

  return (
    <EmployeeProfile
      deleteAction={deleteEmployeeAction}
      employee={employee}
      updateAccentAction={updateEmployeeAccentAction}
      updateAction={updateEmployeeAction}
      usageCounts={usageCounts}
    />
  );
}
