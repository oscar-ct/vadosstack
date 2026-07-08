"use client";

import { useRouter } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BackButton({
  fallbackHref,
  label = "Back",
  preferFallback = false,
}: {
  fallbackHref: string;
  label?: string;
  preferFallback?: boolean;
}) {
  const router = useRouter();

  function goBack() {
    if (preferFallback) {
      router.push(fallbackHref);
      return;
    }

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={goBack}>
      <ArrowLeft />
      {label}
    </Button>
  );
}
