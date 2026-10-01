"use client";

import { useActionState, useEffect } from "react";

import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";

import { type StripeCheckoutState, startStripeCheckoutAction } from "./actions";

const initialState: StripeCheckoutState = { success: false, message: "" };

export function PayWithStripeButton({ token }: { token: string }) {
  const [state, action, pending] = useActionState(startStripeCheckoutAction, initialState);

  useEffect(() => {
    if (state.checkoutUrl) window.location.assign(state.checkoutUrl);
  }, [state.checkoutUrl]);

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" size="lg" disabled={pending || Boolean(state.checkoutUrl)} className="w-full">
        <CreditCard /> {pending || state.checkoutUrl ? "Opening secure checkout…" : "Pay balance"}
      </Button>
      {state.message && !state.checkoutUrl ? (
        <p className="text-center text-destructive text-sm">{state.message}</p>
      ) : null}
    </form>
  );
}
