import { describe, expect, it } from "vitest";

import { can, WorkspaceAccessDeniedError } from "@/lib/authorization";
import { normalizeWorkspaceSlug } from "@/lib/authorization/workspace-slug";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";

describe("workspace boundaries", () => {
  it("does not treat a permission in one membership as global access", () => {
    const businessA = {
      roleSystemKey: null,
      permissions: new Set(["jobs.update"] as const),
    };
    const businessB = {
      roleSystemKey: null,
      permissions: new Set([]),
    };

    expect(can(businessA, "jobs.update")).toBe(true);
    expect(can(businessB, "jobs.update")).toBe(false);
  });

  it("uses workspace-scoped dashboard URLs", () => {
    expect(getWorkspaceDashboardPath("castro-handyman-services", "/dashboard/jobs/job-123/edit")).toBe(
      "/w/castro-handyman-services/dashboard/jobs/job-123/edit",
    );
  });

  it("normalizes unsafe company names into stable URL slugs", () => {
    expect(normalizeWorkspaceSlug("  O&C Handyman Services!  ")).toBe("o-c-handyman-services");
    expect(normalizeWorkspaceSlug("***")).toBe("workspace");
  });

  it("uses a dedicated denial error that does not expose record details", () => {
    const error = new WorkspaceAccessDeniedError();

    expect(error.message).toBe("You do not have permission to perform this action.");
    expect(error.message).not.toMatch(/workspace|record|customer|job/i);
  });
});
