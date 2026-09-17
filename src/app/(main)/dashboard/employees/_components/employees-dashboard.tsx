"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format, parseISO } from "date-fns";
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ColorPaletteIcon } from "@/components/icons/color-palette-icon";
import { OptionalDatePicker } from "@/components/optional-date-picker";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { employeeColors, getEmployeeAccent } from "@/lib/employee-colors";
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";

import type { EmployeeMutationState } from "../actions";
import type { EmployeeRow } from "../types";

const initialState: EmployeeMutationState = {
  success: false,
  message: "",
};

const employmentTypes = ["Employee", "Contractor", "Seasonal", "Temporary"];
const payTypes = ["Hourly", "Salary", "Day Rate", "Piece Rate"];

function formatDate(value?: string) {
  return value ? format(parseISO(value), "MMM d, yyyy") : "Not set";
}

function formatHours(hours: number) {
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

function getSearchText(employee: EmployeeRow) {
  return [
    employee.name,
    employee.employeeNumber,
    employee.email,
    employee.phone,
    employee.jobTitle,
    employee.department,
    employee.employmentType,
    employee.payType,
    employee.emergencyName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function PhoneInput({ defaultValue, id, name }: { defaultValue?: string | null; id: string; name: string }) {
  const [digits, setDigits] = React.useState(() => normalizePhoneNumber(defaultValue).slice(0, 10));

  return (
    <Input
      id={id}
      name={name}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      maxLength={14}
      value={formatPhoneNumber(digits)}
      onChange={(event) => setDigits(normalizePhoneNumber(event.target.value).slice(0, 10))}
      placeholder="(555) 555-1234"
    />
  );
}

function EmployeeFormFields({ employee }: { employee?: EmployeeRow }) {
  const [startDate, setStartDate] = React.useState<Date | undefined>(() =>
    employee?.startDate ? parseISO(employee.startDate) : undefined,
  );
  const [endDate, setEndDate] = React.useState<Date | undefined>(() =>
    employee?.endDate ? parseISO(employee.endDate) : undefined,
  );

  return (
    <div className="grid min-w-0 gap-5">
      {employee ? <input type="hidden" name="employeeId" value={employee.id} /> : null}

      <section className="grid gap-4 rounded-lg border bg-muted/15 p-4">
        <div className="grid gap-1">
          <h3 className="font-medium text-sm">Basic information</h3>
          <p className="text-muted-foreground text-xs">Identity and contact details for this employee.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="employee-number">Employee number</Label>
            <Input
              id="employee-number"
              name="employeeNumber"
              aria-describedby="employee-number-help"
              inputMode="numeric"
              maxLength={4}
              minLength={4}
              pattern="\d{4}"
              defaultValue={employee?.employeeNumber ?? ""}
              placeholder={employee ? "0000" : "Auto-generated"}
            />
            <p id="employee-number-help" className="text-muted-foreground text-xs">
              {employee ? "A unique 4-digit employee ID." : "Leave blank to generate a unique 4-digit ID."}
            </p>
          </div>
          <div className="grid min-w-0 content-start gap-2">
            <Label htmlFor="employee-name">Name</Label>
            <Input
              id="employee-name"
              name="name"
              autoComplete="name"
              defaultValue={employee?.name ?? ""}
              placeholder="Employee name"
              required
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="employee-email">Email (optional)</Label>
            <Input
              id="employee-email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={employee?.email ?? ""}
              placeholder="employee@example.com"
            />
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="employee-phone">Phone (optional)</Label>
            <PhoneInput id="employee-phone" name="phone" defaultValue={employee?.phone} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-muted/15 p-4">
        <div className="grid gap-1">
          <h3 className="font-medium text-sm">Employment details</h3>
          <p className="text-muted-foreground text-xs">Role, compensation, status, and employment dates.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="employee-job-title">Job title (optional)</Label>
            <Input id="employee-job-title" name="jobTitle" defaultValue={employee?.jobTitle ?? ""} />
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="employee-department">Department (optional)</Label>
            <Input id="employee-department" name="department" defaultValue={employee?.department ?? ""} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="employee-employment-type">Type</Label>
            <NativeSelect
              id="employee-employment-type"
              name="employmentType"
              defaultValue={employee?.employmentType ?? "Employee"}
              className="w-full min-w-0"
            >
              {employmentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="employee-pay-type">Pay type</Label>
            <NativeSelect
              id="employee-pay-type"
              name="payType"
              defaultValue={employee?.payType ?? "Hourly"}
              className="w-full min-w-0"
            >
              {payTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="employee-pay-rate">Pay amount ($) (optional)</Label>
            <Input
              id="employee-pay-rate"
              name="payRate"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              defaultValue={employee?.payRate ?? ""}
              placeholder="0.00"
            />
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="employee-active">Status</Label>
            <NativeSelect
              id="employee-active"
              name="active"
              defaultValue={employee?.active === false ? "false" : "true"}
              className="w-full min-w-0"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </NativeSelect>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">Pay amount corresponds to the selected pay type.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="employee-start-date">Start date (optional)</Label>
            <OptionalDatePicker
              id="employee-start-date"
              name="startDate"
              value={startDate}
              onChange={setStartDate}
              placeholder="Select start date"
            />
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="employee-end-date">End date (optional)</Label>
            <OptionalDatePicker
              id="employee-end-date"
              name="endDate"
              value={endDate}
              onChange={setEndDate}
              placeholder="Select end date"
            />
          </div>
        </div>
        <p className="text-muted-foreground text-xs">End date cannot be earlier than the start date.</p>
      </section>

      <section className="grid gap-3 rounded-lg border bg-muted/15 p-4">
        <div className="grid gap-1">
          <h3 className="font-medium text-sm">Address (optional)</h3>
          <p className="text-muted-foreground text-xs">Employee mailing or home address.</p>
        </div>
        <Label htmlFor="employee-address" className="sr-only">
          Address
        </Label>
        <Textarea
          id="employee-address"
          name="address"
          defaultValue={employee?.address ?? ""}
          placeholder="Street, city, state, and ZIP code"
          className="min-h-24"
        />
      </section>

      <section className="grid gap-4 rounded-lg border border-amber-200/80 bg-amber-50/40 p-4 dark:border-amber-900/60 dark:bg-amber-950/15">
        <div className="grid gap-1">
          <h3 className="font-medium text-sm">Emergency contact (optional)</h3>
          <p className="text-muted-foreground text-xs">Who should be contacted in an emergency.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="employee-emergency-name">Name</Label>
            <Input id="employee-emergency-name" name="emergencyName" defaultValue={employee?.emergencyName ?? ""} />
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="employee-emergency-phone">Phone</Label>
            <PhoneInput id="employee-emergency-phone" name="emergencyPhone" defaultValue={employee?.emergencyPhone} />
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="employee-emergency-relation">Relationship</Label>
            <Input
              id="employee-emergency-relation"
              name="emergencyRelation"
              defaultValue={employee?.emergencyRelation ?? ""}
              placeholder="Spouse, parent, friend…"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-2">
        <Label htmlFor="employee-notes">Internal notes (optional)</Label>
        <Textarea
          id="employee-notes"
          name="notes"
          defaultValue={employee?.notes ?? ""}
          placeholder="Add internal employee notes…"
          className="min-h-24"
        />
      </section>
    </div>
  );
}

export function EmployeeDialog({
  action,
  deleteAction,
  employee,
  redirectAfterDelete,
}: {
  action: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  deleteAction?: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  employee?: EmployeeRow;
  redirectAfterDelete?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;

    toast.success(state.message || "Employee saved.");
    setOpen(false);
    router.refresh();
  }, [router, state]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {employee ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <Pencil />
              Edit profile
            </Button>
          ) : (
            <Button type="button" size="sm">
              <Plus />
              Add employee
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="top-0 left-0 grid h-svh max-h-svh w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <DialogHeader className="border-b p-4 pr-12">
            <DialogTitle>{employee ? "Edit employee" : "Add employee"}</DialogTitle>
            <DialogDescription>
              {employee
                ? "Update employment details, contacts, and internal notes."
                : "Create a detailed employee record."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              React.startTransition(() => formAction(formData));
            }}
          >
            <div className="grid min-h-0 gap-4 overflow-y-auto overflow-x-hidden p-4">
              <EmployeeFormFields employee={employee} />
              {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
            </div>
            <DialogFooter className="mx-0 mb-0 shrink-0 gap-2 rounded-none sm:justify-between">
              {employee && deleteAction ? (
                employee.active ? (
                  <p className="max-w-xs text-muted-foreground text-xs sm:mr-auto">
                    Only inactive employees can be deleted
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => {
                      setOpen(false);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 />
                    Delete
                  </Button>
                )
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : employee ? "Save changes" : "Create employee"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {employee && deleteAction && !employee.active ? (
        <DeleteEmployeeDialog
          action={deleteAction}
          employee={employee}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          redirectTo={redirectAfterDelete}
        />
      ) : null}
    </>
  );
}

function DeleteEmployeeDialog({
  action,
  employee,
  onOpenChange,
  open,
  redirectTo,
}: {
  action: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  employee: EmployeeRow;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;

    toast.success(state.message || "Employee deleted.");
    onOpenChange(false);
    if (redirectTo) router.push(redirectTo);
  }, [onOpenChange, redirectTo, router, state]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete employee?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes {employee.name}. Deletion is only available when the employee has no time history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <input type="hidden" name="employeeId" value={employee.id} />
          {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Deleting..." : "Delete employee"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function EmployeeColorPicker({
  action,
  employee,
  usageCounts,
}: {
  action: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  employee: EmployeeRow;
  usageCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [selectedColor, setSelectedColor] = React.useState(employee.accentColor);
  const [isPending, startTransition] = React.useTransition();
  const selectedAccent = getEmployeeAccent(selectedColor, employee.id);

  React.useEffect(() => {
    setSelectedColor(employee.accentColor);
  }, [employee.accentColor]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={isPending}
          aria-label={`Choose a color for ${employee.name}. Current color: ${selectedAccent.label}`}
          title={`Employee color: ${selectedAccent.label}`}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <ColorPaletteIcon className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64" onClick={(event) => event.stopPropagation()}>
        <div className="grid gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <div className="font-medium text-sm">Employee color</div>
              <p className="text-muted-foreground text-xs">Used across employee schedules and summaries.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="-mt-1 -mr-1 shrink-0"
              aria-label="Close color picker"
              onClick={() => handleOpenChange(false)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {employeeColors.map((color) => {
              const selected = selectedColor === color.key;
              const usedBy = usageCounts[color.key] ?? 0;

              return (
                <button
                  key={color.key}
                  type="button"
                  className={cn(
                    "relative grid aspect-square place-items-center rounded-md border transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected && "border-foreground ring-1 ring-foreground",
                  )}
                  aria-label={`${color.label}${usedBy ? `, used by ${usedBy} ${usedBy === 1 ? "employee" : "employees"}` : ", unused"}`}
                  title={`${color.label} · ${usedBy ? `Used by ${usedBy}` : "Unused"}`}
                  disabled={isPending}
                  onClick={() => {
                    if (selected) {
                      handleOpenChange(false);
                      return;
                    }

                    const previousColor = selectedColor;
                    setSelectedColor(color.key);
                    handleOpenChange(false);
                    startTransition(async () => {
                      const formData = new FormData();
                      formData.set("employeeId", employee.id);
                      formData.set("accentColor", color.key);
                      const result = await action(initialState, formData);

                      if (!result.success) {
                        setSelectedColor(previousColor);
                        toast.error(result.message || "Employee color could not be updated.");
                        return;
                      }

                      toast.success(result.message);
                      router.refresh();
                    });
                  }}
                >
                  <span className={cn("size-5 rounded-full", color.dot)} aria-hidden="true" />
                  {selected ? <Check className="absolute size-3 text-white drop-shadow-sm" aria-hidden="true" /> : null}
                  {usedBy ? (
                    <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-muted px-1 text-[9px] tabular-nums">
                      {usedBy}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">Numbers show how many employees use each color.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EmployeeStatusToggle({
  action,
  employee,
}: {
  action: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  employee: EmployeeRow;
}) {
  const router = useRouter();
  const [active, setActive] = React.useState(employee.active);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setActive(employee.active);
  }, [employee.active]);

  return (
    <div className="flex items-center gap-2">
      <span className={active ? "text-emerald-700 text-xs dark:text-emerald-300" : "text-muted-foreground text-xs"}>
        {active ? "Active" : "Inactive"}
      </span>
      <Switch
        checked={active}
        disabled={isPending}
        aria-label={`Mark ${employee.name} ${active ? "inactive" : "active"}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onCheckedChange={(nextActive) => {
          const previousActive = active;
          setActive(nextActive);
          startTransition(async () => {
            const formData = new FormData();
            formData.set("employeeId", employee.id);
            formData.set("active", String(nextActive));
            const result = await action(initialState, formData);

            if (!result.success) {
              setActive(previousActive);
              toast.error(result.message || "Employee status could not be updated.");
              return;
            }

            toast.success(result.message);
            router.refresh();
          });
        }}
      />
    </div>
  );
}

export function EmployeesDashboard({
  createAction,
  employees,
  updateAccentAction,
  updateStatusAction,
}: {
  createAction: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  employees: EmployeeRow[];
  updateAccentAction: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  updateStatusAction: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
}) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<"active" | "all" | "inactive">("active");
  const normalizedQuery = query.trim().toLowerCase();
  const activeCount = employees.filter((employee) => employee.active).length;
  const inactiveCount = employees.length - activeCount;
  const colorUsageCounts = employees.reduce<Record<string, number>>((counts, employee) => {
    counts[employee.accentColor] = (counts[employee.accentColor] ?? 0) + 1;
    return counts;
  }, {});
  const filteredEmployees = employees.filter((employee) => {
    if (status === "active" && !employee.active) return false;
    if (status === "inactive" && employee.active) return false;
    return !normalizedQuery || getSearchText(employee).includes(normalizedQuery);
  });

  return (
    <div className="@container/main mx-auto grid w-full max-w-7xl gap-4 md:gap-6">
      <Card className="overflow-hidden rounded-lg">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid max-w-2xl gap-2">
              <CardTitle className="flex items-center gap-2 leading-none">
                <span className="text-lg">Employees</span>
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <UserRound className="size-4" />
                </span>
              </CardTitle>
              <CardDescription>
                Manage employee profiles, employment details, pay metadata, and emergency contacts.
              </CardDescription>
            </div>
            <EmployeeDialog action={createAction} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full md:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-7 pl-8"
                placeholder="Search employees..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              {[
                { count: employees.length, label: "All", value: "all" as const },
                { count: activeCount, label: "Active", value: "active" as const },
                { count: inactiveCount, label: "Inactive", value: "inactive" as const },
              ].map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={status === option.value ? "default" : "outline"}
                  size="sm"
                  className="h-7"
                  onClick={() => setStatus(option.value)}
                >
                  {option.label}
                  <span className="tabular-nums">{option.count}</span>
                </Button>
              ))}
            </div>
          </div>

          {filteredEmployees.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredEmployees.map((employee) => (
                <Card key={employee.id} className="gap-0 rounded-lg" size="sm">
                  <CardContent className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 overflow-hidden p-4">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "size-2.5 shrink-0 rounded-full",
                            getEmployeeAccent(employee.accentColor, employee.id).dot,
                          )}
                          aria-hidden="true"
                        />
                        <div className="truncate font-medium text-sm">{employee.name}</div>
                      </div>
                      <p className="text-muted-foreground text-xs">#{employee.employeeNumber}</p>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/15 px-3 py-2">
                      <EmployeeStatusToggle action={updateStatusAction} employee={employee} />
                      <div className="flex items-center gap-2">
                        <EmployeeColorPicker
                          action={updateAccentAction}
                          employee={employee}
                          usageCounts={colorUsageCounts}
                        />
                        <Button asChild variant="outline" size="sm">
                          <Link prefetch={false} href={`/dashboard/employees/${employee.id}`}>
                            View profile
                          </Link>
                        </Button>
                      </div>
                    </div>

                    <div className="grid min-w-0 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <BriefcaseBusiness className="size-4 text-muted-foreground" />
                        <span className="min-w-0 truncate">
                          {[employee.jobTitle, employee.department].filter(Boolean).join(" · ") || "Role not set"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="size-4 text-muted-foreground" />
                        <span className="min-w-0 truncate">{employee.email ?? "No email"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="size-4 text-muted-foreground" />
                        <span>{employee.phone ? formatPhoneNumber(employee.phone) : "No phone"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="size-4 text-muted-foreground" />
                        <span>Started {formatDate(employee.startDate)}</span>
                      </div>
                    </div>

                    <div className="grid min-w-0 grid-cols-2 gap-2 rounded-md bg-muted/20 p-3 pb-0 text-sm">
                      <div className="grid min-w-0 gap-1">
                        <span className="text-muted-foreground text-xs">Lifetime hours</span>
                        <span className="font-medium tabular-nums">{formatHours(employee.totalHours)}</span>
                      </div>
                      <div className="grid min-w-0 gap-1 text-right">
                        <span className="text-muted-foreground text-xs">Last Worked</span>
                        <span className="truncate font-medium">
                          {employee.lastWorkedOn ? formatDate(employee.lastWorkedOn) : "Never"}
                        </span>
                      </div>
                      {/*<div className="grid min-w-0 gap-1">*/}
                      {/*  <span className="text-muted-foreground text-xs">Pay</span>*/}
                      {/*  <span className="truncate font-medium">{formatPay(employee)}</span>*/}
                      {/*</div>*/}
                    </div>

                    {employee.emergencyName || employee.emergencyPhone ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                        <div className="mb-1 flex items-center gap-2 font-medium">
                          <ShieldAlert className="size-4" />
                          Emergency contact
                        </div>
                        <div>
                          {employee.emergencyName ?? "No name"}
                          {employee.emergencyRelation ? ` · ${employee.emergencyRelation}` : ""}
                        </div>
                        <div>{employee.emergencyPhone ? formatPhoneNumber(employee.emergencyPhone) : "No phone"}</div>
                      </div>
                    ) : null}

                    {employee.notes ? (
                      <p className="line-clamp-3 text-muted-foreground text-sm">{employee.notes}</p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid place-items-center rounded-lg border bg-muted/20 p-8 text-center">
              <div className="grid max-w-sm gap-2">
                <div className="mx-auto flex size-10 items-center justify-center rounded-md bg-background text-muted-foreground">
                  <UserRound className="size-5" />
                </div>
                <div className="font-medium text-sm">
                  {employees.length ? "No employees match your filters." : "No employees yet."}
                </div>
                <p className="text-muted-foreground text-sm">
                  {employees.length
                    ? "Try another status, name, employee number, role, or contact detail."
                    : "Create employee profiles here, then track their hours from Time Tracking."}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
