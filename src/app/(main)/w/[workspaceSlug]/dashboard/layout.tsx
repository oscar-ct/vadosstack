import type { ReactNode } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { endOfToday, startOfToday } from "date-fns";

import { DashboardRouteAccessGate } from "@/app/(main)/w/[workspaceSlug]/dashboard/_components/dashboard-route-access-gate";
import { AccountSwitcher } from "@/app/(main)/w/[workspaceSlug]/dashboard/_components/sidebar/account-switcher";
import { AppSidebar } from "@/app/(main)/w/[workspaceSlug]/dashboard/_components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { WorkspacePathProvider } from "@/components/workspace-path-provider";
import {
  can,
  getCurrentPrincipal,
  getDashboardRequestContext,
  getDashboardRouteLabel,
  getMembershipLandingPath,
  type WorkspaceMembershipSummary,
} from "@/lib/authorization";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { getRenderedDocumentEmailTemplates } from "@/lib/email-templates";
import { isMainPlatformAdministrator } from "@/lib/platform-admin";
import { SIDEBAR_COLLAPSIBLE_VALUES, SIDEBAR_VARIANT_VALUES } from "@/lib/preferences/layout";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { parseWorkspaceMode } from "@/lib/workspace-mode";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";
import { getPreference } from "@/server/server-actions";

import {
  DashboardNavigationContent,
  DashboardNavigationLoaderProvider,
} from "./_components/dashboard-navigation-loader";
import { SessionKeepalive } from "./_components/session-keepalive";
import { LayoutControls } from "./_components/sidebar/layout-controls";
import { ThemeSwitcher } from "./_components/sidebar/theme-switcher";
import { WorkspaceModeGuard } from "./_components/workspace-mode-guard";
import { WorkspaceSuspendedState } from "./_components/workspace-suspended-state";

export default async function Layout({
  children,
  params,
}: Readonly<{ children: ReactNode; params: Promise<{ workspaceSlug: string }> }>) {
  const { workspaceSlug: requestedWorkspaceSlug } = await params;
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const [variant, collapsible, principal, requestContext] = await Promise.all([
    getPreference("sidebar_variant", SIDEBAR_VARIANT_VALUES, "inset"),
    getPreference("sidebar_collapsible", SIDEBAR_COLLAPSIBLE_VALUES, "icon"),
    getCurrentPrincipal(),
    getDashboardRequestContext(),
  ]);

  if (!principal) {
    const requestedDestination = `${getWorkspaceDashboardPath(
      requestedWorkspaceSlug,
      requestContext.dashboardPath,
    )}${requestContext.query}`;

    redirect(`/login?returnTo=${encodeURIComponent(requestedDestination)}`);
  }

  const currentUser = principal?.user ?? null;
  const canCreateBusiness = Boolean(
    principal && !principal.memberships.some((membership) => membership.roleSystemKey === "OWNER"),
  );
  let workspaceSlug: string | null = null;
  let activeMembership: WorkspaceMembershipSummary | null = null;

  if (principal) {
    const ownerMembership = principal.memberships.find((membership) => membership.roleSystemKey === "OWNER");

    let requestedMembership = principal.memberships.find(
      (membership) => membership.workspaceSlug === requestedWorkspaceSlug,
    );

    if (!requestedMembership) {
      const slugAlias = await prisma.workspaceSlugAlias.findUnique({
        where: { slug: requestedWorkspaceSlug },
        select: {
          workspace: {
            select: { id: true, slug: true },
          },
        },
      });
      requestedMembership = slugAlias
        ? principal.memberships.find((membership) => membership.workspaceId === slugAlias.workspace.id)
        : undefined;

      if (slugAlias && requestedMembership) {
        redirect(
          `${getWorkspaceDashboardPath(slugAlias.workspace.slug, requestContext.dashboardPath)}${requestContext.query}`,
        );
      }
    }
    if (!requestedMembership) {
      const fallbackMembership = ownerMembership ?? principal.memberships[0];

      if (fallbackMembership) {
        redirect(
          getWorkspaceDashboardPath(fallbackMembership.workspaceSlug, getMembershipLandingPath(fallbackMembership)),
        );
      }
      redirect("/workplace-access");
    }

    workspaceSlug = requestedMembership.workspaceSlug;
    activeMembership = requestedMembership;

    if (requestContext.dashboardPath === "/dashboard") {
      redirect(
        `${getWorkspaceDashboardPath(workspaceSlug, getMembershipLandingPath(requestedMembership))}${requestContext.query}`,
      );
    }
  }
  const activeWorkspace = activeMembership
    ? await prisma.workspace.findUnique({
        where: {
          id: activeMembership.workspaceId,
        },
      })
    : null;

  if (currentUser && !activeWorkspace) {
    redirect("/workplace-access");
  }

  const isFounderUsersConsole = Boolean(
    currentUser &&
      isMainPlatformAdministrator(currentUser.admin, currentUser.email) &&
      requestContext.dashboardPath === "/dashboard/admin/users",
  );

  if (activeWorkspace?.status === "Suspended" && !isFounderUsersConsole) {
    return (
      <WorkspaceSuspendedState
        workspaceName={activeWorkspace.name}
        availableWorkspaces={
          principal?.memberships.filter(
            (membership) => membership.workspaceId !== activeWorkspace.id && membership.workspaceStatus === "Active",
          ) ?? []
        }
      />
    );
  }

  const activeWorkspaceMode = parseWorkspaceMode(activeWorkspace?.workspaceMode);
  const permittedLandingPath = activeMembership ? getMembershipLandingPath(activeMembership) : "/dashboard";
  const permittedLandingHref = workspaceSlug
    ? getWorkspaceDashboardPath(workspaceSlug, permittedLandingPath)
    : permittedLandingPath;
  const permittedLandingLabel = getDashboardRouteLabel(permittedLandingPath);
  const canSendEmail = activeMembership ? can(activeMembership, "email.send") : false;
  const canManageEmailAccount = activeMembership ? can(activeMembership, "email.account.manage") : false;
  const canManageSettings = activeMembership ? can(activeMembership, "settings.manage") : false;
  const canManageBranding = activeMembership ? can(activeMembership, "settings.branding.manage") : false;
  const canViewCustomers = activeMembership ? can(activeMembership, "customers.view") : false;
  const canViewLeads = activeMembership ? can(activeMembership, "leads.view") : false;
  const canReviewTime = activeMembership ? can(activeMembership, "time.approve") : false;
  const canViewCalendar = activeMembership ? can(activeMembership, "calendar.view") : false;
  const [
    companyLogoSrc,
    googleMailAccount,
    emailTemplates,
    emailRecipients,
    pendingTimeReviewCount,
    dueTodayTaskCount,
    workspaceLogoSources,
  ] =
    currentUser && activeWorkspace
      ? await Promise.all([
          getCompanyLogoSrc(activeWorkspace.id, workspaceSlug ?? undefined),
          prisma.googleMailAccount.findUnique({
            where: {
              workspaceId: activeWorkspace.id,
            },
            select: {
              email: true,
            },
          }),
          canSendEmail
            ? getRenderedDocumentEmailTemplates({
                ownerId: activeWorkspace.id,
                scope: "general",
                context: {
                  companyEmail: activeWorkspace.companyEmail ?? currentUser.email,
                  companyName: activeWorkspace.name,
                  companyAddress: activeWorkspace.companyAddress,
                  companyPhone: activeWorkspace.companyPhone,
                },
              })
            : [],
          Promise.all([
            canSendEmail && canViewCustomers
              ? prisma.customer.findMany({
                  where: {
                    ownerId: activeWorkspace.id,
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
                })
              : [],
            canSendEmail && canViewLeads
              ? prisma.lead.findMany({
                  where: {
                    ownerId: activeWorkspace.id,
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
                })
              : [],
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
          canReviewTime
            ? prisma.timeEntryRequest.count({
                where: {
                  ownerId: activeWorkspace.id,
                  status: "Pending",
                },
              })
            : 0,
          canViewCalendar
            ? prisma.task.count({
                where: {
                  ownerId: activeWorkspace.id,
                  scheduledFor: {
                    gte: startOfToday(),
                    lte: endOfToday(),
                  },
                  status: {
                    not: "Completed",
                  },
                },
              })
            : 0,
          Promise.all(
            (principal?.memberships ?? [])
              .filter((membership) => membership.workspaceId !== activeWorkspace.id)
              .map(
                async (membership) =>
                  [
                    membership.workspaceId,
                    await getCompanyLogoSrc(membership.workspaceId, membership.workspaceSlug),
                  ] as const,
              ),
          ),
        ])
      : [
          workspaceSlug
            ? `${getWorkspaceDashboardPath(workspaceSlug, "/dashboard/company-logo")}?fallback=1`
            : "/dashboard/company-logo?fallback=1",
          null,
          [],
          [],
          0,
          0,
          [],
        ];
  const workspaceLogoSrcById = new Map(workspaceLogoSources);
  if (activeWorkspace) {
    workspaceLogoSrcById.set(activeWorkspace.id, companyLogoSrc);
  }
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
        <WorkspacePathProvider workspaceSlug={workspaceSlug ?? requestedWorkspaceSlug}>
          <SessionKeepalive />
          {currentUser && workspaceSlug ? (
            <WorkspaceModeGuard mode={activeWorkspaceMode} workspaceSlug={workspaceSlug} />
          ) : null}
          <AppSidebar
            className="print:hidden"
            variant={variant}
            collapsible={collapsible}
            dueTodayTaskCount={dueTodayTaskCount}
            pendingTimeReviewCount={pendingTimeReviewCount}
            currentUser={
              currentUser && activeWorkspace && activeMembership && principal
                ? {
                    name: currentUser.name ?? currentUser.email,
                    companyName: activeWorkspace.name,
                    companyAddress: activeWorkspace.companyAddress,
                    companyEmail: activeWorkspace.companyEmail,
                    companyPhone: activeWorkspace.companyPhone,
                    estimateValidDays: activeWorkspace.estimateValidDays,
                    email: currentUser.email,
                    companyLogoSrc,
                    invoiceDueDays: activeWorkspace.invoiceDueDays,
                    workspaceMode: activeWorkspaceMode,
                    workspaceSlug: workspaceSlug ?? "",
                    admin: currentUser.admin,
                    gmailConnected: Boolean(googleMailAccount),
                    gmailSenderEmail: googleMailAccount?.email ?? null,
                    emailTemplates,
                    emailRecipients,
                    permissionKeys: [...activeMembership.permissions],
                    canManageSettings,
                    canManageBranding,
                    canManageEmailAccount,
                    canSendEmail,
                    canCreateBusiness,
                    currentWorkspaceId: activeMembership.workspaceId,
                    workspaces: principal.memberships.map((membership) => ({
                      id: membership.workspaceId,
                      logoSrc:
                        workspaceLogoSrcById.get(membership.workspaceId) ??
                        `${getWorkspaceDashboardPath(membership.workspaceSlug, "/dashboard/company-logo")}?fallback=1`,
                      name: membership.workspaceName,
                      roleName: membership.roleName,
                      status: membership.workspaceStatus,
                      url: getWorkspaceDashboardPath(membership.workspaceSlug, getMembershipLandingPath(membership)),
                    })),
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
                "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-40 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
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
                    canCreateBusiness={canCreateBusiness}
                    currentWorkspaceId={activeMembership?.workspaceId ?? null}
                    workspaces={
                      principal?.memberships.map((membership) => ({
                        id: membership.workspaceId,
                        logoSrc:
                          workspaceLogoSrcById.get(membership.workspaceId) ??
                          `${getWorkspaceDashboardPath(membership.workspaceSlug, "/dashboard/company-logo")}?fallback=1`,
                        name: membership.workspaceName,
                        roleName: membership.roleName,
                        status: membership.workspaceStatus,
                        url: getWorkspaceDashboardPath(membership.workspaceSlug, getMembershipLandingPath(membership)),
                      })) ?? []
                    }
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
            <DashboardNavigationContent>
              <DashboardRouteAccessGate
                backHref={permittedLandingHref}
                backLabel={`Return to ${permittedLandingLabel}`}
                permissionKeys={activeMembership ? [...activeMembership.permissions] : []}
              >
                {children}
              </DashboardRouteAccessGate>
            </DashboardNavigationContent>
          </SidebarInset>
        </WorkspacePathProvider>
      </DashboardNavigationLoaderProvider>
    </SidebarProvider>
  );
}
