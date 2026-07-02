import { type NextRequest, NextResponse } from "next/server";

import { createUserSessionResponse, getDisplayName } from "@/lib/auth";
import {
  exchangeGoogleCodeForAccessToken,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  getGoogleOAuthConfig,
  getGoogleUserInfo,
} from "@/lib/google-auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

import { randomBytes } from "node:crypto";

function redirectToLogin(request: NextRequest, error: string) {
  const loginUrl = new URL("/login", request.nextUrl.origin);
  loginUrl.searchParams.set("google_error", error);

  return NextResponse.redirect(loginUrl);
}

function clearOAuthState(response: NextResponse) {
  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE_NAME);
  return response;
}

function getGoogleWorkspaceName(userInfo: { name?: string; email: string; hd?: string }) {
  if (userInfo.hd) {
    return userInfo.hd;
  }

  return `${getDisplayName(userInfo)}'s Workspace`;
}

export async function GET(request: NextRequest) {
  const config = getGoogleOAuthConfig(request);

  if (!config) {
    return clearOAuthState(redirectToLogin(request, "config"));
  }

  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return clearOAuthState(redirectToLogin(request, "denied"));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE_NAME)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return clearOAuthState(redirectToLogin(request, "state"));
  }

  try {
    const tokenResponse = await exchangeGoogleCodeForAccessToken(config, code);
    const userInfo = await getGoogleUserInfo(tokenResponse.access_token);

    if (!userInfo.email_verified) {
      return clearOAuthState(redirectToLogin(request, "unverified"));
    }

    const email = userInfo.email.toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        authProviders: true,
        id: true,
      },
    });
    const user = existingUser
      ? await prisma.user.update({
          where: {
            id: existingUser.id,
          },
          data: existingUser.authProviders.includes("google")
            ? {}
            : {
                authProviders: {
                  push: "google",
                },
              },
        })
      : await prisma.user.create({
          data: {
            authProviders: ["google"],
            companyAddress: null,
            companyName: getGoogleWorkspaceName({ email, hd: userInfo.hd, name: userInfo.name }),
            companyEmail: email,
            email,
            name: userInfo.name || getDisplayName({ email }),
            passwordHash: hashPassword(randomBytes(32).toString("hex")),
          },
        });

    const response = NextResponse.redirect(new URL("/dashboard/overview", request.nextUrl.origin));
    await createUserSessionResponse(user.id, response, true);

    return clearOAuthState(response);
  } catch {
    return clearOAuthState(redirectToLogin(request, "callback"));
  }
}
