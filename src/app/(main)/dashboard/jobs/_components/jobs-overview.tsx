"use client";

import Link from "next/link";

import { BriefcaseBusiness, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { JobRow } from "./jobs-table/schema";
import { JobsTable } from "./jobs-table/table";

export function JobsOverview({ data }: { data: JobRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 leading-none">
          <span className="text-lg">Jobs</span>
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BriefcaseBusiness className="size-4 text-muted-foreground" />
          </div>
        </CardTitle>
        <CardDescription>
          Service jobs with title, description, customer, schedule, cost, location, and status details.
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link prefetch={false} href="/dashboard/jobs/create">
              <Plus />
              Create job
            </Link>
          </Button>
          <div id="jobs-export-action" />
        </CardAction>
      </CardHeader>

      <CardContent className="pt-0">
        <JobsTable data={data} exportSlotId="jobs-export-action" />
      </CardContent>
    </Card>
  );
}
