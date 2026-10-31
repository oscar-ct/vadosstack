"use client";

import * as React from "react";

import { useSearchParams } from "next/navigation";

import { useWorkspaceRouter } from "@/components/workspace-path-provider";

export function useCommerceSearch(path: string, query: string) {
  const router = useWorkspaceRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState(query);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const paramsRef = React.useRef(searchParams);
  paramsRef.current = searchParams;

  React.useEffect(() => {
    if (!timer.current) setValue(query);
  }, [query]);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function update(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(paramsRef.current.toString());
      const trimmed = next.trim().slice(0, 200);
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      params.delete("page");
      timer.current = null;
      router.replace(`${path}${params.size ? `?${params}` : ""}`, { scroll: false });
    }, 350);
  }

  return [value, update] as const;
}
