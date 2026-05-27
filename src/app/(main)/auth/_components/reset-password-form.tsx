"use client";

import * as React from "react";

import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type { AuthFormState } from "../actions";

const initialState: AuthFormState = {
  success: false,
  message: "",
};

export function ResetPasswordForm({
  action,
  token,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  token: string;
}) {
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FieldGroup className="gap-4">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="reset-password">New Password</FieldLabel>
          <div className="relative">
            <Input
              id="reset-password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="pr-9"
              required
            />
            <button
              type="button"
              className="absolute top-1/2 right-2 inline-flex -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="reset-confirm-password">Confirm Password</FieldLabel>
          <div className="relative">
            <Input
              id="reset-confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="pr-9"
              required
            />
            <button
              type="button"
              className="absolute top-1/2 right-2 inline-flex -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              onClick={() => setShowConfirmPassword((value) => !value)}
            >
              {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
      </FieldGroup>
      {state.message ? (
        state.success ? (
          <p className="text-muted-foreground text-sm">{state.message}</p>
        ) : (
          <FieldError errors={[{ message: state.message }]} />
        )
      ) : null}
      <Button className="w-full" type="submit" disabled={isPending || !token}>
        {isPending ? "Saving..." : "Reset password"}
      </Button>
    </form>
  );
}
