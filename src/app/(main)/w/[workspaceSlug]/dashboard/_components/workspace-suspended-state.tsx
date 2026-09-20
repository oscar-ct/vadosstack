import Image from "next/image";
import Link from "next/link";

import { Building2, LogOut, ShieldAlert } from "lucide-react";

import { logoutAction } from "@/app/(main)/auth/actions";
import { Button } from "@/components/ui/button";
import { getMembershipLandingPath, type WorkspaceMembershipSummary } from "@/lib/authorization";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";

type WorkspaceSuspendedStateProps = {
  workspaceName: string;
  availableWorkspaces: readonly WorkspaceMembershipSummary[];
};

export function WorkspaceSuspendedState({
  workspaceName,
  availableWorkspaces,
}: Readonly<WorkspaceSuspendedStateProps>) {
  return (
    <main className="grid min-h-svh place-items-center bg-white px-6 py-12 text-neutral-950">
      <div className="flex w-full max-w-lg flex-col items-center text-center">
        <Image
          src="/apple-icon.png"
          alt="VadosStack"
          width={112}
          height={112}
          priority
          className="size-24 object-contain"
        />
        <p className="mt-2 text-sm uppercase tracking-[0.22em] text-neutral-500">VadosStack Workspace</p>
        <div className="mt-8 grid size-12 place-items-center rounded-full bg-amber-100 text-amber-700">
          <ShieldAlert className="size-6" />
        </div>
        <h1 className="mt-4 text-2xl tracking-tight">This workspace is suspended</h1>
        <p className="mt-2 text-balance text-neutral-600">
          {workspaceName} is temporarily unavailable. Its dashboard and business data cannot be accessed while the
          suspension is active.
        </p>
        <p className="mt-3 text-balance text-sm text-neutral-500">
          The business owner can contact VadosStack support for more information. Your personal account and access to
          other active workspaces are not affected.
        </p>

        {availableWorkspaces.length ? (
          <div className="mt-8 w-full rounded-xl border border-neutral-200 p-2 text-left">
            <p className="px-2 pb-2 pt-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Available workspaces
            </p>
            {availableWorkspaces.map((workspace) => (
              <Button
                key={workspace.workspaceId}
                variant="ghost"
                className="h-auto w-full justify-start gap-3 px-2 py-2"
                asChild
              >
                <Link href={getWorkspaceDashboardPath(workspace.workspaceSlug, getMembershipLandingPath(workspace))}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-neutral-100">
                    <Building2 className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{workspace.workspaceName}</span>
                    <span className="block text-neutral-500 text-xs">{workspace.roleName}</span>
                  </span>
                </Link>
              </Button>
            ))}
          </div>
        ) : null}

        <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
          <Button asChild variant="outline">
            <Link href="/">Return to VadosStack</Link>
          </Button>
          <form action={logoutAction}>
            <Button type="submit" className="w-full">
              <LogOut />
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
