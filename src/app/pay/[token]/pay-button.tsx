"use client";

import { useActionState, useEffect, useState } from "react";

import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";

import { type StripeCheckoutState, startStripeCheckoutAction } from "./actions";

const initialState: StripeCheckoutState = { success: false, message: "" };

export function PayWithStripeButton({ token }: { token: string }) {
  const [state, action, pending] = useActionState(startStripeCheckoutAction, initialState);
  const [isTakingLonger, setIsTakingLonger] = useState(false);

  useEffect(() => {
    if (!state.checkoutUrl) return;

    try {
      window.location.assign(state.checkoutUrl);
    } catch (error) {
      console.error("Stripe Checkout navigation failed.", error);
    }
  }, [state.checkoutUrl]);

  useEffect(() => {
    if (!pending) {
      setIsTakingLonger(false);
      return;
    }

    const timer = window.setTimeout(() => setIsTakingLonger(true), 12_000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="token" value={token} />
      {state.checkoutUrl ? (
        <Button asChild size="lg" className="w-full">
          <a href={state.checkoutUrl}>
            <CreditCard /> Continue to secure checkout
          </a>
        </Button>
      ) : (
        <Button type="submit" size="lg" disabled={pending} className="w-full">
          <CreditCard /> {pending ? "Opening secure checkout…" : "Pay balance"}
        </Button>
      )}
      {isTakingLonger && pending ? (
        <div className="grid gap-1 text-center text-muted-foreground text-sm">
          <p>Stripe is taking longer than expected to respond.</p>
          <button
            className="font-medium text-primary underline underline-offset-4"
            type="button"
            onClick={() => window.location.reload()}
          >
            Refresh this page to retry
          </button>
        </div>
      ) : null}
      {state.message && !state.checkoutUrl ? (
        <p className="text-center text-destructive text-sm">{state.message}</p>
      ) : null}
    </form>
  );
}
