import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

import vadosstackLogoSmall from "../../../../../media/vadosstack-logo-transparent-small.png";
import { RegisterForm } from "../_components/register-form";
import { registerAction } from "../actions";

export default async function RegisterV1() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard/overview");
  }

  return (
    <div className="flex h-dvh">
      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-2/3">
        <div className="w-full max-w-md space-y-10 py-24 lg:py-32">
          <div className="space-y-4 text-center">
            <div className="font-semibold text-2xl tracking-tight">Register</div>
            <div className="mx-auto max-w-xl text-muted-foreground">
              Fill in your details below. We promise not to quiz you about your first pet&apos;s name (this time).
            </div>
          </div>
          <div className="space-y-4">
            <RegisterForm action={registerAction} />
            <p className="text-center text-muted-foreground text-xs">
              Already have an account?{" "}
              <Link prefetch={false} href="/login" className="text-primary">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="hidden bg-primary lg:block lg:w-1/3">
        <div className="flex h-full flex-col items-center justify-center p-12 text-center">
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
