"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { LoaderCircle, RotateCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const MAX_AUTOMATIC_REFRESHES = 20;

export function PaymentConfirmationStatus() {
  const router = useRouter();
  const [refreshCount, setRefreshCount] = useState(0);
  const automaticallyRefreshing = refreshCount < MAX_AUTOMATIC_REFRESHES;

  useEffect(() => {
    if (!automaticallyRefreshing) return;
    const timeout = window.setTimeout(() => {
      setRefreshCount((count) => count + 1);
      router.refresh();
    }, 1500);
    return () => window.clearTimeout(timeout);
  }, [automaticallyRefreshing, router]);

  return (
    <Alert className="border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-100 print:hidden">
      <LoaderCircle className="animate-spin" />
      <AlertTitle>
        {automaticallyRefreshing ? "Confirming your payment" : "Confirmation is taking longer than usual"}
      </AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>
          {automaticallyRefreshing
            ? "This page updates automatically. Please don’t submit another payment."
            : "Your payment may still be processing. You can safely refresh its status."}
        </span>
        {!automaticallyRefreshing ? (
          <Button type="button" size="sm" variant="outline" onClick={() => router.refresh()}>
            <RotateCw /> Refresh status
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function CheckoutCanceledNotice({ cleanUrl }: { cleanUrl: string }) {
  useEffect(() => {
    window.history.replaceState(window.history.state, "", cleanUrl);
  }, [cleanUrl]);

  return (
    <Alert className="print:hidden">
      <AlertTitle>Checkout canceled</AlertTitle>
      <AlertDescription>No payment was submitted. You can try again when ready.</AlertDescription>
    </Alert>
  );
}
