import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearSession: vi.fn(),
  createSession: vi.fn(),
  currentUser: vi.fn(),
  hashPassword: vi.fn(() => "password-hash"),
  prisma: {
    user: { findUnique: vi.fn() },
    workspaceInvitation: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((location: string) => {
    throw new Error(`REDIRECT:${location}`);
  }),
}));
vi.mock("@/lib/auth", () => ({
  clearCurrentSession: mocks.clearSession,
  createUserSession: mocks.createSession,
  getCurrentUser: mocks.currentUser,
}));
vi.mock("@/lib/authorization/audit", () => ({ recordAuthorizationAuditEvent: vi.fn() }));
vi.mock("@/lib/password", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { acceptInvitationAction, registerFromInvitationAction } from "@/app/(main)/accept-invitation/actions";

const initialState = { message: "", success: false };

function invitationForm(token = "valid-token") {
  const data = new FormData();
  data.set("token", token);
  return data;
}

function registrationForm() {
  const data = invitationForm();
  data.set("name", "Invited User");
  data.set("password", "secure-password");
  data.set("confirmPassword", "secure-password");
  return data;
}

describe("invitation acceptance", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.currentUser.mockResolvedValue(null);
    mocks.prisma.workspaceInvitation.findFirst.mockResolvedValue(null);
    mocks.prisma.user.findUnique.mockResolvedValue(null);
  });

  it("requires authentication for an existing user", async () => {
    const result = await acceptInvitationAction(initialState, invitationForm());

    expect(result.message).toBe("Sign in or create your account to accept this invitation.");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not reveal or consume expired, revoked, or already-used invitations", async () => {
    mocks.currentUser.mockResolvedValue({ id: "user-a", email: "member@example.com" });

    const result = await acceptInvitationAction(initialState, invitationForm());

    expect(result.message).toBe("This invitation is invalid, expired, or already used.");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("requires the signed-in email to match the invited email", async () => {
    mocks.currentUser.mockResolvedValue({ id: "user-a", email: "different@example.com" });
    mocks.prisma.workspaceInvitation.findFirst.mockResolvedValue({
      id: "invitation-a",
      email: "member@example.com",
    });

    const result = await acceptInvitationAction(initialState, invitationForm());

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/sent to member@example.com/);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("fails safely when a single-use invitation loses the acceptance race", async () => {
    mocks.currentUser.mockResolvedValue({ id: "user-a", email: "member@example.com" });
    mocks.prisma.workspaceInvitation.findFirst.mockResolvedValue({
      id: "invitation-a",
      email: "member@example.com",
    });
    mocks.prisma.$transaction.mockRejectedValue(new Error("INVITATION_UNAVAILABLE"));

    const result = await acceptInvitationAction(initialState, invitationForm());

    expect(result).toEqual({ success: false, message: "The invitation could not be accepted. Please try again." });
  });

  it("does not create a duplicate account for an existing invitation email", async () => {
    mocks.prisma.workspaceInvitation.findFirst.mockResolvedValue({
      id: "invitation-a",
      email: "member@example.com",
    });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "existing-user" });

    const result = await registerFromInvitationAction(initialState, registrationForm());

    expect(result.message).toBe("An account already exists for this email. Sign in to accept the invitation.");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("validates password confirmation before reading invitation data", async () => {
    const data = registrationForm();
    data.set("confirmPassword", "different-password");

    const result = await registerFromInvitationAction(initialState, data);

    expect(result.message).toBe("Passwords do not match.");
    expect(mocks.prisma.workspaceInvitation.findFirst).not.toHaveBeenCalled();
  });
});
