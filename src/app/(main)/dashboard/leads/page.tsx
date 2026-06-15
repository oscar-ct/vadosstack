import { CalendarClock, CircleDollarSign, UserRoundCheck, UsersRound } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

import { CreateLeadDialog } from "./_components/create-lead-dialog";
import { LeadsTable } from "./_components/leads-table";
import { getLeads, summarizeLeads } from "./_lib/lead-data";
import { createLeadAction } from "./actions";

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-medium text-muted-foreground text-xs sm:text-sm">{label}</p>
        {icon}
      </div>
      <p className="mt-2 font-semibold text-xl tracking-tight sm:text-2xl">{value}</p>
    </div>
  );
}

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return <AuthRequiredState title="Sign in to view leads" description="Lead records are private to each account." />;
  }

  const leads = await getLeads(currentUser.id);
  const summary = summarizeLeads(leads);

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <div className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          icon={<UsersRound className="size-4 text-muted-foreground" />}
          label="Total leads"
          value={summary.total}
        />
        <StatCard icon={<CalendarClock className="size-4 text-amber-600" />} label="Open leads" value={summary.open} />
        <StatCard icon={<UserRoundCheck className="size-4 text-emerald-600" />} label="Won" value={summary.won} />
        <StatCard
          icon={<CircleDollarSign className="size-4 text-sky-600" />}
          label="Needs follow-up"
          value={summary.needsFollowUp}
        />
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 leading-none">
            <span className="text-lg">Leads</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <UsersRound className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>
            Track inquiries before they become customers, estimates, jobs, or lost opportunities.
          </CardDescription>
          <CardAction>
            <CreateLeadDialog action={createLeadAction} />
          </CardAction>
        </CardHeader>
        <CardContent className="pt-0">
          {leads.length ? (
            <LeadsTable leads={leads} />
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="font-medium">No leads yet</p>
              <p className="mt-1 text-muted-foreground text-sm">Create a lead when someone asks about future work.</p>
              <div className="mt-4 flex justify-center">
                <CreateLeadDialog action={createLeadAction} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
