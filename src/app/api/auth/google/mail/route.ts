import { type NextRequest, NextResponse } from "next/server";

import { can, getCurrentPrincipal, type WorkspaceMembershipSummary } from "@/lib/authorization";
import { createGoogleAuthorizationUrl, createOAuthState, getGoogleOAuthConfig } from "@/lib/google-auth";
import {
  GMAIL_SEND_SCOPE,
  GOOGLE_MAIL_OAUTH_STATE_COOKIE_NAME,
  GOOGLE_MAIL_OAUTH_STATE_MAX_AGE_SECONDS,
  GOOGLE_MAIL_RETURN_TO_COOKIE_NAME,
} from "@/lib/google-mail";

function getSafeReturnTo(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo");

  if (returnTo && /^\/w\/[a-z0-9-]+\/dashboard(?:\/|$)/.test(returnTo)) {
    return returnTo;
  }

  if (returnTo && /^\/dashboard(?:\/|$)/.test(returnTo)) {
    const activeWorkspaceSlug = request.cookies.get("vados-active-workspace-client")?.value;

    if (activeWorkspaceSlug && /^[a-z0-9-]+$/.test(activeWorkspaceSlug)) {
      return `/w/${activeWorkspaceSlug}${returnTo}`;
    }

    return returnTo;
  }

  return "/dashboard/invoices";
}

function getReturnToMembership(memberships: readonly WorkspaceMembershipSummary[], returnTo: string) {
  const workspaceSlug = returnTo.match(/^\/w\/([a-z0-9-]+)\/dashboard(?:\/|$)/)?.[1];

  return workspaceSlug
    ? memberships.find((membership) => membership.workspaceSlug === workspaceSlug)
    : memberships.find((membership) => can(membership, "email.account.manage"));
}

function redirectToInvoices(request: NextRequest, error: string) {
  const redirectUrl = new URL("/dashboard/invoices", request.nextUrl.origin);
  redirectUrl.searchParams.set("gmail_error", error);

  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const principal = await getCurrentPrincipal();

  if (!principal) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }

  const returnTo = getSafeReturnTo(request);
  const membership = getReturnToMembership(principal.memberships, returnTo);

  if (!membership || !can(membership, "email.account.manage")) {
    return redirectToInvoices(request, "permission");
  }

  const config = getGoogleOAuthConfig(request, "/api/auth/google/mail/callback");

  if (!config) {
    return redirectToInvoices(request, "config");
  }

  const state = createOAuthState();
  const authorizationUrl = createGoogleAuthorizationUrl(config, state, {
    accessType: "offline",
    includeGrantedScopes: true,
    prompt: "consent select_account",
    scopes: ["openid", "email", "profile", GMAIL_SEND_SCOPE],
  });
  const response = NextResponse.redirect(authorizationUrl);

  response.cookies.set(GOOGLE_MAIL_OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    maxAge: GOOGLE_MAIL_OAUTH_STATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set(GOOGLE_MAIL_RETURN_TO_COOKIE_NAME, returnTo, {
    httpOnly: true,
    maxAge: GOOGLE_MAIL_OAUTH_STATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
