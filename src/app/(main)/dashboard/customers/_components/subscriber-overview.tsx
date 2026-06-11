"use client";

import { Users } from "lucide-react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { CreateCustomerState } from "../actions";
import { CreateCustomerDialog } from "./create-customer-dialog";
import type { RecentCustomerRow } from "./recent-customers-table/schema";
import { RecentCustomersTable } from "./recent-customers-table/table";

export function SubscriberOverview({
  createCustomerAction,
  data,
}: {
  createCustomerAction: (state: CreateCustomerState, formData: FormData) => Promise<CreateCustomerState>;
  data: RecentCustomerRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 leading-none">
          <span className={"text-lg"}>Customers</span>
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Users className="size-4 text-muted-foreground" />
          </div>
        </CardTitle>
        <CardDescription>Recent customer records with plan, billing, status, and signup activity.</CardDescription>
        <CardAction className="flex items-center gap-2">
          <CreateCustomerDialog action={createCustomerAction} />
          <div id="customers-export-action" />
        </CardAction>
      </CardHeader>

      <CardContent className="pt-0">
        <RecentCustomersTable data={data} exportSlotId="customers-export-action" />
      </CardContent>
    </Card>
  );
}
