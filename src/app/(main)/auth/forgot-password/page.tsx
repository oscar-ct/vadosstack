import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

import vadosstackLogoSmall from "../../../../../media/vadosstack-logo-transparent-small.png";
import { ForgotPasswordForm } from "../_components/forgot-password-form";
import { requestPasswordResetAction } from "../actions";

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard/overview");
  }

  return (
    <div className="flex h-dvh">
      <div className="hidden bg-primary lg:block lg:w-1/3">
        <div className="flex h-full flex-col items-center justify-center p-12 text-center">
          <div className="space-y-4">
            <Image src={vadosstackLogoSmall} alt="VadosStack" className="mx-auto h-16 w-auto" priority />
            <div className="space-y-2">
              <h1 className="font-light text-5xl text-primary-foreground">Password help</h1>
              <p className="text-primary-foreground/80 text-xl">Reset access securely</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-2/3">
        <div className="w-full max-w-md space-y-10 py-24 lg:py-32">
          <div className="space-y-4 text-center">
            <div className="font-semibold text-2xl tracking-tight">Forgot password</div>
            <div className="mx-auto max-w-xl text-muted-foreground">
              Enter your account email and we&apos;ll send a reset link if password sign-in is available.
            </div>
          </div>
          <div className="space-y-4">
            <ForgotPasswordForm action={requestPasswordResetAction} />
            <p className="text-center text-muted-foreground text-xs">
              Remembered it?{" "}
              <Link prefetch={false} href="/login" className="text-primary">
                Back to login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
