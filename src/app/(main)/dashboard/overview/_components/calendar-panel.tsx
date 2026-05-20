"use client";

import * as React from "react";

import { startOfMonth, startOfToday } from "date-fns";
import { enGB } from "date-fns/locale";
import { CalendarDays } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CalendarPanel() {
  const today = startOfToday();
  const [date, setDate] = React.useState<Date | undefined>(today);
  const [currentMonth, setCurrentMonth] = React.useState<Date>(startOfMonth(today));

  return (
    <Card className="mx-auto w-full max-w-md rounded-lg border-border bg-card shadow-sm xl:sticky xl:top-18" size="sm">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="grid size-8 place-items-center rounded-md bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/25">
            <CalendarDays className="size-4" />
          </span>
          Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          fixedWeeks
          locale={enGB}
          className="w-full p-0"
        />
      </CardContent>
    </Card>
  );
}
