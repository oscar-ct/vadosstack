"use client";

import { type ReactNode, useState } from "react";

import { ClipboardList, FileText } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type EstimateRecordView = "customer" | "overview";

export function EstimateRecordViews({
  customerPreview,
  defaultView,
  overview,
}: {
  customerPreview: ReactNode;
  defaultView: EstimateRecordView;
  overview: ReactNode;
}) {
  const [selectedView, setSelectedView] = useState<EstimateRecordView>(defaultView);

  function changeView(view: string) {
    const nextView = view === "customer" ? "customer" : "overview";
    setSelectedView(nextView);
  }

  return (
    <Tabs value={selectedView} onValueChange={changeView} className="gap-4">
      <TabsList className="grid h-auto! w-full grid-cols-1 overflow-hidden rounded-lg border bg-background p-0 md:max-w-2xl md:grid-cols-2">
        <TabsTrigger
          value="overview"
          className="h-auto min-h-16 justify-start rounded-none border-0! bg-transparent px-3 py-2.5 text-left data-active:bg-sky-50/70 data-active:text-sky-800 data-active:shadow-none md:min-h-20 md:px-4 md:py-3 dark:data-active:bg-sky-950/40"
        >
          <span className="flex items-center gap-2 md:items-start md:gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ClipboardList className="size-4" />
            </span>
            <span className="grid gap-0.5">
              <span className="font-semibold">Overview</span>
              <span className="whitespace-normal font-normal text-muted-foreground text-xs leading-snug">
                Working details, line items, and pricing
              </span>
            </span>
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="customer"
          className="h-auto min-h-16 justify-start rounded-none border-0! border-border! border-t! bg-transparent px-3 py-2.5 text-left data-active:bg-sky-50 data-active:text-sky-800 data-active:shadow-none md:min-h-20 md:border-l! md:border-t-0! md:px-4 md:py-3 dark:data-active:bg-sky-950/40"
        >
          <span className="flex items-center gap-2 md:items-start md:gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FileText className="size-4" />
            </span>
            <span className="grid gap-0.5">
              <span className="font-semibold">Customer preview</span>
              <span className="whitespace-normal font-normal text-muted-foreground text-xs leading-snug">
                Customer-facing estimate document
              </span>
            </span>
          </span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="customer">{customerPreview}</TabsContent>
    </Tabs>
  );
}
