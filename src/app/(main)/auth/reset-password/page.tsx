import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

import vadosstackLogoSmall from "../../../../../media/vadosstack-logo-transparent-small.png";
import { ResetPasswordForm } from "../_components/reset-password-form";
import { resetPasswordAction } from "../actions";

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string | string[];
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard/overview");
  }

  const params = await searchParams;
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token;

  return (
    <div className="flex h-dvh">
      <div className="hidden bg-primary lg:block lg:w-1/3">
        <div className="flex h-full flex-col items-center justify-center p-12 text-center">
          <div className="space-y-4">
            <Image src={vadosstackLogoSmall} alt="VadosStack" className="mx-auto h-16 w-auto" priority />
            <div className="space-y-2">
              <h1 className="font-light text-5xl text-primary-foreground">New password</h1>
              <p className="text-primary-foreground/80 text-xl">Choose something secure</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-2/3">
        <div className="w-full max-w-md space-y-10 py-24 lg:py-32">
          <div className="space-y-4 text-center">
            <div className="font-semibold text-2xl tracking-tight">Reset password</div>
            <div className="mx-auto max-w-xl text-muted-foreground">
              Create a new password for your account. Reset links expire after 10 minutes.
            </div>
          </div>
          <div className="space-y-4">
            <ResetPasswordForm action={resetPasswordAction} token={token ?? ""} />
            <p className="text-center text-muted-foreground text-xs">
              Need a new link?{" "}
              <Link prefetch={false} href="/forgot-password" className="text-primary">
                Request another reset
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
