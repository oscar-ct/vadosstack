"use client";

import { Users } from "lucide-react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { CreateCustomerState, CustomerMutationState } from "../actions";
import { CreateCustomerDialog } from "./create-customer-dialog";
import type { RecentCustomerRow } from "./recent-customers-table/schema";
import { RecentCustomersTable } from "./recent-customers-table/table";

export function SubscriberOverview({
  createCustomerAction,
  data,
  deleteCustomerAction,
  updateCustomerAction,
}: {
  createCustomerAction: (state: CreateCustomerState, formData: FormData) => Promise<CreateCustomerState>;
  data: RecentCustomerRow[];
  deleteCustomerAction: (state: CustomerMutationState, formData: FormData) => Promise<CustomerMutationState>;
  updateCustomerAction: (state: CustomerMutationState, formData: FormData) => Promise<CustomerMutationState>;
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
        <RecentCustomersTable
          data={data}
          deleteCustomerAction={deleteCustomerAction}
          exportSlotId="customers-export-action"
          updateCustomerAction={updateCustomerAction}
        />
      </CardContent>
    </Card>
  );
}
