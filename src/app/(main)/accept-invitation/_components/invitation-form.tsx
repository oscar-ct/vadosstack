"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { InvitationActionState } from "../actions";

const initialState: InvitationActionState = { message: "", success: false };

export function InvitationForm({
  action,
  signedIn,
  token,
}: {
  action: (state: InvitationActionState, formData: FormData) => Promise<InvitationActionState>;
  signedIn: boolean;
  token: string;
}) {
  const [state, formAction, pending] = React.useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      {!signedIn ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor="invitation-name">Your name</Label>
            <Input id="invitation-name" name="name" autoComplete="name" required />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="invitation-password">Password</Label>
              <Input
                id="invitation-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invitation-confirm-password">Confirm password</Label>
              <Input
                id="invitation-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          </div>
        </>
      ) : null}
      {state.message ? <p className="text-destructive text-sm">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Joining..." : signedIn ? "Accept invitation" : "Create account and join"}
      </Button>
    </form>
  );
}
