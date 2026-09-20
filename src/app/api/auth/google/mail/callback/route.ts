import { type NextRequest, NextResponse } from "next/server";

import { can, getCurrentPrincipal, type WorkspaceMembershipSummary } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { exchangeGoogleCodeForAccessToken, getGoogleOAuthConfig, getGoogleUserInfo } from "@/lib/google-auth";
import {
  encryptGoogleToken,
  GMAIL_SEND_SCOPE,
  GOOGLE_MAIL_OAUTH_STATE_COOKIE_NAME,
  GOOGLE_MAIL_RETURN_TO_COOKIE_NAME,
} from "@/lib/google-mail";
import { prisma } from "@/lib/prisma";

function createRedirect(request: NextRequest, status: "connected" | "error", value: string) {
  const returnTo = request.cookies.get(GOOGLE_MAIL_RETURN_TO_COOKIE_NAME)?.value;
  const safeReturnTo =
    returnTo && (/^\/dashboard(?:\/|$)/.test(returnTo) || /^\/w\/[a-z0-9-]+\/dashboard(?:\/|$)/.test(returnTo))
      ? returnTo
      : "/dashboard/invoices";
  const redirectUrl = new URL(safeReturnTo, request.nextUrl.origin);

  redirectUrl.searchParams.set(status === "connected" ? "gmail_connected" : "gmail_error", value);

  return NextResponse.redirect(redirectUrl);
}

function clearOAuthCookies(response: NextResponse) {
  response.cookies.delete(GOOGLE_MAIL_OAUTH_STATE_COOKIE_NAME);
  response.cookies.delete(GOOGLE_MAIL_RETURN_TO_COOKIE_NAME);
  return response;
}

function getReturnToMembership(memberships: readonly WorkspaceMembershipSummary[], returnTo?: string) {
  const workspaceSlug = returnTo?.match(/^\/w\/([a-z0-9-]+)\/dashboard(?:\/|$)/)?.[1];

  return workspaceSlug
    ? memberships.find((membership) => membership.workspaceSlug === workspaceSlug)
    : memberships.find((membership) => can(membership, "email.account.manage"));
}

export async function GET(request: NextRequest) {
  const principal = await getCurrentPrincipal();

  if (!principal) {
    return clearOAuthCookies(NextResponse.redirect(new URL("/login", request.nextUrl.origin)));
  }

  const returnTo = request.cookies.get(GOOGLE_MAIL_RETURN_TO_COOKIE_NAME)?.value;
  const membership = getReturnToMembership(principal.memberships, returnTo);

  if (!membership || !can(membership, "email.account.manage")) {
    return clearOAuthCookies(createRedirect(request, "error", "permission"));
  }

  const config = getGoogleOAuthConfig(request, "/api/auth/google/mail/callback");

  if (!config) {
    return clearOAuthCookies(createRedirect(request, "error", "config"));
  }

  if (request.nextUrl.searchParams.get("error")) {
    return clearOAuthCookies(createRedirect(request, "error", "denied"));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(GOOGLE_MAIL_OAUTH_STATE_COOKIE_NAME)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return clearOAuthCookies(createRedirect(request, "error", "state"));
  }

  try {
    const tokenResponse = await exchangeGoogleCodeForAccessToken(config, code);
    const userInfo = await getGoogleUserInfo(tokenResponse.access_token);
    const email = userInfo.email.toLowerCase();
    const grantedScopes = tokenResponse.scope ?? "";

    if (!userInfo.email_verified) {
      return clearOAuthCookies(createRedirect(request, "error", "unverified"));
    }

    if (email !== principal.user.email.toLowerCase()) {
      return clearOAuthCookies(createRedirect(request, "error", "mismatch"));
    }

    if (!grantedScopes.split(" ").includes(GMAIL_SEND_SCOPE)) {
      return clearOAuthCookies(createRedirect(request, "error", "scope"));
    }

    if (!tokenResponse.refresh_token) {
      return clearOAuthCookies(createRedirect(request, "error", "refresh"));
    }

    await prisma.googleMailAccount.upsert({
      where: {
        workspaceId: membership.workspaceId,
      },
      create: {
        email,
        googleSubject: userInfo.sub,
        refreshTokenCipher: encryptGoogleToken(tokenResponse.refresh_token),
        scopes: grantedScopes,
        workspaceId: membership.workspaceId,
      },
      update: {
        email,
        googleSubject: userInfo.sub,
        refreshTokenCipher: encryptGoogleToken(tokenResponse.refresh_token),
        scopes: grantedScopes,
      },
    });
    await recordAuthorizationAuditEvent({
      workspaceId: membership.workspaceId,
      actorUserId: principal.user.id,
      membershipId: membership.id,
      action: "email.account.connect",
      targetType: "GoogleMailAccount",
      targetId: membership.workspaceId,
      metadata: { email },
    });

    return clearOAuthCookies(createRedirect(request, "connected", "1"));
  } catch {
    return clearOAuthCookies(createRedirect(request, "error", "callback"));
  }
}
