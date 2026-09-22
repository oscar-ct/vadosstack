import { describe, expect, it } from "vitest";

import type { CurrentPrincipal, WorkspaceMembershipSummary } from "@/lib/authorization/authorize";
import { getPrincipalDashboardDestination } from "@/lib/authorization/dashboard-destination";

function membership(overrides: Partial<WorkspaceMembershipSummary>): WorkspaceMembershipSummary {
  return {
    employeeId: null,
    id: "membership-a",
    membershipStatus: "Active",
    permissions: new Set(),
    roleId: "role-a",
    roleName: "Admin",
    roleSystemKey: "ADMIN",
    workspaceId: "workspace-a",
    workspaceMode: "both",
    workspaceName: "Workspace A",
    workspaceSlug: "workspace-a",
    workspaceStatus: "Active",
    workspaceSuspendedAt: null,
    workspaceSuspendedUntil: null,
    workspaceSuspensionReasonCode: null,
    ...overrides,
  };
}

function principal(memberships: WorkspaceMembershipSummary[]): CurrentPrincipal {
  return {
    authorizationVersion: "version-a",
    memberships,
    user: {
      admin: false,
      companyAddress: null,
      companyEmail: null,
      companyName: "Member Business",
      companyPhone: null,
      email: "member@example.com",
      estimateMessageAlign: "left",
      estimateMessageEnabled: false,
      estimateMessageText: "",
      estimateValidDays: 30,
      id: "user-a",
      invoiceDueDays: 30,
      invoiceMessageAlign: "left",
      invoiceMessageEnabled: false,
      invoiceMessageText: "",
      name: "Member",
      orderMessageText: "",
      workspaceMode: "both",
    },
  };
}

describe("dashboard destination", () => {
  it("prefers an active membership over a suspended membership", () => {
    const destination = getPrincipalDashboardDestination(
      principal([
        membership({
          id: "suspended-membership",
          membershipStatus: "Suspended",
          workspaceId: "workspace-suspended",
          workspaceName: "Suspended Workspace",
          workspaceSlug: "suspended-workspace",
        }),
        membership({
          id: "active-membership",
          workspaceId: "workspace-active",
          workspaceName: "Active Workspace",
          workspaceSlug: "active-workspace",
        }),
      ]),
    );

    expect(destination).toBe("/w/active-workspace/dashboard/overview");
  });

  it("routes an account with only suspended access to the suspension display route", () => {
    const destination = getPrincipalDashboardDestination(
      principal([membership({ membershipStatus: "Suspended", workspaceSlug: "suspended-workspace" })]),
    );

    expect(destination).toBe("/w/suspended-workspace/dashboard/overview");
  });
});
