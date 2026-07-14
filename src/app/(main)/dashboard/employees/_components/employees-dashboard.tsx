"use client";

import * as React from "react";

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
import { NativeSelect } from "@/components/ui/native-select";
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
  const [digits, setDigits] = React.useState(() => normalizePhoneNumber(defaultValue));

  return (
    <Input
      id={id}
      name={name}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={formatPhoneNumber(digits)}
      onChange={(event) => setDigits(normalizePhoneNumber(event.target.value))}
    />
  );
}

function EmployeeFormFields({ employee }: { employee?: EmployeeRow }) {
  return (
    <div className="grid min-w-0 gap-4">
      {employee ? <input type="hidden" name="employeeId" value={employee.id} /> : null}
      <div className="grid gap-4 md:grid-cols-[8rem_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="employee-number">Number</Label>
          <Input
            id="employee-number"
            name="employeeNumber"
            inputMode="numeric"
            maxLength={4}
            minLength={4}
            pattern="\d{4}"
            defaultValue={employee?.employeeNumber ?? ""}
            placeholder="Auto"
          />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="employee-name">Name</Label>
          <Input
            id="employee-name"
            name="name"
            defaultValue={employee?.name ?? ""}
            placeholder="Employee name"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="employee-email">Email</Label>
          <Input id="employee-email" name="email" type="email" defaultValue={employee?.email ?? ""} />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="employee-phone">Phone</Label>
          <PhoneInput id="employee-phone" name="phone" defaultValue={employee?.phone} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="employee-job-title">Job title</Label>
          <Input id="employee-job-title" name="jobTitle" defaultValue={employee?.jobTitle ?? ""} />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="employee-department">Department</Label>
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
          <Label htmlFor="employee-pay-rate">Pay rate</Label>
          <Input id="employee-pay-rate" name="payRate" inputMode="decimal" defaultValue={employee?.payRate ?? ""} />
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="employee-start-date">Start date</Label>
          <Input id="employee-start-date" name="startDate" type="date" defaultValue={employee?.startDate ?? ""} />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="employee-end-date">End date</Label>
          <Input id="employee-end-date" name="endDate" type="date" defaultValue={employee?.endDate ?? ""} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="employee-address">Address</Label>
        <Textarea id="employee-address" name="address" defaultValue={employee?.address ?? ""} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="employee-emergency-name">Emergency contact</Label>
          <Input id="employee-emergency-name" name="emergencyName" defaultValue={employee?.emergencyName ?? ""} />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="employee-emergency-phone">Emergency phone</Label>
          <PhoneInput id="employee-emergency-phone" name="emergencyPhone" defaultValue={employee?.emergencyPhone} />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="employee-emergency-relation">Relationship</Label>
          <Input
            id="employee-emergency-relation"
            name="emergencyRelation"
            defaultValue={employee?.emergencyRelation ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="employee-notes">Notes</Label>
        <Textarea id="employee-notes" name="notes" defaultValue={employee?.notes ?? ""} />
      </div>
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
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;

    toast.success(state.message || "Employee saved.");
    setOpen(false);
  }, [state]);

  return (
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
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            {employee
              ? "Update employment details, contacts, and internal notes."
              : "Create a detailed employee record."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid min-w-0 gap-4">
          <EmployeeFormFields employee={employee} />
          {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : employee ? "Save changes" : "Create employee"}
            </Button>
          </DialogFooter>
        </form>
        {employee && deleteAction ? (
          <div className="flex min-w-0 flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid min-w-0 gap-1">
              <div className="font-medium text-sm">Delete employee</div>
              <div className="text-muted-foreground text-xs">
                Permanently removes this employee and their tracked time.
              </div>
            </div>
            <DeleteEmployeeDialog action={deleteAction} employee={employee} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DeleteEmployeeDialog({
  action,
  employee,
}: {
  action: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  employee: EmployeeRow;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;

    toast.success(state.message || "Employee deleted.");
    setOpen(false);
  }, [state]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm">
          <Trash2 />
          Delete
        </Button>
      </AlertDialogTrigger>
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
            <DetailItem label="Current period hours" value={formatHours(employee.totalHours)} />
            <DetailItem label="Created" value={format(parseISO(employee.createdAt), "MMM d, yyyy")} />
            <DetailItem label="Updated" value={format(parseISO(employee.updatedAt), "MMM d, yyyy")} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EmployeesDashboard({
  createAction,
  deleteAction,
  employees,
  updateAction,
}: {
  createAction: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  deleteAction: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  employees: EmployeeRow[];
  updateAction: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
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
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate font-medium text-sm">{employee.name}</div>
                          <Badge variant="outline" className={getStatusBadgeClass(employee.active)}>
                            {employee.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs">#{employee.employeeNumber}</p>
                      </div>
                      <div className="pointer-events-auto flex shrink-0 gap-1">
                        <EmployeeDialog action={updateAction} deleteAction={deleteAction} employee={employee} />
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

                    <div className="grid min-w-0 grid-cols-3 gap-2 rounded-md bg-muted/20 p-3 text-sm">
                      <div className="grid min-w-0 gap-1">
                        <span className="text-muted-foreground text-xs">Hours</span>
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
