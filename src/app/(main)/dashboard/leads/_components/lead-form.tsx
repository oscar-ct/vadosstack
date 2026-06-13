"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/phone";

import type { LeadRow } from "../_lib/lead-data";
import type { LeadMutationState } from "../actions";
import { leadPriorities, leadServiceTypes, leadSources, leadStatuses } from "../constants";

const initialState: LeadMutationState = {
  success: false,
  message: "",
};

function formatDateInput(value?: string) {
  return value ? value.slice(0, 10) : "";
}

export function LeadForm({
  action,
  lead,
}: {
  action: (state: LeadMutationState, formData: FormData) => Promise<LeadMutationState>;
  lead: LeadRow;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [phoneDigits, setPhoneDigits] = React.useState(lead.phone ?? "");

  React.useEffect(() => {
    if (!state.success) return;

    toast.success(state.message || "Lead updated.");
    if (state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [router, state]);

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Lead details</CardTitle>
        <CardDescription>
          Capture the inquiry, next follow-up, and enough context to turn it into an estimate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          <input type="hidden" name="id" value={lead.id} />

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="lead-name">Name</Label>
              <Input id="lead-name" name="name" defaultValue={lead.name} placeholder="Jane Smith" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-priority">Priority</Label>
              <NativeSelect
                id="lead-priority"
                name="priority"
                defaultValue={lead.priority ?? "Normal"}
                className="w-full"
              >
                {leadPriorities.map((priority) => (
                  <NativeSelectOption key={priority} value={priority}>
                    {priority}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                name="email"
                type="email"
                defaultValue={lead.email}
                placeholder="jane@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                maxLength={12}
                value={formatPhoneNumber(phoneDigits)}
                onChange={(event) => setPhoneDigits(normalizePhoneNumber(event.target.value).slice(0, 10))}
                placeholder="555-555-1234"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-follow-up">Follow-up date</Label>
              <Input
                id="lead-follow-up"
                name="followUpAt"
                type="date"
                defaultValue={formatDateInput(lead.followUpAt)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="lead-status">Status</Label>
              <NativeSelect id="lead-status" name="status" defaultValue={lead.status ?? "New"} className="w-full">
                {leadStatuses.map((status) => (
                  <NativeSelectOption key={status} value={status}>
                    {status}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-source">Source</Label>
              <NativeSelect id="lead-source" name="source" defaultValue={lead.source ?? ""} className="w-full">
                <NativeSelectOption value="">Not set</NativeSelectOption>
                {leadSources.map((source) => (
                  <NativeSelectOption key={source} value={source}>
                    {source}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-service-type">Service type</Label>
              <NativeSelect
                id="lead-service-type"
                name="serviceType"
                defaultValue={lead.serviceType ?? ""}
                className="w-full"
              >
                <NativeSelectOption value="">Not set</NativeSelectOption>
                {leadServiceTypes.map((serviceType) => (
                  <NativeSelectOption key={serviceType} value={serviceType}>
                    {serviceType}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-value">Estimated value</Label>
              <Input
                id="lead-value"
                name="estimatedValue"
                type="number"
                min="0"
                step="0.01"
                defaultValue={lead.estimatedValue}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="lead-location">Service location</Label>
            <Input
              id="lead-location"
              name="serviceLocation"
              defaultValue={lead.serviceLocation}
              placeholder="123 Main St, Houston, TX"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="lead-notes">Notes</Label>
              <Textarea
                id="lead-notes"
                name="notes"
                defaultValue={lead.notes}
                placeholder="What did they ask for?"
                className="min-h-28"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-lost-reason">Lost reason</Label>
              <Textarea
                id="lead-lost-reason"
                name="lostReason"
                defaultValue={lead.lostReason}
                placeholder="Only needed when the lead is lost."
                className="min-h-28"
              />
            </div>
          </div>

          {state.message && !state.success ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
              {state.message}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              <Save />
              {isPending ? "Saving..." : "Save lead"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
