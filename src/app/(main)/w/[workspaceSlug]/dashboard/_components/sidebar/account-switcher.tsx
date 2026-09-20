"use client";

import Image from "next/image";

import { Check, LogOut, Plus } from "lucide-react";

import { logoutAction } from "@/app/(main)/auth/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceLink as Link } from "@/components/workspace-path-provider";
import { isMainPlatformAdministrator } from "@/lib/platform-admin";
import { getInitials } from "@/lib/utils";

import { useDashboardNavigationLoader } from "../dashboard-navigation-loader";
import { PlatformAdminIdentity } from "./platform-admin-identity";

export function AccountSwitcher({
  canCreateBusiness,
  currentWorkspaceId,
  user,
  workspaces,
}: {
  readonly canCreateBusiness: boolean;
  readonly currentWorkspaceId: string | null;
  readonly workspaces: ReadonlyArray<{
    readonly id: string;
    readonly logoSrc: string;
    readonly name: string;
    readonly roleName: string;
    readonly status: string;
    readonly url: string;
  }>;
  readonly user: Readonly<{
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly avatar?: string;
    readonly role?: boolean;
  } | null>;
}) {
  const { startNavigation, startWorkspaceNavigation } = useDashboardNavigationLoader();

  if (!user) return null;
  const showPlatformIdentity = isMainPlatformAdministrator(user.role, user.email);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="size-8 rounded-lg">
          <AvatarImage src={user.avatar || undefined} alt={user.name} />
          <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56 space-y-1 rounded-lg" side="bottom" align="end" sideOffset={4}>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
              <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-muted-foreground text-xs">{user.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        {workspaces.length ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs">Workplaces</DropdownMenuLabel>
            <DropdownMenuGroup>
              {workspaces.map((workspace) => (
                <DropdownMenuItem key={workspace.id} asChild>
                  <Link
                    href={workspace.url}
                    prefetch={false}
                    onClick={() => {
                      if (workspace.id !== currentWorkspaceId) {
                        startWorkspaceNavigation(workspace.url, workspace.name);
                      }
                    }}
                  >
                    <Image
                      src={workspace.logoSrc}
                      alt=""
                      width={20}
                      height={20}
                      unoptimized
                      className="size-5 shrink-0 rounded-sm object-contain"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{workspace.name}</span>
                      <span className="block truncate text-muted-foreground text-xs">
                        {workspace.roleName}
                        {workspace.status === "Suspended" ? " · Suspended" : ""}
                      </span>
                    </span>
                    {workspace.id === currentWorkspaceId ? <Check className="ml-auto" /> : null}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}
        {canCreateBusiness ? (
          <DropdownMenuItem asChild>
            <Link href="/create-business" prefetch={false} onClick={() => startNavigation("/create-business")}>
              <Plus />
              Create a business
            </Link>
          </DropdownMenuItem>
        ) : null}
        {showPlatformIdentity ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <PlatformAdminIdentity />
            </DropdownMenuGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="flex w-full items-center">
              <LogOut />
              Log out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
