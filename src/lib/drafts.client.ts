"use client";

import * as React from "react";

const DISCARD_DRAFT_EVENT = "vadosstack:discard-draft";

export function discardLocalDraft(draftKey: string) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(DISCARD_DRAFT_EVENT, { detail: { draftKey } }));
  window.localStorage.removeItem(draftKey);
}

export function useDiscardLocalDraftListener(draftKey: string | undefined, onDiscard: () => void) {
  React.useEffect(() => {
    if (!draftKey || typeof window === "undefined") return;

    function handleDiscard(event: Event) {
      const detail = (event as CustomEvent<{ draftKey?: string }>).detail;

      if (detail?.draftKey === draftKey) {
        onDiscard();
      }
    }

    window.addEventListener(DISCARD_DRAFT_EVENT, handleDiscard);

    return () => window.removeEventListener(DISCARD_DRAFT_EVENT, handleDiscard);
  }, [draftKey, onDiscard]);
}
