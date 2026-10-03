"use client";

import * as React from "react";

import { addDays, format, parseISO } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarX2,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleEllipsis,
  Clock3,
  CloudRain,
  Download,
  EllipsisVertical,
  Filter,
  Lock,
  LockOpen,
  LogOut,
  PackageX,
  Pencil,
  Plus,
  Printer,
  Trash2,
  UserRound,
  UserRoundCog,
  UserRoundX,
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
import { useIsMobile } from "@/hooks/use-mobile";
import { type EmployeeAccent, getEmployeeAccent as getStoredEmployeeAccent } from "@/lib/employee-colors";
import { getNoWorkDayReasonLabel, noWorkDayReasons } from "@/lib/no-work-days";
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

export type NoWorkDayRow = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  id: string;
  jobCustomerName?: string;
  jobId?: string;
  jobTitle?: string;
  notes?: string;
  reason: string;
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
  actorName: string;
  afterSnapshot?: unknown;
  beforeSnapshot?: unknown;
  createdAt: string;
  employeeName: string;
  employeeNumber: string;
  id: string;
  source: string;
};

type AuditDetail = {
  key: string;
  label: string;
  value: string;
};

type AuditChange = {
  after: string;
  before: string;
  key: string;
  label: string;
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

function getNoWorkDayPresentation(reason: string) {
  switch (reason) {
    case "weather":
      return {
        className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
        icon: CloudRain,
        label: "Weather delay",
      };
    case "customer_cancellation":
      return {
        className:
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
        icon: UserRoundX,
        label: "Customer canceled",
      };
    case "no_work_scheduled":
      return {
        className:
          "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300",
        icon: CalendarX2,
        label: "No work scheduled",
      };
    case "company_closure":
      return {
        className:
          "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
        icon: Building2,
        label: "Company closed",
      };
    case "material_or_equipment_delay":
      return {
        className:
          "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
        icon: PackageX,
        label: "Materials or equipment delayed",
      };
    case "personal":
      return {
        className:
          "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
        icon: UserRound,
        label: "Personal day",
      };
    default:
      return {
        className: "border-border bg-muted text-muted-foreground",
        icon: CircleEllipsis,
        label: "Other reason",
      };
  }
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

function EmptyDayTimeline() {
  return (
    <div
      className="relative h-5 overflow-hidden rounded-md border border-border/70 bg-muted/50"
      role="img"
      aria-label="No hours worked"
    >
      {Array.from({ length: 23 }, (_, index) => {
        const hour = index + 1;
        return (
          <span
            key={hour}
            className={cn(
              "pointer-events-none absolute inset-y-0 border-l",
              hour % 6 === 0 ? "border-foreground/15" : "border-foreground/6",
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

function EmployeeSelectField({
  defaultEmployeeId,
  employees,
}: {
  defaultEmployeeId?: string;
  employees: EmployeeSummary[];
}) {
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
      <Select name="employeeId" defaultValue={defaultEmployeeId} required>
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
  onOpenChange,
  open: controlledOpen,
  requiresApproval = false,
  trigger,
}: {
  action: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  date: string;
  employees: EmployeeSummary[];
  jobs: JobOption[];
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  requiresApproval?: boolean;
  trigger?: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [deductLunch, setDeductLunch] = React.useState(true);
  const [state, setState] = React.useState(initialState);
  const [isPending, startTransition] = React.useTransition();
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

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
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
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

function NoWorkDayDialog({
  action,
  date,
  employees,
  jobs,
  onOpenChange,
  open: controlledOpen,
  trigger,
}: {
  action: TimeEntryMutationAction;
  date: string;
  employees: EmployeeSummary[];
  jobs: JobOption[];
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  trigger?: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [state, setState] = React.useState(initialState);
  const [isPending, startTransition] = React.useTransition();
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await action(initialState, formData);
      setState(result);
      if (result.success) {
        form.reset();
        setOpen(false);
        toast.success(result.message || "No-work day recorded.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a no-work day</DialogTitle>
          <DialogDescription>
            Explain why no hours were worked on {format(parseISO(date), "EEEE, MMM d")}. This does not add paid hours.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <input type="hidden" name="workedOn" value={date} />
          <EmployeeSelectField employees={employees} />
          <div className="grid gap-2">
            <Label htmlFor={`no-work-reason-${date}`}>Reason</Label>
            <Select name="reason" required>
              <SelectTrigger id={`no-work-reason-${date}`} className="w-full">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {noWorkDayReasons.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <JobSelectField jobs={jobs} />
          <div className="grid gap-2">
            <Label htmlFor={`no-work-notes-${date}`}>Explanation</Label>
            <Textarea
              id={`no-work-notes-${date}`}
              name="notes"
              maxLength={1000}
              placeholder="Optional details for the time record..."
            />
          </div>
          {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Record no-work day"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditNoWorkDayDialog({
  action,
  deleteAction,
  disabled = false,
  employees,
  jobs,
  record,
  trigger,
}: {
  action: TimeEntryMutationAction;
  deleteAction?: TimeEntryMutationAction;
  disabled?: boolean;
  employees: EmployeeSummary[];
  jobs: JobOption[];
  record: NoWorkDayRow;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState(initialState);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) setState(initialState);
  }, [open]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await action(initialState, formData);
      setState(result);
      if (result.success) {
        setOpen(false);
        toast.success(result.message || "No-work day updated.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" size="icon-sm" variant="ghost" disabled={disabled}>
            <Pencil />
            <span className="sr-only">Edit {record.employeeName} no-work day</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit no-work day</DialogTitle>
          <DialogDescription>Update the reason, date, job, or explanation for this record.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <input type="hidden" name="noWorkDayId" value={record.id} />
          <EmployeeSelectField defaultEmployeeId={record.employeeId} employees={employees} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`no-work-date-${record.id}`}>Date</Label>
              <Input
                id={`no-work-date-${record.id}`}
                name="workedOn"
                type="date"
                defaultValue={record.workedOn}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`no-work-reason-edit-${record.id}`}>Reason</Label>
              <Select name="reason" defaultValue={record.reason} required>
                <SelectTrigger id={`no-work-reason-edit-${record.id}`} className="w-full">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {noWorkDayReasons.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <JobSelectField defaultJobId={record.jobId} jobs={jobs} />
          <div className="grid gap-2">
            <Label htmlFor={`no-work-notes-edit-${record.id}`}>Explanation</Label>
            <Textarea
              id={`no-work-notes-edit-${record.id}`}
              name="notes"
              maxLength={1000}
              defaultValue={record.notes ?? ""}
              placeholder="Optional details for the time record..."
            />
          </div>
          {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
          <DialogFooter>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {deleteAction ? <DeleteNoWorkDayButton action={deleteAction} record={record} /> : <span />}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending || disabled}>
                  {isPending ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NoWorkDayTimeline({
  deleteAction,
  disabled,
  employees,
  jobs,
  record,
  updateAction,
}: {
  deleteAction?: TimeEntryMutationAction;
  disabled: boolean;
  employees: EmployeeSummary[];
  jobs: JobOption[];
  record: NoWorkDayRow;
  updateAction?: TimeEntryMutationAction;
}) {
  const [open, setOpen] = React.useState(false);
  const pinned = React.useRef(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
    <div className="relative">
      <EmptyDayTimeline />
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
            className="absolute inset-0 cursor-pointer rounded-md bg-transparent outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            aria-label={`View ${record.employeeName}'s no-work day details`}
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
              <div className="flex items-center gap-1.5 font-medium">
                <CalendarX2 className="size-4 text-muted-foreground" /> No work
              </div>
              <div className="text-muted-foreground text-xs">
                {record.employeeName} · {format(parseISO(record.workedOn), "EEEE, MMM d")}
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {getNoWorkDayReasonLabel(record.reason)}
            </Badge>
          </div>
          <div className="grid gap-1 rounded-md bg-muted/50 p-2 text-xs">
            <div className="font-medium">0 hours recorded</div>
            {record.jobTitle ? (
              <div className="text-muted-foreground">
                {formatJobLabel({ customerName: record.jobCustomerName, title: record.jobTitle })}
              </div>
            ) : null}
            {record.notes ? (
              <div className="text-muted-foreground">{record.notes}</div>
            ) : (
              <div className="text-muted-foreground">No additional explanation provided.</div>
            )}
          </div>
          {updateAction ? (
            <div className="flex justify-end">
              <EditNoWorkDayDialog
                action={updateAction}
                deleteAction={deleteAction}
                disabled={disabled}
                employees={employees}
                jobs={jobs}
                record={record}
                trigger={
                  <Button type="button" size="sm" disabled={disabled}>
                    <Pencil /> Edit no-work day
                  </Button>
                }
              />
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DayEntryActions({
  createNoWorkDayAction,
  createTimeEntryAction,
  date,
  disabled,
  employees,
  jobs,
  requiresApproval,
}: {
  createNoWorkDayAction: TimeEntryMutationAction;
  createTimeEntryAction: TimeEntryMutationAction;
  date: string;
  disabled: boolean;
  employees: EmployeeSummary[];
  jobs: JobOption[];
  requiresApproval: boolean;
}) {
  const [mode, setMode] = React.useState<"hours" | "no-work" | null>(null);
  const isMobile = useIsMobile();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="outline" disabled={disabled}>
            <Plus /> Add entry
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isMobile ? "start" : "end"} className="w-48">
          <DropdownMenuItem onSelect={() => setMode("hours")}>
            <Clock3 /> Log hours
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMode("no-work")}>
            <CalendarX2 /> No-work day
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AddHoursDialog
        action={createTimeEntryAction}
        date={date}
        employees={employees}
        jobs={jobs}
        onOpenChange={(open) => setMode(open ? "hours" : null)}
        open={mode === "hours"}
        requiresApproval={requiresApproval}
      />
      <NoWorkDayDialog
        action={createNoWorkDayAction}
        date={date}
        employees={employees}
        jobs={jobs}
        onOpenChange={(open) => setMode(open ? "no-work" : null)}
        open={mode === "no-work"}
      />
    </>
  );
}

function DeleteNoWorkDayButton({ action, record }: { action: TimeEntryMutationAction; record: NoWorkDayRow }) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState(initialState);
  const [isPending, startTransition] = React.useTransition();

  function handleDelete() {
    const formData = new FormData();
    formData.set("noWorkDayId", record.id);
    startTransition(async () => {
      const result = await action(initialState, formData);
      setState(result);
      if (result.success) {
        setOpen(false);
        toast.success(result.message || "No-work day removed.");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="destructive"
          size="icon-sm"
          aria-label={`Remove ${record.employeeName} no-work day`}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this no-work day?</AlertDialogTitle>
          <AlertDialogDescription>
            {record.employeeName} will return to having no explanation recorded for this date.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Removing..." : "Remove"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

function getAuditSnapshot(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getAuditString(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return typeof value === "string" ? value : null;
}

function getAuditDetails(snapshotValue: unknown, action: string, jobs: JobOption[]): AuditDetail[] {
  const snapshot = getAuditSnapshot(snapshotValue);
  if (!snapshot) return [];

  const workedOn = getAuditString(snapshot, "workedOn");
  const jobId = getAuditString(snapshot, "jobId");
  const notes = getAuditString(snapshot, "notes");
  const job = jobId ? jobs.find((option) => option.id === jobId) : undefined;
  const commonDetails: AuditDetail[] = [
    {
      key: "workedOn",
      label: "Work date",
      value: workedOn ? format(parseISO(workedOn), "EEEE, MMM d, yyyy") : "Not recorded",
    },
    {
      key: "jobId",
      label: "Job",
      value: job
        ? formatJobLabel({ customerName: job.customerName, title: job.title })
        : jobId
          ? "Job unavailable"
          : "No job",
    },
    { key: "notes", label: "Notes", value: notes?.trim() ? notes : "None" },
  ];

  if (action.toLowerCase().includes("no-work")) {
    const reason = getAuditString(snapshot, "reason");
    return [
      commonDetails[0],
      {
        key: "reason",
        label: "Reason",
        value: reason ? getNoWorkDayReasonLabel(reason) : "Not recorded",
      },
      ...commonDetails.slice(1),
    ];
  }

  const startTime = getAuditString(snapshot, "startTime") ?? undefined;
  const endTime = getAuditString(snapshot, "endTime") ?? undefined;
  const hours = getAuditString(snapshot, "hours");
  const deductLunch = snapshot.deductLunch === true;
  const lunchMinutes = typeof snapshot.lunchMinutes === "number" ? snapshot.lunchMinutes : 0;

  return [
    commonDetails[0],
    {
      key: "time",
      label: "Time",
      value: startTime && endTime ? `${formatTime12(startTime)} – ${formatTime12(endTime)}` : "Not recorded",
    },
    { key: "hours", label: "Hours", value: hours ? formatHours(Number(hours)) : "Not recorded" },
    {
      key: "lunch",
      label: "Lunch",
      value: deductLunch ? `${lunchMinutes} minutes deducted` : "No deduction",
    },
    ...commonDetails.slice(1),
  ];
}

function AuditDetailList({ details }: { details: AuditDetail[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border text-sm">
      {details.map((detail) => (
        <div key={detail.key} className="grid min-w-0 gap-1 bg-card p-3">
          <dt className="text-muted-foreground text-xs">{detail.label}</dt>
          <dd className="break-words font-medium">{detail.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function getAuditChanges(beforeDetails: AuditDetail[], afterDetails: AuditDetail[]) {
  const beforeByKey = new Map(beforeDetails.map((detail) => [detail.key, detail]));

  return afterDetails.flatMap((detail): AuditChange[] => {
    const before = beforeByKey.get(detail.key);
    if (!before || before.value === detail.value) return [];

    return [{ after: detail.value, before: before.value, key: detail.key, label: detail.label }];
  });
}

function TimeEntryAuditCard({ events, jobs }: { events: TimeEntryAuditRow[]; jobs: JobOption[] }) {
  function getActionPresentation(action: string) {
    const normalized = action.toLowerCase();

    if (normalized.includes("add") || normalized === "create") {
      return {
        accentClassName: "bg-emerald-500",
        icon: Plus,
        iconClassName: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        recordLabel: normalized === "create" ? "Time entry" : action.replace(/\s+added$/i, ""),
        performedBy: "Added by",
        verb: "Added",
        verbClassName: "text-emerald-700 dark:text-emerald-300",
      };
    }

    if (normalized.includes("update")) {
      return {
        accentClassName: "bg-sky-500",
        icon: Pencil,
        iconClassName: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
        recordLabel: normalized === "update" ? "Time entry" : action.replace(/\s+updated$/i, ""),
        performedBy: "Updated by",
        verb: "Updated",
        verbClassName: "text-sky-700 dark:text-sky-300",
      };
    }

    if (normalized.includes("remove") || normalized === "delete") {
      return {
        accentClassName: "bg-rose-500",
        icon: Trash2,
        iconClassName: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
        recordLabel: normalized === "delete" ? "Time entry" : action.replace(/\s+removed$/i, ""),
        performedBy: "Removed by",
        verb: "Removed",
        verbClassName: "text-rose-700 dark:text-rose-300",
      };
    }

    return {
      accentClassName: "bg-zinc-400",
      icon: Clock3,
      iconClassName: "bg-muted text-muted-foreground",
      recordLabel: action,
      performedBy: "Changed by",
      verb: "Changed",
      verbClassName: "text-foreground",
    };
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent activity</CardTitle>
        <CardDescription>Manager and approved-request changes, including who made them.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length ? (
          <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
            {events.map((event) => {
              const presentation = getActionPresentation(event.action);
              const ActionIcon = presentation.icon;
              const beforeDetails = getAuditDetails(event.beforeSnapshot, event.action, jobs);
              const afterDetails = getAuditDetails(event.afterSnapshot, event.action, jobs);
              const recordedDetails = afterDetails.length ? afterDetails : beforeDetails;
              const changes = getAuditChanges(beforeDetails, afterDetails);
              const changedKeys = new Set(changes.map((change) => change.key));
              const contextDetails = afterDetails.filter((detail) => !changedKeys.has(detail.key));

              return (
                <Dialog key={event.id}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="group relative w-full overflow-hidden rounded-lg border bg-card p-2.5 pl-3 text-left text-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", presentation.accentClassName)} />
                      <span className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2.5">
                        <span
                          className={cn(
                            "mt-0.5 flex size-7 items-center justify-center rounded-md",
                            presentation.iconClassName,
                          )}
                        >
                          <ActionIcon className="size-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                            <span className={cn("font-bold uppercase tracking-wide", presentation.verbClassName)}>
                              {presentation.verb}
                            </span>
                            <span className="font-semibold">{presentation.recordLabel}</span>
                          </span>
                          <span className="mt-0.5 block font-medium">
                            {event.employeeName} <span className="text-muted-foreground">#{event.employeeNumber}</span>
                          </span>
                          <span className="mt-1 block text-muted-foreground">
                            {presentation.performedBy}{" "}
                            <span className="font-medium text-foreground">{event.actorName}</span>
                            {event.source === "EmployeeRequest" ? " · Approved request" : ""} ·{" "}
                            {format(parseISO(event.createdAt), "MMM d, h:mm a")}
                          </span>
                        </span>
                        <ChevronRight className="mt-2 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                      <DialogTitle>
                        {presentation.recordLabel} {presentation.verb.toLowerCase()}
                      </DialogTitle>
                      <DialogDescription>
                        {event.employeeName} #{event.employeeNumber} · {format(parseISO(event.createdAt), "PPp")}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                      <div className="grid gap-1 rounded-lg bg-muted/50 p-3 text-sm">
                        <span>
                          {presentation.performedBy} <strong>{event.actorName}</strong>
                        </span>
                        {event.source === "EmployeeRequest" ? (
                          <span className="text-muted-foreground text-xs">
                            This change approved an employee request.
                          </span>
                        ) : null}
                      </div>

                      {beforeDetails.length && afterDetails.length ? (
                        <div className="grid gap-4">
                          <section className="grid gap-2">
                            <h3 className="font-semibold text-sm">Changes</h3>
                            {changes.length ? (
                              <div className="grid gap-2">
                                {changes.map((change) => (
                                  <div key={change.key} className="grid gap-2 rounded-lg border bg-muted/20 p-3">
                                    <span className="font-medium text-muted-foreground text-xs">{change.label}</span>
                                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
                                      <span className="min-w-0 break-words rounded-md bg-background px-2.5 py-2 text-muted-foreground ring-1 ring-border">
                                        {change.before}
                                      </span>
                                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                                      <span className="min-w-0 break-words rounded-md bg-sky-50 px-2.5 py-2 font-semibold text-sky-800 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900">
                                        {change.after}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="rounded-lg border bg-muted/20 p-3 text-muted-foreground text-sm">
                                No displayable fields changed.
                              </p>
                            )}
                          </section>
                          {contextDetails.length ? (
                            <section className="grid gap-2">
                              <h3 className="font-semibold text-sm">Other details</h3>
                              <AuditDetailList details={contextDetails} />
                            </section>
                          ) : null}
                        </div>
                      ) : recordedDetails.length ? (
                        <section className="grid gap-2">
                          <h3 className="font-semibold text-sm">
                            {afterDetails.length ? "Recorded details" : "Removed record"}
                          </h3>
                          <AuditDetailList details={recordedDetails} />
                        </section>
                      ) : (
                        <p className="rounded-lg border bg-muted/20 p-3 text-muted-foreground text-sm">
                          No additional snapshot data is available for this older activity record.
                        </p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              );
            })}
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
  createNoWorkDayAction,
  createTimeEntryAction,
  dayGroups,
  deleteEmployeeTimeRequestAction,
  deleteNoWorkDayAction,
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
  noWorkDays = [],
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
  updateNoWorkDayAction,
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
  createNoWorkDayAction?: TimeEntryMutationAction;
  createTimeEntryAction: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  createEmployeeAction?: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  dayGroups: DayGroup[];
  deleteEmployeeTimeRequestAction?: (
    state: TimeTrackingMutationState,
    formData: FormData,
  ) => Promise<TimeTrackingMutationState>;
  deleteEmployeeAction?: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  deleteNoWorkDayAction?: TimeEntryMutationAction;
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
  noWorkDays?: NoWorkDayRow[];
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
  updateNoWorkDayAction?: TimeEntryMutationAction;
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
  const filteredNoWorkDays = noWorkDays.filter((record) => {
    const employee = employees.find((candidate) => candidate.id === record.employeeId);
    return (
      (employeeFilter === "all" || record.employeeId === employeeFilter) &&
      (jobFilter === "all" || (jobFilter === "none" ? !record.jobId : record.jobId === jobFilter)) &&
      (departmentFilter === "all" || (employee?.department ?? "Unassigned") === departmentFilter) &&
      !attentionOnly
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
      noWorkDays: filteredNoWorkDays.filter((record) => record.workedOn === group.date),
      totalHours: filteredEntries.reduce((total, entry) => total + entry.hours, 0),
    };
  });
  const weekHours = entries.reduce((total, entry) => total + entry.hours, 0);
  const noWorkDayCount = filteredNoWorkDays.length;
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
        "Record type",
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
        "No-work reason",
        "Notes",
      ],
      ...entries.map((entry) => {
        const employee = employees.find((candidate) => candidate.id === entry.employeeId);
        return [
          "Hours",
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
          "",
          entry.notes,
        ];
      }),
      ...filteredNoWorkDays.map((record) => {
        const employee = employees.find((candidate) => candidate.id === record.employeeId);
        return [
          "No-work day",
          record.workedOn,
          record.employeeName,
          record.employeeNumber,
          employee?.department,
          "",
          "",
          "No",
          0,
          0,
          record.jobTitle ? formatJobLabel({ customerName: record.jobCustomerName, title: record.jobTitle }) : "",
          getNoWorkDayReasonLabel(record.reason),
          record.notes,
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
          <h1 className="flex items-center gap-2 font-semibold text-xl leading-none">
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
                <DropdownMenuItem
                  disabled={!canExport || (!entries.length && !filteredNoWorkDays.length)}
                  onSelect={exportCsv}
                >
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

      <div className={cn("grid gap-2 sm:gap-3", showEmployeeControls ? "grid-cols-3" : "grid-cols-2")}>
        <Card className="min-w-0 py-2 sm:py-4">
          <CardContent className="grid gap-0.5 px-2 py-0 sm:gap-1 sm:p-4">
            <span className="text-[11px] text-muted-foreground leading-tight sm:text-xs">
              {activeFilterCount > 0 ? "Filtered hours" : "Hours logged"}
            </span>
            <span className="font-semibold text-xl sm:text-2xl">{formatHours(weekHours)}</span>
            <span className="text-[11px] text-muted-foreground leading-tight sm:text-xs">
              <span className="sm:hidden">This week</span>
              <span className="hidden sm:inline">{periodLabel}</span>
            </span>
          </CardContent>
        </Card>
        <Card className="min-w-0 py-2 sm:py-4">
          <CardContent className="grid gap-0.5 px-2 py-0 sm:gap-1 sm:p-4">
            <span className="text-[11px] text-muted-foreground leading-tight sm:text-xs">{secondaryStatLabel}</span>
            <span className="font-semibold text-xl sm:text-2xl">{secondaryStatValue ?? activeEmployees.length}</span>
            {secondaryStatValue === undefined ? (
              <span className="text-[11px] text-muted-foreground leading-tight sm:text-xs">
                <span className="sm:hidden">
                  {activeEmployeesWithHours} of {activeEmployees.length} logged
                </span>
                <span className="hidden sm:inline">
                  {activeEmployeesWithHours} of {activeEmployees.length} logged time for the selected week
                </span>
              </span>
            ) : null}
          </CardContent>
        </Card>
        {showEmployeeControls ? (
          <Card className="min-w-0 py-2 sm:py-4">
            <CardContent className="grid gap-0.5 px-2 py-0 sm:gap-1 sm:p-4">
              <span className="text-[11px] text-muted-foreground leading-tight sm:text-xs">No-work records</span>
              <span className="font-semibold text-xl sm:text-2xl">{noWorkDayCount}</span>
              <span className="text-[11px] text-muted-foreground leading-tight sm:text-xs">
                <span className="sm:hidden">{noWorkDayCount === 1 ? "1 day" : `${noWorkDayCount} days`}</span>
                <span className="hidden sm:inline">
                  {noWorkDayCount === 1 ? "1 explained day" : `${noWorkDayCount} explained days`} for this week
                </span>
              </span>
            </CardContent>
          </Card>
        ) : null}
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
                            Showing {entries.length} of {allEntries.length} hour entries and {noWorkDayCount} no-work
                            records · {formatHours(weekHours)}. Filters also apply to CSV exports.
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
                        {group.entries.length || group.noWorkDays.length
                          ? [
                              group.entries.length
                                ? `${group.entries.length} hour ${group.entries.length === 1 ? "entry" : "entries"}`
                                : null,
                              group.noWorkDays.length
                                ? `${group.noWorkDays.length} no-work ${group.noWorkDays.length === 1 ? "record" : "records"}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : "No activity recorded"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-background/80">
                        {formatHours(group.totalHours)}
                      </Badge>
                      {canManage && createNoWorkDayAction ? (
                        <DayEntryActions
                          createNoWorkDayAction={createNoWorkDayAction}
                          createTimeEntryAction={createTimeEntryAction}
                          date={group.date}
                          disabled={!activeEmployees.length || isWeekLocked}
                          employees={activeEmployees}
                          jobs={jobs}
                          requiresApproval={requiresManagerApproval}
                        />
                      ) : canManage ? (
                        <AddHoursDialog
                          action={createTimeEntryAction}
                          date={group.date}
                          employees={activeEmployees}
                          jobs={jobs}
                          requiresApproval={requiresManagerApproval}
                          trigger={
                            <Button size="sm" variant="outline" disabled={!activeEmployees.length || isWeekLocked}>
                              <Plus /> Add hours
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
                  {group.noWorkDays.length ? (
                    <div className="grid gap-2">
                      {group.noWorkDays.map((record) => {
                        const reasonPresentation = getNoWorkDayPresentation(record.reason);
                        const ReasonIcon = reasonPresentation.icon;

                        return (
                          <div
                            key={record.id}
                            className="grid gap-2 rounded-lg border bg-muted/30 p-2 text-muted-foreground"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className="size-2.5 shrink-0 rounded-full bg-muted-foreground/45"
                                  aria-hidden="true"
                                />
                                <div className="flex flex-wrap items-baseline gap-1.5">
                                  <span className="font-medium text-foreground/80 text-sm">{record.employeeName}</span>
                                  <span className="text-[11px]">#{record.employeeNumber}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    "inline-flex min-h-6 items-center gap-1.5 rounded-md border px-2 py-1 font-semibold text-[11px] leading-none",
                                    reasonPresentation.className,
                                  )}
                                  title={`No-work reason: ${getNoWorkDayReasonLabel(record.reason)}`}
                                >
                                  <ReasonIcon className="size-3.5 shrink-0" aria-hidden="true" />
                                  {reasonPresentation.label}
                                </span>
                                <span className="font-medium text-xs">0h</span>
                              </div>
                            </div>
                            <NoWorkDayTimeline
                              deleteAction={isWeekLocked ? undefined : deleteNoWorkDayAction}
                              disabled={isWeekLocked ? true : !canManage}
                              employees={activeEmployees}
                              jobs={jobs}
                              record={record}
                              updateAction={updateNoWorkDayAction}
                            />
                            {record.jobTitle || record.notes ? (
                              <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs">
                                {record.jobTitle ? (
                                  <span>
                                    {formatJobLabel({ customerName: record.jobCustomerName, title: record.jobTitle })}
                                  </span>
                                ) : null}
                                {record.notes ? <span>{record.notes}</span> : null}
                              </div>
                            ) : null}
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
            <TimeEntryAuditCard events={auditEvents} jobs={jobs} />
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
