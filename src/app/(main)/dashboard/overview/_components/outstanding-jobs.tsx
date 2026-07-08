import Link from "next/link";

import { ArrowRight, CheckCircle2, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/customer-billing";

export type OutstandingJob = {
  amountPaid: number;
  id: string;
  balanceDue: number;
  customerName: string;
  finalCost: number;
  invoiceId?: string;
  paymentStatus: string;
  title: string;
};

export function OutstandingJobs({ jobs }: { jobs: OutstandingJob[] }) {
  const totalOutstanding = jobs.reduce((total, job) => total + job.balanceDue, 0);

  return (
    <Card className="min-w-0 rounded-lg border-border bg-card shadow-sm">
      <CardHeader className="border-b pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="grid size-8 place-items-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25">
              <WalletCards className="size-4" />
            </span>
            Receivables
          </CardTitle>
          <CardDescription className="mt-1 text-xs">{formatCurrency(totalOutstanding)} currently open</CardDescription>
        </div>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link prefetch={false} href="/dashboard/jobs">
              View <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-2 pt-0 md:grid-cols-2 2xl:grid-cols-3">
        {jobs.length ? (
          jobs.map((job) => {
            const finalCost = Math.max(job.finalCost, job.amountPaid + job.balanceDue, 0);
            const amountPaid = Math.min(Math.max(job.amountPaid, 0), finalCost);
            const amountDue = Math.max(0, finalCost - amountPaid);
            const paidWidth = finalCost ? Math.round((amountPaid / finalCost) * 100) : 100;
            const dueWidth = finalCost ? 100 - paidWidth : 0;
            const isPaidInFull = amountDue <= 0;

            return (
              <Link
                key={job.id}
                prefetch={false}
                href={`/dashboard/jobs/${job.id}`}
                className="grid min-w-0 gap-3 rounded-md border border-border bg-muted/35 p-3 transition-colors hover:bg-muted/60"
              >
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-sm">{job.title}</div>
                    <div className="truncate text-muted-foreground text-xs">{job.customerName}</div>
                  </div>
                  <div className="max-w-28 truncate text-right font-medium text-sm tabular-nums">
                    {formatCurrency(job.balanceDue)}
                  </div>
                </div>
                <div className="min-w-0 pr-1">
                  <div className="flex h-1.5 overflow-hidden rounded-full bg-background ring-1 ring-border/70">
                    {isPaidInFull ? (
                      <div className="h-full w-full bg-emerald-500" />
                    ) : (
                      <>
                        {amountPaid > 0 ? (
                          <div
                            className="h-full bg-emerald-500"
                            title={`${formatCurrency(amountPaid)} paid`}
                            style={{ width: `${paidWidth}%` }}
                          />
                        ) : null}
                        {amountDue > 0 ? (
                          <div
                            className="h-full bg-amber-500"
                            title={`${formatCurrency(amountDue)} due`}
                            style={{ width: `${dueWidth}%` }}
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-muted-foreground text-xs">
                  <span className="min-w-0 truncate">
                    {formatCurrency(amountPaid)} paid · {formatCurrency(amountDue)} due
                  </span>
                  <span className="shrink-0 text-muted-foreground/80">
                    {job.invoiceId ? "Invoice open" : "Ready to invoice"}
                  </span>
                  <ArrowRight className="size-3.5 shrink-0" />
                </div>
              </Link>
            );
          })
        ) : (
          <div className="grid min-h-36 place-items-center rounded-md border border-dashed bg-muted/20 p-6 text-center md:col-span-2 xl:col-span-3">
            <div>
              <div className="mx-auto grid size-10 place-items-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25">
                <CheckCircle2 className="size-4" />
              </div>
              <p className="mt-3 font-medium text-sm">Receivables are clear</p>
              <p className="mt-1 text-muted-foreground text-xs">Open job balances will appear here.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
