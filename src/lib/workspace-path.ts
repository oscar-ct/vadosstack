const SCOPED_DASHBOARD_PATH = /^\/w\/[^/]+(\/dashboard(?:\/.*)?)$/;

export function getLegacyDashboardPath(pathname: string) {
  return pathname.match(SCOPED_DASHBOARD_PATH)?.[1] ?? pathname;
}

export function getWorkspaceDashboardPath(workspaceSlug: string, dashboardPath: string) {
  if (dashboardPath !== "/dashboard" && !dashboardPath.startsWith("/dashboard/")) {
    return dashboardPath;
  }

  return `/w/${encodeURIComponent(workspaceSlug)}${dashboardPath}`;
}

export function scopeWorkspacePath(workspaceSlug: string, href: string) {
  if (href.startsWith("/w/")) return href;

  const match = href.match(/^([^?#]*)(.*)$/);
  const pathname = match?.[1] ?? href;
  const suffix = match?.[2] ?? "";

  if (pathname !== "/dashboard" && !pathname.startsWith("/dashboard/")) return href;
  return `${getWorkspaceDashboardPath(workspaceSlug, pathname)}${suffix}`;
}
