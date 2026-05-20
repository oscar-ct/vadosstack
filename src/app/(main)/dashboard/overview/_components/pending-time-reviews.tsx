import Link from "next/link";

import { format, parseISO } from "date-fns";
import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type PendingTimeReview = {
  id: string;
  action: string;
  employeeName: string;
  employeeNumber: string;
  requestedAt: string;
  workedOn?: string;
};

function formatReviewDate(value?: string) {
  if (!value) return "Time change";

  return format(parseISO(value), "MMM d");
}

export function PendingTimeReviews({ pendingCount, reviews }: { pendingCount: number; reviews: PendingTimeReview[] }) {
  return (
    <Card className="rounded-lg border-border bg-card shadow-sm">
      <CardHeader className="border-b pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="grid size-8 place-items-center rounded-md bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25">
              <Clock3 className="size-4" />
            </span>
            Time approvals
          </CardTitle>
          <CardDescription className="mt-1 text-xs">
            {pendingCount
              ? `${pendingCount} request${pendingCount === 1 ? "" : "s"} waiting`
              : "No employee requests waiting"}
          </CardDescription>
        </div>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link prefetch={false} href="/dashboard/time-tracking">
              Review <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0">
        {reviews.length ? (
          reviews.map((review) => (
            <Link
              key={review.id}
              prefetch={false}
              href={`/dashboard/time-tracking?request=${review.id}`}
              className="grid min-w-0 grid-cols-[auto_1fr] gap-3 rounded-md border border-border bg-muted/35 p-3 transition-colors hover:bg-muted/60 sm:grid-cols-[auto_1fr_auto]"
            >
              <div className="grid size-10 shrink-0 place-items-center rounded-md bg-foreground text-background">
                <Clock3 className="size-4" />
              </div>
              <div className="min-w-0 self-center">
                <div className="truncate font-medium text-sm">{review.employeeName}</div>
                <div className="truncate text-muted-foreground text-xs">
                  #{review.employeeNumber} · {review.action} request for {formatReviewDate(review.workedOn)}
                </div>
              </div>
              <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end sm:self-center">
                <span className="text-[11px] text-muted-foreground">
                  {format(parseISO(review.requestedAt), "MMM d")}
                </span>
                <Badge variant="outline" className="rounded-md px-2 py-0.5 font-medium text-[10px]">
                  Pending
                </Badge>
              </div>
            </Link>
          ))
        ) : (
          <div className="grid min-h-36 place-items-center rounded-md border border-dashed bg-muted/20 p-6 text-center">
            <div>
              <div className="mx-auto grid size-10 place-items-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25">
                <CheckCircle2 className="size-4" />
              </div>
              <p className="mt-3 font-medium text-sm">Time queue is clear</p>
              <p className="mt-1 text-muted-foreground text-xs">New employee requests will appear here.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
