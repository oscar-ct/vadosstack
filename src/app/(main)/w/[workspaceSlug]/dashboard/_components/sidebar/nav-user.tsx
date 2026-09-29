"use client";

import * as React from "react";

import Image from "next/image";

import {
  ArrowLeft,
  Check,
  EllipsisVertical,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Plus,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { logoutAction } from "@/app/(main)/auth/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { WorkspaceLink as Link, useWorkspaceRouter as useRouter } from "@/components/workspace-path-provider";
import { isMainPlatformAdministrator } from "@/lib/platform-admin";
import { getInitials } from "@/lib/utils";

import { useDashboardNavigationLoader } from "../dashboard-navigation-loader";
import {
  type AccountProfileState,
  type ChangePasswordState,
  changePasswordAction,
  updateAccountProfileAction,
} from "./actions";
import { PlatformAdminIdentity } from "./platform-admin-identity";

const initialAccountProfileState: AccountProfileState = {
  success: false,
  message: "",
};

const initialChangePasswordState: ChangePasswordState = {
  success: false,
  message: "",
};

function ChangePasswordForm({ onCancel }: { readonly onCancel: () => void }) {
  const [state, formAction, isPending] = React.useActionState(changePasswordAction, initialChangePasswordState);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  return (
    <div className="grid gap-4">
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>All active sessions will be terminated</AlertTitle>
        <AlertDescription>
          After changing your password, you will be signed out on this device and every other device. You will need to
          sign in again with your new password.
        </AlertDescription>
      </Alert>
      <form action={formAction} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="current-password">Current password</Label>
          <div className="relative">
            <Input
              id="current-password"
              name="currentPassword"
              type={showCurrentPassword ? "text" : "password"}
              autoComplete="current-password"
              className="pr-10"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
              onClick={() => setShowCurrentPassword((value) => !value)}
            >
              {showCurrentPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-password">New password</Label>
          <div className="relative">
            <Input
              id="new-password"
              name="newPassword"
              type={showNewPassword ? "text" : "password"}
              autoComplete="new-password"
              className="pr-10"
              minLength={8}
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              aria-label={showNewPassword ? "Hide new password" : "Show new password"}
              onClick={() => setShowNewPassword((value) => !value)}
            >
              {showNewPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">Use at least 8 characters.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm-new-password">Confirm new password</Label>
          <div className="relative">
            <Input
              id="confirm-new-password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              className="pr-10"
              minLength={8}
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
              onClick={() => setShowConfirmPassword((value) => !value)}
            >
              {showConfirmPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </div>
        {state.message ? <FieldError errors={[{ message: state.message }]} /> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" disabled={isPending}>
            {isPending ? "Changing password..." : "Change password and sign out"}
          </Button>
        </DialogFooter>
      </form>
    </div>
  );
}

export function NavUser({
  canCreateBusiness,
  currentWorkspaceId,
  user,
  workspaces,
}: {
  readonly canCreateBusiness: boolean;
  readonly currentWorkspaceId: string | null;
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly authProviders: string[];
    readonly avatar?: string;
    readonly admin?: boolean;
  } | null;
  readonly workspaces: ReadonlyArray<{
    readonly id: string;
    readonly logoSrc: string;
    readonly name: string;
    readonly roleName: string;
    readonly status: string;
    readonly url: string;
  }>;
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [changingPassword, setChangingPassword] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(updateAccountProfileAction, initialAccountProfileState);
  const { startNavigation, startWorkspaceNavigation } = useDashboardNavigationLoader();

  React.useEffect(() => {
    if (!state.success) {
      return;
    }

    setProfileOpen(false);
    router.refresh();
    toast.success(state.message || "Profile updated.");
  }, [router, state]);

  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="lg">
            <Link prefetch={false} href="/login">
              <ShieldCheck className="size-4" />
              <span>Sign in</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const showPlatformIdentity = isMainPlatformAdministrator(user.admin, user.email);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
                <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-muted-foreground text-xs">{user.email}</span>
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
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
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {showPlatformIdentity ? <PlatformAdminIdentity /> : null}
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setProfileOpen(true);
                }}
              >
                <UserRound />
                Account settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
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
        <Dialog
          open={profileOpen}
          onOpenChange={(open) => {
            setProfileOpen(open);
            if (!open) setChangingPassword(false);
          }}
        >
          <DialogContent className="max-h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{changingPassword ? "Change password" : "Account settings"}</DialogTitle>
              <DialogDescription>
                {changingPassword
                  ? "Choose a new password for your account."
                  : "Manage your profile and sign-in security."}
              </DialogDescription>
            </DialogHeader>
            {changingPassword ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit px-2"
                  onClick={() => setChangingPassword(false)}
                >
                  <ArrowLeft />
                  Back to account settings
                </Button>
                <ChangePasswordForm onCancel={() => setChangingPassword(false)} />
              </>
            ) : (
              <div className="grid gap-5">
                <section className="grid gap-3">
                  <div>
                    <h3 className="font-medium">Profile</h3>
                    <p className="text-muted-foreground text-xs">Update the name shown throughout your account.</p>
                  </div>
                  <form action={formAction} className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="account-name">Account name</Label>
                      <Input id="account-name" name="name" defaultValue={user.name} required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="account-email">Sign-in email</Label>
                      <Input id="account-email" value={user.email} disabled />
                    </div>
                    {state.message && !state.success ? <FieldError errors={[{ message: state.message }]} /> : null}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isPending}>
                        {isPending ? "Saving..." : "Save profile"}
                      </Button>
                    </div>
                  </form>
                </section>
                <Separator />
                <section className="grid gap-3">
                  <div>
                    <h3 className="font-medium">Security</h3>
                    <p className="text-muted-foreground text-xs">Manage how you sign in to your account.</p>
                  </div>
                  {user.authProviders.includes("email") ? (
                    <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm">Password</p>
                          <p className="text-muted-foreground text-xs">Change your account password securely.</p>
                          {user.authProviders.includes("google") ? (
                            <p className="mt-1 text-muted-foreground text-xs">
                              Google is connected to this account. Changing your VadosStack password will not change
                              your Google password.
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => setChangingPassword(true)}
                      >
                        Change password
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 rounded-lg border p-3">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm">Signed in with Google</p>
                        <p className="break-words text-muted-foreground text-xs">
                          Password changes are managed through your Google account.
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
