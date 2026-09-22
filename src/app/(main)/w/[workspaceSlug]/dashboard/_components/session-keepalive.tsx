"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { getAuthorizationVersionAction, refreshSessionAction } from "@/app/(main)/auth/actions";

const SESSION_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const AUTHORIZATION_CHECK_INTERVAL_MS = 60 * 1000;
const AUTHORIZATION_CHECK_THROTTLE_MS = 5 * 1000;

export function SessionKeepalive({ authorizationVersion }: Readonly<{ authorizationVersion: string }>) {
  const router = useRouter();
  const authorizationVersionRef = React.useRef(authorizationVersion);

  React.useEffect(() => {
    authorizationVersionRef.current = authorizationVersion;
  }, [authorizationVersion]);

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

  React.useEffect(() => {
    let active = true;
    let checking = false;
    let lastCheckedAt = 0;

    const checkAuthorization = async () => {
      const now = Date.now();
      if (
        !active ||
        checking ||
        document.visibilityState !== "visible" ||
        now - lastCheckedAt < AUTHORIZATION_CHECK_THROTTLE_MS
      ) {
        return;
      }

      checking = true;
      lastCheckedAt = now;

      try {
        const nextVersion = await getAuthorizationVersionAction();
        if (!active) return;

        if (!nextVersion) {
          router.refresh();
          return;
        }

        if (nextVersion !== authorizationVersionRef.current) {
          authorizationVersionRef.current = nextVersion;
          router.refresh();
        }
      } catch {
        // Permission freshness is retried later and must not interrupt the current task.
      } finally {
        checking = false;
      }
    };

    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void checkAuthorization();
    };

    const intervalId = window.setInterval(checkAuthorization, AUTHORIZATION_CHECK_INTERVAL_MS);
    window.addEventListener("focus", checkWhenVisible);
    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", checkWhenVisible);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [router]);

  return null;
}
