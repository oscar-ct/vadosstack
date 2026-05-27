import { createHash, randomBytes } from "node:crypto";

const ACCOUNT_CONFIRMATION_TOKEN_BYTES = 32;

export function createAccountConfirmationToken() {
  return randomBytes(ACCOUNT_CONFIRMATION_TOKEN_BYTES).toString("base64url");
}

export function hashAccountConfirmationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createAccountConfirmationUrl(token: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const confirmUrl = new URL("/confirm-account", siteUrl);
  confirmUrl.searchParams.set("token", token);
  return confirmUrl.toString();
}
