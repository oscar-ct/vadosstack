"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

import { PermissionRequiredState } from "@/components/permission-required-state";
import type { PermissionKey } from "@/lib/authorization/permissions";
import { getDashboardRouteLabel, getDashboardViewPermission } from "@/lib/authorization/route-permissions";
import { getLegacyDashboardPath } from "@/lib/workspace-path";

export function DashboardRouteAccessGate({
  backHref,
  backLabel,
  children,
  permissionKeys,
}: Readonly<{
  backHref: string;
  backLabel: string;
  children: ReactNode;
  permissionKeys: readonly PermissionKey[] | ReadonlySet<PermissionKey>;
}>) {
  const dashboardPath = getLegacyDashboardPath(usePathname());
  const requiredPermission = getDashboardViewPermission(dashboardPath);
  const hasPermission = requiredPermission
    ? "has" in permissionKeys
      ? permissionKeys.has(requiredPermission)
      : permissionKeys.includes(requiredPermission)
    : true;
  const accessDenied = !hasPermission;

  if (!accessDenied) return children;

  const routeLabel = getDashboardRouteLabel(dashboardPath);

  return (
    <PermissionRequiredState
      backHref={backHref}
      backLabel={backLabel}
      description={`Your current role does not include permission to view ${routeLabel}. Contact a workspace administrator if you need access.`}
      title={`${routeLabel} access unavailable`}
    />
  );
}
