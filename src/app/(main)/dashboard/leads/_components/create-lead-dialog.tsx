"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Plus } from "lucide-react";
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
import { emptyServiceAddressFields, formatServiceAddress } from "@/lib/service-address";

import type { LeadMutationState } from "../actions";
import { leadPriorities, leadServiceTypes, leadSources } from "../constants";

const initialState: LeadMutationState = {
  success: false,
  message: "",
};

export function CreateLeadDialog({
  action,
}: {
  action: (state: LeadMutationState, formData: FormData) => Promise<LeadMutationState>;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [phoneDigits, setPhoneDigits] = React.useState("");
  const [serviceLocationFields, setServiceLocationFields] = React.useState(emptyServiceAddressFields);
  const serviceLocation = formatServiceAddress(serviceLocationFields) ?? "";
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [visibleMessage, setVisibleMessage] = React.useState("");

  const resetForm = React.useCallback(() => {
    formRef.current?.reset();
    setPhoneDigits("");
    setServiceLocationFields(emptyServiceAddressFields());
  }, []);

  React.useEffect(() => {
    if (!state.success) {
      setVisibleMessage(state.message);
      return;
    }

    resetForm();
    setVisibleMessage("");
    setOpen(false);
    toast.success(state.message || "Lead created.");

    if (state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [resetForm, router, state]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetForm();
          setVisibleMessage("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Create
        </Button>
      </DialogTrigger>
      <DialogContent className="top-0 left-0 grid h-svh max-h-svh w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>Create lead</DialogTitle>
          <DialogDescription>Capture a new inquiry before it becomes a customer or estimate.</DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]">
          <input type="hidden" name="status" value="New" />

          <div className="grid min-h-0 gap-4 overflow-y-auto p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="lead-dialog-name">Name</Label>
                <Input id="lead-dialog-name" name="name" placeholder="Jane Smith" required />
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="lead-dialog-email">Email</Label>
                <Input id="lead-dialog-email" name="email" type="email" placeholder="jane@example.com" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="lead-dialog-phone">Phone</Label>
                <Input
                  id="lead-dialog-phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={14}
                  value={formatPhoneNumber(phoneDigits)}
                  onChange={(event) => setPhoneDigits(normalizePhoneNumber(event.target.value).slice(0, 10))}
                  placeholder="(555) 555-1234"
                />
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="lead-dialog-follow-up">Follow-up date</Label>
                <Input id="lead-dialog-follow-up" name="followUpAt" type="date" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="lead-dialog-source">Source</Label>
                <NativeSelect id="lead-dialog-source" name="source" defaultValue="" className="w-full min-w-0">
                  <NativeSelectOption value="">Not set</NativeSelectOption>
                  {leadSources.map((source) => (
                    <NativeSelectOption key={source} value={source}>
                      {source}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="lead-dialog-service-type">Service type</Label>
                <NativeSelect
                  id="lead-dialog-service-type"
                  name="serviceType"
                  defaultValue=""
                  className="w-full min-w-0"
                >
                  <NativeSelectOption value="">Not set</NativeSelectOption>
                  {leadServiceTypes.map((serviceType) => (
                    <NativeSelectOption key={serviceType} value={serviceType}>
                      {serviceType}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="lead-dialog-priority">Priority</Label>
                <NativeSelect
                  id="lead-dialog-priority"
                  name="priority"
                  defaultValue="Normal"
                  className="w-full min-w-0"
                >
                  {leadPriorities.map((priority) => (
                    <NativeSelectOption key={priority} value={priority}>
                      {priority}
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
                <Label htmlFor="lead-dialog-location-street">Street address</Label>
                <Input
                  id="lead-dialog-location-street"
                  name="serviceAddressLine1"
                  value={serviceLocationFields.serviceAddressLine1}
                  onChange={(event) =>
                    setServiceLocationFields((current) => ({ ...current, serviceAddressLine1: event.target.value }))
                  }
                  placeholder="123 Main St"
                />
              </div>
              <div className="col-span-2 grid gap-2 sm:col-span-1">
                <Label htmlFor="lead-dialog-location-apt">Apt, suite, unit</Label>
                <Input
                  id="lead-dialog-location-apt"
                  name="serviceAddressLine2"
                  value={serviceLocationFields.serviceAddressLine2}
                  onChange={(event) =>
                    setServiceLocationFields((current) => ({ ...current, serviceAddressLine2: event.target.value }))
                  }
                  placeholder="Unit B"
                />
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="lead-dialog-location-city">City</Label>
                <Input
                  id="lead-dialog-location-city"
                  name="serviceCity"
                  value={serviceLocationFields.serviceCity}
                  onChange={(event) =>
                    setServiceLocationFields((current) => ({ ...current, serviceCity: event.target.value }))
                  }
                  placeholder="Houston"
                />
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="lead-dialog-location-state">State</Label>
                <UsStateSelect
                  id="lead-dialog-location-state"
                  name="serviceState"
                  value={serviceLocationFields.serviceState}
                  onChange={(event) =>
                    setServiceLocationFields((current) => ({ ...current, serviceState: event.target.value }))
                  }
                />
              </div>
              <div className="col-span-2 grid gap-2 sm:col-span-1">
                <Label htmlFor="lead-dialog-location-zip">Zip code</Label>
                <Input
                  id="lead-dialog-location-zip"
                  name="servicePostalCode"
                  value={serviceLocationFields.servicePostalCode}
                  onChange={(event) =>
                    setServiceLocationFields((current) => ({ ...current, servicePostalCode: event.target.value }))
                  }
                  placeholder="77001"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="lead-dialog-notes">Notes</Label>
              <Textarea id="lead-dialog-notes" name="notes" placeholder="What did they ask for?" />
            </div>

            {visibleMessage ? <p className="text-destructive text-sm">{visibleMessage}</p> : null}
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
