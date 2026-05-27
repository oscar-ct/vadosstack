"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type { AuthFormState } from "../actions";

const initialState: AuthFormState = {
  success: false,
  message: "",
};

export function ForgotPasswordForm({
  action,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}) {
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [email, setEmail] = React.useState("");
  const requestSent = state.success;

  React.useEffect(() => {
    if (state.success) {
      setEmail("");
    }
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FieldGroup className="gap-4">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="forgot-password-email">Email Address</FieldLabel>
          <Input
            id="forgot-password-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isPending || requestSent}
            required
          />
        </Field>
      </FieldGroup>
      {state.message ? (
        state.success ? (
          <p className="text-muted-foreground text-sm">{state.message}</p>
        ) : (
          <FieldError errors={[{ message: state.message }]} />
        )
      ) : null}
      <Button className="w-full" type="submit" disabled={isPending || requestSent}>
        {isPending ? "Sending..." : requestSent ? "Reset link sent" : "Send reset link"}
      </Button>
    </form>
  );
}
