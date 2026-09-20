"use client";

import * as React from "react";

import { useSearchParams } from "next/navigation";

import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  MailCheck,
  MailWarning,
  Search,
  Send,
  UserRound,
  X,
} from "lucide-react";

import { CustomerLink } from "@/components/customer-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkspaceLink as Link, useWorkspaceRouter as useRouter } from "@/components/workspace-path-provider";
import { cn } from "@/lib/utils";

export type EmailHistoryItem = {
  id: string;
  bodyText?: string;
  customerId?: string;
  documentHref?: string;
  documentNumber: string;
  documentTotal: string;
  documentType: string;
  errorMessage?: string;
  recipientEmail?: string;
  recipientName?: string;
  senderEmail?: string;
  sentAt: string;
  sentByEmail?: string;
  sentByName?: string;
  status: "error" | "success";
  subject?: string;
};

type EmailHistoryStatus = "all" | "error" | "success";

type EmailHistoryDashboardProps = {
  errorCount: number;
  filteredCount: number;
  initialQuery: string;
  initialStatus: EmailHistoryStatus;
  page: number;
  pageSize: number;
  records: EmailHistoryItem[];
  successCount: number;
  totalCount: number;
  totalPages: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "America/Chicago",
    year: "numeric",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: EmailHistoryItem["status"] }) {
  const isSuccess = status === "success";

  return (
    <Badge
      variant={isSuccess ? "secondary" : "destructive"}
      className={cn(isSuccess && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300")}
    >
      {isSuccess ? <CheckCircle2 /> : <MailWarning />}
      {isSuccess ? "Sent" : "Error"}
    </Badge>
  );
}

function DocumentLink({ record }: { record: EmailHistoryItem }) {
  if (!record.documentHref) {
    return <span className="font-medium">{record.documentNumber}</span>;
  }

  return (
    <Link
      href={record.documentHref}
      prefetch={false}
      className="pointer-events-auto inline-flex max-w-full items-center gap-1 font-medium underline-offset-4 hover:underline"
    >
      <span className="truncate">{record.documentNumber}</span>
      <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function MessageSheet({
  record,
  onOpenChange,
}: {
  record: EmailHistoryItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(record)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {record ? (
          <>
            <SheetHeader className="border-b pr-12">
              <div className="mb-2 flex items-center gap-2">
                <StatusBadge status={record.status} />
                <span className="text-muted-foreground text-xs">{record.documentType}</span>
              </div>
              <SheetTitle className="text-lg leading-snug">{record.subject ?? "No subject"}</SheetTitle>
              <SheetDescription>
                {record.recipientEmail ? `To ${record.recipientEmail}` : "Recipient unavailable"} ·{" "}
                {formatDate(record.sentAt)}
              </SheetDescription>
            </SheetHeader>

            <div className="grid gap-5 px-4 pb-6">
              <dl className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-muted-foreground text-xs">Recipient</dt>
                  <dd className="mt-1 truncate font-medium">
                    {record.recipientName ?? record.recipientEmail ?? "Unavailable"}
                  </dd>
                  {record.recipientName && record.recipientEmail ? (
                    <dd className="truncate text-muted-foreground text-xs">{record.recipientEmail}</dd>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground text-xs">Sent by</dt>
                  <dd className="mt-1 truncate font-medium">
                    {record.sentByName ?? record.sentByEmail ?? "Legacy record"}
                  </dd>
                  <dd className="truncate text-muted-foreground text-xs">
                    {record.senderEmail ? `via ${record.senderEmail}` : (record.sentByEmail ?? "Mailbox unavailable")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Related record</dt>
                  <dd className="mt-1">
                    <DocumentLink record={record} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Amount</dt>
                  <dd className="mt-1 font-medium tabular-nums">{record.documentTotal}</dd>
                </div>
              </dl>

              {record.errorMessage ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                  <div className="flex items-center gap-2 font-medium text-destructive text-sm">
                    <MailWarning className="size-4" />
                    Delivery error
                  </div>
                  <p className="mt-2 text-sm">{record.errorMessage}</p>
                </div>
              ) : null}

              <section>
                <h3 className="font-medium text-sm">Message</h3>
                {record.bodyText ? (
                  <div className="mt-2 whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-6">
                    {record.bodyText}
                  </div>
                ) : (
                  <div className="mt-2 rounded-lg border border-dashed p-6 text-center">
                    <MailCheck className="mx-auto size-7 text-muted-foreground" />
                    <p className="mt-2 font-medium text-sm">Message content wasn&apos;t captured</p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      This record predates body capture or the message did not reach the composition step.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function EmailHistoryDashboard({
  errorCount,
  filteredCount,
  initialQuery,
  initialStatus,
  page,
  pageSize,
  records,
  successCount,
  totalCount,
  totalPages,
}: EmailHistoryDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(initialQuery);
  const [selectedRecord, setSelectedRecord] = React.useState<EmailHistoryItem | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => setQuery(initialQuery), [initialQuery]);

  const updateParams = React.useCallback(
    (updates: { page?: number; pageSize?: number; query?: string; status?: EmailHistoryStatus }) => {
      const params = new URLSearchParams(searchParams.toString());
      const nextQuery = updates.query ?? initialQuery;
      const nextStatus = updates.status ?? initialStatus;

      if (nextQuery) params.set("q", nextQuery);
      else params.delete("q");

      if (nextStatus === "all") params.delete("status");
      else params.set("status", nextStatus);

      const nextPageSize = updates.pageSize ?? pageSize;
      if (nextPageSize === 20) params.delete("pageSize");
      else params.set("pageSize", String(nextPageSize));

      const nextPage = updates.page ?? 1;
      if (nextPage > 1) params.set("page", String(nextPage));
      else params.delete("page");

      const suffix = params.toString();
      startTransition(() => router.replace(`/dashboard/email-history${suffix ? `?${suffix}` : ""}`, { scroll: false }));
    },
    [initialQuery, initialStatus, pageSize, router, searchParams],
  );

  const firstResult = filteredCount ? (page - 1) * pageSize + 1 : 0;
  const lastResult = Math.min(page * pageSize, filteredCount);

  const statOptions: Array<{
    count: number;
    icon: React.ReactNode;
    label: string;
    status: EmailHistoryStatus;
  }> = [
    { count: totalCount, icon: <Send className="size-4" />, label: "Total emails", status: "all" },
    {
      count: successCount,
      icon: <CheckCircle2 className="size-4 text-emerald-600" />,
      label: "Successful",
      status: "success",
    },
    {
      count: errorCount,
      icon: <MailWarning className="size-4 text-destructive" />,
      label: "Needs attention",
      status: "error",
    },
  ];

  return (
    <>
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        {statOptions.map((option) => {
          const active = initialStatus === option.status;

          return (
            <button
              key={option.status}
              type="button"
              aria-pressed={active}
              disabled={isPending}
              onClick={() => updateParams({ status: option.status })}
              className={cn(
                "rounded-lg border bg-card p-4 text-left text-card-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
                active && "border-primary/40 bg-primary/5 ring-1 ring-primary/15",
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-medium text-muted-foreground text-sm">{option.label}</span>
                <span className="text-muted-foreground">{option.icon}</span>
              </span>
              <span className="mt-2 block font-semibold text-2xl tabular-nums tracking-tight">{option.count}</span>
            </button>
          );
        })}
      </div>

      <form
        className="w-full sm:max-w-md"
        onSubmit={(event) => {
          event.preventDefault();
          updateParams({ query: query.trim() });
        }}
      >
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search email history"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search record, recipient, subject, or sender"
            className="pr-8 pl-8"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                setQuery("");
                updateParams({ query: "" });
              }}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <button type="submit" className="sr-only" disabled={isPending || query.trim() === initialQuery}>
          Search email history
        </button>
      </form>

      {records.length ? (
        <>
          <div
            className={cn(
              "hidden min-w-0 max-w-full overflow-hidden rounded-lg border bg-card transition-opacity md:block",
              isPending && "opacity-60",
            )}
          >
            <Table className="min-w-[56rem] table-fixed">
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="w-[12%]">Document</TableHead>
                  <TableHead className="w-[18%]">Recipient</TableHead>
                  <TableHead className="w-[24%]">Subject</TableHead>
                  <TableHead className="w-[11%] text-right">Amount</TableHead>
                  <TableHead className="w-[16%]">Sent by</TableHead>
                  <TableHead className="w-[13%]">Sent at</TableHead>
                  <TableHead className="w-[8%]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow
                    key={record.id}
                    tabIndex={0}
                    aria-label={`View message for ${record.documentNumber}`}
                    className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    onClick={(event) => {
                      if (event.target instanceof HTMLElement && event.target.closest("a, button, input, label"))
                        return;
                      setSelectedRecord(record);
                    }}
                    onKeyDown={(event) => {
                      if (event.target instanceof HTMLElement && event.target.closest("a, button, input, label"))
                        return;
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setSelectedRecord(record);
                    }}
                  >
                    <TableCell className="min-w-0 max-w-40 overflow-hidden">
                      <DocumentLink record={record} />
                      <div className="text-muted-foreground text-xs">{record.documentType}</div>
                    </TableCell>
                    <TableCell className="min-w-0 max-w-48 overflow-hidden">
                      <CustomerLink
                        customerId={record.customerId}
                        name={record.recipientName}
                        fallback="No name"
                        className="block truncate font-medium"
                      />
                      <div className="truncate text-muted-foreground text-xs">
                        {record.recipientEmail ?? "No email"}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 max-w-72 overflow-hidden">
                      <div className="truncate font-medium">{record.subject ?? "No subject"}</div>
                      {record.errorMessage ? (
                        <div className="truncate text-destructive text-xs">{record.errorMessage}</div>
                      ) : (
                        <div className="truncate text-muted-foreground text-xs">
                          {record.bodyText ?? "Message preview unavailable"}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{record.documentTotal}</TableCell>
                    <TableCell className="min-w-0 max-w-48 overflow-hidden">
                      <div className="truncate font-medium">
                        {record.sentByName ?? record.sentByEmail ?? "Legacy record"}
                      </div>
                      <div className="truncate text-muted-foreground text-xs">
                        {record.senderEmail
                          ? `via ${record.senderEmail}`
                          : (record.sentByEmail ?? "Mailbox unavailable")}
                      </div>
                    </TableCell>
                    <TableCell className="overflow-hidden text-muted-foreground">
                      <span className="block truncate">{formatDate(record.sentAt)}</span>
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <StatusBadge status={record.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className={cn("space-y-3 transition-opacity md:hidden", isPending && "opacity-60")}>
            {records.map((record) => (
              <div
                key={record.id}
                className="relative grid min-w-0 gap-3 overflow-hidden rounded-lg border bg-background p-3 transition-colors hover:bg-muted/30"
              >
                <button
                  type="button"
                  aria-label={`View message for ${record.documentNumber}`}
                  className="absolute inset-0 z-0 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  onClick={() => setSelectedRecord(record)}
                />
                <div className="pointer-events-none relative z-10 flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <DocumentLink record={record} />
                    <div className="text-muted-foreground text-xs">{record.documentType}</div>
                  </div>
                  <StatusBadge status={record.status} />
                </div>

                <div className="pointer-events-none relative z-10 grid min-w-0 gap-2 text-sm">
                  <div className="flex min-w-0 items-start gap-2">
                    <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <CustomerLink
                        customerId={record.customerId}
                        name={record.recipientName}
                        fallback="No name"
                        className="pointer-events-auto block truncate font-medium"
                      />
                      <div className="truncate text-muted-foreground text-xs">
                        {record.recipientEmail ?? "No email"}
                      </div>
                    </div>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <Send className="size-4 shrink-0" />
                    <span className="truncate">
                      {record.sentByName ?? record.sentByEmail ?? "Legacy record"}
                      {record.senderEmail ? ` via ${record.senderEmail}` : ""}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2">
                    <span className="font-medium text-muted-foreground text-xs uppercase">Amount</span>
                    <span className="shrink-0 font-semibold tabular-nums">{record.documentTotal}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock3 className="size-4 shrink-0" />
                    <span>{formatDate(record.sentAt)}</span>
                  </div>
                </div>

                <div
                  className={cn(
                    "pointer-events-none relative z-10 rounded-md bg-muted/50 px-3 py-2 text-sm",
                    record.errorMessage && "bg-destructive/5 text-destructive",
                  )}
                >
                  <div className="truncate font-medium">{record.subject ?? "No subject"}</div>
                  <div
                    className={cn(
                      "mt-0.5 line-clamp-2 text-muted-foreground text-xs",
                      record.errorMessage && "text-destructive",
                    )}
                  >
                    {record.errorMessage ?? record.bodyText ?? "Message preview unavailable"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
          <MailCheck className="size-10 text-muted-foreground" />
          <h2 className="mt-3 font-semibold text-base">
            {totalCount ? "No emails match these filters" : "No emailed records yet"}
          </h2>
          <p className="mt-1 max-w-md text-muted-foreground text-sm">
            {totalCount
              ? "Try a different search or select another delivery status."
              : "Sent estimates, invoices, orders, and general messages will appear here."}
          </p>
        </div>
      )}

      {filteredCount ? (
        <div className="flex flex-col gap-3 border-t px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="hidden flex-1 text-muted-foreground text-sm lg:block">
            Showing{" "}
            <span className="font-medium text-foreground tabular-nums">
              {firstResult}–{lastResult}
            </span>{" "}
            of <span className="font-medium text-foreground tabular-nums">{filteredCount}</span> emails
          </p>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="email-history-rows-per-page" className="font-medium text-sm">
                Rows per page
              </Label>
              <Select
                value={String(pageSize)}
                disabled={isPending}
                onValueChange={(value) => updateParams({ pageSize: Number(value) })}
              >
                <SelectTrigger id="email-history-rows-per-page" size="sm" className="w-20">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectGroup>
                    {[20, 30, 40, 50].map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-center font-medium text-sm sm:w-fit">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center justify-center gap-2 sm:ml-auto lg:ml-0">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="hidden size-8 lg:flex"
                disabled={page <= 1 || isPending}
                onClick={() => updateParams({ page: 1 })}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page <= 1 || isPending}
                onClick={() => updateParams({ page: page - 1 })}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page >= totalPages || isPending}
                onClick={() => updateParams({ page: page + 1 })}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="hidden size-8 lg:flex"
                disabled={page >= totalPages || isPending}
                onClick={() => updateParams({ page: totalPages })}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <MessageSheet record={selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)} />
    </>
  );
}
