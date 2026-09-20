"use client";

import * as React from "react";

import { addDays, format, parseISO } from "date-fns";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock3,
  Download,
  EllipsisVertical,
  Filter,
  Lock,
  LockOpen,
  LogOut,
  Pencil,
  Plus,
  Printer,
  Trash2,
  UserRoundCog,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { OptionalDatePicker } from "@/components/optional-date-picker";
import { PermissionDisabledButton } from "@/components/permission-disabled-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceLink as Link, useWorkspaceRouter as useRouter } from "@/components/workspace-path-provider";
import { type EmployeeAccent, getEmployeeAccent as getStoredEmployeeAccent } from "@/lib/employee-colors";
import { cn } from "@/lib/utils";

import type { TimeTrackingMutationState } from "../actions";

export type EmployeeSummary = {
  accentColor: string;
  active: boolean;
  department?: string;
  id: string;
  employeeNumber: string;
  name: string;
  totalHours: number;
  lastWorkedOn?: string;
};

export type TimeEntryRow = {
  id: string;
  deductLunch: boolean;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  endTime?: string;
  hours: number;
  jobCustomerName?: string;
  jobId?: string;
  jobTitle?: string;
  lunchMinutes: number;
  notes?: string;
  startTime?: string;
  workedOn: string;
};

export type TimeEntryRequestRow = {
  id: string;
  action: string;
  currentEntry?: TimeEntryReviewSnapshot;
  deductLunch: boolean;
  employeeAccentColor: string;
  employeeName: string;
  employeeNumber: string;
  hasConflict?: boolean;
  endTime?: string;
  hours?: number;
  jobCustomerName?: string;
  jobId?: string;
  jobTitle?: string;
  lunchMinutes: number;
  notes?: string;
  requestedAt: string;
  reviewedAt?: string;
  reviewReason?: string;
  startTime?: string;
  status: string;
  workedOn?: string;
};

type TimeEntryReviewSnapshot = {
  deductLunch: boolean;
  endTime?: string;
  hours?: number;
  jobCustomerName?: string;
  jobId?: string;
  jobTitle?: string;
  lunchMinutes: number;
  notes?: string;
  startTime?: string;
  updatedAt?: string;
  workedOn?: string;
};

type DayGroup = {
  date: string;
  entries: TimeEntryRow[];
  totalHours: number;
};

export type JobOption = {
  customerName?: string;
  id: string;
  title: string;
};

type TimeEntryAuditRow = {
  action: string;
  createdAt: string;
  employeeName: string;
  employeeNumber: string;
  id: string;
  source: string;
};

const initialState: TimeTrackingMutationState = {
  success: false,
  message: "",
};

function formatHours(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
}

function formatTime12(value?: string) {
  if (!value) return "";

  const [hours, minutes] = value.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;

  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function addMinutesToTime(startTime: string, minutesToAdd: number) {
  const [hours, minutes] = startTime.split(":").map(Number);
  const totalMinutes = Math.min(hours * 60 + minutes + minutesToAdd, 23 * 60 + 59);
  const nextHours = Math.floor(totalMinutes / 60);
  const nextMinutes = totalMinutes % 60;

  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

function formatReviewDate(value?: string) {
  return value ? format(parseISO(value), "MMM d, yyyy") : "Not set";
}

function formatReviewTimeRange(snapshot: TimeEntryReviewSnapshot) {
  if (!snapshot.startTime || !snapshot.endTime) return "Not set";

  const overnight = snapshot.endTime < snapshot.startTime ? " (+1 day)" : "";
  return `${formatTime12(snapshot.startTime)} - ${formatTime12(snapshot.endTime)}${overnight}`;
}

function formatReviewLunch(snapshot: TimeEntryReviewSnapshot) {
  return snapshot.deductLunch ? `Deduct ${snapshot.lunchMinutes}m` : "No lunch deducted";
}

function formatReviewNotes(value?: string) {
  return value?.trim() ? value : "No notes";
}

function formatJobLabel(job?: Pick<JobOption, "customerName" | "title"> | null) {
  if (!job?.title) return "No job";

  return [job.title, job.customerName].filter(Boolean).join(" - ");
}

function getTimeEntryChanges(request: TimeEntryRequestRow) {
  const current = request.currentEntry;

  if (!current || request.action !== "Update") return [];

  const requested: TimeEntryReviewSnapshot = request;
  const changes: Array<{ label: string; next: string; previous: string }> = [];

  if (current.workedOn !== requested.workedOn) {
    changes.push({
      label: "Date",
      previous: formatReviewDate(current.workedOn),
      next: formatReviewDate(requested.workedOn),
    });
  }

  if (current.startTime !== requested.startTime || current.endTime !== requested.endTime) {
    changes.push({
      label: "Time",
      previous: formatReviewTimeRange(current),
      next: formatReviewTimeRange(requested),
    });
  }

  if (current.deductLunch !== requested.deductLunch || current.lunchMinutes !== requested.lunchMinutes) {
    changes.push({
      label: "Lunch",
      previous: formatReviewLunch(current),
      next: formatReviewLunch(requested),
    });
  }

  if ((current.jobId ?? "") !== (requested.jobId ?? "")) {
    changes.push({
      label: "Job",
      previous: formatJobLabel(
        current.jobTitle ? { customerName: current.jobCustomerName, title: current.jobTitle } : undefined,
      ),
      next: formatJobLabel(
        requested.jobTitle ? { customerName: requested.jobCustomerName, title: requested.jobTitle } : undefined,
      ),
    });
  }

  if (current.hours !== requested.hours) {
    changes.push({
      label: "Hours",
      previous: current.hours === undefined ? "Not set" : formatHours(current.hours),
      next: requested.hours === undefined ? "Not set" : formatHours(requested.hours),
    });
  }

  if ((current.notes ?? "") !== (requested.notes ?? "")) {
    changes.push({
      label: "Notes",
      previous: formatReviewNotes(current.notes),
      next: formatReviewNotes(requested.notes),
    });
  }

  return changes;
}

function getEmployeeAccent(employeeId: string, employees: EmployeeSummary[]) {
  const employee = employees.find((candidate) => candidate.id === employeeId);
  return getStoredEmployeeAccent(employee?.accentColor, employeeId);
}

function timeToMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

type TimelineSegment = {
  endMinutes: number;
  entry: TimeEntryRow;
  isContinuation: boolean;
  startMinutes: number;
};

type TimeEntryMutationAction = (
  state: TimeTrackingMutationState,
  formData: FormData,
) => Promise<TimeTrackingMutationState>;

function TimelineSegmentPopover({
  accent,
  deleteAction,
  disabled,
  jobs,
  requiresApproval,
  segment,
  style,
  updateAction,
}: {
  accent: EmployeeAccent;
  deleteAction: TimeEntryMutationAction;
  disabled: boolean;
  jobs: JobOption[];
  requiresApproval: boolean;
  segment: TimelineSegment;
  style: React.CSSProperties;
  updateAction: TimeEntryMutationAction;
}) {
  const [open, setOpen] = React.useState(false);
  const pinned = React.useRef(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const entry = segment.entry;
  const sourceDay = format(parseISO(entry.workedOn), "EEEE");
  const displayedStart = segment.isContinuation ? "12:00 AM" : formatTime12(entry.startTime);
  const displayedEnd = segment.isContinuation ? formatTime12(entry.endTime) : formatTime12(entry.endTime);

  React.useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function showPreview() {
    cancelClose();
    setOpen(true);
  }

  function scheduleClose() {
    cancelClose();
    if (pinned.current) return;
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  }

  return (
    <>
      <span className={cn("absolute inset-y-0 rounded-sm", accent.fill)} style={style} aria-hidden="true" />
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) pinned.current = false;
        }}
      >
        <PopoverAnchor asChild>
          <button
            type="button"
            className="absolute inset-y-0 z-10 min-w-6 cursor-pointer rounded-sm bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            style={{ ...style, width: `max(${String(style.width)}, 24px)` }}
            aria-label={`View ${entry.employeeName}'s ${displayedStart} to ${displayedEnd} shift`}
            onMouseEnter={showPreview}
            onMouseLeave={scheduleClose}
            onFocus={showPreview}
            onBlur={scheduleClose}
            onClick={() => {
              cancelClose();
              pinned.current = !pinned.current;
              setOpen(pinned.current);
            }}
          />
        </PopoverAnchor>
        <PopoverContent
          side="top"
          align="center"
          className="w-72"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">{entry.employeeName}</div>
              <div className="text-muted-foreground text-xs">Employee #{entry.employeeNumber}</div>
            </div>
            <Badge variant="secondary" className={cn("shrink-0", accent.text)}>
              {formatHours(entry.hours)} paid
            </Badge>
          </div>
          <div className="grid gap-1 rounded-md bg-muted/50 p-2 text-xs">
            <div className="font-medium">
              {displayedStart} - {displayedEnd}
              {!segment.isContinuation && entry.endTime && entry.startTime && entry.endTime < entry.startTime
                ? " (+1 day)"
                : ""}
            </div>
            {segment.isContinuation ? <div className="text-muted-foreground">Continued from {sourceDay}</div> : null}
            {entry.deductLunch ? (
              <div className="text-muted-foreground">Lunch deducted: {entry.lunchMinutes} minutes</div>
            ) : null}
            {entry.jobTitle ? (
              <div className="text-muted-foreground">
                {formatJobLabel({ customerName: entry.jobCustomerName, title: entry.jobTitle })}
              </div>
            ) : null}
            {entry.notes ? <div className="text-muted-foreground">{entry.notes}</div> : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {entry.endTime && entry.startTime && entry.endTime < entry.startTime ? (
              <Badge variant="outline" className="text-[10px]">
                Overnight
              </Badge>
            ) : null}
            {entry.hours > 12 ? (
              <Badge variant="destructive" className="text-[10px]">
                Long shift
              </Badge>
            ) : null}
            {entry.hours > 6 && !entry.deductLunch ? (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">
                No break
              </Badge>
            ) : null}
            <div className="ml-auto">
              <EditHoursDialog
                action={updateAction}
                deleteAction={deleteAction}
                entry={entry}
                jobs={jobs}
                disabled={disabled}
                requiresApproval={requiresApproval}
                trigger={
                  <Button type="button" size="sm" disabled={disabled}>
                    <Pencil /> Edit shift
                  </Button>
                }
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

function DayTimeline({
  accent,
  deleteAction,
  disabled,
  jobs,
  requiresApproval,
  segments,
  updateAction,
}: {
  accent: EmployeeAccent;
  deleteAction: TimeEntryMutationAction;
  disabled: boolean;
  jobs: JobOption[];
  requiresApproval: boolean;
  segments: TimelineSegment[];
  updateAction: TimeEntryMutationAction;
}) {
  return (
    <div className="relative h-5 overflow-hidden rounded-md border bg-background">
      {segments.map((segment) => {
        const left = (segment.startMinutes / (24 * 60)) * 100;
        const width = ((segment.endMinutes - segment.startMinutes) / (24 * 60)) * 100;

        return (
          <TimelineSegmentPopover
            key={`${segment.entry.id}-${segment.isContinuation ? "continuation" : "origin"}`}
            accent={accent}
            deleteAction={deleteAction}
            disabled={disabled}
            jobs={jobs}
            requiresApproval={requiresApproval}
            segment={segment}
            style={{ left: `${left}%`, width: `${width}%` }}
            updateAction={updateAction}
          />
        );
      })}
      {Array.from({ length: 23 }, (_, index) => {
        const hour = index + 1;
        return (
          <span
            key={hour}
            className={cn(
              "pointer-events-none absolute inset-y-0 z-20 border-l",
              hour % 6 === 0 ? "border-foreground/20" : "border-foreground/8",
            )}
            style={{ left: `${(hour / 24) * 100}%` }}
          />
        );
      })}
    </div>
  );
}

function TimelineScale() {
  return (
    <div className="flex justify-between px-0.5 text-[10px] text-muted-foreground" aria-hidden="true">
      <span>12 AM</span>
      <span>6 AM</span>
      <span>12 PM</span>
      <span>6 PM</span>
      <span>12 AM</span>
    </div>
  );
}

function EmployeeSelectField({ employees }: { employees: EmployeeSummary[] }) {
  if (employees.length === 1) {
    const employee = employees[0];

    return (
      <>
        <input type="hidden" name="employeeId" value={employee.id} />
        <div className="rounded-lg border bg-muted/20 p-3 text-sm">
          <div className="font-medium">{employee.name}</div>
          <div className="text-muted-foreground text-xs">Employee #{employee.employeeNumber}</div>
        </div>
      </>
    );
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="time-entry-employee">Employee</Label>
      <Select name="employeeId" required>
        <SelectTrigger id="time-entry-employee" className="w-full">
          <SelectValue placeholder="Select employee" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {employees.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                <span className="flex items-center gap-2">
                  <span
                    className={cn("size-2.5 shrink-0 rounded-full", getEmployeeAccent(employee.id, employees).dot)}
                    aria-hidden="true"
                  />
                  <span>{employee.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function JobSelectField({ defaultJobId, jobs }: { defaultJobId?: string; jobs: JobOption[] }) {
  if (!jobs.length) return null;

  return (
    <div className="grid gap-2">
      <Label htmlFor={defaultJobId ? `time-entry-job-${defaultJobId}` : "time-entry-job"}>Job</Label>
      <Select name="jobId" defaultValue={defaultJobId ?? "none"}>
        <SelectTrigger id={defaultJobId ? `time-entry-job-${defaultJobId}` : "time-entry-job"} className="w-full">
          <SelectValue placeholder="No job" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          className="max-h-[min(18rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]"
        >
          <SelectGroup>
            <SelectItem value="none">No job</SelectItem>
            {jobs.map((job) => (
              <SelectItem key={job.id} value={job.id} className="whitespace-normal pr-8">
                <span className="block max-w-full truncate">{formatJobLabel(job)}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function AddHoursDialog({
  action,
  date,
  employees,
  jobs,
  requiresApproval = false,
  trigger,
}: {
  action: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  date: string;
  employees: EmployeeSummary[];
  jobs: JobOption[];
  requiresApproval?: boolean;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [deductLunch, setDeductLunch] = React.useState(true);
  const [state, setState] = React.useState(initialState);
  const [isPending, startTransition] = React.useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await action(initialState, formData);
      setState(result);

      if (result.success) {
        form.reset();
        setDeductLunch(true);
        setOpen(false);
        toast.success(result.message || (requiresApproval ? "Hours submitted for review." : "Hours saved."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log hours</DialogTitle>
          <DialogDescription>
            Add hours for {format(parseISO(date), "EEEE, MMM d")}.
            {requiresApproval ? " This request will need manager review before it changes your timesheet." : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <input type="hidden" name="workedOn" value={date} />
          <EmployeeSelectField employees={employees} />
          <JobSelectField jobs={jobs} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="time-entry-start">Start time</Label>
              <Input id="time-entry-start" name="startTime" type="time" defaultValue="08:00" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time-entry-end">End time</Label>
              <Input id="time-entry-end" name="endTime" type="time" defaultValue="17:00" required />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            For an overnight shift, choose an end time earlier than the start time.
          </p>
          <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="deductLunch"
                value="true"
                checked={deductLunch}
                onChange={(event) => setDeductLunch(event.target.checked)}
              />
              Deduct lunch
            </label>
            <div className="grid gap-2">
              <Label htmlFor="time-entry-lunch">Lunch minutes</Label>
              <Input
                id="time-entry-lunch"
                name="lunchMinutes"
                type="number"
                min="0"
                max="240"
                step="15"
                defaultValue="60"
                disabled={!deductLunch}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="time-entry-notes">Notes</Label>
            <Textarea
              id="time-entry-notes"
              name="notes"
              maxLength={1000}
              placeholder="Optional notes about the day..."
            />
          </div>
          {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : requiresApproval ? "Submit for review" : "Save hours"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditHoursDialog({
  action,
  deleteAction,
  disabled = false,
  entry,
  jobs,
  requiresApproval = false,
  trigger,
}: {
  action: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  deleteAction: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  disabled?: boolean;
  entry: TimeEntryRow;
  jobs: JobOption[];
  requiresApproval?: boolean;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [deductLunch, setDeductLunch] = React.useState(entry.deductLunch);
  const [state, setState] = React.useState(initialState);
  const [isPending, startTransition] = React.useTransition();
  const fallbackStartTime = entry.startTime ?? "09:00";
  const fallbackEndTime = entry.endTime ?? addMinutesToTime(fallbackStartTime, Math.round(entry.hours * 60));

  React.useEffect(() => {
    if (open) {
      setState(initialState);
      setDeductLunch(entry.deductLunch);
    }
  }, [entry.deductLunch, open]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await action(initialState, formData);
      setState(result);

      if (result.success) {
        setOpen(false);
        toast.success(result.message || (requiresApproval ? "Hours update submitted for review." : "Hours updated."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${entry.employeeName} hours`} disabled={disabled}>
            <Pencil />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit hours</DialogTitle>
          <DialogDescription>
            Update {entry.employeeName} on {format(parseISO(entry.workedOn), "EEEE, MMM d")}.
            {requiresApproval ? " Changes from this portal require manager review before they take effect." : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <input type="hidden" name="entryId" value={entry.id} />
          <JobSelectField defaultJobId={entry.jobId} jobs={jobs} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`time-entry-start-${entry.id}`}>Start time</Label>
              <Input
                id={`time-entry-start-${entry.id}`}
                name="startTime"
                type="time"
                defaultValue={fallbackStartTime}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`time-entry-end-${entry.id}`}>End time</Label>
              <Input
                id={`time-entry-end-${entry.id}`}
                name="endTime"
                type="time"
                defaultValue={fallbackEndTime}
                required
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            An end time earlier than the start time is treated as the next day.
          </p>
          <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="deductLunch"
                value="true"
                checked={deductLunch}
                onChange={(event) => setDeductLunch(event.target.checked)}
              />
              Deduct lunch
            </label>
            <div className="grid gap-2">
              <Label htmlFor={`time-entry-lunch-${entry.id}`}>Lunch minutes</Label>
              <Input
                id={`time-entry-lunch-${entry.id}`}
                name="lunchMinutes"
                type="number"
                min="0"
                max="240"
                step="15"
                defaultValue={entry.lunchMinutes || 60}
                disabled={!deductLunch}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`time-entry-notes-${entry.id}`}>Notes</Label>
            <Textarea
              id={`time-entry-notes-${entry.id}`}
              name="notes"
              maxLength={1000}
              defaultValue={entry.notes ?? ""}
            />
          </div>
          {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
          <DialogFooter>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <DeleteHoursDialog action={deleteAction} entry={entry} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : requiresApproval ? "Submit for review" : "Save hours"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteHoursDialog({
  action,
  entry,
}: {
  action: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  entry: TimeEntryRow;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState(initialState);
  const [isPending, startTransition] = React.useTransition();

  function handleDelete() {
    const formData = new FormData();
    formData.set("entryId", entry.id);

    startTransition(async () => {
      const result = await action(initialState, formData);
      setState(result);

      if (result.success) {
        setOpen(false);
        toast.success(result.message || "Hours deleted.");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="icon-sm" variant="destructive" aria-label={`Delete ${entry.employeeName} hours`}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete these hours?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {formatHours(entry.hours)} for {entry.employeeName} on{" "}
            {format(parseISO(entry.workedOn), "MMM d")}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReviewTimeRequestButtons({
  approveAction,
  hasConflict = false,
  rejectAction,
  requestAction,
  requestId,
  vertical = false,
}: {
  approveAction: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  hasConflict?: boolean;
  rejectAction: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  requestAction: string;
  requestId: string;
  vertical?: boolean;
}) {
  const [approveState, approveFormAction, isApproving] = React.useActionState(approveAction, initialState);
  const [rejectState, rejectFormAction, isRejecting] = React.useActionState(rejectAction, initialState);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const approvalDisabled = [isApproving, isRejecting, hasConflict, requestAction === "Delete" && !confirmDelete].some(
    Boolean,
  );
  const message = !approveState.success ? approveState.message : !rejectState.success ? rejectState.message : "";

  React.useEffect(() => {
    if (!approveState.success) return;
    toast.success(approveState.message || "Time request approved.");
  }, [approveState]);

  React.useEffect(() => {
    if (!rejectState.success) return;
    toast.success(rejectState.message || "Time request rejected.");
  }, [rejectState]);

  return (
    <div className="grid gap-2">
      {requestAction === "Delete" ? (
        <label className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-900 text-sm">
          <input
            className="mt-0.5"
            type="checkbox"
            checked={confirmDelete}
            onChange={(event) => setConfirmDelete(event.target.checked)}
          />
          I understand approval permanently removes the current time entry. The audit record will remain.
        </label>
      ) : null}
      <div className={cn("flex gap-2", vertical ? "flex-col sm:flex-row" : "")}>
        <form action={approveFormAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <Button
            size="sm"
            variant={requestAction === "Delete" ? "destructive" : "default"}
            className={vertical ? "w-full sm:w-auto" : undefined}
            disabled={approvalDisabled}
          >
            {isApproving ? "Approving..." : requestAction === "Delete" ? "Approve deletion" : "Approve"}
          </Button>
        </form>
        <form action={rejectFormAction} className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input type="hidden" name="requestId" value={requestId} />
          <Input name="reason" placeholder="Reason for rejection (optional)" maxLength={500} />
          <Button
            size="sm"
            variant="outline"
            className={vertical ? "w-full sm:w-auto" : undefined}
            disabled={isApproving || isRejecting}
          >
            {isRejecting ? "Rejecting..." : "Reject"}
          </Button>
        </form>
      </div>
      {hasConflict ? (
        <p className="flex items-center gap-1.5 text-amber-700 text-xs">
          <AlertTriangle className="size-3.5" /> The original entry changed after submission. Reject this request and
          ask the employee to resubmit from the latest entry.
        </p>
      ) : null}
      {message ? <p className="text-destructive text-xs">{message}</p> : null}
    </div>
  );
}

function ReviewTimeRequestDialog({
  approveAction,
  open,
  onOpenChange,
  rejectAction,
  request,
}: {
  approveAction: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  rejectAction: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  request: TimeEntryRequestRow;
}) {
  const changes = getTimeEntryChanges(request);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Review
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className={cn("size-3 shrink-0 rounded-full", getStoredEmployeeAccent(request.employeeAccentColor).dot)}
              aria-hidden="true"
            />
            Review time change
          </DialogTitle>
          <DialogDescription>
            {request.employeeName} #{request.employeeNumber} sent a {request.action.toLowerCase()} request on{" "}
            {format(parseISO(request.requestedAt), "MMM d, h:mm a")}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {request.hasConflict ? (
            <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              This entry was edited after the employee submitted the request. Approval is disabled to prevent
              overwriting newer manager changes.
            </div>
          ) : null}
          {request.action === "Delete" ? (
            <div className="flex gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-rose-950 text-sm">
              <Trash2 className="mt-0.5 size-4 shrink-0" />
              This is a destructive request. Approval removes the current entry but preserves an audit snapshot.
            </div>
          ) : null}
          {changes.length ? (
            <div className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm">
              <div className="font-medium text-amber-900">Changed fields</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {changes.map((change) => (
                  <div key={change.label} className="grid gap-1 rounded-md bg-background/70 p-2">
                    <span className="font-medium text-xs">{change.label}</span>
                    <span className="text-muted-foreground text-xs line-through">{change.previous}</span>
                    <span className="font-medium text-amber-900 text-xs">{change.next}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {request.currentEntry ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <TimeReviewSnapshot label="Current" snapshot={request.currentEntry} />
              <TimeReviewSnapshot label="Requested" snapshot={request} tone="requested" />
            </div>
          ) : (
            <TimeReviewSnapshot
              label={request.action === "Delete" ? "Delete request" : "Requested"}
              snapshot={request}
              tone="requested"
            />
          )}
          <ReviewTimeRequestButtons
            approveAction={approveAction}
            hasConflict={request.hasConflict}
            rejectAction={rejectAction}
            requestAction={request.action}
            requestId={request.id}
            vertical
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PendingTimeRequestsCard({
  approveAction,
  pendingRequests,
  rejectAction,
  selectedRequestId,
}: {
  approveAction: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  pendingRequests: TimeEntryRequestRow[];
  rejectAction: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  selectedRequestId?: string;
}) {
  const router = useRouter();
  const selectedRequestExists = pendingRequests.some((request) => request.id === selectedRequestId);
  const [openRequestId, setOpenRequestId] = React.useState<string | null>(
    selectedRequestExists ? (selectedRequestId ?? null) : null,
  );

  React.useEffect(() => {
    setOpenRequestId(selectedRequestExists ? (selectedRequestId ?? null) : null);
  }, [selectedRequestExists, selectedRequestId]);

  function handleRequestOpenChange(requestId: string, open: boolean) {
    setOpenRequestId(open ? requestId : null);

    if (!open && selectedRequestId === requestId) {
      router.replace("/dashboard/time-tracking");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Pending Reviews</CardTitle>
            <CardDescription>Approve or reject employee-submitted time changes.</CardDescription>
          </div>
          {pendingRequests.length ? <Badge variant="secondary">{pendingRequests.length}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {pendingRequests.length ? (
          <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
            {pendingRequests.map((request) => {
              const changes = getTimeEntryChanges(request);
              const changeSummary =
                changes.length > 0
                  ? changes.map((change) => change.label).join(", ")
                  : request.action === "Create"
                    ? "New time entry"
                    : request.action === "Delete"
                      ? "Delete existing entry"
                      : "No differences found";

              return (
                <div
                  key={request.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        "mt-1 size-2.5 shrink-0 rounded-full",
                        getStoredEmployeeAccent(request.employeeAccentColor).dot,
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-sm">
                        {request.employeeName} #{request.employeeNumber}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {request.action} · {changeSummary}
                      </div>
                      {request.hasConflict ? (
                        <div className="text-amber-700 text-xs">Conflict—entry changed</div>
                      ) : null}
                      <div className="text-[11px] text-muted-foreground">
                        {format(parseISO(request.requestedAt), "MMM d, h:mm a")}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {request.hours ? <Badge variant="secondary">{formatHours(request.hours)}</Badge> : null}
                    <ReviewTimeRequestDialog
                      approveAction={approveAction}
                      open={openRequestId === request.id}
                      onOpenChange={(open) => handleRequestOpenChange(request.id, open)}
                      rejectAction={rejectAction}
                      request={request}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/20 p-3 text-center text-muted-foreground text-sm">
            No employee requests waiting for review.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TimeReviewSnapshot({
  label,
  snapshot,
  tone = "current",
}: {
  label: string;
  snapshot: TimeEntryReviewSnapshot;
  tone?: "current" | "requested";
}) {
  return (
    <div
      className={cn(
        "grid gap-1 rounded-md border p-2 text-xs",
        tone === "requested" ? "border-emerald-200 bg-emerald-50/70" : "bg-background/70",
      )}
    >
      <div className={cn("font-medium", tone === "requested" ? "text-emerald-900" : "text-foreground")}>{label}</div>
      <div className="grid gap-0.5 text-muted-foreground">
        <span>{formatReviewDate(snapshot.workedOn)}</span>
        <span>{formatReviewTimeRange(snapshot)}</span>
        <span>{formatReviewLunch(snapshot)}</span>
        <span>{snapshot.hours === undefined ? "Hours not set" : formatHours(snapshot.hours)}</span>
        {snapshot.jobTitle ? (
          <span>{formatJobLabel({ customerName: snapshot.jobCustomerName, title: snapshot.jobTitle })}</span>
        ) : null}
        {snapshot.notes ? <span className="text-foreground">{snapshot.notes}</span> : null}
      </div>
    </div>
  );
}

function RequestStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        status === "Approved" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        status === "Rejected" && "border-rose-200 bg-rose-50 text-rose-700",
        status === "Pending" && "border-amber-200 bg-amber-50 text-amber-700",
      )}
    >
      {status}
    </Badge>
  );
}

function EditEmployeeRequestDialog({
  action,
  request,
}: {
  action: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  request: TimeEntryRequestRow;
}) {
  const [open, setOpen] = React.useState(false);
  const [deductLunch, setDeductLunch] = React.useState(request.deductLunch);
  const [state, setState] = React.useState(initialState);
  const [isPending, startTransition] = React.useTransition();
  const fallbackStartTime = request.startTime ?? "09:00";
  const fallbackEndTime = request.endTime ?? addMinutesToTime(fallbackStartTime, Math.round((request.hours ?? 8) * 60));

  React.useEffect(() => {
    if (open) {
      setState(initialState);
      setDeductLunch(request.deductLunch);
    }
  }, [open, request.deductLunch]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await action(initialState, formData);
      setState(result);

      if (result.success) {
        setOpen(false);
        toast.success(result.message || "Request updated.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit request</DialogTitle>
          <DialogDescription>
            Update this pending request before your manager reviews it. The approved timesheet will not change yet.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="jobId" value={request.jobId ?? "none"} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`request-start-${request.id}`}>Start time</Label>
              <Input
                id={`request-start-${request.id}`}
                name="startTime"
                type="time"
                defaultValue={fallbackStartTime}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`request-end-${request.id}`}>End time</Label>
              <Input
                id={`request-end-${request.id}`}
                name="endTime"
                type="time"
                defaultValue={fallbackEndTime}
                required
              />
            </div>
          </div>
          <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="deductLunch"
                value="true"
                checked={deductLunch}
                onChange={(event) => setDeductLunch(event.target.checked)}
              />
              Deduct lunch
            </label>
            <div className="grid gap-2">
              <Label htmlFor={`request-lunch-${request.id}`}>Lunch minutes</Label>
              <Input
                id={`request-lunch-${request.id}`}
                name="lunchMinutes"
                type="number"
                min="0"
                step="15"
                defaultValue={request.lunchMinutes || 60}
                disabled={!deductLunch}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`request-notes-${request.id}`}>Notes</Label>
            <Textarea id={`request-notes-${request.id}`} name="notes" defaultValue={request.notes ?? ""} />
          </div>
          {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelEmployeeRequestDialog({
  action,
  request,
}: {
  action: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  request: TimeEntryRequestRow;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState(initialState);
  const [isPending, startTransition] = React.useTransition();

  function handleCancelRequest() {
    const formData = new FormData();
    formData.set("requestId", request.id);

    startTransition(async () => {
      const result = await action(initialState, formData);
      setState(result);

      if (result.success) {
        setOpen(false);
        toast.success(result.message || "Request canceled.");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the pending {request.action.toLowerCase()} request before your manager reviews it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep request</AlertDialogCancel>
          <Button type="button" variant="destructive" onClick={handleCancelRequest} disabled={isPending}>
            {isPending ? "Canceling..." : "Cancel request"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EmployeeRequestsCard({
  deleteAction,
  requests,
  updateAction,
}: {
  deleteAction?: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  requests: TimeEntryRequestRow[];
  updateAction?: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
}) {
  const pendingRequests = requests.filter((request) => request.status === "Pending");
  const historyRequests = requests.filter((request) => request.status !== "Pending");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">My Requests</CardTitle>
            <CardDescription>Track pending and reviewed time changes.</CardDescription>
          </div>
          {pendingRequests.length ? <Badge variant="secondary">{pendingRequests.length} pending</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 overflow-hidden">
        <div className="grid gap-2">
          <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Pending</div>
          {pendingRequests.length ? (
            pendingRequests.map((request) => (
              <EmployeeRequestRow
                key={request.id}
                deleteAction={deleteAction}
                request={request}
                updateAction={updateAction}
              />
            ))
          ) : (
            <div className="rounded-md border bg-muted/20 p-3 text-muted-foreground text-sm">
              You do not have any pending requests.
            </div>
          )}
        </div>
        <div className="grid gap-2">
          <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">History</div>
          {historyRequests.length ? (
            <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
              {historyRequests.map((request) => (
                <EmployeeRequestRow key={request.id} request={request} />
              ))}
            </div>
          ) : (
            <div className="rounded-md border bg-muted/20 p-3 text-muted-foreground text-sm">
              Reviewed requests will show here.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeeRequestRow({
  deleteAction,
  request,
  updateAction,
}: {
  deleteAction?: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  request: TimeEntryRequestRow;
  updateAction?: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
}) {
  const canEdit = request.status === "Pending" && request.action !== "Delete" && updateAction;
  const canCancel = request.status === "Pending" && deleteAction;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden rounded-lg border bg-muted/20 p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn("size-2.5 shrink-0 rounded-full", getStoredEmployeeAccent(request.employeeAccentColor).dot)}
              aria-hidden="true"
            />
            <span className="font-medium text-sm">{request.action} request</span>
            <RequestStatusBadge status={request.status} />
          </div>
          <div className="text-muted-foreground text-xs">
            {request.workedOn ? format(parseISO(request.workedOn), "MMM d") : "No date"} ·{" "}
            {formatReviewTimeRange(request)}
          </div>
          <div className="text-muted-foreground text-xs">
            {formatReviewLunch(request)} · {request.hours === undefined ? "Hours not set" : formatHours(request.hours)}
          </div>
          {request.jobTitle ? (
            <div className="text-muted-foreground text-xs">
              {formatJobLabel({ customerName: request.jobCustomerName, title: request.jobTitle })}
            </div>
          ) : null}
          {request.reviewedAt ? (
            <div className="text-[11px] text-muted-foreground">
              Reviewed {format(parseISO(request.reviewedAt), "MMM d, h:mm a")}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">
              Submitted {format(parseISO(request.requestedAt), "MMM d, h:mm a")}
            </div>
          )}
          {request.reviewReason ? (
            <div className="mt-1 text-foreground text-xs">Manager note: {request.reviewReason}</div>
          ) : null}
        </div>
        {request.hours ? <Badge variant="secondary">{formatHours(request.hours)}</Badge> : null}
      </div>
      {canEdit || canCancel ? (
        <div className="flex flex-wrap justify-end gap-2">
          {canEdit ? <EditEmployeeRequestDialog action={updateAction} request={request} /> : null}
          {canCancel ? <CancelEmployeeRequestDialog action={deleteAction} request={request} /> : null}
        </div>
      ) : null}
    </div>
  );
}

type FilterOption = {
  description?: string;
  label: string;
  value: string;
};

function FilterCombobox({
  allLabel,
  emptyLabel,
  label,
  onValueChange,
  options,
  searchPlaceholder,
  value,
}: {
  allLabel: string;
  emptyLabel: string;
  label: string;
  onValueChange: (value: string) => void;
  options: FilterOption[];
  searchPlaceholder: string;
  value: string;
}) {
  const [open, setOpen] = React.useState(false);
  const fieldId = React.useId();
  const selected = options.find((option) => option.value === value);

  function select(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
  }

  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={fieldId} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <Popover modal open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={fieldId}
            type="button"
            variant="outline"
            role="combobox"
            aria-label={`${label} filter`}
            aria-expanded={open}
            className="w-full justify-between bg-background font-normal"
          >
            <span className="truncate">{selected?.label ?? allLabel}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 overflow-hidden p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup>
                <CommandItem value={allLabel} onSelect={() => select("all")}>
                  <Check className={cn("size-4", value === "all" ? "opacity-100" : "opacity-0")} />
                  {allLabel}
                </CommandItem>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.description ?? ""}`}
                    onSelect={() => select(option.value)}
                  >
                    <Check className={cn("size-4", value === option.value ? "opacity-100" : "opacity-0")} />
                    <span className="grid min-w-0">
                      <span className="truncate">{option.label}</span>
                      {option.description ? (
                        <span className="truncate text-muted-foreground text-xs">{option.description}</span>
                      ) : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 py-1 pr-1 pl-2 font-normal">
      <span className="max-w-44 truncate">{label}</span>
      <button
        type="button"
        className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
        aria-label={`Remove ${label} filter`}
        onClick={onRemove}
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}

function TimesheetLockButton({
  action,
  locked,
  weekStart,
}: {
  action: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  locked: boolean;
  weekStart: string;
}) {
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (state.success) toast.success(state.message);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="weekStart" value={weekStart} />
      <Button type="submit" variant={locked ? "outline" : "secondary"} size="sm" disabled={isPending}>
        {locked ? <LockOpen /> : <Lock />}
        {isPending ? "Updating..." : locked ? "Unlock" : "Lock"}
      </Button>
      {state.message && !state.success ? <p className="mt-1 text-destructive text-xs">{state.message}</p> : null}
    </form>
  );
}

function TimeEntryAuditCard({ events }: { events: TimeEntryAuditRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent activity</CardTitle>
        <CardDescription>Immutable manager and approved-request changes.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length ? (
          <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
            {events.map((event) => (
              <div key={event.id} className="rounded-md border bg-muted/20 p-2 text-xs">
                <div className="font-medium">
                  {event.action} · {event.employeeName} #{event.employeeNumber}
                </div>
                <div className="text-muted-foreground">
                  {event.source === "EmployeeRequest" ? "Approved employee request" : "Manager change"} ·{" "}
                  {format(parseISO(event.createdAt), "MMM d, h:mm a")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/20 p-3 text-muted-foreground text-sm">No audited changes yet.</div>
        )}
      </CardContent>
    </Card>
  );
}

export function TimeTrackingDashboard({
  approveTimeEntryRequestAction,
  auditEvents = [],
  carryInEntries = [],
  canExport = false,
  canManage = true,
  createTimeEntryAction,
  dayGroups,
  deleteEmployeeTimeRequestAction,
  deleteTimeEntryAction,
  employeeLogoutAction,
  employeeTimeRequests = [],
  employees,
  headerDescription,
  isWeekLocked = false,
  jobs,
  lockTimesheetWeekAction,
  monthLabel,
  nextWeekHref,
  pendingRequests = [],
  periodLabel,
  previousWeekHref,
  rejectTimeEntryRequestAction,
  requiresManagerApproval = false,
  secondaryStatLabel = "Active employees",
  secondaryStatValue,
  selectedRequestId,
  showEmployeeControls = true,
  updateEmployeeTimeRequestAction,
  updateTimeEntryAction,
  unlockTimesheetWeekAction,
  weekStart,
}: {
  approveTimeEntryRequestAction?: (
    state: TimeTrackingMutationState,
    formData: FormData,
  ) => Promise<TimeTrackingMutationState>;
  auditEvents?: TimeEntryAuditRow[];
  carryInEntries?: TimeEntryRow[];
  canExport?: boolean;
  canManage?: boolean;
  createTimeEntryAction: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  createEmployeeAction?: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  dayGroups: DayGroup[];
  deleteEmployeeTimeRequestAction?: (
    state: TimeTrackingMutationState,
    formData: FormData,
  ) => Promise<TimeTrackingMutationState>;
  deleteEmployeeAction?: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  deleteTimeEntryAction: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  employeeLogoutAction?: () => Promise<void>;
  employeeTimeRequests?: TimeEntryRequestRow[];
  employees: EmployeeSummary[];
  jobs: JobOption[];
  headerDescription?: string;
  isWeekLocked?: boolean;
  monthLabel: string;
  lockTimesheetWeekAction?: (
    state: TimeTrackingMutationState,
    formData: FormData,
  ) => Promise<TimeTrackingMutationState>;
  nextWeekHref: string;
  pendingRequests?: TimeEntryRequestRow[];
  periodLabel: string;
  previousWeekHref: string;
  rejectTimeEntryRequestAction?: (
    state: TimeTrackingMutationState,
    formData: FormData,
  ) => Promise<TimeTrackingMutationState>;
  requiresManagerApproval?: boolean;
  secondaryStatLabel?: string;
  secondaryStatValue?: string;
  selectedRequestId?: string;
  showEmployeeControls?: boolean;
  updateEmployeeTimeRequestAction?: (
    state: TimeTrackingMutationState,
    formData: FormData,
  ) => Promise<TimeTrackingMutationState>;
  updateEmployeeAction?: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  updateTimeEntryAction: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  unlockTimesheetWeekAction?: (
    state: TimeTrackingMutationState,
    formData: FormData,
  ) => Promise<TimeTrackingMutationState>;
  weekStart?: string;
}) {
  const router = useRouter();
  const [employeeFilter, setEmployeeFilter] = React.useState("all");
  const [jobFilter, setJobFilter] = React.useState("all");
  const [departmentFilter, setDepartmentFilter] = React.useState("all");
  const [attentionOnly, setAttentionOnly] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [filtersReady, setFiltersReady] = React.useState(false);
  const initializedFilters = React.useRef(false);
  const allEntries = dayGroups.flatMap((group) => group.entries);
  const employeeWeekTotals = new Map<string, number>();
  for (const entry of allEntries) {
    employeeWeekTotals.set(entry.employeeId, (employeeWeekTotals.get(entry.employeeId) ?? 0) + entry.hours);
  }
  function entryNeedsAttention(entry: TimeEntryRow) {
    return (
      entry.hours > 12 ||
      (entry.hours > 6 && !entry.deductLunch) ||
      (employeeWeekTotals.get(entry.employeeId) ?? 0) > 40
    );
  }

  const entries = allEntries.filter((entry) => {
    const employee = employees.find((candidate) => candidate.id === entry.employeeId);
    return (
      (employeeFilter === "all" || entry.employeeId === employeeFilter) &&
      (jobFilter === "all" || (jobFilter === "none" ? !entry.jobId : entry.jobId === jobFilter)) &&
      (departmentFilter === "all" || (employee?.department ?? "Unassigned") === departmentFilter) &&
      (!attentionOnly || entryNeedsAttention(entry))
    );
  });
  const overnightContinuations = new Map<string, TimeEntryRow[]>();
  for (const entry of [...carryInEntries, ...entries]) {
    if (employeeFilter !== "all" && entry.employeeId !== employeeFilter) {
      continue;
    }
    if (jobFilter !== "all" && (jobFilter === "none" ? Boolean(entry.jobId) : entry.jobId !== jobFilter)) continue;
    const employee = employees.find((candidate) => candidate.id === entry.employeeId);
    if (departmentFilter !== "all" && (employee?.department ?? "Unassigned") !== departmentFilter) continue;
    if (attentionOnly && !entryNeedsAttention(entry)) continue;
    if (!entry.startTime || !entry.endTime || entry.endTime >= entry.startTime) continue;

    const continuationDate = format(addDays(parseISO(entry.workedOn), 1), "yyyy-MM-dd");
    const continuations = overnightContinuations.get(continuationDate) ?? [];
    continuations.push(entry);
    overnightContinuations.set(continuationDate, continuations);
  }
  const filteredDayGroups = dayGroups.map((group) => {
    const filteredEntries = group.entries.filter((entry) => entries.some((candidate) => candidate.id === entry.id));
    return {
      ...group,
      entries: filteredEntries,
      totalHours: filteredEntries.reduce((total, entry) => total + entry.hours, 0),
    };
  });
  const weekHours = entries.reduce((total, entry) => total + entry.hours, 0);
  const activeEmployees = employees.filter((employee) => employee.active);
  const activeEmployeesWithHours = activeEmployees.filter(
    (employee) => (employeeWeekTotals.get(employee.id) ?? 0) > 0,
  ).length;
  const departments = Array.from(new Set(employees.map((employee) => employee.department ?? "Unassigned"))).sort();
  const attentionCount =
    allEntries.filter(entryNeedsAttention).length +
    employees.filter((employee) => employee.active && (employeeWeekTotals.get(employee.id) ?? 0) === 0).length;
  const activeFilterCount =
    Number(employeeFilter !== "all") +
    Number(jobFilter !== "all") +
    Number(departmentFilter !== "all") +
    Number(attentionOnly);
  const weeklyEmployees = employees
    .map((employee) => {
      const employeeEntries = entries.filter((entry) => entry.employeeId === employee.id);
      const lastWorkedOn = employeeEntries.at(-1)?.workedOn;

      return {
        ...employee,
        lastWorkedOn,
        totalHours: employeeEntries.reduce((total, entry) => total + entry.hours, 0),
      };
    })
    .filter((employee) => employeeFilter === "all" || employee.id === employeeFilter)
    .filter((employee) => departmentFilter === "all" || (employee.department ?? "Unassigned") === departmentFilter)
    .filter((employee) => jobFilter === "all" || employee.totalHours > 0)
    .filter(
      (employee) =>
        !attentionOnly ||
        (employee.active && employee.totalHours === 0) ||
        employee.totalHours > 40 ||
        entries.some((entry) => entry.employeeId === employee.id && entryNeedsAttention(entry)),
    )
    .filter((employee) => employee.totalHours > 0);
  const missingTimeEmployees = employees
    .filter((employee) => employee.active && (employeeWeekTotals.get(employee.id) ?? 0) === 0)
    .filter((employee) => employeeFilter === "all" || employee.id === employeeFilter)
    .filter((employee) => departmentFilter === "all" || (employee.department ?? "Unassigned") === departmentFilter)
    .filter(() => jobFilter === "all");
  const employeeOptions: FilterOption[] = employees.map((employee) => ({
    description: `#${employee.employeeNumber}${employee.active ? "" : " · Inactive"}`,
    label: employee.name,
    value: employee.id,
  }));
  const jobOptions: FilterOption[] = [
    { label: "No job", value: "none" },
    ...jobs.map((job) => ({
      description: job.customerName,
      label: job.title,
      value: job.id,
    })),
  ];
  const departmentOptions: FilterOption[] = departments.map((department) => ({
    label: department,
    value: department,
  }));

  React.useEffect(() => {
    if (initializedFilters.current || !showEmployeeControls) return;
    const params = new URLSearchParams(window.location.search);
    const requestedEmployee = params.get("employee");
    const requestedJob = params.get("job");
    const requestedDepartment = params.get("department");
    if (requestedEmployee && employees.some((employee) => employee.id === requestedEmployee)) {
      setEmployeeFilter(requestedEmployee);
    }
    if (requestedJob && (requestedJob === "none" || jobs.some((job) => job.id === requestedJob))) {
      setJobFilter(requestedJob);
    }
    if (requestedDepartment && departments.includes(requestedDepartment)) {
      setDepartmentFilter(requestedDepartment);
    }
    setAttentionOnly(params.get("attention") === "1");
    initializedFilters.current = true;
    setFiltersReady(true);
  }, [departments, employees, jobs, showEmployeeControls]);

  React.useEffect(() => {
    if (!filtersReady || !showEmployeeControls) return;
    const url = new URL(window.location.href);
    const setOrDelete = (key: string, value: string, defaultValue = "all") => {
      if (value === defaultValue) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    };
    setOrDelete("employee", employeeFilter);
    setOrDelete("job", jobFilter);
    setOrDelete("department", departmentFilter);
    if (attentionOnly) url.searchParams.set("attention", "1");
    else url.searchParams.delete("attention");
    window.history.replaceState(null, "", url);
  }, [attentionOnly, departmentFilter, employeeFilter, filtersReady, jobFilter, showEmployeeControls]);

  function clearFilters() {
    setEmployeeFilter("all");
    setJobFilter("all");
    setDepartmentFilter("all");
    setAttentionOnly(false);
  }

  function hrefWithFilters(href: string) {
    const url = new URL(href, "https://vadosstack.local");
    if (employeeFilter !== "all") url.searchParams.set("employee", employeeFilter);
    if (jobFilter !== "all") url.searchParams.set("job", jobFilter);
    if (departmentFilter !== "all") url.searchParams.set("department", departmentFilter);
    if (attentionOnly) url.searchParams.set("attention", "1");
    return `${url.pathname}${url.search}`;
  }

  function exportCsv() {
    const csvCell = (value: string | number | undefined) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      [
        "Date",
        "Employee",
        "Employee ID",
        "Department",
        "Start",
        "End",
        "Overnight",
        "Lunch minutes",
        "Hours",
        "Job",
        "Notes",
      ],
      ...entries.map((entry) => {
        const employee = employees.find((candidate) => candidate.id === entry.employeeId);
        return [
          entry.workedOn,
          entry.employeeName,
          entry.employeeNumber,
          employee?.department,
          entry.startTime,
          entry.endTime,
          entry.startTime && entry.endTime && entry.endTime < entry.startTime ? "Yes" : "No",
          entry.deductLunch ? entry.lunchMinutes : 0,
          entry.hours.toFixed(2),
          entry.jobTitle ? formatJobLabel({ customerName: entry.jobCustomerName, title: entry.jobTitle }) : "",
          entry.notes,
        ];
      }),
    ];
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timesheet-${weekStart ?? "week"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid max-w-2xl gap-2">
          <h1 className="flex items-center gap-2 font-semibold text-lg leading-none">
            <span>Time Tracking</span>
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Clock3 className="size-4" />
            </span>
          </h1>
          <p className="text-muted-foreground text-sm">
            {headerDescription ?? `Track employee work days and hours for ${periodLabel}.`}
          </p>
        </div>
        {showEmployeeControls ? (
          <div className="flex flex-wrap gap-2">
            {weekStart && (isWeekLocked ? unlockTimesheetWeekAction : lockTimesheetWeekAction) ? (
              <TimesheetLockButton
                action={
                  isWeekLocked
                    ? (unlockTimesheetWeekAction as NonNullable<typeof unlockTimesheetWeekAction>)
                    : (lockTimesheetWeekAction as NonNullable<typeof lockTimesheetWeekAction>)
                }
                locked={isWeekLocked}
                weekStart={weekStart}
              />
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link prefetch={false} href="/dashboard/employees">
                <UserRoundCog />
                Manage employees
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="icon-sm" aria-label="More time tracking actions">
                  <EllipsisVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Report actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!canExport || !entries.length} onSelect={exportCsv}>
                  <Download /> Export filtered CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => window.print()}>
                  <Printer /> Print report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : employeeLogoutAction ? (
          <form action={employeeLogoutAction}>
            <Button type="submit" variant="outline" size="sm">
              <LogOut />
              Log out
            </Button>
          </form>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="grid gap-1 p-4">
            <span className="text-muted-foreground text-xs">
              {activeFilterCount > 0 ? "Filtered hours" : "Hours logged"}
            </span>
            <span className="font-semibold text-2xl">{formatHours(weekHours)}</span>
            <span className="text-muted-foreground text-xs">{periodLabel}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-1 p-4">
            <span className="text-muted-foreground text-xs">{secondaryStatLabel}</span>
            <span className="font-semibold text-2xl">{secondaryStatValue ?? activeEmployees.length}</span>
            {secondaryStatValue === undefined ? (
              <span className="text-muted-foreground text-xs">
                {activeEmployeesWithHours} of {activeEmployees.length} logged time for the selected week
              </span>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div
        className={cn(
          "grid items-start gap-6",
          showEmployeeControls
            ? "xl:grid-cols-[minmax(0,1fr)_360px]"
            : "md:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]",
        )}
      >
        <Card
          className={cn(
            "order-2",
            showEmployeeControls ? "xl:order-none xl:row-span-3" : "md:order-none md:row-span-3",
          )}
        >
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Weekly Hours</CardTitle>
                <CardDescription>
                  {formatHours(weekHours)} logged for {periodLabel} · {monthLabel}.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {showEmployeeControls ? (
                  <>
                    <Button asChild variant="outline" size="sm">
                      <Link href={hrefWithFilters("/dashboard/time-tracking")}>Today</Link>
                    </Button>
                    <OptionalDatePicker
                      ariaLabel="Choose week"
                      clearable={false}
                      className="h-8 w-40 text-sm"
                      id="time-tracking-week-picker"
                      placeholder="Choose week"
                      value={weekStart ? parseISO(weekStart) : undefined}
                      onChange={(date) => {
                        if (!date) return;
                        router.push(hrefWithFilters(`/dashboard/time-tracking?week=${format(date, "yyyy-MM-dd")}`));
                      }}
                    />
                    <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant={activeFilterCount ? "secondary" : "outline"} size="sm">
                          <Filter /> Filters
                          {activeFilterCount ? (
                            <Badge variant="secondary" className="ml-0.5 bg-background px-1.5">
                              {activeFilterCount}
                            </Badge>
                          ) : null}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
                        <DialogHeader>
                          <DialogTitle>Filter weekly hours</DialogTitle>
                          <DialogDescription>
                            Showing {entries.length} of {allEntries.length} entries · {formatHours(weekHours)}. Filters
                            also apply to CSV exports.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FilterCombobox
                            allLabel="All employees"
                            emptyLabel="No employees found."
                            label="Employee"
                            onValueChange={setEmployeeFilter}
                            options={employeeOptions}
                            searchPlaceholder="Search employees..."
                            value={employeeFilter}
                          />
                          <FilterCombobox
                            allLabel="All jobs"
                            emptyLabel="No jobs found."
                            label="Job"
                            onValueChange={setJobFilter}
                            options={jobOptions}
                            searchPlaceholder="Search jobs or customers..."
                            value={jobFilter}
                          />
                          <FilterCombobox
                            allLabel="All departments"
                            emptyLabel="No departments found."
                            label="Department"
                            onValueChange={setDepartmentFilter}
                            options={departmentOptions}
                            searchPlaceholder="Search departments..."
                            value={departmentFilter}
                          />
                          <div className="grid gap-1.5">
                            <span className="font-medium text-muted-foreground text-xs">Review</span>
                            <Button
                              type="button"
                              variant={attentionOnly ? "secondary" : "outline"}
                              className={cn(
                                "justify-between bg-background font-normal",
                                attentionOnly && "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100",
                              )}
                              aria-pressed={attentionOnly}
                              onClick={() => setAttentionOnly((value) => !value)}
                            >
                              <span className="flex items-center gap-2">
                                <AlertTriangle className={cn("size-4", attentionOnly && "text-amber-600")} /> Needs
                                attention
                              </span>
                              <Badge variant="secondary" className="bg-background">
                                {attentionCount}
                              </Badge>
                            </Button>
                          </div>
                        </div>
                        {activeFilterCount ? (
                          <div className="flex flex-wrap gap-1.5 border-t pt-4">
                            {employeeFilter !== "all" ? (
                              <ActiveFilterChip
                                label={`Employee: ${employeeOptions.find((option) => option.value === employeeFilter)?.label ?? employeeFilter}`}
                                onRemove={() => setEmployeeFilter("all")}
                              />
                            ) : null}
                            {jobFilter !== "all" ? (
                              <ActiveFilterChip
                                label={`Job: ${jobOptions.find((option) => option.value === jobFilter)?.label ?? jobFilter}`}
                                onRemove={() => setJobFilter("all")}
                              />
                            ) : null}
                            {departmentFilter !== "all" ? (
                              <ActiveFilterChip
                                label={`Department: ${departmentFilter}`}
                                onRemove={() => setDepartmentFilter("all")}
                              />
                            ) : null}
                            {attentionOnly ? (
                              <ActiveFilterChip label="Needs attention" onRemove={() => setAttentionOnly(false)} />
                            ) : null}
                          </div>
                        ) : null}
                        <DialogFooter>
                          {activeFilterCount ? (
                            <Button type="button" variant="ghost" onClick={clearFilters}>
                              Clear filters
                            </Button>
                          ) : null}
                          <Button type="button" onClick={() => setFiltersOpen(false)}>
                            Done
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                ) : null}
                <Button asChild variant="outline" size="sm">
                  <Link href={hrefWithFilters(previousWeekHref)}>
                    <ChevronLeft />
                    Previous week
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={hrefWithFilters(nextWeekHref)}>
                    Next week
                    <ChevronRight />
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 overflow-hidden">
            {isWeekLocked && showEmployeeControls ? (
              <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sky-900 text-sm">
                <Lock className="size-4" /> This week is locked. Entries and pending requests cannot change it.
              </div>
            ) : null}
            {filteredDayGroups.map((group) => {
              const continuations = overnightContinuations.get(group.date) ?? [];
              const timelineRows = Array.from(
                new Set([...continuations, ...group.entries].map((entry) => entry.employeeId)),
              )
                .map((employeeId) => {
                  const dayEntries = group.entries.filter((entry) => entry.employeeId === employeeId);
                  const continuationEntries = continuations.filter((entry) => entry.employeeId === employeeId);
                  const referenceEntry = dayEntries[0] ?? continuationEntries[0];
                  const segments: TimelineSegment[] = [
                    ...continuationEntries
                      .filter((entry) => entry.endTime)
                      .map((entry) => ({
                        endMinutes: timeToMinutes(entry.endTime as string),
                        entry,
                        isContinuation: true,
                        startMinutes: 0,
                      })),
                    ...dayEntries
                      .filter((entry) => entry.startTime && entry.endTime)
                      .map((entry) => ({
                        endMinutes:
                          (entry.endTime as string) < (entry.startTime as string)
                            ? 24 * 60
                            : timeToMinutes(entry.endTime as string),
                        entry,
                        isContinuation: false,
                        startMinutes: timeToMinutes(entry.startTime as string),
                      })),
                  ];

                  return {
                    continuationEntries,
                    dayEntries,
                    employeeId,
                    referenceEntry,
                    segments,
                    totalHours: dayEntries.reduce((total, entry) => total + entry.hours, 0),
                  };
                })
                .sort(
                  (left, right) =>
                    employees.findIndex((employee) => employee.id === left.employeeId) -
                    employees.findIndex((employee) => employee.id === right.employeeId),
                );

              return (
                <section key={group.date} className="grid gap-2 rounded-xl border bg-muted/20 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="grid gap-1">
                      <div className="font-medium text-sm">{format(parseISO(group.date), "EEEE, MMM d")}</div>
                      <div className="text-muted-foreground text-xs">
                        {timelineRows.length
                          ? `${group.entries.length} saved ${group.entries.length === 1 ? "entry" : "entries"}`
                          : "No hours logged"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-background/80">
                        {formatHours(group.totalHours)}
                      </Badge>
                      {canManage ? (
                        <AddHoursDialog
                          action={createTimeEntryAction}
                          date={group.date}
                          employees={activeEmployees}
                          jobs={jobs}
                          requiresApproval={requiresManagerApproval}
                          trigger={
                            <Button size="sm" variant="outline" disabled={!activeEmployees.length || isWeekLocked}>
                              <Plus />
                              Add hours
                            </Button>
                          }
                        />
                      ) : (
                        <PermissionDisabledButton
                          size="sm"
                          variant="outline"
                          reason="Your role can view time entries but cannot add or edit them."
                        >
                          <Plus />
                          Add hours
                        </PermissionDisabledButton>
                      )}
                    </div>
                  </div>

                  {timelineRows.length ? (
                    <div className="grid gap-2">
                      <div className="px-2">
                        <TimelineScale />
                      </div>
                      {timelineRows.map((row) => {
                        const accent = getEmployeeAccent(row.employeeId, employees);
                        const needsAttention = row.dayEntries.some(
                          (entry) => entry.hours > 12 || (entry.hours > 6 && !entry.deductLunch),
                        );

                        return (
                          <div key={row.employeeId} className={cn("grid gap-2 rounded-lg border p-2", accent.panel)}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className={cn("size-2.5 shrink-0 rounded-full", accent.dot)} />
                                <div className="flex flex-wrap items-baseline gap-1.5">
                                  <span className="font-medium text-sm">{row.referenceEntry.employeeName}</span>
                                  <span className="text-[11px] text-muted-foreground">
                                    #{row.referenceEntry.employeeNumber}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-1">
                                {needsAttention ? (
                                  <span
                                    className="text-amber-600"
                                    title="This employee has a shift that needs attention"
                                  >
                                    <AlertTriangle className="size-3.5" />
                                    <span className="sr-only">Shift needs attention</span>
                                  </span>
                                ) : null}
                                <span className={cn("font-medium text-xs", accent.text)}>
                                  {row.dayEntries.length ? formatHours(row.totalHours) : "Carry-in"}
                                </span>
                              </div>
                            </div>

                            <DayTimeline
                              accent={accent}
                              deleteAction={deleteTimeEntryAction}
                              disabled={isWeekLocked ? true : !canManage}
                              jobs={jobs}
                              requiresApproval={requiresManagerApproval}
                              segments={row.segments}
                              updateAction={updateTimeEntryAction}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </CardContent>
        </Card>

        {approveTimeEntryRequestAction && rejectTimeEntryRequestAction ? (
          <div className={cn("order-1 self-start", showEmployeeControls ? "xl:order-none" : "md:order-none")}>
            <PendingTimeRequestsCard
              approveAction={approveTimeEntryRequestAction}
              pendingRequests={pendingRequests}
              rejectAction={rejectTimeEntryRequestAction}
              selectedRequestId={selectedRequestId}
            />
          </div>
        ) : null}
        {showEmployeeControls ? (
          <div className="order-3 self-start xl:order-none">
            <TimeEntryAuditCard events={auditEvents} />
          </div>
        ) : null}
        {!showEmployeeControls ? (
          <div className={cn("order-3 self-start", showEmployeeControls ? "xl:order-none" : "md:order-none")}>
            <EmployeeRequestsCard
              deleteAction={deleteEmployeeTimeRequestAction}
              requests={employeeTimeRequests}
              updateAction={updateEmployeeTimeRequestAction}
            />
          </div>
        ) : null}
        <Card className={cn("order-4 self-start", showEmployeeControls ? "xl:order-none" : "md:order-none")}>
          <CardHeader>
            <CardTitle className="text-base">
              <span>Weekly Hour Summary</span>
            </CardTitle>
            <CardDescription>Hours worked for {periodLabel}</CardDescription>
          </CardHeader>
          <CardContent className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden">
            {weeklyEmployees.length ? (
              weeklyEmployees.map((employee) => {
                const accent = getEmployeeAccent(employee.id, employees);

                return (
                  <div key={employee.id} className={cn("rounded-lg border p-3", accent.panel)}>
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-2">
                        <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", accent.dot)} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-sm">{employee.name}</div>
                          <div className="truncate text-muted-foreground text-xs">
                            #{employee.employeeNumber}
                            {" · "}
                            {employee.lastWorkedOn
                              ? `Last worked ${format(parseISO(employee.lastWorkedOn), "MMM d")}`
                              : "No hours yet"}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {!employee.active ? (
                              <Badge variant="outline" className="text-[10px]">
                                Inactive
                              </Badge>
                            ) : null}
                            {employee.totalHours > 40 ? (
                              <Badge variant="destructive" className="text-[10px]">
                                Overtime
                              </Badge>
                            ) : null}
                            {employee.totalHours === 0 && employee.active ? (
                              <Badge
                                variant="outline"
                                className="border-amber-300 bg-amber-50 text-[10px] text-amber-800"
                              >
                                Missing time
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className={cn("shrink-0 bg-background/80", accent.text)}>
                        {formatHours(employee.totalHours)}
                      </Badge>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-md border bg-muted/20 p-4 text-center text-muted-foreground text-sm">
                {employees.length
                  ? "No employees have logged hours for this week."
                  : "Add your first employee to start tracking hours."}
              </div>
            )}
            {showEmployeeControls && missingTimeEmployees.length ? (
              <details className="group rounded-lg border border-amber-200 bg-amber-50/70">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 marker:content-none">
                  <div className="flex items-center gap-2 text-amber-900">
                    <AlertTriangle className="size-4" />
                    <span className="font-medium text-sm">Missing time</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-amber-300 bg-background/80 text-amber-900">
                      {missingTimeEmployees.length}
                    </Badge>
                    <ChevronRight className="size-4 text-amber-700 transition-transform group-open:rotate-90" />
                  </div>
                </summary>
                <div className="grid gap-2 border-amber-200 border-t px-3 pt-2 pb-3">
                  <p className="text-amber-800 text-xs">Active employees with no recorded hours this week.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {missingTimeEmployees.map((employee) => (
                      <Badge key={employee.id} variant="outline" className="border-amber-300 bg-background/80 text-xs">
                        {employee.name} · #{employee.employeeNumber}
                      </Badge>
                    ))}
                  </div>
                </div>
              </details>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
