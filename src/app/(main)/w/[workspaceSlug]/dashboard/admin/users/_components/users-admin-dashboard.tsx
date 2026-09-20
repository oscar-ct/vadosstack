"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { formatDistanceToNow } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  Eye,
  KeyRound,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { reactivateWorkspaceAction, suspendWorkspaceAction, type WorkspaceEnforcementActionState } from "../actions";

export type AdminWorkspaceRecord = {
  id: string;
  name: string;
  slug: string;
  status: string;
  roleName: string;
  roleSystemKey: string | null;
  joinedAt: string;
  suspendedAt: string | null;
  suspensionReasonCode: string | null;
  suspensionNote: string | null;
  memberCount: number;
  latestEvent: {
    action: string;
    actorName: string;
    createdAt: string;
    note: string | null;
  } | null;
};

export type AdminUserRecord = {
  id: string;
  name: string | null;
  email: string;
  admin: boolean;
  authProviders: string[];
  createdAt: string;
  lastLoginAt: string | null;
  workspaces: AdminWorkspaceRecord[];
};

type StatusFilter = "all" | "active" | "affected" | "no-workspace";
const initialActionState: WorkspaceEnforcementActionState = { message: "", success: false, submittedAt: 0 };

function getUserStatus(user: AdminUserRecord) {
  if (!user.workspaces.length) return "No workspace";
  const suspendedCount = user.workspaces.filter((workspace) => workspace.status === "Suspended").length;
  if (suspendedCount === user.workspaces.length) return "Suspended access";
  if (suspendedCount) return "Mixed access";
  return "Active";
}

function statusBadge(status: string) {
  if (status === "Suspended" || status === "Suspended access") {
    return <Badge variant="destructive">Suspended</Badge>;
  }
  if (status === "Mixed access") return <Badge className="border-amber-300 bg-amber-50 text-amber-800">Mixed</Badge>;
  if (status === "No workspace") return <Badge variant="outline">No workspace</Badge>;
  return (
    <Badge variant="outline" className="border-emerald-300 text-emerald-700">
      Active
    </Badge>
  );
}

function relativeDate(value: string | null) {
  if (!value) return "Never";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function WorkspaceControl({
  workspace,
  consoleWorkspaceSlug,
}: Readonly<{ workspace: AdminWorkspaceRecord; consoleWorkspaceSlug: string }>) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const action = workspace.status === "Suspended" ? reactivateWorkspaceAction : suspendWorkspaceAction;
  const [state, formAction, pending] = React.useActionState(action, initialActionState);
  const handledAt = React.useRef(0);

  React.useEffect(() => {
    if (!state.submittedAt || state.submittedAt === handledAt.current) return;
    handledAt.current = state.submittedAt;
    if (state.success) {
      toast.success(state.message);
      setOpen(false);
      router.refresh();
    } else {
      toast.error(state.message);
    }
  }, [router, state]);

  const isSuspended = workspace.status === "Suspended";
  return (
    <>
      <Button variant={isSuspended ? "outline" : "destructive"} size="sm" onClick={() => setOpen(true)}>
        {isSuspended ? "Reactivate" : "Suspend"}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{isSuspended ? "Reactivate workspace?" : "Suspend workspace?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isSuspended
                ? `Every member will immediately regain their permitted access to ${workspace.name}.`
                : `Every member, including the owner, will immediately lose dashboard access to ${workspace.name}. Their access to other businesses will remain unchanged.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form action={formAction} className="grid gap-4">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <input type="hidden" name="workspaceSlug" value={consoleWorkspaceSlug} />
            {!isSuspended ? (
              <label className="grid gap-1.5 text-sm" htmlFor={`suspension-reason-${workspace.id}`}>
                <span className="font-medium">Reason</span>
                <NativeSelect
                  id={`suspension-reason-${workspace.id}`}
                  name="reasonCode"
                  className="w-full"
                  defaultValue="terms_violation"
                  disabled={pending}
                >
                  <NativeSelectOption value="terms_violation">Terms violation</NativeSelectOption>
                  <NativeSelectOption value="abuse_or_spam">Abuse or spam</NativeSelectOption>
                  <NativeSelectOption value="fraud_or_security">Fraud or security risk</NativeSelectOption>
                  <NativeSelectOption value="prohibited_content">Prohibited content</NativeSelectOption>
                  <NativeSelectOption value="other">Other</NativeSelectOption>
                </NativeSelect>
              </label>
            ) : null}
            <label className="grid gap-1.5 text-sm" htmlFor={`enforcement-note-${workspace.id}`}>
              <span className="font-medium">
                Internal note {isSuspended ? <span className="text-muted-foreground">(optional)</span> : null}
              </span>
              <Textarea
                id={`enforcement-note-${workspace.id}`}
                name="note"
                required={!isSuspended}
                minLength={isSuspended ? undefined : 10}
                placeholder={isSuspended ? "Why is access being restored?" : "Document the evidence or policy concern…"}
                disabled={pending}
              />
            </label>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={pending}>
                Cancel
              </AlertDialogCancel>
              <Button type="submit" variant={isSuspended ? "default" : "destructive"} disabled={pending}>
                {pending ? "Saving…" : isSuspended ? "Reactivate workspace" : "Suspend workspace"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function UserDetails({
  user,
  consoleWorkspaceSlug,
  onOpenChange,
}: Readonly<{ user: AdminUserRecord; consoleWorkspaceSlug: string; onOpenChange: (open: boolean) => void }>) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{user.name ?? "Unnamed user"}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs">Account created</p>
              <p className="mt-1 text-sm">{new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Last sign-in</p>
              <p className="mt-1 text-sm">{relativeDate(user.lastLoginAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Sign-in methods</p>
              <p className="mt-1 text-sm capitalize">{user.authProviders.join(", ") || "Unknown"}</p>
            </div>
          </div>
          <div className="grid gap-2">
            <div>
              <h3 className="font-medium">Workspace access</h3>
              <p className="text-muted-foreground text-sm">
                Suspension applies to the entire business, not this user alone.
              </p>
            </div>
            {user.workspaces.length ? (
              user.workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{workspace.name}</p>
                      {statusBadge(workspace.status)}
                      <Badge variant="secondary">{workspace.roleName}</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {workspace.memberCount} {workspace.memberCount === 1 ? "member" : "members"} · Joined{" "}
                      {new Date(workspace.joinedAt).toLocaleDateString()}
                    </p>
                    {workspace.status === "Suspended" ? (
                      <p className="mt-2 rounded-md bg-destructive/5 p-2 text-destructive text-xs">
                        {workspace.suspensionNote || "No internal suspension note recorded."}
                      </p>
                    ) : null}
                    {workspace.latestEvent ? (
                      <p className="mt-2 text-muted-foreground text-xs">
                        Latest: {workspace.latestEvent.action === "workspace.suspend" ? "Suspended" : "Reactivated"} by{" "}
                        {workspace.latestEvent.actorName} {relativeDate(workspace.latestEvent.createdAt)}
                      </p>
                    ) : null}
                  </div>
                  <WorkspaceControl workspace={workspace} consoleWorkspaceSlug={consoleWorkspaceSlug} />
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
                This account does not belong to a workspace.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UsersAdminDashboard({
  users,
  workspaceSlug,
}: Readonly<{ users: AdminUserRecord[]; workspaceSlug: string }>) {
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [selectedUser, setSelectedUser] = React.useState<AdminUserRecord | null>(null);
  const suspendedWorkspaceIds = new Set(
    users.flatMap((user) =>
      user.workspaces.filter((workspace) => workspace.status === "Suspended").map((workspace) => workspace.id),
    ),
  );
  const activeUsers = users.filter((user) => getUserStatus(user) === "Active").length;
  const affectedUsers = users.filter((user) =>
    user.workspaces.some((workspace) => workspace.status === "Suspended"),
  ).length;
  const recentUsers = users.filter((user) => Date.now() - new Date(user.createdAt).getTime() <= 30 * 86_400_000).length;
  const stats: Array<{ icon: LucideIcon; label: string; value: number }> = [
    { icon: Users, label: "Total users", value: users.length },
    { icon: UserRoundCheck, label: "Active access", value: activeUsers },
    { icon: ShieldAlert, label: "Affected users", value: affectedUsers },
    { icon: Building2, label: "Suspended workspaces", value: suspendedWorkspaceIds.size },
    { icon: CalendarDays, label: "New in 30 days", value: recentUsers },
  ];

  const filteredUsers = users.filter((user) => {
    const search = query.trim().toLowerCase();
    const matchesSearch =
      !search ||
      [user.name, user.email, ...user.workspaces.map((workspace) => workspace.name)].some((value) =>
        value?.toLowerCase().includes(search),
      );
    const status = getUserStatus(user);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && status === "Active") ||
      (statusFilter === "affected" && user.workspaces.some((workspace) => workspace.status === "Suspended")) ||
      (statusFilter === "no-workspace" && status === "No workspace");
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="@container/main grid gap-4 md:gap-6">
      <div className="grid gap-1">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <ShieldCheck className="size-4" />
          Platform administration
        </div>
        <h1 className="text-2xl tracking-tight">Users</h1>
        <p className="max-w-2xl text-muted-foreground text-sm">
          Review account access and enforce workspace-level policy decisions without affecting a person’s other
          businesses.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(({ icon: Icon, label, value }) => (
          <Card key={label} size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground" />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl">{value.toLocaleString()}</CardContent>
          </Card>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users or workspaces…"
              className="pl-8"
            />
          </div>
          <NativeSelect
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="w-full sm:w-44"
          >
            <NativeSelectOption value="all">All access</NativeSelectOption>
            <NativeSelectOption value="active">Active</NativeSelectOption>
            <NativeSelectOption value="affected">Suspension affected</NativeSelectOption>
            <NativeSelectOption value="no-workspace">No workspace</NativeSelectOption>
          </NativeSelect>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Workspaces</TableHead>
              <TableHead>Sign-in</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => {
              const status = getUserStatus(user);
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="grid gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.name || "Unnamed user"}</span>
                        {user.admin ? <Badge variant="secondary">Platform admin</Badge> : null}
                      </div>
                      <span className="text-muted-foreground text-xs">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-0.5">
                      <span>{user.workspaces.length.toLocaleString()}</span>
                      <span className="max-w-52 truncate text-muted-foreground text-xs">
                        {user.workspaces.map((workspace) => workspace.name).join(", ") || "None"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.authProviders.map((provider) => (
                        <Badge key={provider} variant="outline" className="capitalize">
                          <KeyRound className="size-3" />
                          {provider}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{relativeDate(user.lastLoginAt)}</TableCell>
                  <TableCell>{statusBadge(status)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedUser(user)}>
                      <Eye />
                      View account
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!filteredUsers.length ? (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                  No users match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <div className="border-t px-4 py-3 text-muted-foreground text-sm">
          Showing {filteredUsers.length.toLocaleString()} of {users.length.toLocaleString()} users
        </div>
      </section>
      {selectedUser ? (
        <UserDetails
          user={selectedUser}
          consoleWorkspaceSlug={workspaceSlug}
          onOpenChange={(open) => {
            if (!open) setSelectedUser(null);
          }}
        />
      ) : null}
    </div>
  );
}
