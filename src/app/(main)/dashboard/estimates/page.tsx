import Link from "next/link";

import { NotebookText, Plus } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

import { EstimateRecordsTable } from "./_components/estimate-records-table";
import { getEstimateRecords } from "./_lib/estimate-record-data";

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view estimates"
        description="Estimate records are private to each signed-in account."
      />
    );
  }

  const estimates = await getEstimateRecords(currentUser.id);

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 leading-none">
            <span className={"text-lg"}>Estimates</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <NotebookText className="size-4 text-muted-foreground" />
            </div>
          </CardTitle>
          <CardDescription>
            Work estimates from draft, to sending, to customer decision, to job conversion.
          </CardDescription>
          <CardAction className="flex items-center gap-2">
            <Button asChild size="sm">
              <Link prefetch={false} href="/dashboard/estimates/create">
                <Plus />
                Create
              </Link>
            </Button>
            <div id="estimates-export-action" />
          </CardAction>
        </CardHeader>
        <CardContent className="pt-0">
          <EstimateRecordsTable data={estimates} exportSlotId="estimates-export-action" />
        </CardContent>
      </Card>
    </div>
  );
}
