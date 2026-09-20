"use client";

import type * as React from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PermissionDisabledButtonProps = Omit<React.ComponentProps<typeof Button>, "asChild" | "disabled"> & {
  reason: string;
};

export function PermissionDisabledButton({ children, reason, ...props }: PermissionDisabledButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          {...props}
          type={props.type ?? "button"}
          aria-disabled="true"
          className={cn("cursor-not-allowed opacity-50", props.className)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
