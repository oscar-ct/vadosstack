import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceHomePath } from "@/lib/workspace-mode";

import vadosstackLogoSmall from "../../../../../media/vadosstack-logo-transparent-small.png";
import { AuthDatabaseWarmup } from "../_components/auth-database-warmup";
import { LoginForm } from "../_components/login-form";
import { GoogleButton } from "../_components/social-auth/google-button";
import { loginAction } from "../actions";

const googleErrorMessages: Record<string, string> = {
  callback: "Google sign-in could not be completed. Please try again.",
  config: "Google sign-in is not configured yet.",
  denied: "Google sign-in was cancelled.",
  state: "Google sign-in expired. Please try again.",
  unverified: "Google has not verified that email address.",
};

const resetMessages: Record<string, string> = {
  success: "Your password has been reset. You can now sign in with your new password.",
};

const confirmMessages: Record<string, string> = {
  exists: "That account has already been confirmed. You can sign in now.",
  success: "Your account has been confirmed. You can now sign in.",
};

type LoginPageProps = {
  searchParams?: Promise<{
    confirm?: string | string[];
    google_error?: string | string[];
    reset?: string | string[];
  }>;
};

export default async function LoginV1({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect(getWorkspaceHomePath(user.workspaceMode));
  }

  const params = await searchParams;
  const googleError = Array.isArray(params?.google_error) ? params.google_error[0] : params?.google_error;
  const googleErrorMessage = googleError ? googleErrorMessages[googleError] : null;
  const resetStatus = Array.isArray(params?.reset) ? params.reset[0] : params?.reset;
  const resetMessage = resetStatus ? resetMessages[resetStatus] : null;
  const confirmStatus = Array.isArray(params?.confirm) ? params.confirm[0] : params?.confirm;
  const confirmMessage = confirmStatus ? confirmMessages[confirmStatus] : null;

  return (
    <div className="flex h-dvh">
      <AuthDatabaseWarmup />
      <div className="hidden bg-primary lg:block lg:w-1/3">
        <div className="flex h-full flex-col items-center justify-center p-12 text-center">
          <div className="space-y-4">
            <Image src={vadosstackLogoSmall} alt="VadosStack" className="mx-auto h-16 w-auto" priority />
            <div className="space-y-2">
              <h1 className="font-light text-5xl text-primary-foreground">Hello again</h1>
              <p className="text-primary-foreground/80 text-xl">Login to continue</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-2/3">
        <div className="w-full max-w-md space-y-10 py-24 lg:py-32">
          <div className="space-y-4 text-center">
            <div className="font-semibold text-2xl tracking-tight">Login</div>
            <div className="mx-auto max-w-xl text-muted-foreground">
              Welcome back. Enter your email and password, let&apos;s hope you remember them this time.
            </div>
          </div>
          <div className="space-y-4">
            <form action="/api/auth/google" method="get">
              <GoogleButton className="w-full" type="submit" />
            </form>
            {resetMessage ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-emerald-700 text-sm">
                {resetMessage}
              </p>
            ) : null}
            {confirmMessage ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-emerald-700 text-sm">
                {confirmMessage}
              </p>
            ) : null}
            {googleErrorMessage ? <p className="text-center text-destructive text-sm">{googleErrorMessage}</p> : null}
            <div className="flex items-center gap-3 text-muted-foreground text-xs">
              <Separator className="flex-1" />
              <span>or</span>
              <Separator className="flex-1" />
            </div>
            <LoginForm action={loginAction} />
            <p className="text-center text-muted-foreground text-xs">
              Don&apos;t have an account?{" "}
              <Link prefetch={false} href="/register" className="text-primary">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
