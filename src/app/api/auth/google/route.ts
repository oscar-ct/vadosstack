import { type NextRequest, NextResponse } from "next/server";

import {
  createGoogleAuthorizationUrl,
  createOAuthState,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
  getGoogleOAuthConfig,
} from "@/lib/google-auth";

function redirectToLogin(request: NextRequest, error: string) {
  const loginUrl = new URL("/login", request.nextUrl.origin);
  loginUrl.searchParams.set("google_error", error);

  return NextResponse.redirect(loginUrl);
}

export function GET(request: NextRequest) {
  const config = getGoogleOAuthConfig(request);

  if (!config) {
    return redirectToLogin(request, "config");
  }

  const state = createOAuthState();
  const authorizationUrl = createGoogleAuthorizationUrl(config, state);
  const response = NextResponse.redirect(authorizationUrl);

  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    maxAge: GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
