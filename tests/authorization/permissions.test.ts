import { describe, expect, it } from "vitest";

import {
  can,
  DEFAULT_ROLE_TEMPLATES,
  getDashboardViewPermission,
  getMembershipLandingPath,
  getPermissionGroupsForWorkspaceMode,
  isPermissionKey,
  PERMISSION_KEYS,
} from "@/lib/authorization";
import { filterSidebarGroups, isDashboardPathEnabled } from "@/lib/workspace-mode";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";

function role(systemKey: string | null, permissions: readonly string[]) {
  return {
    roleSystemKey: systemKey,
    permissions: new Set(permissions.filter(isPermissionKey)),
  };
}

describe("permission registry", () => {
  it("contains unique stable permission keys", () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    expect(PERMISSION_KEYS.length).toBeGreaterThanOrEqual(50);
  });

  it("keeps every default-role permission in the registry", () => {
    for (const template of DEFAULT_ROLE_TEMPLATES) {
      for (const permission of template.permissions) {
        expect(isPermissionKey(permission), `${template.name}: ${permission}`).toBe(true);
      }
    }
  });

  it("always grants every registered permission to the Owner system role", () => {
    const owner = role("OWNER", []);

    for (const permission of PERMISSION_KEYS) {
      expect(can(owner, permission), permission).toBe(true);
    }
  });

  it("denies every permission when the workspace is suspended, including Owner and Admin", () => {
    for (const systemKey of ["OWNER", "ADMIN", null]) {
      const suspended = { ...role(systemKey, PERMISSION_KEYS), workspaceStatus: "Suspended" };
      for (const permission of PERMISSION_KEYS) {
        expect(can(suspended, permission), `${systemKey ?? "custom"}: ${permission}`).toBe(false);
      }
    }
  });

  it("denies every permission when the individual membership is suspended", () => {
    for (const systemKey of ["OWNER", "ADMIN", null]) {
      const suspended = { ...role(systemKey, PERMISSION_KEYS), membershipStatus: "Suspended" };
      for (const permission of PERMISSION_KEYS) {
        expect(can(suspended, permission), `${systemKey ?? "custom"}: ${permission}`).toBe(false);
      }
    }
  });

  it("ships an Admin role with every registered permission but without Owner identity", () => {
    const admin = DEFAULT_ROLE_TEMPLATES.find((template) => template.systemKey === "ADMIN");

    expect(admin?.permissions).toEqual(PERMISSION_KEYS);
    expect(admin?.name).toBe("Admin");
    for (const permission of PERMISSION_KEYS) {
      expect(can(role("ADMIN", []), permission), permission).toBe(true);
    }
  });

  it.each(PERMISSION_KEYS)("grants %s only when a scoped membership contains it", (permission) => {
    expect(can(role(null, [permission]), permission)).toBe(true);
    expect(can(role(null, []), permission)).toBe(false);
  });

  it("does not give the read-only template mutation, compensation, settings, or role-management access", () => {
    const readOnlyTemplate = DEFAULT_ROLE_TEMPLATES.find((template) => template.systemKey === "READ_ONLY");

    expect(readOnlyTemplate).toBeDefined();
    expect(readOnlyTemplate?.permissions.every((permission) => permission.endsWith(".view"))).toBe(true);
    expect(readOnlyTemplate?.permissions).not.toContain("employees.compensation.view");
    expect(readOnlyTemplate?.permissions).not.toContain("settings.view");
    expect(readOnlyTemplate?.permissions).not.toContain("roles.manage");
  });

  it("keeps sensitive ownership and connected-email permissions out of the Manager template", () => {
    const manager = DEFAULT_ROLE_TEMPLATES.find((template) => template.systemKey === "MANAGER");

    expect(manager?.permissions).not.toContain("roles.manage");
    expect(manager?.permissions).not.toContain("email.account.manage");
    expect(manager?.permissions).not.toContain("settings.branding.manage");
  });

  it("limits the Time manager template to employee and time operations without compensation", () => {
    const timeManager = DEFAULT_ROLE_TEMPLATES.find((template) => template.systemKey === "TIME_MANAGER");

    expect(timeManager?.permissions).toEqual([
      "employees.view",
      "employees.manage",
      "time.view",
      "time.manage",
      "time.approve",
      "time.lock",
    ]);
  });

  it("shows only commerce-relevant permissions for a commerce-only workspace", () => {
    const keys = getPermissionGroupsForWorkspaceMode("commerce").flatMap((group) =>
      group.permissions.map((permission) => permission.key),
    );

    expect(keys).toContain("orders.view");
    expect(keys).toContain("inventory.manage");
    expect(keys).toContain("customers.view");
    expect(keys).toContain("employees.view");
    expect(keys).toContain("employees.manage");
    expect(keys).toContain("time.view");
    expect(keys).toContain("time.manage");
    expect(keys).toContain("email.send");
    expect(keys).toContain("roles.manage");
    expect(keys).not.toContain("jobs.view");
    expect(keys).not.toContain("estimates.view");
    expect(keys).not.toContain("leads.view");
  });

  it("keeps employee records available while service scheduling stays disabled in commerce mode", () => {
    expect(isDashboardPathEnabled("/dashboard/employees", "commerce")).toBe(true);
    expect(isDashboardPathEnabled("/dashboard/employees/employee-a", "commerce")).toBe(true);
    expect(isDashboardPathEnabled("/dashboard/time-tracking", "commerce")).toBe(true);
    expect(isDashboardPathEnabled("/dashboard/calendar", "commerce")).toBe(false);

    const commerceUrls = filterSidebarGroups(sidebarItems, "commerce")
      .flatMap((group) => group.items)
      .map((item) => item.url);
    expect(commerceUrls).toContain("/dashboard/employees");
    expect(commerceUrls).toContain("/dashboard/time-tracking");
    expect(commerceUrls).not.toContain("/dashboard/calendar");
  });

  it("shows only service-relevant permissions for a service-only workspace", () => {
    const keys = getPermissionGroupsForWorkspaceMode("service").flatMap((group) =>
      group.permissions.map((permission) => permission.key),
    );

    expect(keys).toContain("jobs.view");
    expect(keys).toContain("estimates.view");
    expect(keys).toContain("time.manage");
    expect(keys).not.toContain("orders.view");
    expect(keys).not.toContain("inventory.manage");
    expect(keys).not.toContain("commerce.performance.view");
  });

  it("shows every permission for a combined workspace", () => {
    const keys = getPermissionGroupsForWorkspaceMode("both").flatMap((group) =>
      group.permissions.map((permission) => permission.key),
    );

    expect(keys).toEqual(PERMISSION_KEYS);
  });
});

describe("permission-aware landing pages", () => {
  it("uses Overview when it is permitted", () => {
    expect(
      getMembershipLandingPath({
        ...role(null, ["dashboard.overview.view", "jobs.view"]),
        workspaceMode: "service",
      }),
    ).toBe("/dashboard/overview");
  });

  it("uses the first permitted page when Overview is unavailable", () => {
    expect(
      getMembershipLandingPath({
        ...role(null, ["time.view"]),
        workspaceMode: "service",
      }),
    ).toBe("/dashboard/time-tracking");
  });

  it("does not select service pages for a commerce-only workspace", () => {
    expect(
      getMembershipLandingPath({
        ...role(null, ["jobs.view", "orders.view"]),
        workspaceMode: "commerce",
      }),
    ).toBe("/dashboard/orders");
  });

  it("falls back safely when a role has no view permission", () => {
    expect(
      getMembershipLandingPath({
        ...role(null, []),
        workspaceMode: "both",
      }),
    ).toBe("/dashboard");
  });

  it("uses a stable display route for a suspended workspace instead of redirecting to itself", () => {
    expect(
      getMembershipLandingPath({
        ...role("OWNER", []),
        workspaceMode: "both",
        workspaceStatus: "Suspended",
      }),
    ).toBe("/dashboard/overview");
  });

  it("uses a stable display route for a suspended membership", () => {
    expect(
      getMembershipLandingPath({
        ...role("ADMIN", []),
        membershipStatus: "Suspended",
        workspaceMode: "both",
      }),
    ).toBe("/dashboard/overview");
  });
});

describe("route permission mapping", () => {
  it.each([
    ["/dashboard/jobs", "jobs.view"],
    ["/dashboard/jobs/job-123/edit", "jobs.view"],
    ["/dashboard/invoices/invoice-123/pdf", "invoices.view"],
    ["/dashboard/employees/employee-123", "employees.view"],
    ["/dashboard/roles", "roles.manage"],
  ] as const)("maps %s to %s", (path, permission) => {
    expect(getDashboardViewPermission(path)).toBe(permission);
  });
});
