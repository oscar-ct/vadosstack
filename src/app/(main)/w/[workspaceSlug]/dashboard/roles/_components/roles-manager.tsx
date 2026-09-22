"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { format, parseISO } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  MailPlus,
  PauseCircle,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import type { RoleActionState } from "../actions";

type Role = {
  description: string | null;
  id: string;
  invitationCount: number;
  isProtected: boolean;
  memberCount: number;
  name: string;
  permissions: string[];
  systemKey: string | null;
  updatedAt: string;
};

type RoleAction = (state: RoleActionState, formData: FormData) => Promise<RoleActionState>;
type PermissionGroups = ReadonlyArray<{
  key: string;
  label: string;
  permissions: ReadonlyArray<{ key: string; label: string }>;
}>;

const initialState: RoleActionState = { message: "", success: false };

function RoleDialog({
  action,
  controlledOpen,
  deleteAction,
  hideTrigger = false,
  onControlledOpenChange,
  permissionGroups,
  role,
}: {
  action: RoleAction;
  controlledOpen?: boolean;
  deleteAction?: RoleAction;
  hideTrigger?: boolean;
  onControlledOpenChange?: (open: boolean) => void;
  permissionGroups: PermissionGroups;
  role?: Role;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const [state, formAction, pending] = React.useActionState(action, initialState);
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (onControlledOpenChange) onControlledOpenChange(nextOpen);
      else setInternalOpen(nextOpen);
    },
    [onControlledOpenChange],
  );
  const closeDialog = React.useCallback(() => handleOpenChange(false), [handleOpenChange]);
  const isFixedFullAccessRole = role?.systemKey === "OWNER" || role?.systemKey === "ADMIN";

  React.useEffect(() => {
    if (!state.success) return;
    toast.success(state.message);
    closeDialog();
  }, [closeDialog, state]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <Button size="sm" variant={role ? "outline" : "default"}>
            {role ? <Pencil /> : <Plus />}
            {role ? "Edit" : "Create role"}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="top-0 left-0 grid h-svh max-h-svh w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>
            {role ? (isFixedFullAccessRole ? `${role.name} permissions` : `Edit ${role.name}`) : "Create role"}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]">
          {role ? <input type="hidden" name="roleId" value={role.id} /> : null}
          <div className="grid min-h-0 gap-5 overflow-y-auto overflow-x-hidden p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid content-start gap-2">
                <Label htmlFor={`role-name-${role?.id ?? "new"}`}>Role name</Label>
                <Input
                  id={`role-name-${role?.id ?? "new"}`}
                  name="name"
                  defaultValue={role?.name ?? ""}
                  disabled={Boolean(role?.isProtected)}
                  required
                />
                {role?.isProtected ? <input type="hidden" name="name" value={role.name} /> : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`role-description-${role?.id ?? "new"}`}>Description</Label>
                <Textarea
                  id={`role-description-${role?.id ?? "new"}`}
                  name="description"
                  defaultValue={role?.description ?? ""}
                  className="min-h-20"
                  disabled={isFixedFullAccessRole}
                />
              </div>
            </div>
            <div className="grid gap-4">
              {permissionGroups.map((group) => (
                <fieldset key={group.key} className="grid gap-3 rounded-lg border p-4">
                  <legend className="px-1 font-medium text-sm">{group.label}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.permissions.map((permission) => (
                      <label key={permission.key} className="flex items-start gap-2 rounded-md p-1 text-sm">
                        <input
                          type="checkbox"
                          name="permissions"
                          value={permission.key}
                          defaultChecked={isFixedFullAccessRole || role?.permissions.includes(permission.key)}
                          disabled={isFixedFullAccessRole}
                          className="mt-0.5"
                        />
                        <span>{permission.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
          </div>
          <DialogFooter
            className={`mx-0 mb-0 shrink-0 gap-2 rounded-none ${role && deleteAction && !role.isProtected ? "sm:justify-between" : "sm:justify-end"}`}
          >
            {role && deleteAction && !role.isProtected ? (
              <DeleteRoleButton action={deleteAction} role={role} onSuccess={closeDialog} />
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || isFixedFullAccessRole}>
                {pending ? "Saving..." : "Save role"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteRoleButton({ action, onSuccess, role }: { action: RoleAction; onSuccess: () => void; role: Role }) {
  const [state, formAction, pending] = React.useActionState(action, initialState);
  React.useEffect(() => {
    if (!state.message) return;
    (state.success ? toast.success : toast.error)(state.message);
    if (state.success) onSuccess();
  }, [onSuccess, state]);

  if (role.isProtected) return null;
  return (
    <Button
      type="submit"
      formAction={formAction}
      variant="destructive"
      disabled={pending}
      aria-label={`Delete ${role.name}`}
    >
      <Trash2 />
      {pending ? "Deleting..." : "Delete"}
    </Button>
  );
}

function MutationButton({
  action,
  field,
  label,
  value,
}: {
  action: RoleAction;
  field: "invitationId" | "membershipId";
  label: string;
  value: string;
}) {
  const [state, formAction, pending] = React.useActionState(action, initialState);
  React.useEffect(() => {
    if (state.message) (state.success ? toast.success : toast.error)(state.message);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name={field} value={value} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending} aria-label={label}>
        {field === "membershipId" ? <UserMinus /> : <X />}
      </Button>
    </form>
  );
}

function RemoveMemberDialog({
  action,
  member,
  workspaceName,
}: {
  action: RoleAction;
  member: Member;
  workspaceName: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = React.useActionState(action, initialState);
  const memberName = member.user.name ?? member.user.email;

  React.useEffect(() => {
    if (!state.success) return;
    toast.success(state.message);
    setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <UserMinus />
          Remove access
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Remove {memberName} from {workspaceName}?
          </DialogTitle>
          <DialogDescription>
            This immediately ends their access to this workplace. Their VadosStack account and employee record will not
            be deleted, and you can restore access later.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">{memberName}</p>
          <p className="text-muted-foreground">{member.user.email}</p>
        </div>
        {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <form action={formAction}>
            <input type="hidden" name="membershipId" value={member.id} />
            <Button type="submit" variant="destructive" disabled={pending}>
              <UserMinus />
              {pending ? "Removing..." : "Remove access"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RestoreMemberButton({ action, member }: { action: RoleAction; member: Member }) {
  const [state, formAction, pending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (state.message) (state.success ? toast.success : toast.error)(state.message);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="membershipId" value={member.id} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <RotateCcw />
        {pending ? "Restoring..." : "Restore access"}
      </Button>
    </form>
  );
}

function SuspendMemberDialog({ action, member }: { action: RoleAction; member: Member }) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = React.useActionState(action, initialState);
  const memberName = member.user.name ?? member.user.email;

  React.useEffect(() => {
    if (!state.success) return;
    toast.success(state.message);
    setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <PauseCircle />
          Suspend
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend access for {memberName}?</DialogTitle>
          <DialogDescription>
            They will immediately lose access to this workplace, but their role and employee link will be preserved for
            reactivation.
          </DialogDescription>
        </DialogHeader>
        {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <form action={formAction}>
            <input type="hidden" name="membershipId" value={member.id} />
            <Button type="submit" disabled={pending}>
              <PauseCircle />
              {pending ? "Suspending..." : "Suspend access"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReactivateMemberButton({ action, member }: { action: RoleAction; member: Member }) {
  const [state, formAction, pending] = React.useActionState(action, initialState);
  React.useEffect(() => {
    if (state.message) (state.success ? toast.success : toast.error)(state.message);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="membershipId" value={member.id} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <Play />
        {pending ? "Reactivating..." : "Reactivate"}
      </Button>
    </form>
  );
}

function ResendInvitationButton({ action, invitationId }: { action: RoleAction; invitationId: string }) {
  const [state, formAction, pending] = React.useActionState(action, initialState);
  React.useEffect(() => {
    if (state.message) (state.success ? toast.success : toast.error)(state.message);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="invitationId" value={invitationId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <RefreshCw />
        {pending ? "Resending..." : "Resend"}
      </Button>
    </form>
  );
}

function MemberRoleSelect({ action, member, roles }: { action: RoleAction; member: Member; roles: Role[] }) {
  const router = useRouter();
  const [state, formAction, pending] = React.useActionState(action, initialState);
  const [selectedRoleId, setSelectedRoleId] = React.useState(member.roleId);

  React.useEffect(() => {
    setSelectedRoleId(member.roleId);
  }, [member.roleId]);

  React.useEffect(() => {
    if (!state.message) return;

    (state.success ? toast.success : toast.error)(state.message);
    if (state.success) router.refresh();
    else setSelectedRoleId(member.roleId);
  }, [member.roleId, router, state]);

  const availableRoles = roles.filter((role) => role.systemKey !== "OWNER" || role.id === member.roleId);

  return (
    <form action={formAction}>
      <input type="hidden" name="membershipId" value={member.id} />
      <NativeSelect
        name="roleId"
        value={selectedRoleId}
        disabled={pending || member.isWorkspaceOwner}
        onChange={(event) => {
          setSelectedRoleId(event.currentTarget.value);
          event.currentTarget.form?.requestSubmit();
        }}
        className="min-w-40"
      >
        {availableRoles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </NativeSelect>
    </form>
  );
}

function InviteMemberDialog({
  action,
  employees,
  roles,
}: {
  action: RoleAction;
  employees: Array<{ email: string | null; id: string; name: string }>;
  roles: Role[];
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = React.useActionState(action, initialState);
  const [email, setEmail] = React.useState("");

  React.useEffect(() => {
    if (!state.success) return;
    toast.success(state.message);
    setOpen(false);
    setEmail("");
  }, [state]);

  const availableRoles = roles.filter((role) => role.systemKey !== "OWNER");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <MailPlus />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite workplace member</DialogTitle>
          <DialogDescription>
            The recipient receives a secure seven-day invitation and chooses when to join this workplace.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-role">Role</Label>
            <NativeSelect id="invite-role" name="roleId" required defaultValue="">
              <option value="" disabled>
                Select a role
              </option>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-employee">Link employee record (optional)</Label>
            <NativeSelect
              id="invite-employee"
              name="employeeId"
              defaultValue=""
              onChange={(event) => {
                const employee = employees.find((candidate) => candidate.id === event.currentTarget.value);
                if (employee?.email) setEmail(employee.email);
              }}
            >
              <option value="">No employee link</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </NativeSelect>
            <p className="text-muted-foreground text-xs">
              Linking connects this login to the matching employee profile and future self-service access.
            </p>
          </div>
          {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Inviting..." : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Member = {
  id: string;
  isWorkspaceOwner: boolean;
  joinedAt: string;
  roleId: string;
  user: { email: string; id: string; name: string | null };
};

type RemovedMember = Member & { removedAt: string };
type SuspendedMember = Member & { changedAt: string };

export function RolesManager({
  actions,
  auditEvents,
  employees,
  invitations,
  members,
  permissionGroups,
  removedMembers,
  roles,
  suspendedMembers,
  workspaceName,
}: {
  actions: {
    createRoleAction: RoleAction;
    deleteRoleAction: RoleAction;
    inviteWorkspaceMemberAction: RoleAction;
    reactivateWorkspaceMemberAction: RoleAction;
    removeWorkspaceMemberAction: RoleAction;
    resendWorkspaceInvitationAction: RoleAction;
    restoreWorkspaceMemberAction: RoleAction;
    revokeWorkspaceInvitationAction: RoleAction;
    suspendWorkspaceMemberAction: RoleAction;
    updateMemberRoleAction: RoleAction;
    updateRoleAction: RoleAction;
  };
  auditEvents: Array<{
    action: string;
    actor: { email: string; name: string | null } | null;
    createdAt: string;
    id: string;
    metadata: object | null;
    targetId: string | null;
    targetType: string | null;
  }>;
  employees: Array<{ email: string | null; id: string; name: string }>;
  invitations: Array<{ email: string; expiresAt: string; id: string; role: { name: string } }>;
  members: Member[];
  permissionGroups: PermissionGroups;
  removedMembers: RemovedMember[];
  roles: Role[];
  suspendedMembers: SuspendedMember[];
  workspaceName: string;
}) {
  const [activeTab, setActiveTab] = React.useState<"audit" | "invitations" | "members" | "roles">("roles");
  const [accessLevel, setAccessLevel] = React.useState<"all" | "full" | "read-only" | "scoped">("all");
  const [editingRole, setEditingRole] = React.useState<Role | null>(null);
  const [roleSearch, setRoleSearch] = React.useState("");
  const [roleType, setRoleType] = React.useState<"all" | "custom" | "system">("all");
  const permissionLabels = new Map(
    permissionGroups.flatMap((group) => group.permissions.map((permission) => [permission.key, permission.label])),
  );
  const normalizedSearch = roleSearch.trim().toLowerCase();
  const visiblePermissions = (role: Role) => role.permissions.filter((permission) => permissionLabels.has(permission));
  const getAccessLevel = (role: Role) => {
    if (role.systemKey === "OWNER" || role.systemKey === "ADMIN") return "full" as const;
    if (role.systemKey === "READ_ONLY") return "read-only" as const;
    return visiblePermissions(role).length ? ("scoped" as const) : ("none" as const);
  };
  const visibleRoles = roles.filter((role) => {
    const matchesType = roleType === "all" || (roleType === "system" ? role.isProtected : !role.isProtected);
    const matchesAccess = accessLevel === "all" || getAccessLevel(role) === accessLevel;
    const matchesSearch =
      !normalizedSearch ||
      role.name.toLowerCase().includes(normalizedSearch) ||
      role.description?.toLowerCase().includes(normalizedSearch) ||
      visiblePermissions(role).some((permission) =>
        (permissionLabels.get(permission) ?? permission).toLowerCase().includes(normalizedSearch),
      );
    return matchesType && matchesAccess && matchesSearch;
  });
  const systemRoleOrder = new Map([
    ["OWNER", 0],
    ["ADMIN", 1],
    ["MANAGER", 2],
    ["OFFICE_STAFF", 3],
    ["TIME_MANAGER", 4],
    ["READ_ONLY", 5],
  ]);
  const roleGroups = [
    {
      key: "system",
      label: "System roles",
      roles: visibleRoles
        .filter((role) => role.isProtected)
        .sort(
          (a, b) => (systemRoleOrder.get(a.systemKey ?? "") ?? 99) - (systemRoleOrder.get(b.systemKey ?? "") ?? 99),
        ),
    },
    {
      key: "custom",
      label: "Custom roles",
      roles: visibleRoles.filter((role) => !role.isProtected).sort((a, b) => a.name.localeCompare(b.name)),
    },
  ].filter((group) => group.roles.length > 0);

  const rolePermissionBadges = (role: Role) => {
    const permissions = new Set(visiblePermissions(role));
    return permissionGroups
      .filter((group) => group.permissions.some((permission) => permissions.has(permission.key)))
      .map((group) => group.label);
  };

  const accessLevelLabel = (role: Role) => {
    const level = getAccessLevel(role);
    if (level === "full") return "Full";
    if (level === "read-only") return "Read only";
    if (level === "scoped") return "Scoped";
    return "No access";
  };

  return (
    <div className="@container/main mx-auto grid w-full max-w-[96rem] gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid max-w-2xl gap-2">
          <h1 className="flex items-center gap-2 font-medium text-xl leading-none">
            <span>Roles & Permissions</span>
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <KeyRound className="size-4" />
            </span>
          </h1>
          <p className="text-muted-foreground text-sm">Manage access roles and permissions across {workspaceName}.</p>
        </div>
        <div className="flex items-center gap-2">
          <InviteMemberDialog action={actions.inviteWorkspaceMemberAction} employees={employees} roles={roles} />
          <RoleDialog action={actions.createRoleAction} permissionGroups={permissionGroups} />
        </div>
      </div>

      {editingRole ? (
        <RoleDialog
          action={actions.updateRoleAction}
          controlledOpen
          deleteAction={actions.deleteRoleAction}
          hideTrigger
          onControlledOpenChange={(open) => {
            if (!open) setEditingRole(null);
          }}
          permissionGroups={permissionGroups}
          role={editingRole}
        />
      ) : null}

      <div
        className="flex flex-wrap gap-x-4 border-b sm:gap-x-6"
        role="tablist"
        aria-label="Access management sections"
      >
        {[
          { id: "roles" as const, label: "Roles", count: roles.length },
          {
            id: "members" as const,
            label: "People",
            count: members.length + suspendedMembers.length + removedMembers.length,
          },
          { id: "invitations" as const, label: "Invitations", count: invitations.length },
          { id: "audit" as const, label: "Audit history", count: auditEvents.length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-1 pb-3 font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "roles" ? (
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
            <div className="flex min-w-0 items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <div className="grid gap-0.5">
                <p className="font-medium text-sm">Protected access</p>
                <p className="text-amber-800 text-xs dark:text-amber-200/80">
                  Owner always has full access. Other system roles can be tailored without changing their names.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="hidden shrink-0 items-center gap-1 font-medium text-xs hover:underline sm:flex"
              onClick={() => setActiveTab("audit")}
            >
              View audit history <ChevronRight className="size-3.5" />
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-background">
            <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={roleSearch}
                  onChange={(event) => setRoleSearch(event.currentTarget.value)}
                  placeholder="Search roles or permissions..."
                  className="pl-9"
                  aria-label="Search roles"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <NativeSelect
                  value={roleType}
                  onChange={(event) => setRoleType(event.currentTarget.value as typeof roleType)}
                  className="w-full sm:w-36"
                  aria-label="Filter roles by type"
                >
                  <option value="all">All</option>
                  <option value="system">System</option>
                  <option value="custom">Custom</option>
                </NativeSelect>
                <NativeSelect
                  value={accessLevel}
                  onChange={(event) => setAccessLevel(event.currentTarget.value as typeof accessLevel)}
                  className="w-full sm:w-36"
                  aria-label="Filter roles by access level"
                >
                  <option value="all">All access</option>
                  <option value="full">Full</option>
                  <option value="scoped">Scoped</option>
                  <option value="read-only">Read only</option>
                </NativeSelect>
              </div>
            </div>

            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[960px]">
                <TableHeader className="bg-muted/20">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-56 border-r">Role</TableHead>
                    <TableHead className="w-36 border-r text-center">Access level</TableHead>
                    <TableHead className="w-24 border-r text-center">Users</TableHead>
                    <TableHead className="min-w-80 border-r text-center">Permission sets</TableHead>
                    <TableHead className="w-36 border-r text-center">Last updated</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-16 border-l" aria-label="Actions" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roleGroups.map((group) => (
                    <React.Fragment key={group.key}>
                      <TableRow className="bg-muted/35 hover:bg-muted/35">
                        <TableCell colSpan={7} className="h-9 py-2 font-medium text-muted-foreground text-xs">
                          {group.label}{" "}
                          <span className="ml-1 rounded-full border bg-background px-1.5 py-0.5">
                            {group.roles.length}
                          </span>
                        </TableCell>
                      </TableRow>
                      {group.roles.map((role) => (
                        <TableRow key={role.id}>
                          <TableCell className="border-r">
                            <p className="font-medium">{role.name}</p>
                          </TableCell>
                          <TableCell className="border-r text-center">
                            <Badge variant="outline" className="font-normal">
                              {accessLevelLabel(role)}
                            </Badge>
                          </TableCell>
                          <TableCell className="border-r text-center tabular-nums">{role.memberCount}</TableCell>
                          <TableCell className="border-r">
                            <div className="flex flex-wrap justify-center gap-1.5">
                              {rolePermissionBadges(role)
                                .slice(0, 3)
                                .map((label) => (
                                  <Badge key={label} variant="outline" className="max-w-40 truncate font-normal">
                                    {label}
                                  </Badge>
                                ))}
                              {rolePermissionBadges(role).length > 3 ? (
                                <span className="self-center text-muted-foreground text-xs">
                                  +{rolePermissionBadges(role).length - 3}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="border-r text-center text-xs">
                            {format(parseISO(role.updatedAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={role.isProtected ? "secondary" : "outline"} className="font-normal">
                              {role.isProtected ? "System" : "Custom"}
                            </Badge>
                          </TableCell>
                          <TableCell className="border-l text-center">
                            <div className="flex justify-center">
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setEditingRole(role)}
                                aria-label={
                                  role.systemKey === "OWNER" || role.systemKey === "ADMIN"
                                    ? `View ${role.name} permissions`
                                    : `Edit ${role.name}`
                                }
                              >
                                <Pencil />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-4 p-3 md:hidden">
              {roleGroups.map((group) => (
                <section key={group.key} className="grid gap-2">
                  <div className="flex items-center gap-2 px-1 font-medium text-muted-foreground text-xs">
                    <span>{group.label}</span>
                    <span className="rounded-full border bg-background px-1.5 py-0.5">{group.roles.length}</span>
                  </div>
                  <div className="grid gap-2">
                    {group.roles.map((role) => {
                      const permissionBadges = rolePermissionBadges(role);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => setEditingRole(role)}
                          aria-label={
                            role.systemKey === "OWNER" || role.systemKey === "ADMIN"
                              ? `View ${role.name} permissions`
                              : `Edit ${role.name}`
                          }
                          className="grid min-w-0 gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="flex min-w-0 items-start justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{role.name}</span>
                              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                <Badge variant={role.isProtected ? "secondary" : "outline"} className="font-normal">
                                  {role.isProtected ? "System" : "Custom"}
                                </Badge>
                                <Badge variant="outline" className="font-normal">
                                  {accessLevelLabel(role)}
                                </Badge>
                              </span>
                            </span>
                            <Pencil className="size-4 shrink-0 text-muted-foreground" />
                          </span>
                          <span className="grid grid-cols-2 gap-3 text-sm">
                            <span>
                              <span className="block text-muted-foreground text-xs">Users</span>
                              <span className="mt-0.5 block tabular-nums">{role.memberCount.toLocaleString()}</span>
                            </span>
                            <span>
                              <span className="block text-muted-foreground text-xs">Last updated</span>
                              <span className="mt-0.5 block">{format(parseISO(role.updatedAt), "MMM d, yyyy")}</span>
                            </span>
                          </span>
                          <span className="min-w-0">
                            <span className="block text-muted-foreground text-xs">Permission sets</span>
                            <span className="mt-1.5 flex flex-wrap gap-1.5">
                              {permissionBadges.length ? (
                                <>
                                  {permissionBadges.slice(0, 4).map((label) => (
                                    <Badge key={label} variant="outline" className="max-w-40 truncate font-normal">
                                      {label}
                                    </Badge>
                                  ))}
                                  {permissionBadges.length > 4 ? (
                                    <span className="self-center text-muted-foreground text-xs">
                                      +{permissionBadges.length - 4}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <span className="text-muted-foreground text-xs">No permission sets</span>
                              )}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            {!visibleRoles.length ? (
              <div className="grid place-items-center gap-1 px-4 py-12 text-center">
                <p className="font-medium text-sm">No roles found</p>
                <p className="text-muted-foreground text-xs">Try a different search or role type.</p>
              </div>
            ) : null}
            <div className="flex flex-col gap-3 border-t px-4 py-3 text-muted-foreground text-xs sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {visibleRoles.length} of {roles.length} roles
              </span>
              <div className="flex items-center justify-between gap-5 sm:justify-end">
                <div className="flex items-center gap-1">
                  <Button size="icon-sm" variant="ghost" disabled aria-label="Previous page">
                    <ChevronLeft />
                  </Button>
                  <span className="grid size-8 place-items-center rounded-lg border bg-background text-foreground">
                    1
                  </span>
                  <Button size="icon-sm" variant="ghost" disabled aria-label="Next page">
                    <ChevronRight />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span>Rows per page</span>
                  <NativeSelect className="w-20" aria-label="Rows per page" defaultValue="12">
                    <option value="12">12</option>
                  </NativeSelect>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "members" ? (
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="border-b p-4">
            <div className="flex items-center gap-2 font-medium">
              <Users className="size-4" />
              People with access
            </div>
            <p className="mt-1 text-muted-foreground text-xs">Role changes take effect on the member's next request.</p>
          </div>
          <div className="grid divide-y">
            {members.map((member) => (
              <div key={member.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{member.user.name || member.user.email}</p>
                  <p className="truncate text-muted-foreground text-xs">
                    {member.user.email} · Joined {format(parseISO(member.joinedAt), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <MemberRoleSelect action={actions.updateMemberRoleAction} member={member} roles={roles} />
                  {roles.find((role) => role.id === member.roleId)?.systemKey !== "OWNER" ? (
                    <>
                      <SuspendMemberDialog action={actions.suspendWorkspaceMemberAction} member={member} />
                      <RemoveMemberDialog
                        action={actions.removeWorkspaceMemberAction}
                        member={member}
                        workspaceName={workspaceName}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {suspendedMembers.length ? (
            <div className="border-t bg-amber-50/30 dark:bg-amber-950/10">
              <div className="border-b px-4 py-3">
                <p className="font-medium text-sm">Suspended access</p>
                <p className="mt-1 text-muted-foreground text-xs">
                  These accounts retain their role and employee link but cannot enter this workplace.
                </p>
              </div>
              <div className="grid divide-y">
                {suspendedMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-sm">{member.user.name || member.user.email}</p>
                        <Badge variant="outline">Suspended</Badge>
                      </div>
                      <p className="truncate text-muted-foreground text-xs">
                        {member.user.email} · Suspended {format(parseISO(member.changedAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <MemberRoleSelect action={actions.updateMemberRoleAction} member={member} roles={roles} />
                      <ReactivateMemberButton action={actions.reactivateWorkspaceMemberAction} member={member} />
                      <RemoveMemberDialog
                        action={actions.removeWorkspaceMemberAction}
                        member={member}
                        workspaceName={workspaceName}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {removedMembers.length ? (
            <div className="border-t bg-muted/10">
              <div className="border-b px-4 py-3">
                <p className="font-medium text-sm">Removed access</p>
                <p className="mt-1 text-muted-foreground text-xs">
                  These accounts cannot access this workplace. Restore access without sending another invitation.
                </p>
              </div>
              <div className="grid divide-y">
                {removedMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-sm">{member.user.name || member.user.email}</p>
                        <Badge variant="outline">Removed</Badge>
                      </div>
                      <p className="truncate text-muted-foreground text-xs">
                        {member.user.email} · Removed {format(parseISO(member.removedAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <MemberRoleSelect action={actions.updateMemberRoleAction} member={member} roles={roles} />
                      <RestoreMemberButton action={actions.restoreWorkspaceMemberAction} member={member} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "invitations" ? (
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="flex items-center justify-between gap-3 border-b p-4">
            <div>
              <p className="font-medium">Pending invitations</p>
              <p className="mt-1 text-muted-foreground text-xs">Invitations expire seven days after they are sent.</p>
            </div>
            <InviteMemberDialog action={actions.inviteWorkspaceMemberAction} employees={employees} roles={roles} />
          </div>
          {invitations.length ? (
            <div className="grid divide-y">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{invitation.email}</p>
                    <p className="text-muted-foreground text-xs">
                      {invitation.role.name} · Expires {format(parseISO(invitation.expiresAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ResendInvitationButton
                      action={actions.resendWorkspaceInvitationAction}
                      invitationId={invitation.id}
                    />
                    <MutationButton
                      action={actions.revokeWorkspaceInvitationAction}
                      field="invitationId"
                      label={`Revoke invitation for ${invitation.email}`}
                      value={invitation.id}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid place-items-center gap-1 px-4 py-14 text-center">
              <MailPlus className="mb-1 size-5 text-muted-foreground" />
              <p className="font-medium text-sm">No pending invitations</p>
              <p className="text-muted-foreground text-xs">
                New invitations will appear here until accepted or revoked.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "audit" ? (
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="border-b p-4">
            <div className="flex items-center gap-2 font-medium">
              <ShieldCheck className="size-4" />
              Authorization audit history
            </div>
            <p className="mt-1 text-muted-foreground text-xs">
              The 100 most recent role, invitation, membership, and workspace-access events.
            </p>
          </div>
          {auditEvents.length ? (
            <div className="grid divide-y">
              {auditEvents.map((event) => {
                const actionLabel = event.action
                  .split(".")
                  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                  .join(" · ");
                const actor = event.actor?.name || event.actor?.email || "System";
                return (
                  <div key={event.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-sm">{actionLabel}</p>
                        {event.targetType ? <Badge variant="outline">{event.targetType}</Badge> : null}
                      </div>
                      <p className="mt-1 truncate text-muted-foreground text-xs">
                        {actor}
                        {event.targetId ? ` · ${event.targetId}` : ""}
                      </p>
                    </div>
                    <time className="text-muted-foreground text-xs" dateTime={event.createdAt}>
                      {format(parseISO(event.createdAt), "MMM d, yyyy · h:mm a")}
                    </time>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid place-items-center gap-1 px-4 py-14 text-center">
              <ShieldCheck className="mb-1 size-5 text-muted-foreground" />
              <p className="font-medium text-sm">No access changes recorded</p>
              <p className="text-muted-foreground text-xs">New authorization events will appear here.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
