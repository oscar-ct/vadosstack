"use client";

import type { ReactNode } from "react";

import { MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { InventoryItem } from "./inventory-table";

export const inventoryDialogClassName =
  "flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[90svh] sm:w-[calc(100vw-3rem)] sm:max-w-5xl sm:rounded-xl";
export const inventoryDialogBodyClassName = "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6";
export const inventoryDialogFooterClassName =
  "flex shrink-0 items-center justify-between gap-3 border-t bg-background px-5 py-4 sm:px-6";

export function InventoryRecordHeader({ item, editing = false }: { item?: InventoryItem; editing?: boolean }) {
  return (
    <DialogHeader className="shrink-0 gap-2 border-b px-5 py-4 pr-12 sm:px-6 sm:pr-14">
      <div className="flex flex-wrap items-center gap-2">
        <DialogTitle className="min-w-0 max-w-full break-words text-lg [overflow-wrap:anywhere]">
          {item ? item.product : "Add inventory item"}
        </DialogTitle>
        {item ? <Badge variant="secondary">{item.itemStatus === "Inactive" ? "Archived" : "Active"}</Badge> : null}
      </div>
      <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {item ? (
          <>
            <span className="min-w-0 break-all font-mono">{item.sku || "No SKU"}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden="true" />
              {item.location}
            </span>
            <span>{editing ? "Editing this location’s record" : "Item details"}</span>
          </>
        ) : (
          "Set up a product and its starting location."
        )}
      </DialogDescription>
    </DialogHeader>
  );
}

export function InventoryRecordSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid min-w-0 content-start gap-4 rounded-xl border p-4" aria-label={title}>
      <div className="grid gap-1">
        <h3 className="font-semibold text-sm">{title}</h3>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function InventoryRecordValue({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-sm">
        {value === undefined || value === null || value === "" ? "—" : value}
      </dd>
    </div>
  );
}
