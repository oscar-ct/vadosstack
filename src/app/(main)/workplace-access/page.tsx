import Link from "next/link";
import { redirect } from "next/navigation";

import { Building2, LogOut, Plus, ShieldX } from "lucide-react";

import { logoutAction } from "@/app/(main)/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentPrincipal, getPrincipalDashboardDestination } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export default async function WorkplaceAccessPage() {
  const principal = await getCurrentPrincipal();

  if (!principal) redirect("/login");
  if (principal.memberships.length) redirect(getPrincipalDashboardDestination(principal));

  const removedMemberships = await prisma.workspaceMembership.findMany({
    where: { userId: principal.user.id, status: "Removed" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      updatedAt: true,
      workspace: { select: { name: true } },
    },
  });
  const latestWorkspace = removedMemberships[0]?.workspace.name;

  return (
    <main className="grid min-h-svh place-items-center bg-muted/20 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <ShieldX className="size-5" />
          </div>
          <CardTitle>{latestWorkspace ? `Access to ${latestWorkspace} was removed` : "No workplace access"}</CardTitle>
          <CardDescription>
            Your VadosStack account is still active, but it is not currently connected to an active workplace.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {removedMemberships.length ? (
            <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
              {removedMemberships.map((membership) => (
                <div key={membership.id} className="flex items-center gap-2 text-sm">
                  <Building2 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{membership.workspace.name}</span>
                </div>
              ))}
            </div>
          ) : null}
          <p className="text-muted-foreground text-sm">
            Ask a workplace owner to restore your access or send you a new invitation. You will be able to return as
            soon as access is restored. You can also create a separate business of your own.
          </p>
          <Button asChild>
            <Link href="/create-business">
              <Plus />
              Create your own business
            </Link>
          </Button>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline">
              <Link href="/">Return to VadosStack</Link>
            </Button>
            <form action={logoutAction}>
              <Button type="submit" className="w-full">
                <LogOut />
                Sign out
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
