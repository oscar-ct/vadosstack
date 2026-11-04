import { redirect } from "next/navigation";

import { getWorkspaceDashboardPath } from "@/lib/workspace-path";

export default async function Page({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  redirect(getWorkspaceDashboardPath(workspaceSlug, "/dashboard/commerce-analytics"));
}
