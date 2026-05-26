"use client";

import * as React from "react";

import { format, subDays } from "date-fns";
import { X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  value?: DateRange;
  defaultValue?: DateRange;
  onChange?: (value: DateRange | undefined) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  align?: "start" | "center" | "end";
  numberOfMonths?: number;
  size?: React.ComponentProps<typeof Button>["size"];
}

export function DateRangePicker(props: DateRangePickerProps) {
  const {
    value,
    defaultValue,
    onChange,
    id = "date",
    className,
    placeholder = "Select date",
    align = "end",
    numberOfMonths = 2,
    size = "default",
  } = props;
  const isControlled = Object.hasOwn(props, "value");
  const [open, setOpen] = React.useState(false);
  const [internalDateRange, setInternalDateRange] = React.useState<DateRange | undefined>(() => {
    if (defaultValue) return defaultValue;

    const to = new Date();
    const from = subDays(to, 29);
    return { from, to };
  });
  const dateRange = isControlled ? value : internalDateRange;

  const handleDateChange = (nextValue: DateRange | undefined) => {
    if (!isControlled) {
      setInternalDateRange(nextValue);
    }
    onChange?.(nextValue);
  };

  const clearDateRange = () => {
    handleDateChange(undefined);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size={size} id={id} className={cn("font-medium", className)}>
          {dateRange?.from
            ? dateRange.to
              ? `${format(dateRange.from, "d MMM yyyy")} - ${format(dateRange.to, "d MMM yyyy")}`
              : format(dateRange.from, "d MMM yyyy")
            : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align={align}>
        <Calendar
          mode="range"
          defaultMonth={dateRange?.from}
          selected={dateRange}
          onSelect={handleDateChange}
          numberOfMonths={numberOfMonths}
        />
        {dateRange?.from || dateRange?.to ? (
          <div className="border-t p-2">
            <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={clearDateRange}>
              <X className="size-4" />
              Clear dates
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
