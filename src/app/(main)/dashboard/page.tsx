import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceHomePath } from "@/lib/workspace-mode";

export default async function Page() {
  const currentUser = await getCurrentUser();

  redirect(getWorkspaceHomePath(currentUser?.workspaceMode ?? "both"));
}
