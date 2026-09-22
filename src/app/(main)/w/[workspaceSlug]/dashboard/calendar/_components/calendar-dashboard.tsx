"use client";

import * as React from "react";

import {
  type DateClickInfo,
  type DatesSetInfo,
  type EventClickInfo,
  type EventInput,
  useCalendarController,
} from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import { addDays, differenceInCalendarDays, endOfMonth, format, parseISO, startOfMonth, startOfToday } from "date-fns";
import { enGB } from "date-fns/locale";
import {
  BriefcaseBusiness,
  CalendarDays,
  Calendar as CalendarIcon,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  XIcon,
} from "lucide-react";

import { EventCalendarViews } from "@/components/calendar/event-calendar-views";
import { PermissionDisabledButton } from "@/components/permission-disabled-button";
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
import { ButtonGroup } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceLink as Link, useWorkspaceRouter as useRouter } from "@/components/workspace-path-provider";
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

const calendarPlugins = [dayGridPlugin, interactionPlugin];

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

function getTaskDateValue(event?: CalendarDashboardEvent, initialDate?: Date) {
  if (!event?.date) return initialDate ?? new Date();
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

function TaskFormFields({
  contacts,
  event,
  initialDate,
}: {
  contacts: CalendarDashboardContact[];
  event?: CalendarDashboardEvent;
  initialDate?: Date;
}) {
  const initialContactValue = event?.leadId
    ? `lead:${event.leadId}`
    : event?.customerId
      ? `customer:${event.customerId}`
      : "";
  const [selectedContact, setSelectedContact] = React.useState(initialContactValue);
  const [scheduledFor, setScheduledFor] = React.useState(() => getTaskDateValue(event, initialDate));
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
  canManage,
  contacts,
  deleteTaskAction,
  event,
  updateTaskAction,
  compact = false,
  linked = true,
  showDate = false,
}: {
  canManage: boolean;
  contacts: CalendarDashboardContact[];
  deleteTaskAction: TaskAction;
  event: CalendarDashboardEvent;
  updateTaskAction: TaskAction;
  compact?: boolean;
  linked?: boolean;
  showDate?: boolean;
}) {
  const Icon = getEventIcon(event.type);
  const amount = formatMoney(event.amount);
  const palette = getEventPalette(event);
  const taskActions =
    event.type === "task" ? (
      <TaskActionsMenu
        canManage={canManage}
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
        {showDate ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3" />
            {format(getEventDate(event), "EEE, MMM d")}
            {event.endDate && getEventEndDate(event).getTime() !== getEventDate(event).getTime()
              ? ` – ${format(getEventEndDate(event), "MMM d")}`
              : null}
          </span>
        ) : null}
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

const initialTaskState: CalendarTaskMutationState = {
  success: false,
  message: "",
};

function CreateTaskDialog({
  action,
  contacts,
  initialDate,
  onOpenChange,
  open,
}: {
  action: TaskAction;
  contacts: CalendarDashboardContact[];
  initialDate: Date;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = React.useActionState(action, initialTaskState);

  React.useEffect(() => {
    if (!state.success) return;

    formRef.current?.reset();
    onOpenChange(false);
    router.refresh();
  }, [onOpenChange, router, state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New calendar task</DialogTitle>
          <DialogDescription>Add a site visit, follow-up, reminder, or other scheduled task.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="grid gap-4">
          <TaskFormFields key={toDateInputValue(initialDate)} contacts={contacts} initialDate={initialDate} />
          {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
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
  canManage,
  contacts,
  deleteAction,
  event,
  updateAction,
}: {
  canManage: boolean;
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
            disabled={!canManage}
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
            disabled={!canManage}
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

function CalendarEventDialog({
  canManage,
  contacts,
  deleteTaskAction,
  event,
  onOpenChange,
  updateTaskAction,
}: {
  canManage: boolean;
  contacts: CalendarDashboardContact[];
  deleteTaskAction: TaskAction;
  event: CalendarDashboardEvent | null;
  onOpenChange: (open: boolean) => void;
  updateTaskAction: TaskAction;
}) {
  return (
    <Dialog open={Boolean(event)} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? getEventLabel(event.type) : "Calendar event"}</DialogTitle>
          <DialogDescription>Details for this scheduled item.</DialogDescription>
        </DialogHeader>
        {event ? (
          <div className="grid gap-3">
            <CalendarEventCard
              canManage={canManage}
              contacts={contacts}
              deleteTaskAction={deleteTaskAction}
              event={event}
              updateTaskAction={updateTaskAction}
              linked={false}
            />
            {event.notes ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-6">
                <div className="mb-1 font-medium">Notes</div>
                <p className="whitespace-pre-wrap text-muted-foreground">{event.notes}</p>
              </div>
            ) : null}
            {event.href ? (
              <Button asChild className="justify-self-end">
                <Link prefetch={false} href={event.href}>
                  {getEventViewLabel(event.type)}
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function CalendarDashboard({
  canManage,
  contacts,
  createTaskAction,
  deleteTaskAction,
  events,
  updateTaskAction,
}: {
  canManage: boolean;
  contacts: CalendarDashboardContact[];
  createTaskAction: TaskAction;
  deleteTaskAction: TaskAction;
  events: CalendarDashboardEvent[];
  updateTaskAction: TaskAction;
}) {
  const controller = useCalendarController();
  const today = startOfToday();
  const initialStart = startOfMonth(today);
  const initialEnd = addDays(endOfMonth(today), 1);
  const [dateInfo, setDateInfo] = React.useState(() => ({
    days: differenceInCalendarDays(initialEnd, initialStart),
    end: initialEnd,
    start: initialStart,
    title: format(today, "MMMM yyyy"),
  }));
  const [activeTypes, setActiveTypes] = React.useState<CalendarDashboardEvent["type"][]>(["job", "task", "invoice"]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createDate, setCreateDate] = React.useState(today);
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarDashboardEvent | null>(null);
  const visibleEvents = React.useMemo(
    () =>
      events
        .filter((event) => activeTypes.includes(event.type))
        .sort((a, b) => getEventDate(a).getTime() - getEventDate(b).getTime()),
    [activeTypes, events],
  );
  const rangeEvents = React.useMemo(
    () =>
      visibleEvents.filter((event) => getEventDate(event) < dateInfo.end && getEventEndDate(event) >= dateInfo.start),
    [dateInfo.end, dateInfo.start, visibleEvents],
  );
  const eventById = React.useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const fullCalendarEvents = React.useMemo<EventInput[]>(
    () =>
      visibleEvents.map((event) => ({
        allDay: true,
        classNames: [`vados-calendar-event-${event.type}`],
        end: event.endDate ? format(addDays(getEventEndDate(event), 1), "yyyy-MM-dd") : undefined,
        id: event.id,
        start: event.date,
        title: getCalendarDisplayName(event),
      })),
    [visibleEvents],
  );
  const selectedCalendar = activeTypes.length === 3 ? "all" : activeTypes.length === 1 ? activeTypes[0] : "custom";

  function handleDatesSet(info: DatesSetInfo) {
    setDateInfo({
      days: differenceInCalendarDays(info.view.currentEnd, info.view.currentStart),
      end: info.view.currentEnd,
      start: info.view.currentStart,
      title: info.view.title,
    });
  }

  function handleDateClick(info: DateClickInfo) {
    if (!canManage) return;
    setCreateDate(info.date);
    setCreateOpen(true);
  }

  function handleEventClick(info: EventClickInfo) {
    info.jsEvent.preventDefault();
    setSelectedEvent(eventById.get(info.event.id) ?? null);
  }

  return (
    <div className="mx-auto grid w-full max-w-[1500px] gap-5">
      <section className="min-w-0 overflow-hidden rounded-lg bg-card">
        <div className="flex flex-col gap-4 rounded-t-lg border border-b-0 bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 shrink-0 flex-col gap-1">
            <h1 className="font-medium text-lg leading-none">{dateInfo.title}</h1>
            <p className="text-muted-foreground text-sm">
              {dateInfo.days} days · {rangeEvents.length} events
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selectedCalendar}
              onValueChange={(value) => {
                if (value === "all") setActiveTypes(["job", "task", "invoice"]);
                else if (value !== "custom") setActiveTypes([value as CalendarDashboardEvent["type"]]);
              }}
            >
              <SelectTrigger className="w-full sm:w-44">
                <CalendarIcon />
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectItem value="all">All events</SelectItem>
                  {selectedCalendar === "custom" ? <SelectItem value="custom">Custom filters</SelectItem> : null}
                  {eventTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <ButtonGroup>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Previous date range"
                onClick={() => controller.prev()}
              >
                <ChevronLeft />
              </Button>
              <Button type="button" variant="outline" onClick={() => controller.today()}>
                Today
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Next date range"
                onClick={() => controller.next()}
              >
                <ChevronRight />
              </Button>
            </ButtonGroup>

            {canManage ? (
              <Button
                type="button"
                onClick={() => {
                  setCreateDate(today);
                  setCreateOpen(true);
                }}
              >
                <Plus />
                Add event
              </Button>
            ) : (
              <PermissionDisabledButton reason="Your role can view the calendar but cannot create tasks.">
                <Plus />
                Add event
              </PermissionDisabledButton>
            )}
          </div>
        </div>

        <EventCalendarViews
          controller={controller}
          initialView="dayGridMonth"
          plugins={calendarPlugins}
          events={fullCalendarEvents}
          nowIndicator
          height="auto"
          displayEventTime={false}
          dayMaxEvents={3}
          moreLinkClick="popover"
          popoverCloseContent={() => <XIcon className="size-5 text-muted-foreground" />}
          selectable={canManage}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventContent={(info) => {
            const event = eventById.get(info.event.id);
            return event ? (
              <div className="flex min-w-0 items-center gap-1.5 px-1 py-0.5 text-xs">
                <CalendarEventPill event={event} />
              </div>
            ) : (
              <span className="truncate">{info.event.title}</span>
            );
          }}
          eventDidMount={(info) => {
            const event = eventById.get(info.event.id);
            if (event) info.el.title = `${event.title} · ${event.customerName}`;
          }}
          datesSet={handleDatesSet}
        />
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
          <div>
            <h2 className="font-medium text-base">{dateInfo.title} schedule</h2>
            <p className="mt-0.5 text-muted-foreground text-sm">
              {rangeEvents.length} visible event{rangeEvents.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="p-4">
          {rangeEvents.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rangeEvents.map((event) => (
                <CalendarEventCard
                  canManage={canManage}
                  key={event.id}
                  contacts={contacts}
                  deleteTaskAction={deleteTaskAction}
                  event={event}
                  updateTaskAction={updateTaskAction}
                  compact
                  showDate
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-muted-foreground text-sm">
              Nothing scheduled in this date range with the active filter.
            </div>
          )}
        </div>
      </section>

      <CreateTaskDialog
        action={createTaskAction}
        contacts={contacts}
        initialDate={createDate}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <CalendarEventDialog
        canManage={canManage}
        contacts={contacts}
        deleteTaskAction={deleteTaskAction}
        event={selectedEvent}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null);
        }}
        updateTaskAction={updateTaskAction}
      />
    </div>
  );
}
