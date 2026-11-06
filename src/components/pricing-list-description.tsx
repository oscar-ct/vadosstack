"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { parsePricingList } from "@/lib/pricing-list-paste";

function clipboardList(text: string, html: string) {
  const plainList = parsePricingList(text);
  if (plainList) return plainList;
  if (!html) return null;
  const document = new DOMParser().parseFromString(html, "text/html");
  // Only actual list markup qualifies. Never render clipboard HTML.
  const entries = Array.from(document.querySelectorAll("ol > li, ul > li"));
  const topLevel = entries.filter((entry) => !entry.parentElement?.closest("li"));
  const descriptions = topLevel.map((entry) => entry.textContent?.replace(/\s+/g, " ").trim() ?? "").filter(Boolean);
  // Text outside a copied list may be meaningful; don't silently discard it.
  const outside = document.body.cloneNode(true) as HTMLElement;
  outside.querySelectorAll("ol, ul").forEach((list) => {
    list.remove();
  });
  if (outside.textContent?.trim()) return null;
  return descriptions.length >= 2 ? descriptions : null;
}

export function PricingListDescription({
  kind,
  onSplit,
  onPasteText,
  ...props
}: React.ComponentProps<typeof Textarea> & {
  kind: "labor" | "material";
  onSplit: (descriptions: string[]) => void;
  onPasteText: (text: string) => void;
}) {
  const [pending, setPending] = React.useState<{
    text: string;
    descriptions: string[];
    preview: { id: string; description: string }[];
  } | null>(null);
  const [open, setOpen] = React.useState(false);
  function pasteAsOne() {
    if (!pending) return;
    onPasteText(pending.text);
    setOpen(false);
  }
  return (
    <>
      <Textarea
        {...props}
        onPaste={(event) => {
          props.onPaste?.(event);
          if (event.defaultPrevented || event.currentTarget.value.trim()) return;
          const text = event.clipboardData.getData("text/plain");
          const descriptions = clipboardList(text, event.clipboardData.getData("text/html"));
          if (!descriptions) return;
          event.preventDefault();
          setPending({
            text: text || descriptions.join("\n"),
            descriptions,
            preview: descriptions.map((description) => ({ id: crypto.randomUUID(), description })),
          });
          setOpen(true);
        }}
      />
      <Dialog
        open={open}
        onOpenChange={(open) => {
          if (!open) pasteAsOne();
        }}
      >
        <DialogContent allowAutoFocus className="max-h-[85dvh] max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Split into {pending?.descriptions.length} {kind} lines?
            </DialogTitle>
            <DialogDescription>
              The first item stays here. The rest will be added directly below, in this order. New lines use their
              normal quantity and price defaults.
            </DialogDescription>
          </DialogHeader>
          <ol className="max-h-48 list-decimal space-y-2 overflow-y-auto overscroll-contain rounded-lg border py-3 pr-3 pl-9 text-sm">
            {pending?.preview.map(({ description, id }) => (
              <li key={id} className="break-words pl-1">
                {description}
              </li>
            ))}
          </ol>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={pasteAsOne}>
              Paste as one description
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!pending) return;
                onSplit(pending.descriptions);
                setOpen(false);
              }}
            >
              Split into {pending?.descriptions.length} {kind} lines
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
