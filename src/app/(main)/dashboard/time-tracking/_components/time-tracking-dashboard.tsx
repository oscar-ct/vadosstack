"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, LogOut, Pencil, Plus, Trash2, UserRoundCog } from "lucide-react";
import { toast } from "sonner";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { TimeTrackingMutationState } from "../actions";

export type EmployeeSummary = {
  id: string;
  employeeNumber: string;
  name: string;
  email?: string;
  phone?: string;
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
  employeeName: string;
  employeeNumber: string;
  endTime?: string;
  hours?: number;
  jobCustomerName?: string;
  jobId?: string;
  jobTitle?: string;
  lunchMinutes: number;
  notes?: string;
  requestedAt: string;
  reviewedAt?: string;
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

const initialState: TimeTrackingMutationState = {
  success: false,
  message: "",
};

const employeeAccents = [
  {
    dot: "bg-sky-500",
    fill: "bg-sky-200/65",
    panel: "border-sky-200 bg-sky-50/80",
    text: "text-sky-700",
  },
  {
    dot: "bg-emerald-500",
    fill: "bg-emerald-200/65",
    panel: "border-emerald-200 bg-emerald-50/80",
    text: "text-emerald-700",
  },
  {
    dot: "bg-amber-500",
    fill: "bg-amber-200/70",
    panel: "border-amber-200 bg-amber-50/80",
    text: "text-amber-700",
  },
  {
    dot: "bg-rose-500",
    fill: "bg-rose-200/65",
    panel: "border-rose-200 bg-rose-50/80",
    text: "text-rose-700",
  },
  {
    dot: "bg-indigo-500",
    fill: "bg-indigo-200/65",
    panel: "border-indigo-200 bg-indigo-50/80",
    text: "text-indigo-700",
  },
];

function formatHours(hours: number) {
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
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

  return `${formatTime12(snapshot.startTime)} - ${formatTime12(snapshot.endTime)}`;
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
  const employeeIndex = employees.findIndex((employee) => employee.id === employeeId);
  const index = employeeIndex >= 0 ? employeeIndex : 0;

  return employeeAccents[index % employeeAccents.length];
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
                {employee.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function JobSelectField({ defaultJobId, jobs }: { defaultJobId?: string; jobs: JobOption[] }) {
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
                step="15"
                defaultValue="60"
                disabled={!deductLunch}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="time-entry-notes">Notes</Label>
            <Textarea id="time-entry-notes" name="notes" placeholder="Optional notes about the day..." />
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
  entry,
  jobs,
  requiresApproval = false,
}: {
  action: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  deleteAction: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  entry: TimeEntryRow;
  jobs: JobOption[];
  requiresApproval?: boolean;
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
        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${entry.employeeName} hours`}>
          <Pencil />
        </Button>
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
                step="15"
                defaultValue={entry.lunchMinutes || 60}
                disabled={!deductLunch}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`time-entry-notes-${entry.id}`}>Notes</Label>
            <Textarea id={`time-entry-notes-${entry.id}`} name="notes" defaultValue={entry.notes ?? ""} />
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
        <Button size="icon-sm" variant="ghost" aria-label={`Delete ${entry.employeeName} hours`}>
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
  rejectAction,
  requestId,
  vertical = false,
}: {
  approveAction: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  rejectAction: (state: TimeTrackingMutationState, formData: FormData) => Promise<TimeTrackingMutationState>;
  requestId: string;
  vertical?: boolean;
}) {
  const [approveState, approveFormAction, isApproving] = React.useActionState(approveAction, initialState);
  const [rejectState, rejectFormAction, isRejecting] = React.useActionState(rejectAction, initialState);
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
      <div className={cn("flex gap-2", vertical ? "flex-col sm:flex-row" : "")}>
        <form action={approveFormAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <Button size="sm" className={vertical ? "w-full sm:w-auto" : undefined} disabled={isApproving || isRejecting}>
            {isApproving ? "Approving..." : "Approve"}
          </Button>
        </form>
        <form action={rejectFormAction}>
          <input type="hidden" name="requestId" value={requestId} />
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
          <DialogTitle>Review time change</DialogTitle>
          <DialogDescription>
            {request.employeeName} #{request.employeeNumber} sent a {request.action.toLowerCase()} request on{" "}
            {format(parseISO(request.requestedAt), "MMM d, h:mm a")}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
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
            rejectAction={rejectAction}
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
                    : "No differences found";

              return (
                <div
                  key={request.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">
                        {request.employeeName} #{request.employeeNumber}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {request.action} · {changeSummary}
                      </div>
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
      <CardContent className="grid gap-4">
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
    <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
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

export function TimeTrackingDashboard({
  approveTimeEntryRequestAction,
  createTimeEntryAction,
  dayGroups,
  deleteEmployeeTimeRequestAction,
  deleteTimeEntryAction,
  employeeLogoutAction,
  employeeTimeRequests = [],
  employees,
  jobs,
  headerDescription,
  monthLabel,
  nextWeekHref,
  pendingRequests = [],
  periodLabel,
  previousWeekHref,
  rejectTimeEntryRequestAction,
  requiresManagerApproval = false,
  secondaryStatLabel = "Employees",
  secondaryStatValue,
  selectedRequestId,
  showEmployeeControls = true,
  updateEmployeeTimeRequestAction,
  updateTimeEntryAction,
}: {
  approveTimeEntryRequestAction?: (
    state: TimeTrackingMutationState,
    formData: FormData,
  ) => Promise<TimeTrackingMutationState>;
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
  monthLabel: string;
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
}) {
  const entries = dayGroups.flatMap((group) => group.entries);
  const weekHours = entries.reduce((total, entry) => total + entry.hours, 0);
  const weeklyEmployees = employees.map((employee) => {
    const employeeEntries = entries.filter((entry) => entry.employeeId === employee.id);
    const lastWorkedOn = employeeEntries.at(-1)?.workedOn;

    return {
      ...employee,
      lastWorkedOn,
      totalHours: employeeEntries.reduce((total, entry) => total + entry.hours, 0),
    };
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="font-semibold text-2xl tracking-tight">Time Tracking</h1>
          <p className="text-muted-foreground text-sm">
            {headerDescription ?? `Track employee work days and hours for ${periodLabel}.`}
          </p>
        </div>
        {showEmployeeControls ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link prefetch={false} href="/dashboard/employees">
                <UserRoundCog />
                Manage employees
              </Link>
            </Button>
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
            <span className="text-muted-foreground text-xs">This week</span>
            <span className="font-semibold text-2xl">{formatHours(weekHours)}</span>
            <span className="text-muted-foreground text-xs">{periodLabel}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-1 p-4">
            <span className="text-muted-foreground text-xs">{secondaryStatLabel}</span>
            <span className="font-semibold text-2xl">{secondaryStatValue ?? employees.length}</span>
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
                  {formatHours(weekHours)} logged for {periodLabel} in {monthLabel}.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={previousWeekHref}>
                    <ChevronLeft />
                    Previous week
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={nextWeekHref}>
                    Next week
                    <ChevronRight />
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {dayGroups.map((group) => {
              return (
                <section key={group.date} className="grid gap-3 rounded-xl border bg-muted/20 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="grid gap-1">
                      <div className="font-medium text-sm">{format(parseISO(group.date), "EEEE, MMM d")}</div>
                      <div className="text-muted-foreground text-xs">{group.entries.length} entries</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-background/80">
                        {formatHours(group.totalHours)}
                      </Badge>
                      <AddHoursDialog
                        action={createTimeEntryAction}
                        date={group.date}
                        employees={employees}
                        jobs={jobs}
                        requiresApproval={requiresManagerApproval}
                        trigger={
                          <Button size="sm" variant="outline" disabled={!employees.length}>
                            <Plus />
                            Add hours
                          </Button>
                        }
                      />
                    </div>
                  </div>

                  {group.entries.length ? (
                    <div className="grid gap-2">
                      {group.entries.map((entry) => {
                        const accent = getEmployeeAccent(entry.employeeId, employees);
                        const fillPercentage = Math.min((entry.hours / 24) * 100, 100);

                        return (
                          <div
                            key={entry.id}
                            className={cn("relative overflow-hidden rounded-lg border p-2", accent.panel)}
                          >
                            <div
                              className={cn("absolute inset-y-0 left-0", accent.fill)}
                              style={{ width: `${fillPercentage}%` }}
                            />
                            <div className="relative flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className={cn("size-2.5 shrink-0 rounded-full", accent.dot)} />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-baseline gap-1.5">
                                    <span className="font-medium text-sm">{entry.employeeName}</span>
                                    <span className="text-[11px] text-muted-foreground">#{entry.employeeNumber}</span>
                                  </div>
                                  {entry.startTime && entry.endTime ? (
                                    <div className="text-muted-foreground text-xs">
                                      {formatTime12(entry.startTime)} - {formatTime12(entry.endTime)}
                                      {entry.deductLunch ? `, lunch ${entry.lunchMinutes}m` : ""}
                                    </div>
                                  ) : null}
                                  {entry.jobTitle ? (
                                    <div className="text-muted-foreground text-xs">
                                      {formatJobLabel({ customerName: entry.jobCustomerName, title: entry.jobTitle })}
                                    </div>
                                  ) : null}
                                  {entry.notes ? (
                                    <div className="text-muted-foreground text-xs">{entry.notes}</div>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Badge variant="secondary" className={cn("bg-background/80", accent.text)}>
                                  {formatHours(entry.hours)}
                                </Badge>
                                <EditHoursDialog
                                  action={updateTimeEntryAction}
                                  deleteAction={deleteTimeEntryAction}
                                  entry={entry}
                                  jobs={jobs}
                                  requiresApproval={requiresManagerApproval}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed bg-background/60 p-4 text-center text-muted-foreground text-sm">
                      No hours logged yet. Add time here when someone works this day.
                    </div>
                  )}
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
          <CardContent className="grid gap-3">
            {weeklyEmployees.length ? (
              weeklyEmployees.map((employee) => {
                const accent = getEmployeeAccent(employee.id, employees);

                return (
                  <div key={employee.id} className={cn("rounded-lg border p-3", accent.panel)}>
                    <div className="flex items-start justify-between gap-3">
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
                        </div>
                      </div>
                      <Badge variant="secondary" className={cn("bg-background/80", accent.text)}>
                        {formatHours(employee.totalHours)}
                      </Badge>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-md border bg-muted/20 p-4 text-center text-muted-foreground text-sm">
                Add your first employee to start tracking hours.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
