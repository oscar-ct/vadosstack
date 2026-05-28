"use client";

import * as React from "react";

import { Download } from "lucide-react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

type CsvExportMenuProps<T> = {
  allRows: T[];
  columns: CsvColumn<T>[];
  currentRows: T[];
  disabled?: boolean;
  filenamePrefix: string;
  selectedRows: T[];
  triggerClassName?: string;
};

type CsvExportSlotProps = {
  children: React.ReactNode;
  id: string;
};

function escapeCsvValue(value: string | number | null | undefined) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function createCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  return [
    columns.map((column) => escapeCsvValue(column.header)).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(column.value(row))).join(",")),
  ].join("\n");
}

function getCsvSize<T>(rows: T[], columns: CsvColumn<T>[]) {
  return new Blob([createCsv(rows, columns)], { type: "text/csv;charset=utf-8" }).size;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(kilobytes >= 10 ? 0 : 1)} KB`;

  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(megabytes >= 10 ? 1 : 2)} MB`;
}

function downloadCsv<T>(rows: T[], columns: CsvColumn<T>[], filenamePrefix: string) {
  const csv = createCsv(rows, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `${filenamePrefix}-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function CsvExportSlot({ children, id }: CsvExportSlotProps) {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setContainer(document.getElementById(id));
  }, [id]);

  return container ? createPortal(children, container) : null;
}

export function CsvExportMenu<T>({
  allRows,
  columns,
  currentRows,
  disabled,
  filenamePrefix,
  selectedRows,
  triggerClassName,
}: CsvExportMenuProps<T>) {
  const [open, setOpen] = React.useState(false);
  const exportOptions = [
    {
      disabled: selectedRows.length === 0,
      filenameSuffix: "selected",
      label: "Selected rows",
      rows: selectedRows,
      summary: "Only the records currently checked.",
    },
    {
      disabled: currentRows.length === 0,
      filenameSuffix: "filtered-rows",
      label: "Filtered rows",
      rows: currentRows,
      summary: "Every record matching the current filters and search.",
    },
    {
      disabled: allRows.length === 0,
      filenameSuffix: "all-records",
      label: "All records",
      rows: allRows,
      summary: "Every record available on this page.",
    },
  ];

  function confirmDownload(rows: T[], filenameSuffix: string) {
    downloadCsv(rows, columns, `${filenamePrefix}-${filenameSuffix}`);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("w-full justify-center sm:w-auto", triggerClassName)}
        disabled={disabled === true || allRows.length === 0}
        onClick={() => setOpen(true)}
      >
        <Download />
        Export
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm export</DialogTitle>
          <DialogDescription>
            Choose which records to download. File sizes are estimated from the generated CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {exportOptions.map((option) => {
            const size = formatFileSize(getCsvSize(option.rows, columns));

            return (
              <button
                key={option.filenameSuffix}
                type="button"
                className="grid gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                disabled={option.disabled}
                onClick={() => confirmDownload(option.rows, option.filenameSuffix)}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {option.rows.length} records · {size}
                  </span>
                </span>
                <span className="text-muted-foreground text-xs">{option.summary}</span>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
