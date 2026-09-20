import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  memberships: vi.fn(),
  slugAlias: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspaceMembership: { findMany: mocks.memberships },
    workspaceSlugAlias: { findUnique: mocks.slugAlias },
  },
}));
vi.mock("@/lib/authorization/request-context", () => ({
  getDashboardRequestContext: vi.fn().mockResolvedValue({
    dashboardPath: "/dashboard/jobs",
    query: "",
    workspaceSlug: "business-a",
  }),
}));

import {
  authorizeWorkspace,
  authorizeWorkspaceSlug,
  getCurrentPrincipal,
  WorkspaceAccessDeniedError,
} from "@/lib/authorization/authorize";

const user = {
  id: "user-a",
  email: "member@example.com",
  name: "Member",
};

function membership({
  workspaceId,
  workspaceSlug,
  permissionKeys,
  systemKey = null,
}: {
  workspaceId: string;
  workspaceSlug: string;
  permissionKeys: string[];
  systemKey?: string | null;
}) {
  return {
    id: `membership-${workspaceId}`,
    workspaceId,
    employeeId: null,
    workspace: {
      id: workspaceId,
      slug: workspaceSlug,
      name: workspaceSlug,
      workspaceMode: "both",
      status: "Active",
      suspendedAt: null,
      suspensionReasonCode: null,
      suspendedUntil: null,
    },
    role: {
      id: `role-${workspaceId}`,
      workspaceId,
      name: systemKey === "OWNER" ? "Owner" : "Custom",
      systemKey,
      permissions: permissionKeys.map((permissionKey) => ({ permissionKey })),
    },
  };
}

describe("workspace principal resolution", () => {
  beforeEach(() => {
    mocks.currentUser.mockResolvedValue(user);
    mocks.memberships.mockResolvedValue([
      membership({ workspaceId: "workspace-a", workspaceSlug: "business-a", permissionKeys: ["jobs.update"] }),
      membership({ workspaceId: "workspace-b", workspaceSlug: "business-b", permissionKeys: ["jobs.view"] }),
      membership({
        workspaceId: "workspace-owner",
        workspaceSlug: "owned-business",
        permissionKeys: [],
        systemKey: "OWNER",
      }),
      {
        ...membership({
          workspaceId: "workspace-tampered",
          workspaceSlug: "tampered",
          permissionKeys: ["jobs.update"],
        }),
        workspace: { id: "different-workspace", slug: "tampered", name: "Tampered", workspaceMode: "both" },
      },
    ]);
  });

  it("drops memberships whose related workspace does not match the membership tenant", async () => {
    const principal = await getCurrentPrincipal();

    expect(principal?.memberships.map(({ workspaceId }) => workspaceId)).not.toContain("workspace-tampered");
    expect(mocks.memberships).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-a",
          status: "Active",
        },
      }),
    );
  });

  it("allows a permission only in the membership that owns it", async () => {
    await expect(authorizeWorkspace("workspace-a", "jobs.update")).resolves.toMatchObject({
      workspaceId: "workspace-a",
    });
    await expect(authorizeWorkspace("workspace-b", "jobs.update")).rejects.toBeInstanceOf(WorkspaceAccessDeniedError);
  });

  it("does not resolve a different workspace by changing the slug", async () => {
    await expect(authorizeWorkspaceSlug("business-b", "jobs.update")).rejects.toBeInstanceOf(
      WorkspaceAccessDeniedError,
    );
  });

  it("preserves full access for the protected Owner role", async () => {
    await expect(authorizeWorkspace("workspace-owner", "roles.manage")).resolves.toMatchObject({
      workspaceId: "workspace-owner",
    });
  });
});
