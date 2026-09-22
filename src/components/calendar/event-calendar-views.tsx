"use client";

import "@fullcalendar/react/themes/forma/theme.css";

import FullCalendar, { type CalendarController, type CalendarOptions } from "@fullcalendar/react";
import formaThemePlugin from "@fullcalendar/react/themes/forma";

type EventCalendarViewsProps = Omit<CalendarOptions, "controller" | "headerToolbar" | "plugins"> & {
  controller: CalendarController;
  plugins: NonNullable<CalendarOptions["plugins"]>;
};

export function EventCalendarViews({ controller, plugins, ...props }: EventCalendarViewsProps) {
  return (
    <div className="vados-event-calendar min-w-0 overflow-hidden bg-card">
      <FullCalendar {...props} controller={controller} headerToolbar={false} plugins={[formaThemePlugin, ...plugins]} />
    </div>
  );
}
