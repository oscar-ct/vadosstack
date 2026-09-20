"use client";

import * as React from "react";

import Image from "next/image";

import { useShallow } from "zustand/react/shallow";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { WorkspaceLink as Link } from "@/components/workspace-path-provider";
import type { PermissionKey } from "@/lib/authorization/permissions";
import { getDashboardViewPermission } from "@/lib/authorization/route-permissions";
import type { DocumentEmailTemplate } from "@/lib/email-templates";
import {
  filterSidebarGroups,
  getWorkspaceHomePath,
  parseWorkspaceMode,
  type WorkspaceMode,
} from "@/lib/workspace-mode";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import { useDashboardNavigationLoader } from "../dashboard-navigation-loader";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

export function AppSidebar({
  currentUser,
  dueTodayTaskCount,
  pendingTimeReviewCount,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  dueTodayTaskCount: number;
  pendingTimeReviewCount: number;
  currentUser: {
    name: string;
    companyName: string;
    companyAddress: string | null;
    companyEmail: string | null;
    companyLogoSrc: string;
    companyPhone: string | null;
    estimateValidDays: number;
    email: string;
    invoiceDueDays: number;
    workspaceMode: WorkspaceMode;
    workspaceSlug: string;
    admin: boolean;
    gmailConnected: boolean;
    gmailSenderEmail: string | null;
    emailTemplates: DocumentEmailTemplate[];
    emailRecipients: Array<{
      email: string;
      id: string;
      name: string;
      type: "Customer" | "Lead";
    }>;
    permissionKeys: PermissionKey[];
    canManageSettings: boolean;
    canManageBranding: boolean;
    canManageEmailAccount: boolean;
    canSendEmail: boolean;
    canCreateBusiness: boolean;
    currentWorkspaceId: string;
    workspaces: Array<{
      id: string;
      logoSrc: string;
      name: string;
      roleName: string;
      status: string;
      url: string;
    }>;
  } | null;
}) {
  const { sidebarVariant, sidebarCollapsible, isSynced } = usePreferencesStore(
    useShallow((s) => ({
      sidebarVariant: s.sidebarVariant,
      sidebarCollapsible: s.sidebarCollapsible,
      isSynced: s.isSynced,
    })),
  );

  const variant = isSynced ? sidebarVariant : props.variant;
  const collapsible = isSynced ? sidebarCollapsible : props.collapsible;
  const companyName = currentUser?.companyName ?? "Company Dashboard";
  const workspaceMode = parseWorkspaceMode(currentUser?.workspaceMode);
  const workspaceSlug = currentUser?.workspaceSlug ?? "";
  const homePath = workspaceSlug
    ? getWorkspaceDashboardPath(workspaceSlug, getWorkspaceHomePath(workspaceMode))
    : getWorkspaceHomePath(workspaceMode);
  const visibleSidebarItems = React.useMemo(
    () =>
      filterSidebarGroups(sidebarItems, workspaceMode, currentUser?.admin ?? false)
        .map((group) => ({
          ...group,
          items: group.items.map((item) => {
            const permission = getDashboardViewPermission(item.url);
            const hasPermission = !permission || currentUser?.permissionKeys.includes(permission);

            return {
              ...item,
              disabledReason: hasPermission ? undefined : `Your role does not include access to ${item.title}.`,
              url: workspaceSlug ? getWorkspaceDashboardPath(workspaceSlug, item.url) : item.url,
              subItems: item.subItems?.map((subItem) => {
                const subItemPermission = getDashboardViewPermission(subItem.url);
                const hasSubItemPermission =
                  !subItemPermission || currentUser?.permissionKeys.includes(subItemPermission);

                return {
                  ...subItem,
                  disabledReason: hasSubItemPermission
                    ? undefined
                    : `Your role does not include access to ${subItem.title}.`,
                  url: workspaceSlug ? getWorkspaceDashboardPath(workspaceSlug, subItem.url) : subItem.url,
                };
              }),
            };
          }),
        }))
        .filter((group) => group.items.length > 0),
    [currentUser?.admin, currentUser?.permissionKeys, workspaceMode, workspaceSlug],
  );
  const { isMobile, setOpenMobile } = useSidebar();
  const { startNavigation } = useDashboardNavigationLoader();
  const [logoVersion, setLogoVersion] = React.useState(0);
  const baseLogoSrc =
    currentUser?.companyLogoSrc ??
    (workspaceSlug
      ? `${getWorkspaceDashboardPath(workspaceSlug, "/dashboard/company-logo")}?fallback=1`
      : "/dashboard/company-logo?fallback=1");
  const logoSrc =
    logoVersion && !baseLogoSrc.startsWith("data:")
      ? `${baseLogoSrc}${baseLogoSrc.includes("?") ? "&" : "?"}v=${logoVersion}`
      : baseLogoSrc;
  const refreshCompanyLogo = React.useCallback(() => {
    setLogoVersion(Date.now());
  }, []);
  const handleNavigate = React.useCallback(() => {
    startNavigation(homePath);
    if (isMobile) setOpenMobile(false);
  }, [homePath, isMobile, setOpenMobile, startNavigation]);

  return (
    <Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link prefetch={false} href={homePath} onClick={handleNavigate}>
                <Image
                  src={logoSrc}
                  alt=""
                  width={16}
                  height={16}
                  unoptimized
                  className="size-4 rounded-sm object-contain"
                />
                <span className="font-semibold text-base">{companyName}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={visibleSidebarItems}
          companyName={companyName}
          companyAddress={currentUser?.companyAddress ?? null}
          companyEmail={currentUser?.companyEmail ?? null}
          companyPhone={currentUser?.companyPhone ?? null}
          estimateValidDays={currentUser?.estimateValidDays ?? 15}
          gmailConnected={currentUser?.gmailConnected ?? false}
          gmailSenderEmail={currentUser?.gmailSenderEmail ?? null}
          emailTemplates={currentUser?.emailTemplates ?? []}
          emailRecipients={currentUser?.emailRecipients ?? []}
          invoiceDueDays={currentUser?.invoiceDueDays ?? 15}
          workspaceMode={workspaceMode}
          logoSrc={logoSrc}
          onCompanySettingsSaved={refreshCompanyLogo}
          dueTodayTaskCount={dueTodayTaskCount}
          pendingTimeReviewCount={pendingTimeReviewCount}
          canManageSettings={currentUser?.canManageSettings ?? false}
          canManageBranding={currentUser?.canManageBranding ?? false}
          canManageEmailAccount={currentUser?.canManageEmailAccount ?? false}
          canSendEmail={currentUser?.canSendEmail ?? false}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          canCreateBusiness={currentUser?.canCreateBusiness ?? false}
          currentWorkspaceId={currentUser?.currentWorkspaceId ?? null}
          user={currentUser ? { ...currentUser, avatar: "" } : null}
          workspaces={currentUser?.workspaces ?? []}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
