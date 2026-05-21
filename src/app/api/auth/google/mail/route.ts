import { type NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createGoogleAuthorizationUrl, createOAuthState, getGoogleOAuthConfig } from "@/lib/google-auth";
import {
  GMAIL_SEND_SCOPE,
  GOOGLE_MAIL_OAUTH_STATE_COOKIE_NAME,
  GOOGLE_MAIL_OAUTH_STATE_MAX_AGE_SECONDS,
  GOOGLE_MAIL_RETURN_TO_COOKIE_NAME,
} from "@/lib/google-mail";

function getSafeReturnTo(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo");

  if (returnTo?.startsWith("/dashboard/")) {
    return returnTo;
  }

  return "/dashboard/invoices";
}

function redirectToInvoices(request: NextRequest, error: string) {
  const redirectUrl = new URL("/dashboard/invoices", request.nextUrl.origin);
  redirectUrl.searchParams.set("gmail_error", error);

  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
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
  response.cookies.set(GOOGLE_MAIL_RETURN_TO_COOKIE_NAME, getSafeReturnTo(request), {
    httpOnly: true,
    maxAge: GOOGLE_MAIL_OAUTH_STATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
