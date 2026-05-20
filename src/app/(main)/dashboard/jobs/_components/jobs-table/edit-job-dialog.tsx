"use client";

import * as React from "react";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UnsavedChangesDialog, useUnsavedChangesGuard } from "@/components/unsaved-changes-guard";

import type { ServiceTemplateRow } from "../../../services/types";
import type { JobMutationState } from "../../actions";
import { JobFormFields } from "../job-form-fields";
import type { JobCustomer, JobRow } from "./schema";

const initialState: JobMutationState = {
  success: false,
  message: "",
};

export function EditJobDialog({
  action,
  customers,
  job,
  onDeleteJob,
  open,
  onOpenChange,
  services,
}: {
  action: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  customers: JobCustomer[];
  job: JobRow | null;
  onDeleteJob: (job: JobRow) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: ServiceTemplateRow[];
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const { closeWithoutPrompt, discardDialogOpen, requestOpenChange, setDiscardDialogOpen } = useUnsavedChangesGuard({
    formRef,
    onOpenChange,
    open,
  });

  React.useEffect(() => {
    if (!state.success) return;

    closeWithoutPrompt();
  }, [closeWithoutPrompt, state.success]);

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="font-semibold text-lg tracking-tight">Edit job</DialogTitle>
          <DialogDescription>Update job details, schedule, costs, location, and notes.</DialogDescription>
        </DialogHeader>

        {job ? (
          <form ref={formRef} action={formAction} className="grid gap-4">
            <input type="hidden" name="id" value={job.id} />
            <JobFormFields customers={customers} job={job} services={services} />

            {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => {
                  closeWithoutPrompt();
                  onDeleteJob(job);
                }}
              >
                <Trash2 />
                Delete
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => requestOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
      <UnsavedChangesDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        onDiscard={closeWithoutPrompt}
      />
    </Dialog>
  );
}
