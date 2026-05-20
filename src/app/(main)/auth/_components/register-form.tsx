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

export function RegisterForm({
  action,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}) {
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [name, setName] = React.useState("");
  const [companyName, setCompanyName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FieldGroup className="gap-4">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="register-name">Name</FieldLabel>
          <Input
            id="register-name"
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Issac Newton"
            autoComplete="name"
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="register-company-name">Company Name</FieldLabel>
          <Input
            id="register-company-name"
            name="companyName"
            type="text"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Vados Field Services"
            autoComplete="organization"
            required
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="register-email">Email Address</FieldLabel>
          <Input
            id="register-email"
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
          <FieldLabel htmlFor="register-password">Password</FieldLabel>
          <div className="relative">
            <Input
              id="register-password"
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
          <FieldLabel htmlFor="register-confirm-password">Confirm Password</FieldLabel>
          <div className="relative">
            <Input
              id="register-confirm-password"
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
      {state.message && !state.success ? <FieldError errors={[{ message: state.message }]} /> : null}
      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? "Creating account..." : "Submit"}
      </Button>
    </form>
  );
}
