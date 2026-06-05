"use client";

import * as React from "react";

export function AuthDatabaseWarmup() {
  React.useEffect(() => {
    const controller = new AbortController();

    fetch("/api/auth/warmup", {
      cache: "no-store",
      signal: controller.signal,
    }).catch(() => {
      // The login/register form action is still the source of truth.
    });

    return () => controller.abort();
  }, []);

  return null;
}
