import type { ReactNode } from "react";

import { cookies } from "next/headers";

import { endOfToday, startOfToday } from "date-fns";

import { AccountSwitcher } from "@/app/(main)/dashboard/_components/sidebar/account-switcher";
import { AppSidebar } from "@/app/(main)/dashboard/_components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getCurrentUser } from "@/lib/auth";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { getRenderedDocumentEmailTemplates } from "@/lib/email-templates";
import { SIDEBAR_COLLAPSIBLE_VALUES, SIDEBAR_VARIANT_VALUES } from "@/lib/preferences/layout";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { getPreference } from "@/server/server-actions";

import {
  DashboardNavigationContent,
  DashboardNavigationLoaderProvider,
} from "./_components/dashboard-navigation-loader";
import { SessionKeepalive } from "./_components/session-keepalive";
import { LayoutControls } from "./_components/sidebar/layout-controls";
import { ThemeSwitcher } from "./_components/sidebar/theme-switcher";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const [variant, collapsible, currentUser] = await Promise.all([
    getPreference("sidebar_variant", SIDEBAR_VARIANT_VALUES, "inset"),
    getPreference("sidebar_collapsible", SIDEBAR_COLLAPSIBLE_VALUES, "icon"),
    getCurrentUser(),
  ]);
  const [
    companyLogoSrc,
    googleMailAccount,
    emailTemplates,
    emailRecipients,
    pendingTimeReviewCount,
    dueTodayTaskCount,
  ] = currentUser
    ? await Promise.all([
        getCompanyLogoSrc(currentUser.id),
        prisma.googleMailAccount.findUnique({
          where: {
            userId: currentUser.id,
          },
          select: {
            email: true,
          },
        }),
        getRenderedDocumentEmailTemplates({
          ownerId: currentUser.id,
          scope: "general",
          context: {
            companyEmail: currentUser.companyEmail ?? currentUser.email,
            companyName: currentUser.companyName,
            companyPhone: currentUser.companyPhone,
          },
        }),
        Promise.all([
          prisma.customer.findMany({
            where: {
              ownerId: currentUser.id,
              email: {
                not: null,
              },
            },
            orderBy: {
              name: "asc",
            },
            select: {
              id: true,
              email: true,
              name: true,
            },
          }),
          prisma.lead.findMany({
            where: {
              ownerId: currentUser.id,
              email: {
                not: null,
              },
            },
            orderBy: {
              name: "asc",
            },
            select: {
              id: true,
              email: true,
              name: true,
            },
          }),
        ]).then(([customers, leads]) => [
          ...customers.map((customer) => ({
            email: customer.email ?? "",
            id: customer.id,
            name: customer.name,
            type: "Customer" as const,
          })),
          ...leads.map((lead) => ({
            email: lead.email ?? "",
            id: lead.id,
            name: lead.name,
            type: "Lead" as const,
          })),
        ]),
        prisma.timeEntryRequest.count({
          where: {
            ownerId: currentUser.id,
            status: "Pending",
          },
        }),
        prisma.task.count({
          where: {
            ownerId: currentUser.id,
            scheduledFor: {
              gte: startOfToday(),
              lte: endOfToday(),
            },
            status: {
              not: "Completed",
            },
          },
        }),
      ])
    : ["/dashboard/company-logo?fallback=1", null, [], [], 0, 0];

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 68)",
        } as React.CSSProperties
      }
    >
      <DashboardNavigationLoaderProvider>
        <SessionKeepalive />
        <AppSidebar
          className="print:hidden"
          variant={variant}
          collapsible={collapsible}
          dueTodayTaskCount={dueTodayTaskCount}
          pendingTimeReviewCount={pendingTimeReviewCount}
          currentUser={
            currentUser
              ? {
                  name: currentUser.name ?? currentUser.email,
                  companyName: currentUser.companyName,
                  companyEmail: currentUser.companyEmail,
                  companyPhone: currentUser.companyPhone,
                  estimateValidDays: currentUser.estimateValidDays,
                  email: currentUser.email,
                  companyLogoSrc,
                  invoiceDueDays: currentUser.invoiceDueDays,
                  admin: currentUser.admin,
                  gmailConnected: Boolean(googleMailAccount),
                  gmailSenderEmail: googleMailAccount?.email ?? null,
                  emailTemplates,
                  emailRecipients,
                }
              : null
          }
        />
        <SidebarInset
          className={cn(
            "[html[data-content-layout=centered]_&>*]:mx-auto",
            "[html[data-content-layout=centered]_&>*]:w-full",
            "[html[data-content-layout=centered]_&>*]:max-w-screen-2xl",
            "peer-data-[variant=inset]:border print:border-0",
          )}
        >
          <header
            className={cn(
              "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 print:hidden",
              // Handle sticky navbar style with conditional classes so blur, background, z-index, and rounded corners remain consistent across all SidebarVariant layouts.
              "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
            )}
          >
            <div className="flex w-full items-center justify-between px-4 lg:px-6">
              <div className="flex items-center gap-1 lg:gap-2">
                <SidebarTrigger className="-ml-1" />
              </div>
              <div className="flex items-center gap-2">
                <LayoutControls />
                <ThemeSwitcher />
                <AccountSwitcher
                  user={
                    currentUser
                      ? {
                          id: currentUser.id,
                          name: currentUser.name ?? currentUser.email,
                          email: currentUser.email,
                          role: currentUser.admin,
                          avatar: "",
                        }
                      : null
                  }
                />
              </div>
            </div>
          </header>
          <DashboardNavigationContent>{children}</DashboardNavigationContent>
        </SidebarInset>
      </DashboardNavigationLoaderProvider>
    </SidebarProvider>
  );
}
