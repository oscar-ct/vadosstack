import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PermissionKey, WorkspaceMembershipSummary } from "@/lib/authorization";

const mocks = vi.hoisted(() => ({
  estimateFindMany: vi.fn(),
  invoiceAggregate: vi.fn(),
  invoiceFindMany: vi.fn(),
  jobFindMany: vi.fn(),
  jobPaymentFindMany: vi.fn(),
  leadFindMany: vi.fn(),
  taskFindMany: vi.fn(),
  timeEntryFindMany: vi.fn(),
  timeRequestFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    estimateRecord: { findMany: mocks.estimateFindMany },
    invoice: { aggregate: mocks.invoiceAggregate, findMany: mocks.invoiceFindMany },
    job: { findMany: mocks.jobFindMany },
    jobPayment: { findMany: mocks.jobPaymentFindMany },
    lead: { findMany: mocks.leadFindMany },
    task: { findMany: mocks.taskFindMany },
    timeEntry: { findMany: mocks.timeEntryFindMany },
    timeEntryRequest: { findMany: mocks.timeRequestFindMany },
  },
}));
vi.mock("@/components/auth-required-state", () => ({ AuthRequiredState: vi.fn() }));
vi.mock("@/app/(main)/w/[workspaceSlug]/dashboard/command-center/_components/command-center-dashboard", () => ({
  CommandCenterDashboard: vi.fn(),
}));

import { getManagerActionQueue } from "@/app/(main)/w/[workspaceSlug]/dashboard/_lib/manager-action-queue";
import { getCommandCenterData } from "@/app/(main)/w/[workspaceSlug]/dashboard/command-center/_components/command-center-page";

function membership(...permissions: PermissionKey[]): WorkspaceMembershipSummary {
  return {
    employeeId: null,
    id: "membership-a",
    membershipStatus: "Active",
    permissions: new Set(permissions),
    roleId: "role-a",
    roleName: "Custom",
    roleSystemKey: null,
    workspaceId: "workspace-a",
    workspaceMode: "Both",
    workspaceName: "Business A",
    workspaceSlug: "business-a",
    workspaceStatus: "Active",
    workspaceSuspendedAt: null,
    workspaceSuspensionReasonCode: null,
    workspaceSuspendedUntil: null,
  };
}

describe("read-side permission privacy", () => {
  beforeEach(() => {
    mocks.estimateFindMany.mockResolvedValue([]);
    mocks.invoiceAggregate.mockResolvedValue({
      _count: { _all: 0 },
      _sum: { amountPaid: null, balanceDue: null, finalCost: null },
    });
    mocks.invoiceFindMany.mockResolvedValue([]);
    mocks.jobFindMany.mockResolvedValue([]);
    mocks.jobPaymentFindMany.mockResolvedValue([]);
    mocks.leadFindMany.mockResolvedValue([]);
    mocks.taskFindMany.mockResolvedValue([]);
    mocks.timeEntryFindMany.mockResolvedValue([]);
    mocks.timeRequestFindMany.mockResolvedValue([]);
  });

  it("does not query any action-queue domain without its view permission", async () => {
    await expect(getManagerActionQueue("workspace-a", undefined, membership())).resolves.toEqual([]);

    expect(mocks.leadFindMany).not.toHaveBeenCalled();
    expect(mocks.jobFindMany).not.toHaveBeenCalled();
    expect(mocks.estimateFindMany).not.toHaveBeenCalled();
    expect(mocks.taskFindMany).not.toHaveBeenCalled();
    expect(mocks.timeRequestFindMany).not.toHaveBeenCalled();
  });

  it("queries only action-queue domains explicitly granted to the member", async () => {
    await getManagerActionQueue("workspace-a", undefined, membership("jobs.view", "time.approve"));

    expect(mocks.jobFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: "workspace-a" } }));
    expect(mocks.timeRequestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "workspace-a", status: "Pending" } }),
    );
    expect(mocks.leadFindMany).not.toHaveBeenCalled();
    expect(mocks.estimateFindMany).not.toHaveBeenCalled();
    expect(mocks.taskFindMany).not.toHaveBeenCalled();
  });

  it("does not query performance-report domains without their corresponding view permissions", async () => {
    const data = await getCommandCenterData("workspace-a", "Business A", membership());

    expect(data.totals).toEqual({
      collectionRate: 0,
      invoices: 0,
      openJobs: 0,
      openWorkValue: 0,
      receivablesTotal: 0,
      waitingEstimateCount: 0,
      waitingEstimateValue: 0,
    });
    expect(mocks.jobFindMany).not.toHaveBeenCalled();
    expect(mocks.estimateFindMany).not.toHaveBeenCalled();
    expect(mocks.invoiceAggregate).not.toHaveBeenCalled();
    expect(mocks.invoiceFindMany).not.toHaveBeenCalled();
    expect(mocks.jobPaymentFindMany).not.toHaveBeenCalled();
    expect(mocks.timeEntryFindMany).not.toHaveBeenCalled();
  });

  it("loads invoice reporting without leaking jobs, estimates, or employee time", async () => {
    await getCommandCenterData("workspace-a", "Business A", membership("invoices.view"));

    expect(mocks.invoiceAggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: "workspace-a" } }));
    expect(mocks.invoiceFindMany).toHaveBeenCalled();
    expect(mocks.jobPaymentFindMany).toHaveBeenCalled();
    expect(mocks.jobFindMany).not.toHaveBeenCalled();
    expect(mocks.estimateFindMany).not.toHaveBeenCalled();
    expect(mocks.timeEntryFindMany).not.toHaveBeenCalled();
  });
});
