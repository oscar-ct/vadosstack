"use client";

import * as React from "react";

import { Calculator, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function formatArea(value: number) {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function SquareFootageCalculator({ inputClassName }: { inputClassName?: string }) {
  const lengthId = React.useId();
  const widthId = React.useId();
  const [length, setLength] = React.useState("");
  const [width, setWidth] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const lengthValue = Number(length);
  const widthValue = Number(width);
  const area = lengthValue > 0 && widthValue > 0 ? lengthValue * widthValue : 0;
  const formattedArea = area > 0 && Number.isFinite(area) ? formatArea(area) : "";

  async function copyArea() {
    if (!formattedArea) return;

    try {
      await navigator.clipboard.writeText(formattedArea);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function clearValues() {
    setLength("");
    setWidth("");
    setCopied(false);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline">
          <Calculator />
          Sq ft
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-72">
        <div className="grid gap-4">
          <div className="grid gap-1">
            <div className="font-medium text-sm">Square footage</div>
            <p className="text-muted-foreground text-xs">Multiply length by width, then copy the qty.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor={lengthId}>Length</Label>
              <Input
                id={lengthId}
                value={length}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                onChange={(event) => {
                  setLength(event.target.value);
                  setCopied(false);
                }}
                placeholder="0"
                className={cn("min-w-0", inputClassName)}
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor={widthId}>Width</Label>
              <Input
                id={widthId}
                value={width}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                onChange={(event) => {
                  setWidth(event.target.value);
                  setCopied(false);
                }}
                placeholder="0"
                className={cn("min-w-0", inputClassName)}
              />
            </div>
          </div>
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="text-muted-foreground text-xs">Result</div>
            <div className="font-semibold text-lg tabular-nums">
              {formattedArea ? `${formattedArea} sq ft` : "0 sq ft"}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={clearValues}>
              Clear
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!formattedArea} onClick={copyArea}>
              <Copy className="size-4" />
              {copied ? "Copied" : "Copy qty"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
