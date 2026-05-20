"use client";

import * as React from "react";

import { refreshSessionAction } from "../../auth/actions";

const SESSION_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export function SessionKeepalive() {
  React.useEffect(() => {
    let active = true;

    const refreshSession = async () => {
      if (!active || document.visibilityState !== "visible") {
        return;
      }

      try {
        await refreshSessionAction();
      } catch {
        // A failed keepalive should not interrupt an in-progress form edit.
      }
    };

    void refreshSession();

    const intervalId = window.setInterval(refreshSession, SESSION_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshSession);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshSession);
    };
  }, []);

  return null;
}
