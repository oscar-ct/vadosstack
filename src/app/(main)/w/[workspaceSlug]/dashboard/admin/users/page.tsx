import { ShieldCheck } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getCurrentUser } from "@/lib/auth";
import { hasMainPlatformAdministrator, isMainPlatformAdministrator } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

import { type AdminUserRecord, UsersAdminDashboard } from "./_components/users-admin-dashboard";

export default async function Page({ params }: Readonly<{ params: Promise<{ workspaceSlug: string }> }>) {
  const [{ workspaceSlug }, currentUser] = await Promise.all([params, getCurrentUser()]);

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view admin users"
        description="User administration is private to the VadosStack platform administrator."
      />
    );
  }

  if (!isMainPlatformAdministrator(currentUser.admin, currentUser.email)) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldCheck />
          </EmptyMedia>
          <EmptyTitle>Platform administrator access required</EmptyTitle>
          <EmptyDescription>This console is only available to the VadosStack founder account.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      admin: true,
      authProviders: true,
      createdAt: true,
      lastLoginAt: true,
      workspaceMemberships: {
        where: { status: "Active" },
        orderBy: { joinedAt: "asc" },
        select: {
          joinedAt: true,
          role: { select: { name: true, systemKey: true } },
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              companyAddress: true,
              companyEmail: true,
              companyPhone: true,
              estimateValidDays: true,
              invoiceDueDays: true,
              status: true,
              suspendedAt: true,
              suspensionReasonCode: true,
              suspensionNote: true,
              createdAt: true,
              updatedAt: true,
              googleMailAccount: { select: { email: true } },
              _count: {
                select: {
                  customers: true,
                  estimates: true,
                  invoices: true,
                  jobs: true,
                  memberships: { where: { status: "Active" } },
                },
              },
              memberships: {
                where: { role: { systemKey: "OWNER" } },
                select: { user: { select: { admin: true, email: true } } },
              },
              enforcementEvents: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: {
                  action: true,
                  createdAt: true,
                  note: true,
                  actor: { select: { name: true, email: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const records: AdminUserRecord[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    admin: user.admin,
    authProviders: user.authProviders,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    workspaces: user.workspaceMemberships.map((membership) => {
      const latestEvent = membership.workspace.enforcementEvents[0];
      return {
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        companyAddress: membership.workspace.companyAddress,
        companyEmail: membership.workspace.companyEmail,
        companyPhone: membership.workspace.companyPhone,
        estimateValidDays: membership.workspace.estimateValidDays,
        invoiceDueDays: membership.workspace.invoiceDueDays,
        status: membership.workspace.status,
        suspensionProtected: hasMainPlatformAdministrator(
          membership.workspace.memberships.map((ownerMembership) => ownerMembership.user),
        ),
        roleName: membership.role.name,
        roleSystemKey: membership.role.systemKey,
        joinedAt: membership.joinedAt.toISOString(),
        suspendedAt: membership.workspace.suspendedAt?.toISOString() ?? null,
        suspensionReasonCode: membership.workspace.suspensionReasonCode,
        suspensionNote: membership.workspace.suspensionNote,
        memberCount: membership.workspace._count.memberships,
        customerCount: membership.workspace._count.customers,
        jobCount: membership.workspace._count.jobs,
        estimateCount: membership.workspace._count.estimates,
        invoiceCount: membership.workspace._count.invoices,
        gmailSenderEmail: membership.workspace.googleMailAccount?.email ?? null,
        createdAt: membership.workspace.createdAt.toISOString(),
        updatedAt: membership.workspace.updatedAt.toISOString(),
        latestEvent: latestEvent
          ? {
              action: latestEvent.action,
              actorName: latestEvent.actor?.name || latestEvent.actor?.email || "VadosStack",
              createdAt: latestEvent.createdAt.toISOString(),
              note: latestEvent.note,
            }
          : null,
      };
    }),
  }));

  return <UsersAdminDashboard users={records} workspaceSlug={workspaceSlug} />;
}
