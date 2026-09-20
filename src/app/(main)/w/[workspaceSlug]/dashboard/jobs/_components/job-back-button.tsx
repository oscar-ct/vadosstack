"use client";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWorkspaceRouter as useRouter } from "@/components/workspace-path-provider";

export function JobBackButton({ fallbackHref = "/dashboard/jobs" }: { fallbackHref?: string }) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={goBack}>
      <ArrowLeft />
      Back
    </Button>
  );
}
