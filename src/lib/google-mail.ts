import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_REFRESH_ERROR_MESSAGE = "Gmail connection could not be refreshed.";
export const GOOGLE_MAIL_OAUTH_STATE_COOKIE_NAME = "studio-google-mail-oauth-state";
export const GOOGLE_MAIL_RETURN_TO_COOKIE_NAME = "studio-google-mail-return-to";
export const GOOGLE_MAIL_OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

type GmailSendMessage = {
  attachments?: Array<{
    content: Buffer | string;
    contentType: string;
    filename: string;
  }>;
  from: string;
  html: string;
  subject: string;
  text: string;
  to: string;
};

type GoogleApiErrorResponse = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

function isGoogleAuthFailure(status: number, detail: string) {
  const normalized = detail.toLowerCase();

  return (
    status === 401 ||
    (status === 403 &&
      (normalized.includes("insufficient") ||
        normalized.includes("permission") ||
        normalized.includes("scope") ||
        normalized.includes("auth")))
  );
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getTokenEncryptionKey() {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? process.env.AUTH_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;

  if (!secret) {
    throw new Error("Set GOOGLE_TOKEN_ENCRYPTION_KEY, AUTH_SECRET, or GOOGLE_CLIENT_SECRET to store Gmail tokens.");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptGoogleToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getTokenEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptGoogleToken(ciphertext: string) {
  const [iv, authTag, encrypted] = ciphertext.split(".").map((part) => Buffer.from(part, "base64url"));

  if (!iv || !authTag || !encrypted) {
    throw new Error("Stored Gmail token is invalid.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getTokenEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(GMAIL_REFRESH_ERROR_MESSAGE);
  }

  const tokenResponse = (await response.json()) as { access_token?: string };

  if (!tokenResponse.access_token) {
    throw new Error("Google did not return a Gmail access token.");
  }

  return tokenResponse.access_token;
}

function encodeSubject(value: string) {
  return `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function chunkBase64(value: string) {
  return value.match(/.{1,76}/g)?.join("\r\n") ?? value;
}

function createRawMessage({ attachments = [], from, html, subject, text, to }: GmailSendMessage) {
  const alternativeBoundary = `vadosstack-alt-${randomBytes(12).toString("hex")}`;
  const mixedBoundary = `vadosstack-mixed-${randomBytes(12).toString("hex")}`;
  const alternativePart = [
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    text,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
    "",
    `--${alternativeBoundary}--`,
  ].join("\r\n");

  if (!attachments.length) {
    const message = [
      `From: ${sanitizeHeader(from)}`,
      `To: ${sanitizeHeader(to)}`,
      `Subject: ${encodeSubject(sanitizeHeader(subject))}`,
      "MIME-Version: 1.0",
      alternativePart,
    ].join("\r\n");

    return base64UrlEncode(message);
  }

  const attachmentParts = attachments.map((attachment) => {
    const filename = sanitizeHeader(attachment.filename);
    const content = typeof attachment.content === "string" ? Buffer.from(attachment.content) : attachment.content;

    return [
      `--${mixedBoundary}`,
      `Content-Type: ${sanitizeHeader(attachment.contentType)}; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      chunkBase64(content.toString("base64")),
    ].join("\r\n");
  });

  const message = [
    `From: ${sanitizeHeader(from)}`,
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${encodeSubject(sanitizeHeader(subject))}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    alternativePart,
    ...attachmentParts,
    `--${mixedBoundary}--`,
  ].join("\r\n");

  return base64UrlEncode(message);
}

export async function sendGmailMessage(accessToken: string, message: GmailSendMessage) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: createRawMessage(message),
    }),
  });

  if (!response.ok) {
    let detail = "";

    try {
      const errorResponse = (await response.json()) as GoogleApiErrorResponse;
      detail = errorResponse.error?.message || errorResponse.error?.status || "";
    } catch {
      detail = await response.text().catch(() => "");
    }

    if (isGoogleAuthFailure(response.status, detail)) {
      throw new Error(GMAIL_REFRESH_ERROR_MESSAGE);
    }

    throw new Error(
      detail
        ? `Gmail could not send this email. Google said: ${detail}`
        : `Gmail could not send this email. Google returned HTTP ${response.status}.`,
    );
  }
}
