"use client";

import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CustomerPhoneMatchWarning({
  className,
  customerName,
  onUseCustomer,
}: {
  className?: string;
  customerName: string;
  onUseCustomer: () => void;
}) {
  return (
    <Alert
      className={cn(
        "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
        className,
      )}
    >
      <AlertTriangle />
      <AlertTitle>This phone number may already belong to {customerName}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2 text-amber-900/80 sm:flex-row sm:items-center sm:justify-between dark:text-amber-100/80">
        <span>Use the existing customer when this is the same person, or continue to create a separate customer.</span>
        <Button type="button" size="sm" variant="outline" className="shrink-0 bg-background" onClick={onUseCustomer}>
          Use {customerName}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
