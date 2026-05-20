"use client";

import * as React from "react";

import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type { AuthFormState } from "../actions";

const initialState: AuthFormState = {
  success: false,
  message: "",
};

export function LoginForm({
  action,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}) {
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FieldGroup className="gap-4">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="login-email">Email Address</FieldLabel>
          <Input
            id="login-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="login-password">Password</FieldLabel>
          <div className="relative">
            <Input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
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
        <Field orientation="horizontal">
          <Checkbox
            id="login-remember"
            name="remember"
            value="true"
            checked={remember}
            onCheckedChange={(value) => setRemember(value === true)}
          />
          <FieldContent>
            <FieldLabel htmlFor="login-remember" className="font-normal">
              Remember me for 30 days
            </FieldLabel>
          </FieldContent>
        </Field>
      </FieldGroup>
      {state.message && !state.success ? <FieldError errors={[{ message: state.message }]} /> : null}
      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? "Signing in..." : "Submit"}
      </Button>
    </form>
  );
}
