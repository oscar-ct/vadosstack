import { describe, expect, it } from "vitest";

import {
  createWorkspaceInvitationToken,
  createWorkspaceInvitationUrl,
  hashWorkspaceInvitationToken,
  WORKSPACE_INVITATION_LIFETIME_MS,
} from "@/lib/workspace-invitations";

describe("workspace invitation tokens", () => {
  it("creates high-entropy URL-safe tokens", () => {
    const token = createWorkspaceInvitationToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(43);
  });

  it("does not generate duplicate tokens in a representative sample", () => {
    const tokens = Array.from({ length: 1_000 }, () => createWorkspaceInvitationToken());

    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("hashes tokens deterministically without storing the raw token", () => {
    const token = "private-invitation-token";
    const hash = hashWorkspaceInvitationToken(token);

    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
    expect(hashWorkspaceInvitationToken(token)).toBe(hash);
    expect(hashWorkspaceInvitationToken(`${token}-different`)).not.toBe(hash);
  });

  it("expires invitations after seven days", () => {
    expect(WORKSPACE_INVITATION_LIFETIME_MS).toBe(7 * 24 * 60 * 60 * 1_000);
  });

  it("puts the raw token only in the invitation URL", () => {
    const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://vadosstack.example";

    try {
      const url = new URL(createWorkspaceInvitationUrl("test-token"));
      expect(url.origin).toBe("https://vadosstack.example");
      expect(url.pathname).toBe("/accept-invitation");
      expect(url.searchParams.get("token")).toBe("test-token");
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
    }
  });
});
