"use client";

import * as React from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";

import type { AuthFormState } from "../actions";
import { RegisterForm } from "./register-form";

type RegisterCardProps = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
};

export function RegisterCard({ action }: RegisterCardProps) {
  const [confirmedEmail, setConfirmedEmail] = React.useState("");

  if (confirmedEmail) {
    return (
      <div className="w-full max-w-md py-24 lg:py-32">
        <div className="grid gap-6 text-center">
          <div className="space-y-2">
            <h1 className="font-semibold text-2xl tracking-tight">Check your email</h1>
            <p className="text-muted-foreground text-sm">
              We just sent a verification link to <span className="font-medium text-foreground">{confirmedEmail}</span>.
            </p>
          </div>
          <Button asChild className="w-full">
            <Link prefetch={false} href="/login">
              Go to login
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-10 py-24 lg:py-32">
      <div className="space-y-4 text-center">
        <div className="font-semibold text-2xl tracking-tight">Register</div>
        <div className="mx-auto max-w-xl text-muted-foreground">
          Fill in your details below. We promise not to quiz you about your first pet&apos;s name (this time).
        </div>
      </div>
      <div className="space-y-4">
        <RegisterForm action={action} onConfirmationSent={setConfirmedEmail} />
        <p className="text-center text-muted-foreground text-xs">
          Already have an account?{" "}
          <Link prefetch={false} href="/login" className="text-primary">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
