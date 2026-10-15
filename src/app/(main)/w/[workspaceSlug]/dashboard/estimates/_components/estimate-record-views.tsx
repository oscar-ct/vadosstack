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
      <div className="grid gap-2 md:max-w-lg">
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Estimate view</span>
        <TabsList className="grid h-auto! w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <TabsTrigger
            value="overview"
            className="h-10 cursor-pointer gap-2 rounded-md border-0! bg-transparent px-3 font-semibold text-muted-foreground shadow-none transition-colors hover:bg-background/70 hover:text-foreground data-active:bg-sky-600 data-active:text-white data-active:shadow-sm data-active:hover:bg-sky-600 data-active:hover:text-white dark:data-active:bg-sky-500 dark:data-active:text-sky-950 dark:data-active:hover:bg-sky-500 dark:data-active:hover:text-sky-950"
          >
            <ClipboardList className="size-4 max-[380px]:hidden" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="customer"
            className="h-10 cursor-pointer gap-2 rounded-md border-0! bg-transparent px-3 font-semibold text-muted-foreground shadow-none transition-colors hover:bg-background/70 hover:text-foreground data-active:bg-sky-600 data-active:text-white data-active:shadow-sm data-active:hover:bg-sky-600 data-active:hover:text-white dark:data-active:bg-sky-500 dark:data-active:text-sky-950 dark:data-active:hover:bg-sky-500 dark:data-active:hover:text-sky-950"
          >
            <FileText className="size-4 max-[380px]:hidden" />
            Customer preview
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="customer">{customerPreview}</TabsContent>
    </Tabs>
  );
}
