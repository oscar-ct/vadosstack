import { headers } from "next/headers";

export type DashboardRequestContext = {
  dashboardPath: string;
  query: string;
  workspaceSlug: string | null;
};

export async function getDashboardRequestContext(): Promise<DashboardRequestContext> {
  const requestHeaders = await headers();
  const dashboardPath = requestHeaders.get("x-vados-dashboard-path");
  const query = requestHeaders.get("x-vados-dashboard-query");
  const workspaceSlug = requestHeaders.get("x-vados-workspace-slug");

  return {
    dashboardPath: dashboardPath?.startsWith("/dashboard") ? dashboardPath : "/dashboard",
    query: query?.startsWith("?") ? query : "",
    workspaceSlug,
  };
}
