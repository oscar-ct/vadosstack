import { createHash, randomBytes } from "node:crypto";

const INVITATION_TOKEN_BYTES = 32;
export const WORKSPACE_INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export function createWorkspaceInvitationToken() {
  return randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
}

export function hashWorkspaceInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createWorkspaceInvitationUrl(token: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const url = new URL("/accept-invitation", siteUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
