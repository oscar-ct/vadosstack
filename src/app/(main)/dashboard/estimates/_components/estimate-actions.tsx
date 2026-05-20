"use client";

import { Mail, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function EstimateActions() {
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button type="button" size="sm" onClick={() => window.print()}>
        <Printer />
        Print / Save PDF
      </Button>
      <Button type="button" variant="outline" size="sm" disabled>
        <Mail />
        Email estimate
      </Button>
    </div>
  );
}
