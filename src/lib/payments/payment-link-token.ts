import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PAYMENT_LINK_TOKEN_BYTES = 32;
const PAYMENT_LINK_CIPHER_VERSION = "v1";

function getPaymentLinkEncryptionKey() {
  const dedicatedSecret = process.env.PAYMENT_LINK_ENCRYPTION_KEY?.trim();
  if (process.env.NODE_ENV === "production" && !dedicatedSecret) {
    throw new Error("PAYMENT_LINK_ENCRYPTION_KEY must be configured explicitly in production.");
  }
  const secret = dedicatedSecret || process.env.AUTH_SECRET?.trim() || process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("Set PAYMENT_LINK_ENCRYPTION_KEY, AUTH_SECRET, or STRIPE_SECRET_KEY to store payment links.");
  }
  return createHash("sha256").update(`vadosstack-payment-links:v1:${secret}`).digest();
}

export function createPaymentLinkToken() {
  return randomBytes(PAYMENT_LINK_TOKEN_BYTES).toString("base64url");
}

export function hashPaymentLinkToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function encryptPaymentLinkToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getPaymentLinkEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [PAYMENT_LINK_CIPHER_VERSION, iv, authTag, encrypted]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

export function decryptPaymentLinkToken(ciphertext: string) {
  const [version, ivValue, authTagValue, encryptedValue] = ciphertext.split(".");
  if (version !== PAYMENT_LINK_CIPHER_VERSION || !ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Stored payment link token is invalid.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getPaymentLinkEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

export function createPaymentLinkUrl(token: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return new URL(`/pay/${encodeURIComponent(token)}`, siteUrl).toString();
}
