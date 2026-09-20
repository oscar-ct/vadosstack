import { redirectLegacyDashboard } from "./_lib/redirect-legacy-dashboard";

export default async function LegacyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return redirectLegacyDashboard("/dashboard", searchParams);
}
