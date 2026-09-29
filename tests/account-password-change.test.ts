import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearCurrentSession: vi.fn(),
  consumeRateLimit: vi.fn(),
  getCurrentPrincipal: vi.fn(),
  getRateLimitIp: vi.fn(),
  hashPassword: vi.fn(),
  passwordResetDeleteMany: vi.fn(),
  redirect: vi.fn(),
  sessionDeleteMany: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("@/lib/auth", () => ({
  clearCurrentSession: mocks.clearCurrentSession,
}));
vi.mock("@/lib/authorization", () => ({
  getCurrentPrincipal: mocks.getCurrentPrincipal,
  getPermittedDashboardAuthorization: vi.fn(),
}));
vi.mock("@/lib/authorization/audit", () => ({ recordAuthorizationAuditEvent: vi.fn() }));
vi.mock("@/lib/password", () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    passwordResetToken: { deleteMany: mocks.passwordResetDeleteMany },
    session: { deleteMany: mocks.sessionDeleteMany },
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  AUTH_RATE_LIMIT_MESSAGE: "Too many attempts. Please wait a few minutes and try again.",
  consumeRateLimit: mocks.consumeRateLimit,
  getRateLimitIp: mocks.getRateLimitIp,
}));
vi.mock("@/lib/workspace-revalidation", () => ({ revalidateWorkspacePath: vi.fn() }));

import { changePasswordAction } from "@/app/(main)/w/[workspaceSlug]/dashboard/_components/sidebar/actions";

const initialState = { message: "", success: false };

function passwordForm(currentPassword = "current-password", newPassword = "new-password") {
  const data = new FormData();
  data.set("currentPassword", currentPassword);
  data.set("newPassword", newPassword);
  data.set("confirmPassword", newPassword);
  return data;
}

describe("account password changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentPrincipal.mockResolvedValue({ user: { id: "user-a" } });
    mocks.getRateLimitIp.mockResolvedValue("127.0.0.1");
    mocks.consumeRateLimit.mockResolvedValue(true);
    mocks.hashPassword.mockReturnValue("new-password-hash");
    mocks.passwordResetDeleteMany.mockResolvedValue({ count: 0 });
    mocks.sessionDeleteMany.mockResolvedValue({ count: 2 });
    mocks.userUpdate.mockResolvedValue({ id: "user-a" });
    mocks.clearCurrentSession.mockResolvedValue(undefined);
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("does not offer password changes to Google-only accounts", async () => {
    mocks.userFindUnique.mockResolvedValue({ authProviders: ["google"], passwordHash: "unused" });

    const result = await changePasswordAction(initialState, passwordForm());

    expect(result.message).toMatch(/signs in with Google/i);
    expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("rejects an incorrect current password without terminating sessions", async () => {
    mocks.userFindUnique.mockResolvedValue({ authProviders: ["email"], passwordHash: "current-hash" });
    mocks.verifyPassword.mockReturnValue(false);

    const result = await changePasswordAction(initialState, passwordForm());

    expect(result).toEqual({ success: false, message: "Current password is incorrect." });
    expect(mocks.sessionDeleteMany).not.toHaveBeenCalled();
    expect(mocks.clearCurrentSession).not.toHaveBeenCalled();
  });

  it("updates the password, removes reset tokens, and terminates every session", async () => {
    mocks.userFindUnique.mockResolvedValue({ authProviders: ["email", "google"], passwordHash: "current-hash" });
    mocks.verifyPassword.mockReturnValue(true);

    await expect(changePasswordAction(initialState, passwordForm())).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-a" },
      data: { passwordHash: "new-password-hash" },
    });
    expect(mocks.passwordResetDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-a" } });
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-a" } });
    expect(mocks.clearCurrentSession).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/login?password=changed");
  });
});
