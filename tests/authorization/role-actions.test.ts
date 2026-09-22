import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transactionClient = {
    workspaceInvitation: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    workspaceMembership: {
      update: vi.fn(),
    },
    workspaceRole: {
      delete: vi.fn(),
      update: vi.fn(),
    },
  };

  return {
    audit: vi.fn(),
    getAuthorization: vi.fn(),
    getRateLimitIp: vi.fn(),
    prisma: {
      employee: { findFirst: vi.fn() },
      workspaceInvitation: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
      workspaceMembership: { findFirst: vi.fn() },
      workspaceRole: { findFirst: vi.fn() },
      $transaction: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient)),
    },
    resend: vi.fn(),
    rateLimit: vi.fn(),
    revalidate: vi.fn(),
    transactionClient,
  };
});

vi.mock("@/lib/authorization", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authorization")>()),
  getPermittedDashboardAuthorization: mocks.getAuthorization,
}));
vi.mock("@/lib/authorization/audit", () => ({ recordAuthorizationAuditEvent: mocks.audit }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/resend", () => ({ resend: { emails: { send: mocks.resend } } }));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: mocks.rateLimit,
  getRateLimitIp: mocks.getRateLimitIp,
}));
vi.mock("@/lib/workspace-revalidation", () => ({ revalidateWorkspacePath: mocks.revalidate }));

import {
  deleteRoleAction,
  inviteWorkspaceMemberAction,
  reactivateWorkspaceMemberAction,
  removeWorkspaceMemberAction,
  resendWorkspaceInvitationAction,
  restoreWorkspaceMemberAction,
  revokeWorkspaceInvitationAction,
  suspendWorkspaceMemberAction,
  updateMemberRoleAction,
  updateRoleAction,
} from "@/app/(main)/w/[workspaceSlug]/dashboard/roles/actions";

const initialState = { message: "", success: false };
const authorization = {
  workspaceId: "workspace-a",
  membership: {
    id: "actor-membership",
    workspaceSlug: "business-a",
    workspaceName: "Business A",
    workspaceMode: "both",
  },
  principal: {
    user: { email: "owner@example.com", id: "actor-user", name: "Owner" },
  },
};

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("role and membership action authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthorization.mockResolvedValue(authorization);
    mocks.audit.mockResolvedValue(undefined);
    mocks.getRateLimitIp.mockResolvedValue("127.0.0.1");
    mocks.rateLimit.mockResolvedValue(true);
    mocks.resend.mockResolvedValue({ data: { id: "email-a" }, error: null });
  });

  it("denies role mutations before touching the database when permission is missing", async () => {
    mocks.getAuthorization.mockResolvedValue(null);

    const result = await updateRoleAction(initialState, formData({ roleId: "role-a", name: "Manager" }));

    expect(result).toEqual({ success: false, message: "You do not have permission to update roles." });
    expect(mocks.prisma.workspaceRole.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("scopes role lookup to the active workspace", async () => {
    mocks.prisma.workspaceRole.findFirst.mockResolvedValue(null);

    const result = await updateRoleAction(initialState, formData({ roleId: "workspace-b-role", name: "Manager" }));

    expect(result.success).toBe(false);
    expect(mocks.prisma.workspaceRole.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "workspace-b-role", workspaceId: "workspace-a" } }),
    );
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("keeps the Owner role immutable", async () => {
    mocks.prisma.workspaceRole.findFirst.mockResolvedValue({
      id: "owner-role",
      systemKey: "OWNER",
      memberships: [],
    });

    const result = await updateRoleAction(initialState, formData({ roleId: "owner-role", name: "Changed" }));

    expect(result).toEqual({
      success: false,
      message: "The Owner role always has full access and cannot be changed.",
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("keeps the Admin role at the same full-access permission level as Owner", async () => {
    mocks.prisma.workspaceRole.findFirst.mockResolvedValue({
      id: "admin-role",
      name: "Admin",
      systemKey: "ADMIN",
      memberships: [],
    });

    const result = await updateRoleAction(initialState, formData({ roleId: "admin-role", name: "Changed" }));

    expect(result).toEqual({
      success: false,
      message: "The Admin role always has full access and cannot be changed.",
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("prevents a role manager from removing their own role-management permission", async () => {
    mocks.prisma.workspaceRole.findFirst.mockResolvedValue({
      id: "manager-role",
      systemKey: null,
      isProtected: false,
      memberships: [{ id: "actor-membership", userId: "actor-user" }],
    });

    const result = await updateRoleAction(
      initialState,
      formData({ roleId: "manager-role", name: "Manager", permissions: "jobs.view" }),
    );

    expect(result.message).toBe("You cannot remove role management from the role assigned to your own account.");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not delete protected or assigned roles", async () => {
    mocks.prisma.workspaceRole.findFirst
      .mockResolvedValueOnce({ id: "protected-role", isProtected: true, _count: { invitations: 0, memberships: 0 } })
      .mockResolvedValueOnce({ id: "used-role", isProtected: false, _count: { invitations: 0, memberships: 1 } });

    const protectedResult = await deleteRoleAction(initialState, formData({ roleId: "protected-role" }));
    const assignedResult = await deleteRoleAction(initialState, formData({ roleId: "used-role" }));

    expect(protectedResult.message).toBe("System roles cannot be deleted.");
    expect(assignedResult.message).toMatch(/Reassign its active or removed members/);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("scopes both membership and replacement role during reassignment", async () => {
    mocks.prisma.workspaceMembership.findFirst.mockResolvedValue(null);
    mocks.prisma.workspaceRole.findFirst.mockResolvedValue(null);

    const result = await updateMemberRoleAction(
      initialState,
      formData({ membershipId: "workspace-b-member", roleId: "workspace-b-role" }),
    );

    expect(result.message).toBe("Member or role could not be found.");
    expect(mocks.prisma.workspaceMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "workspace-b-member", workspaceId: "workspace-a" } }),
    );
    expect(mocks.prisma.workspaceRole.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "workspace-b-role", workspaceId: "workspace-a" } }),
    );
  });

  it("does not allow the Owner role to be assigned from the generic role selector", async () => {
    mocks.prisma.workspaceMembership.findFirst.mockResolvedValue({
      id: "admin-membership",
      roleId: "admin-role",
      userId: "admin-user",
      role: { systemKey: "ADMIN" },
      workspace: { id: "workspace-a", legacyOwnerId: "owner-user" },
    });
    mocks.prisma.workspaceRole.findFirst.mockResolvedValue({
      id: "owner-role",
      systemKey: "OWNER",
      permissions: [],
    });

    const result = await updateMemberRoleAction(
      initialState,
      formData({ membershipId: "admin-membership", roleId: "owner-role" }),
    );

    expect(result.message).toMatch(/Owner access cannot be assigned/);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("keeps the canonical owner immutable but allows an accidental duplicate owner to be repaired", async () => {
    const adminRole = {
      id: "admin-role",
      systemKey: "ADMIN",
      permissions: [{ permissionKey: "roles.manage" }],
    };
    mocks.prisma.workspaceRole.findFirst.mockResolvedValue(adminRole);
    mocks.prisma.workspaceMembership.findFirst
      .mockResolvedValueOnce({
        id: "canonical-owner-membership",
        roleId: "owner-role",
        userId: "owner-user",
        role: { systemKey: "OWNER" },
        workspace: { id: "workspace-a", legacyOwnerId: "owner-user" },
      })
      .mockResolvedValueOnce({
        id: "duplicate-owner-membership",
        roleId: "owner-role",
        userId: "admin-user",
        role: { systemKey: "OWNER" },
        workspace: { id: "workspace-a", legacyOwnerId: "owner-user" },
      });

    const canonicalResult = await updateMemberRoleAction(
      initialState,
      formData({ membershipId: "canonical-owner-membership", roleId: "admin-role" }),
    );
    const repairResult = await updateMemberRoleAction(
      initialState,
      formData({ membershipId: "duplicate-owner-membership", roleId: "admin-role" }),
    );

    expect(canonicalResult.message).toBe("The workspace owner's role cannot be reassigned.");
    expect(repairResult).toEqual({ message: "Member role updated.", success: true });
    expect(mocks.transactionClient.workspaceMembership.update).toHaveBeenCalledWith({
      where: { id: "duplicate-owner-membership" },
      data: { roleId: "admin-role" },
    });
  });

  it("prevents removing the owner or the acting member", async () => {
    mocks.prisma.workspaceMembership.findFirst
      .mockResolvedValueOnce({
        id: "owner-membership",
        userId: "owner-user",
        roleId: "owner-role",
        employeeId: null,
        role: { systemKey: "OWNER" },
      })
      .mockResolvedValueOnce({
        id: "actor-membership",
        userId: "actor-user",
        roleId: "manager-role",
        employeeId: null,
        role: { systemKey: null },
      });

    const ownerResult = await removeWorkspaceMemberAction(initialState, formData({ membershipId: "owner-membership" }));
    const selfResult = await removeWorkspaceMemberAction(initialState, formData({ membershipId: "actor-membership" }));

    expect(ownerResult.message).toBe("The workspace owner cannot be removed.");
    expect(selfResult.message).toBe("You cannot remove your own access from this screen.");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("scopes invitations, revocation, and restoration to the active workspace", async () => {
    mocks.prisma.workspaceRole.findFirst.mockResolvedValue(null);
    mocks.prisma.employee.findFirst.mockResolvedValue(null);
    mocks.prisma.workspaceMembership.findFirst.mockResolvedValue(null);
    mocks.prisma.workspaceInvitation.findFirst.mockResolvedValue(null);

    const inviteResult = await inviteWorkspaceMemberAction(
      initialState,
      formData({ email: "member@example.com", roleId: "workspace-b-role" }),
    );
    const revokeResult = await revokeWorkspaceInvitationAction(
      initialState,
      formData({ invitationId: "workspace-b-invitation" }),
    );
    const restoreResult = await restoreWorkspaceMemberAction(
      initialState,
      formData({ membershipId: "workspace-b-member" }),
    );

    expect(inviteResult.message).toBe("Choose an available non-owner role.");
    expect(mocks.prisma.workspaceRole.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "workspace-b-role", workspaceId: "workspace-a" }),
      }),
    );
    expect(revokeResult.message).toBe("That invitation is no longer active.");
    expect(mocks.prisma.workspaceInvitation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "workspace-b-invitation", workspaceId: "workspace-a" }),
      }),
    );
    expect(restoreResult.message).toBe("Removed access record could not be found.");
    expect(mocks.prisma.workspaceMembership.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "workspace-b-member", workspaceId: "workspace-a" }),
      }),
    );
  });

  it("stops invitation creation before database lookups when the invitation rate limit is exceeded", async () => {
    mocks.rateLimit.mockResolvedValue(false);

    const result = await inviteWorkspaceMemberAction(
      initialState,
      formData({ email: "member@example.com", roleId: "role-a" }),
    );

    expect(result.message).toMatch(/Too many invitations/);
    expect(mocks.rateLimit).toHaveBeenCalledWith("workspace-invitation", ["workspace-a", "actor-user", "127.0.0.1"]);
    expect(mocks.prisma.workspaceRole.findFirst).not.toHaveBeenCalled();
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it("rotates an active invitation only after the replacement email is sent", async () => {
    mocks.prisma.workspaceInvitation.findFirst.mockResolvedValue({
      email: "member@example.com",
      employeeId: "employee-a",
      id: "invitation-old",
      role: { id: "role-a", name: "Manager" },
    });
    mocks.prisma.workspaceInvitation.create.mockResolvedValue({ id: "invitation-new" });

    const result = await resendWorkspaceInvitationAction(initialState, formData({ invitationId: "invitation-old" }));

    expect(result).toEqual({ message: "Invitation resent with a new secure link.", success: true });
    expect(mocks.rateLimit).toHaveBeenCalledWith("workspace-invitation-resend", [
      "workspace-a",
      "actor-user",
      "member@example.com",
      "127.0.0.1",
    ]);
    expect(mocks.resend).toHaveBeenCalledOnce();
    expect(mocks.transactionClient.workspaceInvitation.update).toHaveBeenCalledWith({
      where: { id: "invitation-old" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "invitation.resend", targetId: "invitation-new" }),
      mocks.transactionClient,
    );
  });

  it("keeps the old invitation active when sending its replacement fails", async () => {
    mocks.prisma.workspaceInvitation.findFirst.mockResolvedValue({
      email: "member@example.com",
      employeeId: null,
      id: "invitation-old",
      role: { id: "role-a", name: "Manager" },
    });
    mocks.prisma.workspaceInvitation.create.mockResolvedValue({ id: "invitation-new" });
    mocks.resend.mockResolvedValue({ data: null, error: { message: "provider unavailable" } });

    const result = await resendWorkspaceInvitationAction(initialState, formData({ invitationId: "invitation-old" }));

    expect(result.message).toMatch(/could not be resent/);
    expect(mocks.prisma.workspaceInvitation.update).toHaveBeenCalledWith({
      where: { id: "invitation-new" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mocks.transactionClient.workspaceInvitation.update).not.toHaveBeenCalled();
  });

  it("supports reversible suspension without conflating it with removal", async () => {
    mocks.prisma.workspaceMembership.findFirst
      .mockResolvedValueOnce({
        id: "member-a",
        roleId: "role-a",
        userId: "member-user",
        role: { systemKey: null },
      })
      .mockResolvedValueOnce({ id: "member-a", roleId: "role-a", userId: "member-user" });

    const suspended = await suspendWorkspaceMemberAction(initialState, formData({ membershipId: "member-a" }));
    const reactivated = await reactivateWorkspaceMemberAction(initialState, formData({ membershipId: "member-a" }));

    expect(suspended).toEqual({ message: "Workplace access suspended.", success: true });
    expect(reactivated).toEqual({ message: "Workplace access reactivated.", success: true });
    expect(mocks.prisma.workspaceMembership.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: expect.objectContaining({ status: "Active", workspaceId: "workspace-a" }) }),
    );
    expect(mocks.prisma.workspaceMembership.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: expect.objectContaining({ status: "Suspended", workspaceId: "workspace-a" }) }),
    );
    expect(mocks.transactionClient.workspaceMembership.update).toHaveBeenNthCalledWith(1, {
      where: { id: "member-a" },
      data: { status: "Suspended" },
    });
    expect(mocks.transactionClient.workspaceMembership.update).toHaveBeenNthCalledWith(2, {
      where: { id: "member-a" },
      data: { status: "Active" },
    });
  });
});
