"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfToday,
  startOfWeek,
} from "date-fns";
import { enGB } from "date-fns/locale";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronsUpDown,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { toDateInputValue } from "@/lib/date-only";
import { cn } from "@/lib/utils";

import type { CalendarTaskMutationState } from "../actions";

export type CalendarDashboardEvent = {
  id: string;
  recordId: string;
  type: "job" | "task" | "invoice";
  title: string;
  customerName: string;
  customerId?: string;
  date: string;
  endDate?: string;
  leadId?: string;
  notes?: string;
  status: string;
  amount?: string;
  location?: string;
  href?: string;
};

export type CalendarDashboardContact = {
  id: string;
  kind: "customer" | "lead";
  label: string;
  meta?: string;
};

const eventTypes = [
  { value: "job", label: "Jobs", icon: BriefcaseBusiness },
  { value: "task", label: "Tasks", icon: CheckSquare },
  { value: "invoice", label: "Invoices", icon: ReceiptText },
] as const;

const eventPalette = [
  {
    dot: "bg-cyan-500",
    text: "text-cyan-600 dark:text-cyan-300",
    tone: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300",
  },
  {
    dot: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-300",
    tone: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
  },
  {
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-300",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  {
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-300",
    tone: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  },
  {
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-300",
    tone: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
  },
  {
    dot: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-300",
    tone: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300",
  },
  {
    dot: "bg-lime-500",
    text: "text-lime-600 dark:text-lime-300",
    tone: "border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-500/30 dark:bg-lime-500/10 dark:text-lime-300",
  },
  {
    dot: "bg-fuchsia-500",
    text: "text-fuchsia-600 dark:text-fuchsia-300",
    tone: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-300",
  },
] as const;

function getPaletteIndex(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % eventPalette.length;
  }

  return hash;
}

function getEventPalette(event: CalendarDashboardEvent) {
  return eventPalette[getPaletteIndex(event.recordId || event.id)];
}

function getEventDate(event: CalendarDashboardEvent) {
  return parseISO(event.date);
}

function getEventEndDate(event: CalendarDashboardEvent) {
  return event.endDate ? parseISO(event.endDate) : getEventDate(event);
}

function eventOccursOnDay(event: CalendarDashboardEvent, day: Date) {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  return getEventDate(event) <= dayEnd && getEventEndDate(event) >= dayStart;
}

function eventOccursInMonth(event: CalendarDashboardEvent, month: Date) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  return getEventDate(event) <= monthEnd && getEventEndDate(event) >= monthStart;
}

function formatMoney(value?: string) {
  if (!value) return undefined;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return `$${amount.toFixed(2)}`;
}

function getEventLabel(type: CalendarDashboardEvent["type"]) {
  if (type === "job") return "Job";
  if (type === "task") return "Task";
  return "Invoice due";
}

function getEventViewLabel(type: CalendarDashboardEvent["type"]) {
  if (type === "job") return "View job";
  if (type === "invoice") return "View invoice";
  return "View task";
}

function getEventIcon(type: CalendarDashboardEvent["type"]) {
  if (type === "job") return BriefcaseBusiness;
  if (type === "task") return CheckSquare;
  return ReceiptText;
}

function getCalendarDisplayName(event: CalendarDashboardEvent) {
  return event.customerName === "Task" ? event.title : event.customerName;
}

type TaskAction = (state: CalendarTaskMutationState, formData: FormData) => Promise<CalendarTaskMutationState>;

function getTaskDateValue(event?: CalendarDashboardEvent) {
  if (!event?.date) return new Date();
  return parseISO(event.date);
}

function TaskDatePicker({ id, value, onChange }: { id: string; value: Date; onChange: (date: Date) => void }) {
  const [open, setOpen] = React.useState(false);
  const [currentMonth, setCurrentMonth] = React.useState(() => startOfMonth(value));

  React.useEffect(() => {
    setCurrentMonth(startOfMonth(value));
  }, [value]);

  function handleSelect(date: Date | undefined) {
    if (!date) return;

    onChange(date);
    setOpen(false);
  }

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 bg-background font-normal"
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-muted-foreground">{format(value, "MMM d, yyyy")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto overflow-hidden p-0">
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
      </PopoverContent>
    </Popover>
  );
}

function TaskDeleteDialog({
  action,
  event,
  onOpenChange,
  open,
}: {
  action: TaskAction;
  event: CalendarDashboardEvent;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = React.useActionState(action, initialTaskState);

  React.useEffect(() => {
    if (!state.success) return;
    router.refresh();
  }, [router, state]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete task?</AlertDialogTitle>
          <AlertDialogDescription>This removes "{event.title}" from your calendar.</AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} id={`delete-calendar-task-${event.recordId}`}>
          <input type="hidden" name="id" value={event.recordId} />
        </form>
        {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(clickEvent) => {
              clickEvent.preventDefault();
              const form = document.getElementById(`delete-calendar-task-${event.recordId}`) as HTMLFormElement | null;
              form?.requestSubmit();
            }}
          >
            {isPending ? "Deleting..." : "Delete task"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TaskContactPicker({
  contacts,
  selectedValue,
  onSelect,
}: {
  contacts: CalendarDashboardContact[];
  selectedValue: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedContact = contacts.find((contact) => `${contact.kind}:${contact.id}` === selectedValue);
  const customers = contacts.filter((contact) => contact.kind === "customer");
  const leads = contacts.filter((contact) => contact.kind === "lead");
  const selectedLabel = selectedContact?.label ?? "No customer or lead";

  function handleSelect(value: string) {
    onSelect(value);
    setOpen(false);
  }

  function handleListWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.deltaY) return;

    const list = event.currentTarget;
    const nextScrollTop = list.scrollTop + event.deltaY;
    const canScrollUp = event.deltaY < 0 && list.scrollTop > 0;
    const canScrollDown = event.deltaY > 0 && list.scrollTop + list.clientHeight < list.scrollHeight;

    if (!canScrollUp && !canScrollDown) return;

    event.preventDefault();
    event.stopPropagation();
    list.scrollTop = nextScrollTop;
  }

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="calendar-task-contact"
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-background font-normal"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[min(24rem,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
      >
        <Command>
          <CommandInput placeholder="Search customers and leads..." />
          <CommandList
            className="max-h-[min(18rem,var(--radix-popover-content-available-height))] overscroll-contain pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2"
            onWheel={handleListWheel}
          >
            <CommandEmpty>No customers or leads found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="No customer or lead" onSelect={() => handleSelect("")}>
                <Check className={cn("size-4", selectedValue ? "opacity-0" : "opacity-100")} />
                No customer or lead
              </CommandItem>
            </CommandGroup>
            {customers.length ? (
              <CommandGroup heading="Customers">
                {customers.map((contact) => {
                  const value = `customer:${contact.id}`;

                  return (
                    <CommandItem
                      key={value}
                      value={`${contact.label} ${contact.meta ?? ""} customer`}
                      onSelect={() => handleSelect(value)}
                    >
                      <Check className={cn("size-4", selectedValue === value ? "opacity-100" : "opacity-0")} />
                      <span className="grid min-w-0">
                        <span className="truncate">{contact.label}</span>
                        {contact.meta ? (
                          <span className="truncate text-muted-foreground text-xs">{contact.meta}</span>
                        ) : null}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
            {leads.length ? (
              <CommandGroup heading="Leads">
                {leads.map((contact) => {
                  const value = `lead:${contact.id}`;

                  return (
                    <CommandItem
                      key={value}
                      value={`${contact.label} ${contact.meta ?? ""} lead`}
                      onSelect={() => handleSelect(value)}
                    >
                      <Check className={cn("size-4", selectedValue === value ? "opacity-100" : "opacity-0")} />
                      <span className="grid min-w-0">
                        <span className="truncate">{contact.label}</span>
                        {contact.meta ? (
                          <span className="truncate text-muted-foreground text-xs">{contact.meta}</span>
                        ) : null}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TaskFormFields({ contacts, event }: { contacts: CalendarDashboardContact[]; event?: CalendarDashboardEvent }) {
  const initialContactValue = event?.leadId
    ? `lead:${event.leadId}`
    : event?.customerId
      ? `customer:${event.customerId}`
      : "";
  const [selectedContact, setSelectedContact] = React.useState(initialContactValue);
  const [scheduledFor, setScheduledFor] = React.useState(() => getTaskDateValue(event));
  const [kind, id] = selectedContact.split(":");

  return (
    <>
      <input type="hidden" name="customerId" value={kind === "customer" ? id : ""} />
      <input type="hidden" name="leadId" value={kind === "lead" ? id : ""} />
      <input type="hidden" name="scheduledFor" value={toDateInputValue(scheduledFor)} />
      <div className="grid gap-2">
        <Label htmlFor={`calendar-task-title-${event?.recordId ?? "new"}`}>Task</Label>
        <Textarea
          id={`calendar-task-title-${event?.recordId ?? "new"}`}
          name="title"
          placeholder="Meet customer to view job"
          defaultValue={event?.title ?? ""}
          className="min-h-16 resize-y bg-background"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`calendar-task-date-${event?.recordId ?? "new"}`}>Date</Label>
          <TaskDatePicker
            id={`calendar-task-date-${event?.recordId ?? "new"}`}
            value={scheduledFor}
            onChange={setScheduledFor}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`calendar-task-priority-${event?.recordId ?? "new"}`}>Priority</Label>
          <NativeSelect
            id={`calendar-task-priority-${event?.recordId ?? "new"}`}
            name="priority"
            defaultValue={event?.status ?? "Normal"}
            className="w-full"
          >
            <NativeSelectOption value="Low">Low</NativeSelectOption>
            <NativeSelectOption value="Normal">Normal</NativeSelectOption>
            <NativeSelectOption value="High">High</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="calendar-task-contact">Customer or lead</Label>
        <TaskContactPicker contacts={contacts} selectedValue={selectedContact} onSelect={setSelectedContact} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`calendar-task-location-${event?.recordId ?? "new"}`}>Location</Label>
        <Input
          id={`calendar-task-location-${event?.recordId ?? "new"}`}
          name="location"
          placeholder="Optional"
          defaultValue={event?.location ?? ""}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`calendar-task-notes-${event?.recordId ?? "new"}`}>Notes</Label>
        <Textarea
          id={`calendar-task-notes-${event?.recordId ?? "new"}`}
          name="notes"
          placeholder="Optional details"
          defaultValue={event?.notes ?? ""}
        />
      </div>
    </>
  );
}

function CalendarEventCard({
  contacts,
  deleteTaskAction,
  event,
  updateTaskAction,
  compact = false,
  linked = true,
}: {
  contacts: CalendarDashboardContact[];
  deleteTaskAction: TaskAction;
  event: CalendarDashboardEvent;
  updateTaskAction: TaskAction;
  compact?: boolean;
  linked?: boolean;
}) {
  const Icon = getEventIcon(event.type);
  const amount = formatMoney(event.amount);
  const palette = getEventPalette(event);
  const taskActions =
    event.type === "task" ? (
      <TaskActionsMenu
        contacts={contacts}
        deleteAction={deleteTaskAction}
        event={event}
        updateAction={updateTaskAction}
      />
    ) : null;
  const content = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border", palette.tone)}>
            <Icon className="size-3.5" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium leading-5">{event.title}</div>
            <div className="truncate text-muted-foreground text-xs">{event.customerName}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {amount ? <span className="font-medium text-xs tabular-nums">{amount}</span> : null}
          {taskActions}
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
        <span className={cn("mt-1 size-2 shrink-0 rounded-full", palette.dot)} />
        <span>{getEventLabel(event.type)}</span>
        <span>{event.status}</span>
        {event.location ? (
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3" />
            <span className="truncate">{event.location}</span>
          </span>
        ) : null}
      </div>
    </>
  );

  if (!event.href || !linked) {
    return <div className={cn("grid gap-2 rounded-lg border bg-card p-3 text-sm", compact && "p-2.5")}>{content}</div>;
  }

  return (
    <Link
      prefetch={false}
      href={event.href}
      className={cn(
        "group grid gap-2 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
        compact && "p-2.5",
      )}
    >
      {content}
    </Link>
  );
}

function CalendarEventPill({ event }: { event: CalendarDashboardEvent }) {
  const Icon = getEventIcon(event.type);
  const palette = getEventPalette(event);

  return (
    <>
      <Icon className={cn("size-3.5 shrink-0", palette.text)} />
      <span className="truncate">{getCalendarDisplayName(event)}</span>
    </>
  );
}

function CalendarEventPreviewHoverCard({
  contacts,
  deleteTaskAction,
  event,
  updateTaskAction,
}: {
  contacts: CalendarDashboardContact[];
  deleteTaskAction: TaskAction;
  event: CalendarDashboardEvent;
  updateTaskAction: TaskAction;
}) {
  return (
    <HoverCard closeDelay={120} openDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs hover:bg-accent"
        >
          <CalendarEventPill event={event} />
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-2.5">
        <div className="grid gap-2">
          <CalendarEventCard
            contacts={contacts}
            deleteTaskAction={deleteTaskAction}
            event={event}
            updateTaskAction={updateTaskAction}
            compact
            linked={false}
          />
          {event.href ? (
            <Button asChild size="sm" className="justify-self-end">
              <Link prefetch={false} href={event.href}>
                {getEventViewLabel(event.type)}
              </Link>
            </Button>
          ) : null}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

const initialTaskState: CalendarTaskMutationState = {
  success: false,
  message: "",
};

function CreateTaskDialog({ action, contacts }: { action: TaskAction; contacts: CalendarDashboardContact[] }) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(action, initialTaskState);

  React.useEffect(() => {
    if (!state.success) return;

    formRef.current?.reset();
    setOpen(false);
    router.refresh();
  }, [router, state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus />
        New task
      </Button>
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New calendar task</DialogTitle>
          <DialogDescription>Add a site visit, follow-up, reminder, or other scheduled task.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="grid gap-4">
          <TaskFormFields contacts={contacts} />
          {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTaskDialog({
  action,
  contacts,
  event,
  onOpenChange,
  open,
}: {
  action: TaskAction;
  contacts: CalendarDashboardContact[];
  event: CalendarDashboardEvent;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = React.useActionState(action, initialTaskState);

  React.useEffect(() => {
    if (!state.success) return;

    onOpenChange(false);
    router.refresh();
  }, [onOpenChange, router, state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit calendar task</DialogTitle>
          <DialogDescription>Update the task details, schedule, or linked customer or lead.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="id" value={event.recordId} />
          <TaskFormFields contacts={contacts} event={event} />
          {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskActionsMenu({
  contacts,
  deleteAction,
  event,
  updateAction,
}: {
  contacts: CalendarDashboardContact[];
  deleteAction: TaskAction;
  event: CalendarDashboardEvent;
  updateAction: TaskAction;
}) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div className="flex items-center">
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Task actions for ${event.title}`}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36">
          <DropdownMenuItem
            onSelect={(selectEvent) => {
              selectEvent.preventDefault();
              setMenuOpen(false);
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(selectEvent) => {
              selectEvent.preventDefault();
              setMenuOpen(false);
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditTaskDialog
        action={updateAction}
        contacts={contacts}
        event={event}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <TaskDeleteDialog action={deleteAction} event={event} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span className="grid size-7 place-items-center rounded-md bg-muted">
          <Icon className="size-3.5" />
        </span>
        {label}
      </div>
      <div className="mt-3 font-medium text-2xl leading-none">{value}</div>
      <div className="mt-1 text-muted-foreground text-xs">{detail}</div>
    </div>
  );
}

export function CalendarDashboard({
  contacts,
  createTaskAction,
  deleteTaskAction,
  events,
  updateTaskAction,
  unscheduledJobCount,
}: {
  contacts: CalendarDashboardContact[];
  createTaskAction: TaskAction;
  deleteTaskAction: TaskAction;
  events: CalendarDashboardEvent[];
  updateTaskAction: TaskAction;
  unscheduledJobCount: number;
}) {
  const today = startOfToday();
  const [month, setMonth] = React.useState(() => startOfMonth(today));
  const [activeTypes, setActiveTypes] = React.useState<CalendarDashboardEvent["type"][]>(["job", "task", "invoice"]);

  const visibleEvents = React.useMemo(
    () =>
      events
        .filter((event) => activeTypes.includes(event.type))
        .sort((a, b) => getEventDate(a).getTime() - getEventDate(b).getTime()),
    [activeTypes, events],
  );
  const monthEvents = React.useMemo(
    () => visibleEvents.filter((event) => eventOccursInMonth(event, month)),
    [month, visibleEvents],
  );
  const mobileEventGroups = React.useMemo(() => {
    const groupedEvents = new Map<string, CalendarDashboardEvent[]>();
    const monthDays = eachDayOfInterval({
      start: startOfMonth(month),
      end: endOfMonth(month),
    });

    for (const day of monthDays) {
      const dayEvents = monthEvents.filter((event) => eventOccursOnDay(event, day));

      if (dayEvents.length) {
        groupedEvents.set(format(day, "yyyy-MM-dd"), dayEvents);
      }
    }

    return [...groupedEvents.entries()].map(([date, groupEvents]) => ({
      date,
      events: groupEvents,
    }));
  }, [month, monthEvents]);
  const monthListEvents = monthEvents;
  const calendarDays = React.useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month)),
        end: endOfWeek(endOfMonth(month)),
      }),
    [month],
  );

  const monthJobs = monthEvents.filter((event) => event.type === "job");
  const monthTasks = monthEvents.filter((event) => event.type === "task");
  const monthInvoices = monthEvents.filter((event) => event.type === "invoice");
  const invoiceDueTotal = monthInvoices.reduce((total, event) => total + Number(event.amount ?? 0), 0);

  function toggleType(type: CalendarDashboardEvent["type"]) {
    setActiveTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

  function eventsForDay(day: Date) {
    return monthEvents.filter((event) => eventOccursOnDay(event, day));
  }

  return (
    <div className="mx-auto grid w-full max-w-[1500px] gap-5">
      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border bg-muted px-2.5 py-1 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
                Calendar
              </span>
              <span className="rounded-md border bg-background px-2.5 py-1 text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
                {format(month, "MMMM yyyy")}
              </span>
            </div>
            <h1 className="mt-5 font-medium text-3xl leading-tight">Schedule overview</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-6">
              Jobs, tasks, and invoice due dates in one calendar view.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <CreateTaskDialog action={createTaskAction} contacts={contacts} />
            <Button type="button" variant="outline" size="sm" onClick={() => setMonth(addMonths(month, -1))}>
              <ArrowLeft />
              Previous
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setMonth(startOfMonth(today))}>
              Today
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setMonth(addMonths(month, 1))}>
              Next
              <ArrowRight />
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={BriefcaseBusiness}
          label="Jobs this month"
          value={`${monthJobs.length}`}
          detail={`${unscheduledJobCount} unscheduled jobs`}
        />
        <SummaryCard
          icon={CheckSquare}
          label="Tasks this month"
          value={`${monthTasks.length}`}
          detail="Open scheduled tasks"
        />
        <SummaryCard
          icon={ReceiptText}
          label="Invoices due"
          value={`${monthInvoices.length}`}
          detail={`${formatMoney(invoiceDueTotal.toFixed(2)) ?? "$0.00"} balance due`}
        />
        <SummaryCard
          icon={CalendarDays}
          label="Visible events"
          value={`${monthEvents.length}`}
          detail="Based on the active filters"
        />
      </section>

      <section className="flex flex-wrap items-center gap-2">
        {eventTypes.map((type) => {
          const Icon = type.icon;
          const active = activeTypes.includes(type.value);

          return (
            <Button
              key={type.value}
              type="button"
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => toggleType(type.value)}
            >
              <Icon />
              {type.label}
            </Button>
          );
        })}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="hidden overflow-hidden md:block">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-muted-foreground" />
              {format(month, "MMMM yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b bg-muted/20 text-center font-medium text-muted-foreground text-xs">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="border-r p-2 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dayEvents = eventsForDay(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-32 border-r border-b p-2 last:border-r-0",
                      !isSameMonth(day, month) && "bg-muted/20 text-muted-foreground",
                      isToday(day) && "bg-cyan-50/60 dark:bg-cyan-500/5",
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "grid size-7 place-items-center rounded-md text-xs",
                          isToday(day) && "bg-cyan-600 font-medium text-white",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      {dayEvents.length ? (
                        <span className="text-[11px] text-muted-foreground">{dayEvents.length}</span>
                      ) : null}
                    </div>
                    <div className="grid gap-1.5">
                      {dayEvents.slice(0, 3).map((event) => (
                        <CalendarEventPreviewHoverCard
                          key={event.id}
                          contacts={contacts}
                          deleteTaskAction={deleteTaskAction}
                          event={event}
                          updateTaskAction={updateTaskAction}
                        />
                      ))}
                      {dayEvents.length > 3 ? (
                        <span className="px-1.5 text-[11px] text-muted-foreground">+{dayEvents.length - 3} more</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="md:hidden">
          <CardHeader className="border-b">
            <CardTitle className="text-base">{format(month, "MMMM yyyy")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4">
            {mobileEventGroups.length ? (
              mobileEventGroups.map((group) => (
                <div key={group.date} className="grid gap-2">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-foreground">{format(parseISO(group.date), "EEE, MMM d")}</span>
                    <span className="text-muted-foreground">
                      {group.events.length} event{group.events.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {group.events.map((event) => (
                      <CalendarEventCard
                        key={event.id}
                        contacts={contacts}
                        deleteTaskAction={deleteTaskAction}
                        event={event}
                        updateTaskAction={updateTaskAction}
                        compact
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border bg-muted/20 p-6 text-center text-muted-foreground text-sm">
                No events match the active filters for this month.
              </div>
            )}
          </CardContent>
        </Card>

        <aside className="hidden gap-5 md:grid xl:content-start">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">{format(month, "MMMM")} schedule</CardTitle>
            </CardHeader>
            <CardContent className="grid max-h-[760px] gap-2 overflow-y-auto pt-4">
              {monthListEvents.length ? (
                monthListEvents.map((event) => (
                  <CalendarEventCard
                    key={event.id}
                    contacts={contacts}
                    deleteTaskAction={deleteTaskAction}
                    event={event}
                    updateTaskAction={updateTaskAction}
                    compact
                  />
                ))
              ) : (
                <div className="rounded-lg border bg-muted/20 p-4 text-muted-foreground text-sm">
                  Nothing scheduled this month with the active filters.
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
