"use client";

import * as React from "react";

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
import { UnsavedChangesDialog, useUnsavedChangesGuard } from "@/components/unsaved-changes-guard";

import type { ServiceTemplateRow } from "../../services/types";
import type { JobMutationState } from "../actions";
import { JobFormFields } from "./job-form-fields";
import type { JobCustomer } from "./jobs-table/schema";

const initialState: JobMutationState = {
  success: false,
  message: "",
};

export function CreateJobDialog({
  action,
  customers,
  services,
}: {
  action: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  customers: JobCustomer[];
  services: ServiceTemplateRow[];
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const { captureInitialSnapshot, closeWithoutPrompt, discardDialogOpen, requestOpenChange, setDiscardDialogOpen } =
    useUnsavedChangesGuard({
      formRef,
      onOpenChange: setOpen,
      open,
    });

  React.useEffect(() => {
    if (!state.success) return;

    formRef.current?.reset();
    captureInitialSnapshot();
    closeWithoutPrompt();
    toast.success(state.message || "Job created.");
  }, [captureInitialSnapshot, closeWithoutPrompt, state]);

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Create
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="font-semibold text-lg tracking-tight">Create job</DialogTitle>
          <DialogDescription>Add job details, schedule, costs, location, and notes.</DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="grid gap-4">
          <JobFormFields customers={customers} services={services} />

          {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <UnsavedChangesDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        onDiscard={closeWithoutPrompt}
      />
    </Dialog>
  );
}
