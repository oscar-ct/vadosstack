import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

import { createHash } from "node:crypto";

const ONE_MINUTE_IN_MS = 60 * 1000;
const FIFTEEN_MINUTES_IN_MS = 15 * ONE_MINUTE_IN_MS;
const ONE_HOUR_IN_MS = 60 * ONE_MINUTE_IN_MS;
const RETENTION_MS = 24 * ONE_HOUR_IN_MS;

type RateLimitAction = "account-confirmation" | "login" | "password-reset" | "register" | "reset-password";

type RateLimitRule = {
  limit: number;
  windowMs: number;
};

const RATE_LIMIT_RULES: Record<RateLimitAction, RateLimitRule> = {
  "account-confirmation": {
    limit: 10,
    windowMs: FIFTEEN_MINUTES_IN_MS,
  },
  login: {
    limit: 5,
    windowMs: FIFTEEN_MINUTES_IN_MS,
  },
  "password-reset": {
    limit: 3,
    windowMs: ONE_HOUR_IN_MS,
  },
  register: {
    limit: 3,
    windowMs: ONE_HOUR_IN_MS,
  },
  "reset-password": {
    limit: 5,
    windowMs: FIFTEEN_MINUTES_IN_MS,
  },
};

export const AUTH_RATE_LIMIT_MESSAGE = "Too many attempts. Please wait a few minutes and try again.";

function hashRateLimitKey(action: RateLimitAction, identifiers: string[]) {
  return createHash("sha256")
    .update([action, ...identifiers].join(":"))
    .digest("hex");
}

export async function getRateLimitIp() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (
    forwardedFor || headerStore.get("cf-connecting-ip")?.trim() || headerStore.get("x-real-ip")?.trim() || "unknown"
  );
}

export async function consumeRateLimit(action: RateLimitAction, identifiers: string[]) {
  const rule = RATE_LIMIT_RULES[action];
  const now = Date.now();
  const windowStart = new Date(now - rule.windowMs);
  const keyHash = hashRateLimitKey(
    action,
    identifiers.map((identifier) => identifier.trim().toLowerCase()),
  );

  await prisma.rateLimitAttempt.deleteMany({
    where: {
      createdAt: {
        lt: new Date(now - RETENTION_MS),
      },
    },
  });

  const attempts = await prisma.rateLimitAttempt.count({
    where: {
      action,
      keyHash,
      createdAt: {
        gte: windowStart,
      },
    },
  });

  if (attempts >= rule.limit) {
    return false;
  }

  await prisma.rateLimitAttempt.create({
    data: {
      action,
      keyHash,
    },
  });

  return true;
}
