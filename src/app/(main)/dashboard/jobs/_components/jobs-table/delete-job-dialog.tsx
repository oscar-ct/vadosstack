"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { JobMutationState } from "../../actions";
import type { JobRow } from "./schema";

const initialState: JobMutationState = {
  success: false,
  message: "",
};

export function DeleteJobDialog({
  action,
  job,
  open,
  onOpenChange,
}: {
  action: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  job: JobRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;

    onOpenChange(false);
  }, [onOpenChange, state.success]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete job?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {job?.description ?? "this job"} from the jobs dashboard.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={job?.id ?? ""} />
        </form>

        {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }}
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
