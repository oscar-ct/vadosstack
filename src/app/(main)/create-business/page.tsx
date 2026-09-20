import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentPrincipal, getPrincipalDashboardDestination } from "@/lib/authorization";
import { getMembershipLandingPath } from "@/lib/authorization/workspace-landing";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";

import vadosstackLogoSmall from "../../../../media/vadosstack-logo-transparent-small.png";
import { CreateBusinessForm } from "./_components/create-business-form";
import { createBusinessAction } from "./actions";

export default async function CreateBusinessPage() {
  const principal = await getCurrentPrincipal();

  if (!principal) redirect("/login?returnTo=%2Fcreate-business");

  const ownedWorkspace = principal.memberships.find((membership) => membership.roleSystemKey === "OWNER");

  if (ownedWorkspace) {
    redirect(getWorkspaceDashboardPath(ownedWorkspace.workspaceSlug, getMembershipLandingPath(ownedWorkspace)));
  }

  const cancelHref = principal.memberships.length ? getPrincipalDashboardDestination(principal) : "/workplace-access";

  return (
    <div className="flex min-h-dvh">
      <main className="flex w-full items-start justify-center bg-background p-8 lg:w-2/3">
        <div className="w-full max-w-md space-y-8 py-10 lg:py-12">
          <div className="space-y-4 text-center">
            <h1 className="font-semibold text-2xl tracking-tight">Create your business</h1>
            <p className="mx-auto max-w-xl text-muted-foreground">
              Set up a workplace you own. Your access to other businesses will remain unchanged.
            </p>
          </div>
          <div className="space-y-4">
            <CreateBusinessForm action={createBusinessAction} />
            <p className="text-center text-muted-foreground text-xs">
              Not ready yet?{" "}
              <Link prefetch={false} href={cancelHref} className="text-primary">
                Return to your current workplace
              </Link>
            </p>
          </div>
        </div>
      </main>

      <aside className="hidden bg-primary lg:block lg:w-1/3">
        <div className="sticky top-0 flex h-dvh flex-col items-center justify-center p-12 text-center">
          <div className="space-y-4">
            <Image src={vadosstackLogoSmall} alt="VadosStack" className="mx-auto h-16 w-auto" priority />
            <div className="space-y-2">
              <h2 className="font-light text-5xl text-primary-foreground">Make it yours.</h2>
              <p className="text-primary-foreground/80 text-xl">Your business, your workspace.</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
