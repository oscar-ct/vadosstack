export {
  AuthenticationRequiredError,
  type AuthorizedWorkspace,
  authorizeCurrentDashboard,
  authorizeLegacyOwnerWorkspace,
  authorizeWorkspace,
  authorizeWorkspaceSlug,
  type CurrentDashboardAuthorization,
  type CurrentPrincipal,
  can,
  getCurrentDashboardAuthorization,
  getCurrentPrincipal,
  getPermittedDashboardAuthorization,
  requireCurrentPrincipal,
  WorkspaceAccessDeniedError,
  type WorkspaceMembershipSummary,
} from "./authorize";
export { getPrincipalDashboardDestination, getUserDashboardDestination } from "./dashboard-destination";
export type { PermissionKey } from "./permissions";
export {
  DEFAULT_ROLE_TEMPLATES,
  getPermissionGroupsForWorkspaceMode,
  isPermissionAvailableForWorkspaceMode,
  isPermissionKey,
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
} from "./permissions";
export { type DashboardRequestContext, getDashboardRequestContext } from "./request-context";
export { DASHBOARD_ROUTE_PERMISSIONS, getDashboardRouteLabel, getDashboardViewPermission } from "./route-permissions";
export { getMembershipLandingPath } from "./workspace-landing";
