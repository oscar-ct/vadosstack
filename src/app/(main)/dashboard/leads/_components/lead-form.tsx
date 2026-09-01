"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Pencil, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { UsStateSelect } from "@/components/us-state-select";
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { formatServiceAddress, hasStructuredServiceAddress, toServiceAddressFormFields } from "@/lib/service-address";

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

export function EditLeadDialog({
  action,
  lead,
}: {
  action: (state: LeadMutationState, formData: FormData) => Promise<LeadMutationState>;
  lead: LeadRow;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [phoneDigits, setPhoneDigits] = React.useState(lead.phone ?? "");
  const [serviceLocationFields, setServiceLocationFields] = React.useState(() => toServiceAddressFormFields(lead));
  const [visibleMessage, setVisibleMessage] = React.useState("");
  const legacyServiceLocation = hasStructuredServiceAddress(lead) ? undefined : lead.serviceLocation;
  const serviceLocation =
    formatServiceAddress({ ...serviceLocationFields, serviceLocation: legacyServiceLocation }) ?? "";

  const resetDraft = React.useCallback(() => {
    setPhoneDigits(lead.phone ?? "");
    setServiceLocationFields(toServiceAddressFormFields(lead));
    setVisibleMessage("");
  }, [lead]);

  React.useEffect(() => {
    if (!state.success) {
      setVisibleMessage(state.message);
      return;
    }

    setOpen(false);
    setVisibleMessage("");
    toast.success(state.message || "Lead updated.");
    if (state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
      return;
    }

    router.refresh();
  }, [router, state]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetDraft();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full sm:w-auto">
          <Pencil />
          Edit lead
        </Button>
      </DialogTrigger>
      <DialogContent className="top-0 left-0 grid h-svh max-h-svh w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>Edit lead</DialogTitle>
          <DialogDescription>
            Update the inquiry, follow-up, contact information, and service details.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]">
          <input type="hidden" name="id" value={lead.id} />

          <div className="grid min-h-0 gap-5 overflow-y-auto p-4">
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
                  defaultValue={lead.priority === "High" ? "High" : "Normal"}
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
                  maxLength={14}
                  value={formatPhoneNumber(phoneDigits)}
                  onChange={(event) => setPhoneDigits(normalizePhoneNumber(event.target.value).slice(0, 10))}
                  placeholder="(555) 555-1234"
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
                <NativeSelect id="lead-status" name="status" defaultValue={lead.status} className="w-full">
                  {leadStatuses.map((status) => (
                    <NativeSelectOption key={status} value={status}>
                      {status}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {lead.estimateRecordId ? (
                  <p className="text-muted-foreground text-xs">Estimate updates can also advance this status.</p>
                ) : null}
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
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="col-span-2 grid gap-1">
                <Label>Service location</Label>
                <p className="text-muted-foreground text-xs">
                  This address carries into estimates created from the lead.
                </p>
              </div>
              <input type="hidden" name="serviceLocation" value={serviceLocation} />
              <div className="col-span-2 grid gap-2 sm:col-span-2">
                <Label htmlFor="lead-location-street">Street address</Label>
                <Input
                  id="lead-location-street"
                  name="serviceAddressLine1"
                  value={serviceLocationFields.serviceAddressLine1}
                  onChange={(event) =>
                    setServiceLocationFields((current) => ({ ...current, serviceAddressLine1: event.target.value }))
                  }
                  placeholder="123 Main St"
                />
              </div>
              <div className="col-span-2 grid gap-2 sm:col-span-1">
                <Label htmlFor="lead-location-apt">Apt, suite, unit</Label>
                <Input
                  id="lead-location-apt"
                  name="serviceAddressLine2"
                  value={serviceLocationFields.serviceAddressLine2}
                  onChange={(event) =>
                    setServiceLocationFields((current) => ({ ...current, serviceAddressLine2: event.target.value }))
                  }
                  placeholder="Unit B"
                />
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="lead-location-city">City</Label>
                <Input
                  id="lead-location-city"
                  name="serviceCity"
                  value={serviceLocationFields.serviceCity}
                  onChange={(event) =>
                    setServiceLocationFields((current) => ({ ...current, serviceCity: event.target.value }))
                  }
                  placeholder="Houston"
                />
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="lead-location-state">State</Label>
                <UsStateSelect
                  id="lead-location-state"
                  name="serviceState"
                  value={serviceLocationFields.serviceState}
                  onChange={(event) =>
                    setServiceLocationFields((current) => ({ ...current, serviceState: event.target.value }))
                  }
                />
              </div>
              <div className="col-span-2 grid gap-2 sm:col-span-1">
                <Label htmlFor="lead-location-zip">Zip code</Label>
                <Input
                  id="lead-location-zip"
                  name="servicePostalCode"
                  value={serviceLocationFields.servicePostalCode}
                  onChange={(event) =>
                    setServiceLocationFields((current) => ({ ...current, servicePostalCode: event.target.value }))
                  }
                  placeholder="77001"
                />
              </div>
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

            {visibleMessage ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
                {visibleMessage}
              </p>
            ) : null}
          </div>
          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              <Save />
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
