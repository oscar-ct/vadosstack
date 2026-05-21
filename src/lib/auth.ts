import { cache } from "react";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import { createHash, randomBytes } from "node:crypto";

const SESSION_COOKIE_NAME = "studio-admin-session";
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_IN_MS = 30 * ONE_DAY_IN_MS;

export type CurrentUser = {
  id: string;
  name: string | null;
  companyName: string;
  companyEmail: string | null;
  companyPhone: string | null;
  estimateValidDays: number;
  email: string;
  invoiceDueDays: number;
  admin: boolean;
};

function getSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toCurrentUser(user: {
  id: string;
  name: string | null;
  companyName: string;
  companyEmail: string | null;
  companyPhone: string | null;
  estimateValidDays: number;
  email: string;
  invoiceDueDays: number;
  admin: boolean;
}): CurrentUser {
  return {
    id: user.id,
    name: user.name,
    companyName: user.companyName,
    companyEmail: user.companyEmail,
    companyPhone: user.companyPhone,
    estimateValidDays: user.estimateValidDays,
    email: user.email,
    invoiceDueDays: user.invoiceDueDays,
    admin: user.admin,
  };
}

export function getDisplayName(user: { name?: string | null; email: string }) {
  if (user.name?.trim()) {
    return user.name.trim();
  }

  const [localPart] = user.email.split("@");
  return localPart || "Account";
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashSessionToken(sessionToken),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          companyName: true,
          companyEmail: true,
          companyPhone: true,
          estimateValidDays: true,
          email: true,
          invoiceDueDays: true,
          admin: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.session.delete({
        where: {
          id: session.id,
        },
      });
    }

    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return toCurrentUser(session.user);
});

export async function refreshCurrentSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return false;
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashSessionToken(sessionToken),
    },
    select: {
      expiresAt: true,
      id: true,
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.session.delete({
        where: {
          id: session.id,
        },
      });
    }

    cookieStore.delete(SESSION_COOKIE_NAME);
    return false;
  }

  const remainingMs = session.expiresAt.getTime() - Date.now();
  const extensionMs = remainingMs > ONE_DAY_IN_MS ? THIRTY_DAYS_IN_MS : ONE_DAY_IN_MS;
  const expiresAt = new Date(Date.now() + extensionMs);

  await prisma.session.update({
    where: {
      id: session.id,
    },
    data: {
      expiresAt,
    },
  });

  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return true;
}

export async function createUserSession(userId: string, remember = false) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + (remember ? THIRTY_DAYS_IN_MS : ONE_DAY_IN_MS));

  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(expiresAt));
}

export async function createUserSessionResponse(userId: string, response: NextResponse, remember = false) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + (remember ? THIRTY_DAYS_IN_MS : ONE_DAY_IN_MS));

  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(expiresAt));
}

export async function clearCurrentSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await prisma.session.deleteMany({
      where: {
        tokenHash: hashSessionToken(sessionToken),
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
