"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { format, parseISO } from "date-fns";
import {
  BriefcaseBusiness,
  CalendarDays,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

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
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/phone";

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

function formatPay(employee: EmployeeRow) {
  if (!employee.payRate) return employee.payType;

  return `${employee.payType} · $${Number(employee.payRate).toFixed(2)}`;
}

function getStatusBadgeClass(active: boolean) {
  return active
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
    : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300";
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

function EmployeeDialog({
  action,
  deleteAction,
  employee,
}: {
  action: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  deleteAction?: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  employee?: EmployeeRow;
}) {
  const [open, setOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;

    toast.success(state.message || "Employee saved.");
    setOpen(false);
  }, [state]);

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
              Edit
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
                    Only inactive employees can be deleted. Mark this employee inactive first.
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
}: {
  action: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  employee: EmployeeRow;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;

    toast.success(state.message || "Employee deleted.");
    onOpenChange(false);
  }, [onOpenChange, state]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete employee?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes {employee.name} and all tracked time data attached to this employee.
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

function DetailItem({ label, value }: { label: string; value?: React.ReactNode }) {
  const displayValue = value === "" ? undefined : value;

  return (
    <div className="grid gap-1">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="min-h-5 break-words text-sm">{displayValue ?? "Not set"}</div>
    </div>
  );
}

function EmployeeProfileDialog({
  employee,
  onOpenChange,
}: {
  employee: EmployeeRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!employee) return null;

  const contact = [employee.email, employee.phone ? formatPhoneNumber(employee.phone) : undefined].filter(
    (value): value is string => Boolean(value),
  );

  return (
    <Dialog open={!!employee} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{employee.name}</DialogTitle>
            <Badge variant="outline" className={getStatusBadgeClass(employee.active)}>
              {employee.active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <DialogDescription>
            Employee #{employee.employeeNumber}
            {contact.length ? " · " : ""}
            {contact.join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 rounded-lg border bg-muted/15 p-4 sm:grid-cols-3">
            <DetailItem label="Role" value={[employee.jobTitle, employee.department].filter(Boolean).join(" · ")} />
            <DetailItem label="Employment" value={employee.employmentType} />
            <DetailItem label="Pay" value={formatPay(employee)} />
            <DetailItem label="Start date" value={formatDate(employee.startDate)} />
            <DetailItem label="End date" value={formatDate(employee.endDate)} />
            <DetailItem
              label="Last worked"
              value={employee.lastWorkedOn ? formatDate(employee.lastWorkedOn) : "Never"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <section className="grid gap-3 rounded-lg border p-4">
              <div className="flex items-center gap-2 font-medium text-sm">
                <MapPin className="size-4 text-muted-foreground" />
                Address
              </div>
              <div className="whitespace-pre-wrap text-sm">{employee.address ?? "Not set"}</div>
            </section>

            <section className="grid gap-3 rounded-lg border p-4">
              <div className="flex items-center gap-2 font-medium text-sm">
                <ShieldAlert className="size-4 text-muted-foreground" />
                Emergency contact
              </div>
              <div className="grid gap-2">
                <DetailItem label="Name" value={employee.emergencyName} />
                <DetailItem
                  label="Phone"
                  value={employee.emergencyPhone ? formatPhoneNumber(employee.emergencyPhone) : undefined}
                />
                <DetailItem label="Relationship" value={employee.emergencyRelation} />
              </div>
            </section>
          </div>

          <section className="grid gap-3 rounded-lg border p-4">
            <div className="font-medium text-sm">Notes</div>
            <div className="whitespace-pre-wrap text-sm">{employee.notes ?? "Not set"}</div>
          </section>

          <div className="grid gap-3 rounded-lg border bg-muted/15 p-4 sm:grid-cols-3">
            <DetailItem label="Lifetime hours" value={formatHours(employee.totalHours)} />
            <DetailItem label="Created" value={format(parseISO(employee.createdAt), "MMM d, yyyy")} />
            <DetailItem label="Updated" value={format(parseISO(employee.updatedAt), "MMM d, yyyy")} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  deleteAction,
  employees,
  updateAction,
  updateStatusAction,
}: {
  createAction: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  deleteAction: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  employees: EmployeeRow[];
  updateAction: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  updateStatusAction: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
}) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<"active" | "all" | "inactive">("active");
  const [profileEmployee, setProfileEmployee] = React.useState<EmployeeRow | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const activeCount = employees.filter((employee) => employee.active).length;
  const inactiveCount = employees.length - activeCount;
  const filteredEmployees = employees.filter((employee) => {
    if (status === "active" && !employee.active) return false;
    if (status === "inactive" && employee.active) return false;
    return !normalizedQuery || getSearchText(employee).includes(normalizedQuery);
  });

  return (
    <div className="@container/main mx-auto grid w-full max-w-7xl gap-4 md:gap-6">
      <EmployeeProfileDialog
        employee={profileEmployee}
        onOpenChange={(open) => {
          if (!open) setProfileEmployee(null);
        }}
      />
      <Card className="overflow-hidden rounded-lg">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid max-w-2xl gap-2">
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-normal">
                <UserRound className="size-4" />
                People
              </div>
              <CardTitle className="text-xl">Employees</CardTitle>
              <CardDescription>
                Manage employee profiles, employment details, pay metadata, and emergency contacts.
              </CardDescription>
            </div>
            <EmployeeDialog action={createAction} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:p-5">
          <div className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
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
                  className="h-8"
                  onClick={() => setStatus(option.value)}
                >
                  {option.label}
                  <span className="tabular-nums">{option.count}</span>
                </Button>
              ))}
            </div>
            <div className="relative w-full md:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-8"
                placeholder="Search employees..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          {filteredEmployees.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredEmployees.map((employee) => (
                <Card
                  key={employee.id}
                  className="group relative rounded-lg transition-colors hover:border-primary/40 hover:bg-muted/15"
                  size="sm"
                >
                  <button
                    type="button"
                    className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={`View ${employee.name}`}
                    onClick={() => setProfileEmployee(employee)}
                  />
                  <CardContent className="pointer-events-none relative z-10 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 overflow-hidden p-4">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-sm">{employee.name}</div>
                      <p className="text-muted-foreground text-xs">#{employee.employeeNumber}</p>
                    </div>

                    <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-md border bg-muted/15 px-3 py-2">
                      <EmployeeStatusToggle action={updateStatusAction} employee={employee} />
                      <EmployeeDialog action={updateAction} deleteAction={deleteAction} employee={employee} />
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

                    <div className="grid min-w-0 grid-cols-3 gap-2 rounded-md bg-muted/20 p-3 text-sm">
                      <div className="grid min-w-0 gap-1">
                        <span className="text-muted-foreground text-xs">Lifetime hours</span>
                        <span className="font-medium tabular-nums">{formatHours(employee.totalHours)}</span>
                      </div>
                      <div className="grid min-w-0 gap-1">
                        <span className="text-muted-foreground text-xs">Last</span>
                        <span className="truncate font-medium">
                          {employee.lastWorkedOn ? formatDate(employee.lastWorkedOn) : "Never"}
                        </span>
                      </div>
                      <div className="grid min-w-0 gap-1">
                        <span className="text-muted-foreground text-xs">Pay</span>
                        <span className="truncate font-medium">{formatPay(employee)}</span>
                      </div>
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
