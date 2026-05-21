import type { NextRequest } from "next/server";

import { randomBytes } from "node:crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export const GOOGLE_OAUTH_STATE_COOKIE_NAME = "studio-google-oauth-state";
export const GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

export type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  hd?: string;
};

type GoogleAuthorizationOptions = {
  accessType?: "offline" | "online";
  includeGrantedScopes?: boolean;
  prompt?: string;
  scopes?: string[];
};

type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export function createOAuthState() {
  return randomBytes(32).toString("hex");
}

function getSiteOrigin(request: NextRequest) {
  return process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
}

export function getGoogleOAuthConfig(request: NextRequest, redirectPath = "/api/auth/google/callback") {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const configuredRedirectUri =
    redirectPath === "/api/auth/google/callback"
      ? process.env.GOOGLE_REDIRECT_URI
      : process.env.GOOGLE_MAIL_REDIRECT_URI;
  const redirectUri = configuredRedirectUri || new URL(redirectPath, getSiteOrigin(request)).toString();

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

export function createGoogleAuthorizationUrl(
  config: { clientId: string; redirectUri: string },
  state: string,
  options: GoogleAuthorizationOptions = {},
) {
  const authorizationUrl = new URL(GOOGLE_AUTH_URL);
  const scopes = options.scopes ?? ["openid", "email", "profile"];

  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", scopes.join(" "));
  authorizationUrl.searchParams.set("state", state);

  if (options.accessType) {
    authorizationUrl.searchParams.set("access_type", options.accessType);
  }

  if (options.includeGrantedScopes) {
    authorizationUrl.searchParams.set("include_granted_scopes", "true");
  }

  if (options.prompt) {
    authorizationUrl.searchParams.set("prompt", options.prompt);
  } else {
    authorizationUrl.searchParams.set("prompt", "select_account");
  }

  return authorizationUrl;
}

export async function exchangeGoogleCodeForAccessToken(
  config: { clientId: string; clientSecret: string; redirectUri: string },
  code: string,
) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error("Google rejected the authorization code.");
  }

  const tokenResponse = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
  };

  if (!tokenResponse.access_token) {
    throw new Error("Google did not return an access token.");
  }

  return tokenResponse as GoogleTokenResponse;
}

export async function getGoogleUserInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Could not load Google profile.");
  }

  const userInfo = (await response.json()) as GoogleUserInfo;

  if (!userInfo.email || !userInfo.sub) {
    throw new Error("Google profile is missing required fields.");
  }

  return userInfo;
}
