import { createHash, randomBytes } from "node:crypto";

const RESET_TOKEN_BYTES = 32;

export function createPasswordResetToken() {
  return randomBytes(RESET_TOKEN_BYTES).toString("base64url");
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetUrl(token: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const resetUrl = new URL("/reset-password", siteUrl);
  resetUrl.searchParams.set("token", token);
  return resetUrl.toString();
}
