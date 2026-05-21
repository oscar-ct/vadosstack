import { type NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
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
  const redirectUrl = new URL(
    returnTo?.startsWith("/dashboard/") ? returnTo : "/dashboard/invoices",
    request.nextUrl.origin,
  );

  redirectUrl.searchParams.set(status === "connected" ? "gmail_connected" : "gmail_error", value);

  return NextResponse.redirect(redirectUrl);
}

function clearOAuthCookies(response: NextResponse) {
  response.cookies.delete(GOOGLE_MAIL_OAUTH_STATE_COOKIE_NAME);
  response.cookies.delete(GOOGLE_MAIL_RETURN_TO_COOKIE_NAME);
  return response;
}

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return clearOAuthCookies(NextResponse.redirect(new URL("/login", request.nextUrl.origin)));
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

    if (email !== currentUser.email.toLowerCase()) {
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
        userId: currentUser.id,
      },
      create: {
        email,
        googleSubject: userInfo.sub,
        refreshTokenCipher: encryptGoogleToken(tokenResponse.refresh_token),
        scopes: grantedScopes,
        userId: currentUser.id,
      },
      update: {
        email,
        googleSubject: userInfo.sub,
        refreshTokenCipher: encryptGoogleToken(tokenResponse.refresh_token),
        scopes: grantedScopes,
      },
    });

    return clearOAuthCookies(createRedirect(request, "connected", "1"));
  } catch {
    return clearOAuthCookies(createRedirect(request, "error", "callback"));
  }
}
