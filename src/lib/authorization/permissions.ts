export const PERMISSION_GROUPS = [
  {
    key: "dashboard",
    label: "Dashboard",
    permissions: [
      { key: "dashboard.overview.view", label: "View overview" },
      { key: "dashboard.performance.view", label: "View performance reports" },
    ],
  },
  {
    key: "calendar",
    label: "Calendar",
    permissions: [
      { key: "calendar.view", label: "View calendar" },
      { key: "calendar.manage", label: "Manage calendar" },
    ],
  },
  {
    key: "customers",
    label: "Customers and leads",
    permissions: [
      { key: "leads.view", label: "View leads" },
      { key: "leads.create", label: "Create leads" },
      { key: "leads.update", label: "Edit leads" },
      { key: "leads.delete", label: "Delete leads" },
      { key: "customers.view", label: "View customers" },
      { key: "customers.create", label: "Create customers" },
      { key: "customers.update", label: "Edit customers" },
      { key: "customers.delete", label: "Delete customers" },
    ],
  },
  {
    key: "work",
    label: "Work",
    permissions: [
      { key: "estimates.view", label: "View estimates" },
      { key: "estimates.create", label: "Create estimates" },
      { key: "estimates.update", label: "Edit estimates" },
      { key: "estimates.delete", label: "Delete estimates" },
      { key: "estimates.send", label: "Send estimates" },
      { key: "estimates.convert", label: "Convert estimates to jobs" },
      { key: "jobs.view", label: "View jobs" },
      { key: "jobs.create", label: "Create jobs" },
      { key: "jobs.update", label: "Edit jobs" },
      { key: "jobs.delete", label: "Delete jobs" },
      { key: "jobs.complete", label: "Complete jobs" },
      { key: "invoices.view", label: "View invoices" },
      { key: "invoices.create", label: "Create invoices" },
      { key: "invoices.update", label: "Edit invoices" },
      { key: "invoices.delete", label: "Delete invoices" },
      { key: "invoices.send", label: "Send invoices" },
      { key: "invoices.record_payment", label: "Record invoice payments" },
      { key: "services.view", label: "View services" },
      { key: "services.manage", label: "Manage services" },
    ],
  },
  {
    key: "people",
    label: "People and time",
    permissions: [
      { key: "employees.view", label: "View employees" },
      { key: "employees.manage", label: "Manage employees" },
      { key: "employees.compensation.view", label: "View employee compensation" },
      { key: "employees.compensation.manage", label: "Manage employee compensation" },
      { key: "time.view", label: "View time tracking" },
      { key: "time.manage", label: "Add and edit time" },
      { key: "time.approve", label: "Review time requests" },
      { key: "time.lock", label: "Lock and unlock weeks" },
    ],
  },
  {
    key: "commerce",
    label: "Commerce",
    permissions: [
      { key: "commerce.performance.view", label: "View commerce performance" },
      { key: "orders.view", label: "View orders" },
      { key: "orders.create", label: "Create orders" },
      { key: "orders.update", label: "Edit orders" },
      { key: "orders.delete", label: "Delete orders" },
      { key: "orders.returns.manage", label: "Manage returns" },
      { key: "inventory.view", label: "View inventory" },
      { key: "inventory.manage", label: "Manage inventory" },
    ],
  },
  {
    key: "email",
    label: "Email",
    permissions: [
      { key: "email.send", label: "Send email" },
      { key: "email.history.view", label: "View email history" },
      { key: "email.templates.manage", label: "Manage email templates" },
      { key: "email.account.manage", label: "Manage connected email account" },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    permissions: [
      { key: "settings.view", label: "View company settings" },
      { key: "settings.manage", label: "Manage company settings" },
      { key: "settings.branding.manage", label: "Manage company branding" },
      { key: "roles.manage", label: "Manage roles and invitations" },
      { key: "reports.export", label: "Export reports" },
    ],
  },
] as const;

export const PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.key),
);

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

type PermissionWorkspaceMode = "both" | "commerce" | "service";

const COMMERCE_PERMISSION_PREFIXES = ["commerce.", "inventory.", "orders."] as const;
const SERVICE_PERMISSION_PREFIXES = [
  "calendar.",
  "dashboard.",
  "estimates.",
  "invoices.",
  "jobs.",
  "leads.",
  "services.",
] as const;

export function isPermissionAvailableForWorkspaceMode(permission: PermissionKey, mode: PermissionWorkspaceMode) {
  if (mode === "both") return true;
  if (mode === "commerce") {
    return !SERVICE_PERMISSION_PREFIXES.some((prefix) => permission.startsWith(prefix));
  }
  return !COMMERCE_PERMISSION_PREFIXES.some((prefix) => permission.startsWith(prefix));
}

export function getPermissionGroupsForWorkspaceMode(mode: PermissionWorkspaceMode) {
  return PERMISSION_GROUPS.map((group) => ({
    ...group,
    label:
      mode === "commerce" && group.key === "customers"
        ? "Customers"
        : mode === "commerce" && group.key === "people"
          ? "People"
          : group.label,
    permissions: group.permissions.filter((permission) => isPermissionAvailableForWorkspaceMode(permission.key, mode)),
  })).filter((group) => group.permissions.length > 0);
}

const allPermissions = [...PERMISSION_KEYS];

export const DEFAULT_ROLE_TEMPLATES = [
  {
    systemKey: "OWNER",
    name: "Owner",
    description: "Full workspace access. This role cannot be edited or deleted.",
    permissions: allPermissions,
  },
  {
    systemKey: "ADMIN",
    name: "Admin",
    description: "Full administrative access without workspace ownership.",
    permissions: allPermissions,
  },
  {
    systemKey: "MANAGER",
    name: "Manager",
    description: "Runs daily operations without access to roles, connected email, or company ownership settings.",
    permissions: allPermissions.filter(
      (permission) =>
        permission !== "roles.manage" &&
        permission !== "email.account.manage" &&
        permission !== "settings.branding.manage",
    ),
  },
  {
    systemKey: "OFFICE_STAFF",
    name: "Office staff",
    description: "Manages customers, scheduling, estimates, jobs, invoices, and outbound email.",
    permissions: allPermissions.filter(
      (permission) =>
        permission.startsWith("dashboard.") ||
        permission.startsWith("calendar.") ||
        permission.startsWith("leads.") ||
        permission.startsWith("customers.") ||
        permission.startsWith("estimates.") ||
        permission.startsWith("jobs.") ||
        permission.startsWith("invoices.") ||
        permission === "services.view" ||
        permission === "employees.view" ||
        permission === "time.view" ||
        permission === "email.send" ||
        permission === "email.history.view" ||
        permission === "reports.export",
    ),
  },
  {
    systemKey: "TIME_MANAGER",
    name: "Time manager",
    description: "Manages employee records and time without compensation or broader business access.",
    permissions: ["employees.view", "employees.manage", "time.view", "time.manage", "time.approve", "time.lock"],
  },
  {
    systemKey: "READ_ONLY",
    name: "Read only",
    description: "Can view business records but cannot change or send them.",
    permissions: allPermissions.filter(
      (permission) =>
        permission.endsWith(".view") && permission !== "employees.compensation.view" && permission !== "settings.view",
    ),
  },
] as const satisfies ReadonlyArray<{
  systemKey: string;
  name: string;
  description: string;
  permissions: readonly PermissionKey[];
}>;

export const isPermissionKey = (value: string): value is PermissionKey =>
  (PERMISSION_KEYS as readonly string[]).includes(value);
