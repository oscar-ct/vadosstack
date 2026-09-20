import { redirectLegacyDashboard } from "../_lib/redirect-legacy-dashboard";

export default async function LegacyDashboardPathPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path } = await params;
  const dashboardPath = `/dashboard/${path.map(encodeURIComponent).join("/")}`;
  return redirectLegacyDashboard(dashboardPath, searchParams);
}
