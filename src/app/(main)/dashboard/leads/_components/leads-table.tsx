"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { format, isBefore, startOfToday } from "date-fns";
import { ArrowRight } from "lucide-react";

import { CustomerLink } from "@/components/customer-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPhoneNumber } from "@/lib/phone";
import { cn, formatCurrency } from "@/lib/utils";

import type { LeadRow } from "../_lib/lead-data";

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

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const router = useRouter();
  const today = startOfToday();

  function openLead(href: string) {
    router.push(href);
  }

  return (
    <>
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
            {leads.map((lead) => {
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
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {leads.map((lead) => (
          <Link key={lead.id} href={`/dashboard/leads/${lead.id}`} className="grid gap-3 rounded-lg border bg-card p-4">
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
        ))}
      </div>
    </>
  );
}
