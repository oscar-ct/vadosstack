"use client";

import * as React from "react";

import { format, isSameDay, startOfMonth } from "date-fns";
import { enGB } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function OptionalDatePicker({
  className,
  id,
  name,
  onChange,
  placeholder = "Select date",
  value,
}: {
  className?: string;
  id: string;
  name?: string;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  value?: Date;
}) {
  const [open, setOpen] = React.useState(false);
  const [currentMonth, setCurrentMonth] = React.useState(() => startOfMonth(value ?? new Date()));

  React.useEffect(() => {
    if (value) setCurrentMonth(startOfMonth(value));
  }, [value]);

  function handleSelect(date: Date | undefined) {
    if (!date || (value && isSameDay(value, date))) {
      onChange(undefined);
      return;
    }

    onChange(date);
    setOpen(false);
  }

  function clearDate() {
    onChange(undefined);
    setOpen(false);
  }

  return (
    <>
      {name ? <input type="hidden" name={name} value={value ? format(value, "yyyy-MM-dd") : ""} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "w-full min-w-0 justify-start gap-2 overflow-hidden bg-background/60 text-left font-normal text-base md:text-sm",
              className,
            )}
          >
            <CalendarDays className="size-4 text-muted-foreground" />
            <span className="min-w-0 truncate text-muted-foreground">
              {value ? format(value, "MMM d, yyyy") : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="z-[60] w-auto overflow-hidden p-0">
          <div className="p-3">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleSelect}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              fixedWeeks
              locale={enGB}
              className="w-full p-0"
            />
          </div>
          {value ? (
            <div className="border-t p-2">
              <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={clearDate}>
                <X className="size-4" />
                Clear date
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </>
  );
}
