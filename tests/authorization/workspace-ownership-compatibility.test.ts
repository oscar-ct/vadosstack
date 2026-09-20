import { describe, expect, it, vi } from "vitest";

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({
  membershipFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspaceMembership: {
      findFirst: mocks.membershipFindFirst,
    },
  },
}));

import { resolveOwnedWorkspaceByEmail } from "@/scripts/lib/resolve-owned-workspace";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function filesBelow(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesBelow(path) : [path];
  });
}

describe("workspace ownership compatibility release", () => {
  it("resolves seed ownership through an active Owner membership", async () => {
    mocks.membershipFindFirst.mockResolvedValue({
      workspace: {
        id: "workspace-independent",
        orderMessageText: "Thank you",
      },
    });

    await expect(resolveOwnedWorkspaceByEmail("owner@example.com")).resolves.toEqual({
      id: "workspace-independent",
      orderMessageText: "Thank you",
    });
    expect(mocks.membershipFindFirst).toHaveBeenCalledWith({
      where: {
        status: "Active",
        role: { systemKey: "OWNER" },
        user: { email: "owner@example.com" },
      },
      orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
      select: {
        workspace: {
          select: {
            id: true,
            orderMessageText: true,
          },
        },
      },
    });
  });

  it("refuses to seed records when no owned workspace can be resolved", async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);

    await expect(resolveOwnedWorkspaceByEmail("member@example.com")).rejects.toThrow(
      "No owned workspace matches SEED_OWNER_EMAIL.",
    );
  });

  it("keeps workspace settings canonical instead of mirroring them onto User", () => {
    for (const path of [
      "src/app/(main)/w/[workspaceSlug]/dashboard/_components/sidebar/actions.ts",
      "src/app/(main)/w/[workspaceSlug]/dashboard/document-messages/actions.ts",
    ]) {
      const contents = source(path);
      expect(contents, path).toContain("workspace.update");
      expect(contents, path).not.toContain("transaction.user.update");
      expect(contents, path).not.toContain("tx.user.update");
    }
  });

  it("loads order documents from Workspace rather than treating ownerId as a User id", () => {
    for (const path of [
      "src/app/(main)/w/[workspaceSlug]/dashboard/orders/_lib/order-document.ts",
      "src/app/(main)/w/[workspaceSlug]/dashboard/orders/[orderId]/return/_lib/return-data.ts",
    ]) {
      const contents = source(path);
      expect(contents, path).toContain("prisma.workspace.findUnique");
      expect(contents, path).not.toContain("prisma.user.findUnique");
    }
  });

  it("keeps maintenance ownership foreign keys and backfills workspace-scoped", () => {
    const setupPaths = [
      "src/scripts/setup-auth.ts",
      "src/scripts/setup-ecommerce.ts",
      "src/scripts/setup-estimate-records.ts",
      "src/scripts/setup-estimates.ts",
      "src/scripts/setup-invoices.ts",
      "src/scripts/setup-job-pricing.ts",
      "src/scripts/setup-services.ts",
      "src/scripts/setup-time-tracking.ts",
    ];

    for (const path of setupPaths) {
      expect(source(path), path).not.toMatch(/FOREIGN KEY\s*\(\s*"ownerId"\s*\)\s*REFERENCES\s*"users"/);
    }

    const authSetup = source("src/scripts/setup-auth.ts");
    expect(authSetup).toContain("ensureOwnedWorkspace(user)");
    expect(authSetup).toContain("backfillOwnership(workspaceId)");
  });

  it("resolves every demo seed through an owned workspace", () => {
    for (const path of [
      "src/scripts/seed-customers.ts",
      "src/scripts/seed-demo-extras.ts",
      "src/scripts/seed-ecommerce.ts",
      "src/scripts/seed-jobs.ts",
    ]) {
      const contents = source(path);
      expect(contents, path).toContain("resolveOwnedWorkspaceByEmail(ownerEmail)");
      expect(contents, path).not.toContain("prisma.user.findUnique");
      expect(contents, path).not.toContain("ownerId: owner.id");
    }
  });

  it("does not expose an unreviewed account-deletion path in application code", () => {
    const applicationDirectories = ["src/app", "src/components", "src/lib"];
    const offenders = applicationDirectories
      .flatMap((directory) => filesBelow(join(process.cwd(), directory)))
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter((path) => /(?:prisma|tx|transaction)\.user\.(?:delete|deleteMany)\s*\(/.test(readFileSync(path, "utf8")));

    expect(offenders).toEqual([]);
  });

  it("keeps Gmail ownership explicitly workspace-scoped in every OAuth boundary", () => {
    const oauthEntry = source("src/app/api/auth/google/mail/route.ts");
    const oauthCallback = source("src/app/api/auth/google/mail/callback/route.ts");

    expect(oauthEntry).toContain("membership.workspaceSlug === workspaceSlug");
    expect(oauthEntry).not.toContain("membership.workspaceId === userId");
    expect(oauthCallback).toContain("workspaceId: membership.workspaceId");
    expect(oauthCallback).not.toContain("workspaceId: principal.user.id");
  });

  it("defines the ownership transition as an atomic, preflighted migration", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source(
      "prisma/migrations/20260919090000_retarget_business_ownership_to_workspaces/migration.sql",
    );

    expect(schema).not.toMatch(/owner\s+User\s+@relation\(fields: \[ownerId\]/);
    expect(schema.match(/owner\s+Workspace\s+@relation\(fields: \[ownerId\]/g)).toHaveLength(29);
    expect(schema).toMatch(/model GoogleMailAccount \{[\s\S]*workspaceId\s+String\s+@unique/);
    expect(migration.trimStart()).toMatch(/^--[\s\S]*\nBEGIN;/);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    expect(migration).toContain("Ownership migration aborted");
    expect(migration).toContain('RENAME COLUMN "userId" TO "workspaceId"');
    expect(migration).toContain("ON DELETE SET NULL ON UPDATE CASCADE");
  });

  it("keeps old and new Gmail deployments compatible during the expand-contract window", () => {
    const schema = source("prisma/schema.prisma");
    const bridge = source("prisma/migrations/20260919101000_add_google_mail_deployment_bridge/migration.sql");

    expect(schema).toMatch(/legacyUserId\s+String\?\s+@unique\s+@map\("userId"\)/);
    expect(bridge).toContain('ADD COLUMN "userId" TEXT');
    expect(bridge).toContain("sync_google_mail_workspace_identity");
    expect(bridge).toContain("CREATE TRIGGER");
  });
});
