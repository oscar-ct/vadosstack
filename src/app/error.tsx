"use client";

import { useEffect } from "react";

import Link from "next/link";

import { Home, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Application error boundary caught:", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-12 text-center">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3">
          <p className="font-medium text-muted-foreground text-sm">Something went wrong</p>
          <h1 className="font-semibold text-3xl tracking-tight">We hit an unexpected error.</h1>
          <p className="text-muted-foreground">
            Try again in a moment. If the issue keeps happening, use the error reference when you reach out for help.
          </p>
        </div>
        {error.digest ? <p className="text-muted-foreground text-xs">Error reference: {error.digest}</p> : null}
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button type="button" onClick={reset}>
            <RotateCw />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link prefetch={false} href="/dashboard/overview">
              <Home />
              Go back home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
