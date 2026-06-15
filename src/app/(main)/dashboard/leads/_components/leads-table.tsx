"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format, isBefore, startOfToday } from "date-fns";
import { ArrowRight, ArrowUpDown, CalendarDays, Search, SlidersHorizontal, Tag } from "lucide-react";

import { CustomerLink } from "@/components/customer-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPhoneNumber } from "@/lib/phone";
import { cn, formatCurrency } from "@/lib/utils";

import type { LeadRow } from "../_lib/lead-data";
import { leadPriorities, leadStatuses } from "../constants";

const statusOptions = [
  { value: "all", label: "All statuses" },
  ...leadStatuses.map((status) => ({ value: status, label: status })),
] as const;

const priorityOptions = [
  { value: "all", label: "All priority" },
  ...leadPriorities.map((priority) => ({ value: priority, label: priority })),
] as const;

const followUpOptions = [
  { value: "all", label: "Any follow-up" },
  { value: "overdue", label: "Overdue" },
  { value: "scheduled", label: "Scheduled" },
  { value: "none", label: "No follow-up" },
] as const;

const sortOptions = [
  { value: "follow-up", label: "Follow-up first" },
  { value: "newest", label: "Newest first" },
  { value: "value-desc", label: "Highest value" },
  { value: "name-asc", label: "Name A-Z" },
] as const;

type FollowUpFilter = (typeof followUpOptions)[number]["value"];
type SortValue = (typeof sortOptions)[number]["value"];

function statusClassName(status: string) {
  if (status === "Won") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900";
  if (status === "Lost") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900";
  if (status === "Estimate Sent") return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900";
  if (status === "Estimate Needed") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900";
  if (status === "Contacted") return "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900";
  return "bg-muted-foreground/10 text-muted-foreground";
}

function priorityClassName(priority: string) {
  if (priority === "High") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "Low") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function formatMoney(value?: string) {
  return value ? formatCurrency(Number(value)) : "No value";
}

function formatFollowUp(lead: LeadRow) {
  if (!lead.followUpAt) return "No follow-up";
  return format(new Date(lead.followUpAt), "MMM d, yyyy");
}

function nextActionLabel(status: string) {
  if (status === "New") return "Contact lead";
  if (status === "Contacted") return "Create estimate";
  if (status === "Estimate Needed") return "Create estimate";
  if (status === "Estimate Sent") return "Follow up";
  if (status === "Won") return "Convert work";
  if (status === "Lost") return "Review";
  return "Open";
}

function shouldIgnoreRowClick(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? !!target.closest("a, button, input, label, select, textarea, [data-row-click-ignore]")
    : false;
}

function getLeadSearchText(lead: LeadRow) {
  return [
    lead.name,
    lead.email,
    lead.phone,
    lead.source,
    lead.serviceType,
    lead.serviceLocation,
    lead.customerName,
    lead.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function leadValue(lead: LeadRow) {
  const value = Number(lead.estimatedValue ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function leadDateTime(value?: string) {
  return value ? new Date(value).getTime() : 0;
}

function matchesFollowUpFilter(lead: LeadRow, filter: FollowUpFilter, today: Date) {
  if (filter === "all") return true;
  if (filter === "none") return !lead.followUpAt;
  if (!lead.followUpAt) return false;

  const isClosed = lead.status === "Won" || lead.status === "Lost";
  const followUpDate = new Date(lead.followUpAt);

  if (filter === "overdue") {
    return !isClosed && isBefore(followUpDate, today);
  }

  return !isClosed;
}

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const router = useRouter();
  const today = startOfToday();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [followUpFilter, setFollowUpFilter] = React.useState<FollowUpFilter>("all");
  const [sortValue, setSortValue] = React.useState<SortValue>("follow-up");
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const hasFilters =
    Boolean(normalizedQuery) ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    followUpFilter !== "all" ||
    sortValue !== "follow-up";

  const filteredLeads = React.useMemo(() => {
    return leads
      .filter((lead) => (normalizedQuery ? getLeadSearchText(lead).includes(normalizedQuery) : true))
      .filter((lead) => (statusFilter === "all" ? true : lead.status === statusFilter))
      .filter((lead) => (priorityFilter === "all" ? true : lead.priority === priorityFilter))
      .filter((lead) => matchesFollowUpFilter(lead, followUpFilter, today))
      .sort((left, right) => {
        if (sortValue === "newest") {
          return leadDateTime(right.createdAt) - leadDateTime(left.createdAt);
        }

        if (sortValue === "value-desc") {
          return leadValue(right) - leadValue(left);
        }

        if (sortValue === "name-asc") {
          return left.name.localeCompare(right.name);
        }

        const leftFollowUp = left.followUpAt ? leadDateTime(left.followUpAt) : Number.POSITIVE_INFINITY;
        const rightFollowUp = right.followUpAt ? leadDateTime(right.followUpAt) : Number.POSITIVE_INFINITY;

        if (leftFollowUp !== rightFollowUp) {
          return leftFollowUp - rightFollowUp;
        }

        return leadDateTime(right.createdAt) - leadDateTime(left.createdAt);
      });
  }, [followUpFilter, leads, normalizedQuery, priorityFilter, sortValue, statusFilter, today]);

  function resetFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setFollowUpFilter("all");
    setSortValue("follow-up");
  }

  function openLead(href: string) {
    router.push(href);
  }

  return (
    <>
      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <div className="md:hidden">
              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal />
                    Filters
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Lead filters</DrawerTitle>
                    <DrawerDescription>Filter and sort the lead pipeline on mobile.</DrawerDescription>
                  </DrawerHeader>
                  <div className="grid gap-4 px-4">
                    <div className="grid gap-2">
                      <Label htmlFor="leads-mobile-status">Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger id="leads-mobile-status" className="w-full">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="leads-mobile-priority">Priority</Label>
                      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger id="leads-mobile-priority" className="w-full">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {priorityOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="leads-mobile-follow-up">Follow-up</Label>
                      <Select
                        value={followUpFilter}
                        onValueChange={(value) => setFollowUpFilter(value as FollowUpFilter)}
                      >
                        <SelectTrigger id="leads-mobile-follow-up" className="w-full">
                          <SelectValue placeholder="Follow-up" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {followUpOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="leads-mobile-sort">Sort</Label>
                      <Select value={sortValue} onValueChange={(value) => setSortValue(value as SortValue)}>
                        <SelectTrigger id="leads-mobile-sort" className="w-full">
                          <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {sortOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DrawerFooter>
                    {hasFilters ? (
                      <Button type="button" variant="outline" onClick={resetFilters}>
                        Reset filters
                      </Button>
                    ) : null}
                    <DrawerClose asChild>
                      <Button>Done</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            </div>
            <div className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Tag />
                    Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                    {statusOptions.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Tag />
                    Priority
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={priorityFilter} onValueChange={setPriorityFilter}>
                    {priorityOptions.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarDays />
                    Follow-up
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup
                    value={followUpFilter}
                    onValueChange={(value) => setFollowUpFilter(value as FollowUpFilter)}
                  >
                    {followUpOptions.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ArrowUpDown />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={sortValue} onValueChange={(value) => setSortValue(value as SortValue)}>
                    {sortOptions.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {hasFilters ? (
                <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                  Reset
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="px-1 text-muted-foreground text-sm">
          Showing {filteredLeads.length} of {leads.length} {leads.length === 1 ? "lead" : "leads"}.
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader className="bg-muted/15">
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Follow-up</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Next</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length ? (
              filteredLeads.map((lead) => {
                const href = `/dashboard/leads/${lead.id}`;
                const followUpOverdue =
                  lead.followUpAt &&
                  isBefore(new Date(lead.followUpAt), today) &&
                  lead.status !== "Won" &&
                  lead.status !== "Lost";

                return (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    tabIndex={0}
                    role="button"
                    aria-label={`View ${lead.name} details`}
                    onClick={(event) => {
                      if (shouldIgnoreRowClick(event.target)) return;
                      openLead(href);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      if (shouldIgnoreRowClick(event.target)) return;

                      event.preventDefault();
                      openLead(href);
                    }}
                  >
                    <TableCell onClick={() => openLead(href)}>
                      <Link href={href} className="font-medium hover:underline">
                        {lead.name}
                      </Link>
                      <div className="mt-1 text-muted-foreground text-xs">
                        {[lead.email, lead.phone ? formatPhoneNumber(lead.phone) : undefined]
                          .filter(Boolean)
                          .join(" • ") || "No contact details"}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => openLead(href)}>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={statusClassName(lead.status)}>
                          {lead.status}
                        </Badge>
                        <Badge variant="outline" className={cn("w-fit", priorityClassName(lead.priority))}>
                          {lead.priority}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => openLead(href)}>
                      <div className="font-medium text-sm">{lead.source ?? "Not set"}</div>
                      <div className="text-muted-foreground text-xs">{lead.serviceType ?? "No service type"}</div>
                    </TableCell>
                    <TableCell
                      className={cn(followUpOverdue && "font-medium text-destructive")}
                      onClick={() => openLead(href)}
                    >
                      {formatFollowUp(lead)}
                    </TableCell>
                    <TableCell onClick={() => openLead(href)}>{formatMoney(lead.estimatedValue)}</TableCell>
                    <TableCell>
                      {lead.customerId ? (
                        <CustomerLink customerId={lead.customerId} name={lead.customerName} />
                      ) : (
                        <span className="text-muted-foreground">Not converted</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={href}>
                          {nextActionLabel(lead.status)}
                          <ArrowRight />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {filteredLeads.length ? (
          filteredLeads.map((lead) => (
            <Link
              key={lead.id}
              href={`/dashboard/leads/${lead.id}`}
              className="grid gap-3 rounded-lg border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{lead.name}</div>
                  <div className="truncate text-muted-foreground text-xs">
                    {lead.email ?? formatPhoneNumber(lead.phone ?? "")}
                  </div>
                </div>
                <Badge variant="outline" className={statusClassName(lead.status)}>
                  {lead.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Follow-up</div>
                  <div className="font-medium">{formatFollowUp(lead)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Value</div>
                  <div className="font-medium">{formatMoney(lead.estimatedValue)}</div>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm">
            <p>No results.</p>
            {hasFilters ? (
              <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={resetFilters}>
                Reset filters
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
