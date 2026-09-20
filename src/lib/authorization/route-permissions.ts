import type { PermissionKey } from "./permissions";

const DASHBOARD_ROUTE_PERMISSIONS = [
  ["/dashboard/roles", "roles.manage", "Roles & Permissions"],
  ["/dashboard/email-templates", "email.templates.manage", "Email Templates"],
  ["/dashboard/email-history", "email.history.view", "Email History"],
  ["/dashboard/commerce-pulse", "commerce.performance.view", "Commerce Pulse"],
  ["/dashboard/time-tracking", "time.view", "Time Tracking"],
  ["/dashboard/command-center", "dashboard.performance.view", "Performance"],
  ["/dashboard/employees", "employees.view", "Employees"],
  ["/dashboard/estimates", "estimates.view", "Estimates"],
  ["/dashboard/inventory", "inventory.view", "Inventory"],
  ["/dashboard/customers", "customers.view", "Customers"],
  ["/dashboard/invoices", "invoices.view", "Invoices"],
  ["/dashboard/calendar", "calendar.view", "Calendar"],
  ["/dashboard/services", "services.view", "Services"],
  ["/dashboard/overview", "dashboard.overview.view", "Overview"],
  ["/dashboard/leads", "leads.view", "Leads"],
  ["/dashboard/orders", "orders.view", "Orders"],
  ["/dashboard/jobs", "jobs.view", "Jobs"],
] as const satisfies ReadonlyArray<readonly [string, PermissionKey, string]>;

function getDashboardRoute(dashboardPath: string) {
  return DASHBOARD_ROUTE_PERMISSIONS.find(
    ([prefix]) => dashboardPath === prefix || dashboardPath.startsWith(`${prefix}/`),
  );
}

export function getDashboardViewPermission(dashboardPath: string): PermissionKey | null {
  const route = getDashboardRoute(dashboardPath);

  return route?.[1] ?? null;
}

export function getDashboardRouteLabel(dashboardPath: string) {
  return getDashboardRoute(dashboardPath)?.[2] ?? "Page";
}

export { DASHBOARD_ROUTE_PERMISSIONS };
