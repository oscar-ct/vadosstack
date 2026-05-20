"use client";

import * as React from "react";

import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const usStates = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
] as const;

type UsStateSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children" | "onChange"> & {
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  placeholder?: string;
};

function getStateLabel(value: string) {
  return usStates.find(([stateValue]) => stateValue === value)?.[1] ?? "";
}

export function UsStateSelect({
  className,
  defaultValue,
  disabled,
  id,
  name,
  onChange,
  placeholder = "Select state",
  required,
  value,
}: UsStateSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [internalValue, setInternalValue] = React.useState(String(defaultValue ?? "TX"));
  const selectedValue = String(value ?? internalValue);
  const selectedLabel = getStateLabel(selectedValue);
  const filteredStates = query.trim()
    ? usStates.filter(([stateValue, label]) => {
        const normalizedQuery = query.trim().toLowerCase();
        return stateValue.toLowerCase().startsWith(normalizedQuery) || label.toLowerCase().startsWith(normalizedQuery);
      })
    : usStates;

  function selectState(nextValue: string) {
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onChange?.({
      target: {
        value: nextValue,
      },
    } as React.ChangeEvent<HTMLSelectElement>);
    setQuery("");
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={selectedValue} required={required} />
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "h-8 w-full justify-between rounded-lg border-input bg-transparent px-2.5 py-1 font-normal text-base hover:bg-transparent md:text-sm dark:bg-input/30",
            !selectedLabel && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)]">
        <div className="p-1">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder="Search state..."
            autoFocus
          />
        </div>
        {selectedValue ? (
          <DropdownMenuItem onSelect={() => selectState("")}>
            <Check className="size-4 opacity-0" />
            Clear
          </DropdownMenuItem>
        ) : null}
        {filteredStates.length ? (
          filteredStates.map(([stateValue, label]) => (
            <DropdownMenuItem key={stateValue} onSelect={() => selectState(stateValue)}>
              <Check className={cn("size-4", selectedValue === stateValue ? "opacity-100" : "opacity-0")} />
              <span>{label}</span>
              <span className="ml-auto text-muted-foreground text-xs">{stateValue}</span>
            </DropdownMenuItem>
          ))
        ) : (
          <div className="px-2 py-1.5 text-muted-foreground text-sm">No states found.</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
