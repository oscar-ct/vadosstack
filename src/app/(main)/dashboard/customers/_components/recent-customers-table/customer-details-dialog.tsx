"use client";

import Link from "next/link";

import { format, parseISO } from "date-fns";
import {
  BriefcaseBusiness,
  CalendarDays,
  CreditCard,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  ReceiptText,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { getCustomerBillingDisplay } from "./columns";
import type { RecentCustomerRow } from "./schema";

type CustomerAddress = NonNullable<RecentCustomerRow["addresses"]>[number];

function DetailItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-sm">{value ?? "Not on file"}</span>
    </div>
  );
}

function formatAddress(address: CustomerAddress) {
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(", ");

  return [address.line1, address.line2, cityLine, address.country].filter(Boolean).join("\n");
}

function getCustomerAddresses(customer: RecentCustomerRow) {
  return customer.addresses?.length ? customer.addresses : customer.address ? [customer.address] : [];
}

function formatDate(value?: string) {
  return value ? format(parseISO(value), "MMMM d, yyyy") : "No jobs yet";
}

export function CustomerDetailsDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: RecentCustomerRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const joinedDate = customer ? format(parseISO(customer.joined), "MMMM d, yyyy") : "";
  const addresses = customer ? getCustomerAddresses(customer) : [];
  const phoneNumbers = customer?.phoneNumbers ?? [];
  const jobHistory = customer?.jobHistory ?? [];
  const invoiceHistory = customer?.invoiceHistory ?? [];
  const billingDisplay = customer ? getCustomerBillingDisplay(customer) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {customer ? (
          <>
            <DialogHeader className="border-b p-4 pr-12">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-md border bg-muted">
                  <UserRound className="size-5 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="truncate">{customer.name}</DialogTitle>
                  <DialogDescription className="truncate">Customer #{customer.id}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <ScrollArea className="max-h-[calc(100svh-9rem)]">
              <div className="grid gap-5 p-4">
                <section className="grid gap-3">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <Mail className="size-4 text-muted-foreground" />
                    Contact
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailItem label="Email" value={customer.email} />
                    <DetailItem label="Primary phone" value={phoneNumbers[0]?.value} />
                  </div>
                  {phoneNumbers.length > 1 ? (
                    <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
                      {phoneNumbers.slice(1).map((phone) => (
                        <div key={`${phone.label}-${phone.value}`} className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground text-xs">{phone.label}</span>
                          <span className="font-medium text-sm">{phone.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>

                <Separator />

                <section className="grid gap-3">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <MapPin className="size-4 text-muted-foreground" />
                    Addresses
                  </div>
                  {addresses.length ? (
                    <div className="grid gap-2">
                      {addresses.map((address, index) => (
                        <div
                          key={`${address.label ?? "address"}-${address.line1}`}
                          className="grid gap-1 rounded-md border border-emerald-200/80 bg-emerald-50/60 p-3 dark:bg-emerald-950/20"
                        >
                          <span className="font-medium text-xs">{address.label ?? `Address ${index + 1}`}</span>
                          <p className="whitespace-pre-line text-sm">{formatAddress(address)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border bg-muted/20 p-3 text-muted-foreground text-sm">Not on file</p>
                  )}
                </section>

                <Separator />

                <section className="grid gap-3">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <CreditCard className="size-4 text-muted-foreground" />
                    Account
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailItem label="Billing" value={billingDisplay?.label} />
                    <DetailItem label="Outstanding amount" value={billingDisplay?.amountLabel} />
                    <DetailItem label="Billing detail" value={billingDisplay?.detail} />
                    <DetailItem label="Last scheduled job" value={formatDate(customer.lastScheduledJobDate)} />
                    <DetailItem
                      label="Job history"
                      value={customer.jobCount === 1 ? "1 recorded job" : `${customer.jobCount} recorded jobs`}
                    />
                    <DetailItem label="Joined" value={joinedDate} />
                  </div>
                </section>

                <Separator />

                <section className="grid gap-3">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <BriefcaseBusiness className="size-4 text-muted-foreground" />
                    <span>Job history</span>
                    {customer.outstandingAmount ? (
                      <Badge
                        variant="outline"
                        className="ml-auto border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                      >
                        {customer.outstandingAmount} due
                      </Badge>
                    ) : null}
                  </div>
                  {jobHistory.length ? (
                    <div className="grid overflow-hidden rounded-md border border-indigo-200/80 bg-indigo-50/60 dark:bg-indigo-950/20">
                      {jobHistory.map((job) => (
                        <div
                          key={job.id}
                          className="grid gap-3 border-b bg-muted/10 p-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <div className="grid min-w-0 gap-2">
                            <div className="grid gap-1">
                              <span className="truncate font-medium text-sm">{job.title}</span>
                              <div className="grid grid-cols-2 sm:max-w-sm">
                                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                                  <CalendarDays className="size-3" />
                                  {format(parseISO(job.date), "MMM d, yyyy")}
                                </span>
                                <Badge variant="outline" className="px-1.5 text-muted-foreground text-xs">
                                  {job.status}
                                </Badge>
                                {/*{job.paymentStatus ? (*/}
                                {/*  <Badge*/}
                                {/*    variant="outline"*/}
                                {/*    className={`px-1.5 text-xs ${paymentBadgeClassName(job.paymentStatus)}`}*/}
                                {/*  >*/}
                                {/*    {job.paymentStatus}*/}
                                {/*  </Badge>*/}
                                {/*) : null}*/}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 overflow-hidden rounded-md border bg-background sm:max-w-sm">
                              <div className="grid gap-0.5 border-r p-2">
                                <span className="text-[11px] text-muted-foreground uppercase">Cost</span>
                                <span className="font-medium text-sm">{job.total ?? "Not set"}</span>
                              </div>
                              <div className="grid gap-0.5 p-2">
                                <span className="text-[11px] text-muted-foreground uppercase">Paid</span>
                                <span className="font-medium text-sm">{job.amountPaid ?? "$0.00"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-start justify-self-start sm:justify-self-end">
                            {job.linkedJobId ? (
                              <Button asChild variant="outline" size="sm">
                                <Link prefetch={false} href={`/dashboard/jobs?job=${job.linkedJobId}`}>
                                  Open job
                                  <ExternalLink className="size-3.5" />
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border bg-muted/20 p-3 text-muted-foreground text-sm">
                      No jobs linked yet. This section is ready to show records from the future Jobs table.
                    </p>
                  )}
                </section>

                <Separator />

                <section className="grid gap-3">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <ReceiptText className="size-4 text-muted-foreground" />
                    Invoice history
                  </div>
                  {invoiceHistory.length ? (
                    <div className="grid gap-2">
                      {invoiceHistory.map((invoice) => (
                        <div
                          key={invoice.id}
                          className="grid gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-[1fr_auto]"
                        >
                          <div className="grid gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-sm">Invoice #{invoice.id}</span>
                              <Badge variant="outline">{invoice.status}</Badge>
                            </div>
                            <span className="flex items-center gap-1 text-muted-foreground text-xs">
                              <CalendarDays className="size-3" />
                              Issued {format(parseISO(invoice.issuedAt), "MMM d, yyyy")}
                              {invoice.dueAt ? ` · Due ${format(parseISO(invoice.dueAt), "MMM d, yyyy")}` : ""}
                            </span>
                          </div>
                          <span className="font-medium text-sm">{invoice.total}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border bg-muted/20 p-3 text-muted-foreground text-sm">
                      No invoices linked yet. This section is ready to show records from the Invoices dashboard.
                    </p>
                  )}
                </section>

                <Separator />

                <section className="grid gap-3">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <FileText className="size-4 text-muted-foreground" />
                    Notes
                  </div>
                  <p className="rounded-md border bg-muted/20 p-3 text-sm">{customer.notes || "No notes on file."}</p>
                </section>
              </div>
            </ScrollArea>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
