import { revalidatePath } from "next/cache";

import { scopeWorkspacePath } from "@/lib/workspace-path";

export function revalidateWorkspacePath(workspaceSlug: string, dashboardPath: string) {
  revalidatePath(scopeWorkspacePath(workspaceSlug, dashboardPath));
}
