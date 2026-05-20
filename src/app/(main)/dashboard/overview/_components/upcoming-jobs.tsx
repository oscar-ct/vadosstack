import Link from "next/link";

import { format } from "date-fns";
import { ArrowRight, BriefcaseBusiness, CalendarPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type UpcomingJob = {
  id: string;
  customerName: string;
  dateBegin: string;
  isOverdue: boolean;
  status: string;
  title: string;
};

export function UpcomingJobs({ jobs }: { jobs: UpcomingJob[] }) {
  return (
    <Card className="rounded-lg border-border bg-card shadow-sm">
      <CardHeader className="border-b pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="grid size-8 place-items-center rounded-md bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/25">
              <BriefcaseBusiness className="size-4" />
            </span>
            Schedule
          </CardTitle>
          <CardDescription className="mt-1 text-xs">
            {jobs.length
              ? `${jobs.length} scheduled or overdue service ${jobs.length === 1 ? "job" : "jobs"}`
              : "No jobs scheduled"}
          </CardDescription>
        </div>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link prefetch={false} href="/dashboard/jobs">
              View <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0">
        {jobs.length ? (
          jobs.map((job) => {
            const jobDate = new Date(job.dateBegin);

            return (
              <Link
                key={job.id}
                prefetch={false}
                href={`/dashboard/jobs?job=${job.id}`}
                className="grid min-w-0 grid-cols-[auto_1fr] gap-3 rounded-md border border-border bg-muted/35 p-3 transition-colors hover:bg-muted/60 sm:grid-cols-[auto_1fr_auto]"
              >
                <div className="size-11 shrink-0 overflow-hidden rounded-md border border-border bg-background">
                  <div className="grid h-1/3 place-items-center border-b bg-muted font-medium text-[10px] text-muted-foreground uppercase leading-none">
                    {format(jobDate, "MMM")}
                  </div>
                  <div className="grid h-2/3 place-items-center font-semibold text-lg leading-none">
                    {format(jobDate, "d")}
                  </div>
                </div>

                <div className="min-w-0 self-center">
                  <div className="truncate font-medium text-sm">{job.title}</div>
                  <div className="truncate text-muted-foreground text-xs">{job.customerName}</div>
                </div>

                <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:justify-end sm:self-center">
                  <span className="text-[11px] text-muted-foreground">{format(jobDate, "EEE")}</span>
                  <Badge
                    variant="outline"
                    className={`rounded-md px-2 py-0.5 font-medium text-[10px] ${
                      job.isOverdue ? "border-amber-300 text-amber-700 dark:border-amber-900 dark:text-amber-400" : ""
                    }`}
                  >
                    {job.isOverdue ? "Overdue" : job.status}
                  </Badge>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="grid min-h-36 place-items-center rounded-md border border-dashed bg-muted/20 p-6 text-center">
            <div>
              <div className="mx-auto grid size-10 place-items-center rounded-md bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/25">
                <CalendarPlus className="size-4" />
              </div>
              <p className="mt-3 font-medium text-sm">Schedule is open</p>
              <p className="mt-1 text-muted-foreground text-xs">Upcoming jobs will appear here.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
