import type { NavGroup } from "@/navigation/sidebar/sidebar-items";

export const workspaceModes = ["both", "service", "commerce"] as const;

export type WorkspaceMode = (typeof workspaceModes)[number];

export function parseWorkspaceMode(value: string | null | undefined): WorkspaceMode {
  return workspaceModes.includes(value as WorkspaceMode) ? (value as WorkspaceMode) : "both";
}

export function getWorkspaceHomePath(mode: WorkspaceMode) {
  return mode === "commerce" ? "/dashboard/commerce-pulse" : "/dashboard/overview";
}

const commercePaths = ["/dashboard/commerce-pulse", "/dashboard/orders", "/dashboard/inventory"];
const servicePaths = [
  "/dashboard/overview",
  "/dashboard/calendar",
  "/dashboard/command-center",
  "/dashboard/leads",
  "/dashboard/estimates",
  "/dashboard/invoices",
  "/dashboard/jobs",
  "/dashboard/services",
  "/dashboard/time-tracking",
  "/dashboard/employees",
];

function matchesDashboardPath(pathname: string, paths: readonly string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function isDashboardPathEnabled(pathname: string, mode: WorkspaceMode) {
  if (!pathname.startsWith("/dashboard")) return true;
  if (pathname === "/dashboard") return true;
  if (pathname.startsWith("/dashboard/email") || pathname.startsWith("/dashboard/admin")) return true;
  if (mode === "commerce") return !matchesDashboardPath(pathname, servicePaths);
  if (mode === "service") return !matchesDashboardPath(pathname, commercePaths);
  return true;
}

export function isSidebarGroupEnabled(groupLabel: string | undefined, mode: WorkspaceMode) {
  if (mode === "commerce") {
    return groupLabel !== "Dashboard" && groupLabel !== "Customers" && groupLabel !== "Work";
  }

  if (mode === "service") {
    return groupLabel !== "E-commerce";
  }

  return true;
}

export function getWorkspaceModeLabel(mode: WorkspaceMode) {
  if (mode === "commerce") return "E-commerce";
  if (mode === "service") return "Service business";
  return "Both";
}

export function getWorkspaceModeDescription(mode: WorkspaceMode) {
  if (mode === "commerce") return "Show orders, inventory, Commerce Pulse, email, and admin tools.";
  if (mode === "service") return "Show dashboard, customers, jobs, estimates, invoices, email, and admin tools.";
  return "Show service business and e-commerce tools together.";
}

export function filterSidebarGroups(groups: readonly NavGroup[], mode: WorkspaceMode, isAdmin = false) {
  const customerItem = groups.flatMap((group) => group.items).find((item) => item.url === "/dashboard/customers");

  return groups
    .filter((group) => isSidebarGroupEnabled(group.label, mode))
    .map((group) => ({
      ...group,
      items: [
        ...group.items,
        ...(mode === "commerce" && group.label === "E-commerce" && customerItem ? [customerItem] : []),
      ].filter((item) => {
        if (item.adminOnly && !isAdmin) return false;
        if (mode === "commerce" && item.url === "/dashboard/leads") return false;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);
}
