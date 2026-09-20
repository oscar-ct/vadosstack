import { type NextRequest, NextResponse } from "next/server";

const WORKSPACE_ROUTE = /^\/w\/([a-z0-9-]+)(\/dashboard(?:\/.*)?)$/;
const DASHBOARD_ROUTE = /^\/dashboard(?:\/.*)?$/;
const ACTIVE_WORKSPACE_COOKIE = "vados-active-workspace-client";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-vados-dashboard-path");
  requestHeaders.delete("x-vados-dashboard-query");
  requestHeaders.delete("x-vados-workspace-slug");

  const workspaceMatch = request.nextUrl.pathname.match(WORKSPACE_ROUTE);

  if (workspaceMatch) {
    const [, workspaceSlug, dashboardPath] = workspaceMatch;
    requestHeaders.set("x-vados-dashboard-path", dashboardPath);
    requestHeaders.set("x-vados-dashboard-query", request.nextUrl.search);
    requestHeaders.set("x-vados-workspace-slug", workspaceSlug);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    if (request.method === "GET") {
      response.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspaceSlug, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    return response;
  }

  if (DASHBOARD_ROUTE.test(request.nextUrl.pathname)) {
    const activeWorkspaceSlug = request.cookies.get(ACTIVE_WORKSPACE_COOKIE)?.value;

    if (activeWorkspaceSlug && /^[a-z0-9-]+$/.test(activeWorkspaceSlug) && request.method === "GET") {
      const destination = request.nextUrl.clone();
      destination.pathname = `/w/${activeWorkspaceSlug}${request.nextUrl.pathname}`;
      return NextResponse.redirect(destination);
    }

    requestHeaders.set("x-vados-dashboard-path", request.nextUrl.pathname);
    requestHeaders.set("x-vados-dashboard-query", request.nextUrl.search);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/w/:workspaceSlug/dashboard", "/w/:workspaceSlug/dashboard/:path*"],
};
