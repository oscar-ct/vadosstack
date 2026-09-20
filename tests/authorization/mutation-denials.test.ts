import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const databaseCall = vi.fn();
  const model = new Proxy(
    {},
    {
      get: () => databaseCall,
    },
  );
  const prisma = new Proxy(
    { $transaction: databaseCall },
    {
      get: (target, property) => Reflect.get(target, property) ?? model,
    },
  );

  return {
    audit: vi.fn(),
    databaseCall,
    getAuthorization: vi.fn(),
    prisma,
    revalidate: vi.fn(),
  };
});

vi.mock("@/lib/authorization", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authorization")>()),
  getPermittedDashboardAuthorization: mocks.getAuthorization,
}));
vi.mock("@/lib/authorization/audit", () => ({ recordAuthorizationAuditEvent: mocks.audit }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/workspace-revalidation", () => ({ revalidateWorkspacePath: mocks.revalidate }));

import { createCustomerAction, deleteCustomerAction } from "@/app/(main)/w/[workspaceSlug]/dashboard/customers/actions";
import { createEmployeeAction, deleteEmployeeAction } from "@/app/(main)/w/[workspaceSlug]/dashboard/employees/actions";
import { deleteEstimateAction, emailEstimateAction } from "@/app/(main)/w/[workspaceSlug]/dashboard/estimates/actions";
import {
  convertEstimateToJobAction,
  createEstimateRecordAction,
} from "@/app/(main)/w/[workspaceSlug]/dashboard/estimates/records-actions";
import { deleteInvoiceAction, emailInvoiceAction } from "@/app/(main)/w/[workspaceSlug]/dashboard/invoices/actions";
import {
  completeJobAction,
  createJobAction,
  createJobPaymentAction,
  deleteJobAction,
} from "@/app/(main)/w/[workspaceSlug]/dashboard/jobs/actions";
import {
  approveTimeEntryRequestAction,
  createTimeEntryAction,
  lockTimesheetWeekAction,
} from "@/app/(main)/w/[workspaceSlug]/dashboard/time-tracking/actions";

const initialState = { message: "", success: false };

describe("mutation permission denials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthorization.mockResolvedValue(null);
  });

  it.each([
    ["create a customer", "customers.create", () => createCustomerAction(initialState, new FormData())],
    ["delete a customer", "customers.delete", () => deleteCustomerAction(initialState, new FormData())],
    ["create an employee", "employees.manage", () => createEmployeeAction(initialState, new FormData())],
    ["delete an employee", "employees.manage", () => deleteEmployeeAction(initialState, new FormData())],
    ["send an estimate", "estimates.send", () => emailEstimateAction(initialState, new FormData())],
    ["delete an estimate", "estimates.delete", () => deleteEstimateAction(initialState, new FormData())],
    ["create an estimate", "estimates.create", () => createEstimateRecordAction(initialState, new FormData())],
    ["convert an estimate", "estimates.convert", () => convertEstimateToJobAction(initialState, new FormData())],
    ["send an invoice", "invoices.send", () => emailInvoiceAction(initialState, new FormData())],
    ["delete an invoice", "invoices.delete", () => deleteInvoiceAction(initialState, new FormData())],
    ["complete a job", "jobs.complete", () => completeJobAction(initialState, new FormData())],
    ["create a job", "jobs.create", () => createJobAction(initialState, new FormData())],
    ["delete a job", "jobs.delete", () => deleteJobAction(initialState, new FormData())],
    ["record a payment", "invoices.record_payment", () => createJobPaymentAction(initialState, new FormData())],
    ["create time", "time.manage", () => createTimeEntryAction(initialState, new FormData())],
    ["approve time", "time.approve", () => approveTimeEntryRequestAction(initialState, new FormData())],
    ["lock a week", "time.lock", () => lockTimesheetWeekAction(initialState, new FormData())],
  ])("denies an attempt to %s before database access", async (_label, permission, action) => {
    const result = await action();

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/permission/i);
    expect(mocks.getAuthorization).toHaveBeenCalledWith(permission);
    expect(mocks.databaseCall).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("prevents a time manager without job access from assigning time to a job", async () => {
    mocks.getAuthorization.mockResolvedValue({
      membership: {
        id: "membership-a",
        permissions: new Set(["time.manage"]),
        roleSystemKey: null,
        workspaceSlug: "business-a",
      },
      principal: { user: { id: "user-a" } },
      workspaceId: "workspace-a",
    });
    const data = new FormData();
    const today = new Date();
    const workDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    data.set("employeeId", "employee-a");
    data.set("jobId", "job-a");
    data.set("workedOn", workDate);
    data.set("startTime", "08:00");
    data.set("endTime", "09:00");
    data.set("deductLunch", "false");
    data.set("lunchMinutes", "0");

    const result = await createTimeEntryAction(initialState, data);

    expect(result).toEqual({
      success: false,
      message: "You do not have permission to assign hours to a job.",
    });
    expect(mocks.databaseCall).not.toHaveBeenCalled();
  });
});
