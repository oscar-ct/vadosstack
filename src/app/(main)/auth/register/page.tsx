import Image from "next/image";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceHomePath } from "@/lib/workspace-mode";

import vadosstackLogoSmall from "../../../../../media/vadosstack-logo-transparent-small.png";
import { AuthDatabaseWarmup } from "../_components/auth-database-warmup";
import { RegisterCard } from "../_components/register-card";
import { registerAction } from "../actions";

export default async function RegisterV1() {
  const user = await getCurrentUser();

  if (user) {
    redirect(getWorkspaceHomePath(user.workspaceMode));
  }

  return (
    <div className="flex min-h-dvh">
      <AuthDatabaseWarmup />
      <div className="flex w-full items-start justify-center bg-background p-8 lg:w-2/3">
        <RegisterCard action={registerAction} />
      </div>

      <div className="hidden bg-primary lg:block lg:w-1/3">
        <div className="sticky top-0 flex h-dvh flex-col items-center justify-center p-12 text-center">
          <div className="space-y-4">
            <Image src={vadosstackLogoSmall} alt="VadosStack" className="mx-auto h-16 w-auto" priority />
            <div className="space-y-2">
              <h1 className="font-light text-5xl text-primary-foreground">Welcome!</h1>
              <p className="text-primary-foreground/80 text-xl">You&apos;re in the right place.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
