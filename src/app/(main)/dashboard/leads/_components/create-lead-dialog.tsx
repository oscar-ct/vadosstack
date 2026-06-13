"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
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
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/phone";

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
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [visibleMessage, setVisibleMessage] = React.useState("");

  const resetForm = React.useCallback(() => {
    formRef.current?.reset();
    setPhoneDigits("");
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
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create lead</DialogTitle>
          <DialogDescription>Capture a new inquiry before it becomes a customer or estimate.</DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="grid gap-4">
          <input type="hidden" name="status" value="New" />

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
            <div className="grid gap-2">
              <Label htmlFor="lead-dialog-name">Name</Label>
              <Input id="lead-dialog-name" name="name" placeholder="Jane Smith" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-dialog-priority">Priority</Label>
              <NativeSelect id="lead-dialog-priority" name="priority" defaultValue="Normal" className="w-full">
                {leadPriorities.map((priority) => (
                  <NativeSelectOption key={priority} value={priority}>
                    {priority}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="lead-dialog-email">Email</Label>
              <Input id="lead-dialog-email" name="email" type="email" placeholder="jane@example.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-dialog-phone">Phone</Label>
              <Input
                id="lead-dialog-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                maxLength={12}
                value={formatPhoneNumber(phoneDigits)}
                onChange={(event) => setPhoneDigits(normalizePhoneNumber(event.target.value).slice(0, 10))}
                placeholder="555-555-1234"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="lead-dialog-source">Source</Label>
              <NativeSelect id="lead-dialog-source" name="source" defaultValue="" className="w-full">
                <NativeSelectOption value="">Not set</NativeSelectOption>
                {leadSources.map((source) => (
                  <NativeSelectOption key={source} value={source}>
                    {source}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-dialog-service-type">Service type</Label>
              <NativeSelect id="lead-dialog-service-type" name="serviceType" defaultValue="" className="w-full">
                <NativeSelectOption value="">Not set</NativeSelectOption>
                {leadServiceTypes.map((serviceType) => (
                  <NativeSelectOption key={serviceType} value={serviceType}>
                    {serviceType}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-dialog-value">Estimated value</Label>
              <Input
                id="lead-dialog-value"
                name="estimatedValue"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="lead-dialog-follow-up">Follow-up date</Label>
              <Input id="lead-dialog-follow-up" name="followUpAt" type="date" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-dialog-location">Service location</Label>
              <Input id="lead-dialog-location" name="serviceLocation" placeholder="123 Main St, Houston, TX" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="lead-dialog-notes">Notes</Label>
            <Textarea id="lead-dialog-notes" name="notes" placeholder="What did they ask for?" className="min-h-24" />
          </div>

          {visibleMessage ? <p className="text-destructive text-sm">{visibleMessage}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
