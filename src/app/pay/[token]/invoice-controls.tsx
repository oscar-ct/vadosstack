"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintInvoiceButton() {
  return (
    <Button onClick={() => window.print()} size="sm" type="button" variant="outline">
      <Printer className="size-4" /> Print
    </Button>
  );
}
