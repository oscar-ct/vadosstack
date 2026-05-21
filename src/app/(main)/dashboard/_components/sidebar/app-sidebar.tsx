"use client";

import * as React from "react";

import Link from "next/link";

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
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import { useDashboardNavigationLoader } from "../dashboard-navigation-loader";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

export function AppSidebar({
  currentUser,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  currentUser: {
    name: string;
    companyName: string;
    companyEmail: string | null;
    companyPhone: string | null;
    estimateValidDays: number;
    email: string;
    invoiceDueDays: number;
    admin: boolean;
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
  const { isMobile, setOpenMobile } = useSidebar();
  const { startNavigation } = useDashboardNavigationLoader();
  const [logoVersion, setLogoVersion] = React.useState(0);
  const logoSrc = logoVersion ? `/dashboard/company-logo?v=${logoVersion}` : "/dashboard/company-logo";
  const refreshCompanyLogo = React.useCallback(() => {
    setLogoVersion(Date.now());
  }, []);
  const handleNavigate = React.useCallback(() => {
    startNavigation("/dashboard/overview");
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile, startNavigation]);

  return (
    <Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link prefetch={false} href="/dashboard/overview" onClick={handleNavigate}>
                {/*<Image*/}
                {/*  src={logoSrc}*/}
                {/*  alt=""*/}
                {/*  width={16}*/}
                {/*  height={16}*/}
                {/*  unoptimized*/}
                {/*  className="size-4 rounded-sm object-contain"*/}
                {/*/>*/}
                <span className="font-semibold text-base">{companyName}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={sidebarItems}
          companyName={companyName}
          companyEmail={currentUser?.companyEmail ?? null}
          companyPhone={currentUser?.companyPhone ?? null}
          estimateValidDays={currentUser?.estimateValidDays ?? 15}
          invoiceDueDays={currentUser?.invoiceDueDays ?? 15}
          logoSrc={logoSrc}
          onCompanySettingsSaved={refreshCompanyLogo}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser ? { ...currentUser, avatar: "" } : null} />
      </SidebarFooter>
    </Sidebar>
  );
}
