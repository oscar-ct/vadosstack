"use client";

import Link from "next/link";

import { format, parseISO } from "date-fns";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  Clock3,
  DollarSign,
  Mail,
  ShieldAlert,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getEmployeeAccent } from "@/lib/employee-colors";
import { formatPhoneNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";

import { EmployeeColorPicker, EmployeeDialog } from "../../_components/employees-dashboard";
import type { EmployeeMutationState } from "../../actions";
import type { EmployeeRow } from "../../types";

function formatDate(value?: string) {
  return value ? format(parseISO(value), "MMM d, yyyy") : "Not set";
}

function formatHours(hours: number) {
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

function formatPayRate(employee: EmployeeRow) {
  if (!employee.payRate) return "Not set";

  const payPeriod: Record<string, string> = {
    Hourly: "hour",
    Salary: "year",
    "Day Rate": "day",
    "Piece Rate": "piece",
  };
  const amount = Number(employee.payRate).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
  const period = payPeriod[employee.payType];

  return period ? `${amount} / ${period}` : amount;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function DetailItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid min-w-0 gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="min-h-5 break-words font-medium text-sm">{value ?? "Not set"}</dd>
    </div>
  );
}

function SectionHeading({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof BriefcaseBusiness;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <h2 className="font-medium text-sm">{title}</h2>
        <p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  );
}

export function EmployeeProfile({
  deleteAction,
  employee,
  updateAccentAction,
  updateAction,
  usageCounts,
}: {
  deleteAction: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  employee: EmployeeRow;
  updateAccentAction: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  updateAction: (state: EmployeeMutationState, formData: FormData) => Promise<EmployeeMutationState>;
  usageCounts: Record<string, number>;
}) {
  const accent = getEmployeeAccent(employee.accentColor, employee.id);

  return (
    <div className="@container/main mx-auto grid w-full max-w-7xl gap-4 md:gap-6">
      <nav className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-sm" aria-label="Breadcrumb">
        <Link prefetch={false} href="/dashboard/employees" className="hover:text-foreground">
          Employees
        </Link>
        <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate text-foreground">{employee.name}</span>
      </nav>

      <div className="overflow-hidden rounded-lg border bg-background">
        <header className="border-b bg-card px-4 py-5 md:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div
                className={cn(
                  "grid size-16 shrink-0 place-items-center rounded-full border-2 font-semibold text-lg",
                  accent.panel,
                  accent.text,
                )}
                aria-hidden="true"
              >
                {getInitials(employee.name)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate font-semibold text-2xl tracking-tight">{employee.name}</h1>
                  <Badge
                    variant="outline"
                    className={cn(
                      employee.active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                        : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300",
                    )}
                  >
                    {employee.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="mt-1 text-muted-foreground text-sm">
                  Employee #{employee.employeeNumber}
                  {employee.jobTitle ? ` · ${employee.jobTitle}` : ""}
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-muted-foreground text-xs">
                  <span className={cn("size-2.5 rounded-full", accent.dot)} aria-hidden="true" />
                  {accent.label} employee color
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <EmployeeColorPicker action={updateAccentAction} employee={employee} usageCounts={usageCounts} />
              <EmployeeDialog
                action={updateAction}
                deleteAction={deleteAction}
                employee={employee}
                redirectAfterDelete="/dashboard/employees"
              />
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
          <main className="grid min-w-0 gap-0 lg:border-r">
            <section className="grid gap-4 border-b p-4 md:p-6">
              <SectionHeading
                icon={Clock3}
                title="Work summary"
                description="Recorded time and recent activity for this employee."
              />
              <dl className="grid gap-4 rounded-lg bg-muted/20 p-4 sm:grid-cols-3">
                <DetailItem label="Lifetime hours" value={formatHours(employee.totalHours)} />
                <DetailItem
                  label="Last worked"
                  value={employee.lastWorkedOn ? formatDate(employee.lastWorkedOn) : "Never"}
                />
                <DetailItem label="Current status" value={employee.active ? "Active" : "Inactive"} />
              </dl>
            </section>

            <section className="grid gap-5 border-b p-4 md:p-6">
              <SectionHeading
                icon={BriefcaseBusiness}
                title="Employment"
                description="Role, department, classification, and employment dates."
              />
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
                <DetailItem label="Job title" value={employee.jobTitle} />
                <DetailItem label="Department" value={employee.department} />
                <DetailItem label="Employment type" value={employee.employmentType} />
                <DetailItem label="Start date" value={formatDate(employee.startDate)} />
                <DetailItem label="End date" value={formatDate(employee.endDate)} />
              </dl>
            </section>

            <section className="grid gap-5 border-b p-4 md:p-6">
              <SectionHeading
                icon={Mail}
                title="Contact"
                description="Contact and address information saved for this employee."
              />
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <DetailItem label="Email" value={employee.email} />
                <DetailItem label="Phone" value={employee.phone ? formatPhoneNumber(employee.phone) : undefined} />
                <div className="sm:col-span-2">
                  <DetailItem label="Address" value={employee.address} />
                </div>
              </dl>
            </section>

            <section className="grid gap-5 p-4 md:p-6">
              <SectionHeading
                icon={ShieldAlert}
                title="Emergency contact"
                description="Private contact details to use in an emergency."
              />
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-3">
                <DetailItem label="Name" value={employee.emergencyName} />
                <DetailItem
                  label="Phone"
                  value={employee.emergencyPhone ? formatPhoneNumber(employee.emergencyPhone) : undefined}
                />
                <DetailItem label="Relationship" value={employee.emergencyRelation} />
              </dl>
            </section>
          </main>

          <aside className="grid content-start gap-0 bg-muted/5">
            <section className="grid gap-4 border-b p-4 md:p-6">
              <SectionHeading icon={DollarSign} title="Compensation" description="Current pay arrangement." />
              <dl className="grid gap-4">
                <DetailItem label="Pay type" value={employee.payType} />
                <DetailItem label="Pay rate" value={formatPayRate(employee)} />
              </dl>
            </section>

            <section className="grid gap-4 border-b p-4 md:p-6">
              <SectionHeading icon={CalendarDays} title="Record details" description="Employee record history." />
              <dl className="grid gap-4">
                <DetailItem label="Created" value={format(parseISO(employee.createdAt), "MMM d, yyyy")} />
                <DetailItem label="Last updated" value={format(parseISO(employee.updatedAt), "MMM d, yyyy")} />
              </dl>
            </section>

            <section className="grid gap-3 p-4 md:p-6">
              <div className="flex items-center gap-2 font-medium text-sm">
                <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
                Internal notes
              </div>
              <p className="whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
                {employee.notes ?? "No internal notes have been added."}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
