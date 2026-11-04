"use client";

import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function OrderHistoryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1 border-current/20 bg-background/80 px-2.5 text-current text-xs shadow-none hover:bg-background hover:text-current dark:bg-background/40 dark:hover:bg-background/70"
          aria-label={label}
          aria-haspopup="dialog"
          onClick={onClick}
        >
          <History className="size-3.5" aria-hidden="true" />
          History
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
