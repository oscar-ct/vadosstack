"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { BriefcaseBusiness, NotebookText, Plus, Trash2 } from "lucide-react";

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

import type { JobCustomer } from "../../jobs/_components/jobs-table/schema";
import type { ServiceTemplateRow } from "../../services/types";
import type { EstimateRecordMutationState } from "../records-actions";
import { EstimateRecordFormFields } from "./estimate-record-form-fields";
import type { EstimateRecordRow } from "./schema";

const initialState: EstimateRecordMutationState = {
  success: false,
  message: "",
};

export function CreateEstimateRecordDialog({
  action,
  customers,
  services,
}: {
  action: (state: EstimateRecordMutationState, formData: FormData) => Promise<EstimateRecordMutationState>;
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
  }, [captureInitialSnapshot, closeWithoutPrompt, state.success]);

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
          <DialogTitle className="font-semibold text-lg tracking-tight">Create estimate</DialogTitle>
          <DialogDescription>Add estimate details, customer, line items, notes, and status.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="grid gap-4">
          <EstimateRecordFormFields customers={customers} services={services} />
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

export function EditEstimateRecordDialog({
  action,
  customers,
  estimate,
  onDeleteEstimate,
  open,
  onOpenChange,
  services,
}: {
  action: (state: EstimateRecordMutationState, formData: FormData) => Promise<EstimateRecordMutationState>;
  customers: JobCustomer[];
  estimate: EstimateRecordRow | null;
  onDeleteEstimate: (estimate: EstimateRecordRow) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: ServiceTemplateRow[];
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const { closeWithoutPrompt, discardDialogOpen, requestOpenChange, setDiscardDialogOpen } = useUnsavedChangesGuard({
    formRef,
    onOpenChange,
    open,
  });

  React.useEffect(() => {
    if (!state.success) return;
    router.refresh();
  }, [router, state.success]);

  React.useEffect(() => {
    if (!state.success) return;
    closeWithoutPrompt();
  }, [closeWithoutPrompt, state.success]);

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="font-semibold text-lg tracking-tight">Edit estimate</DialogTitle>
          <DialogDescription>Update estimate details, line items, and status.</DialogDescription>
        </DialogHeader>
        {estimate ? (
          <form ref={formRef} action={formAction} className="grid gap-4">
            <input type="hidden" name="id" value={estimate.id} />
            <EstimateRecordFormFields customers={customers} estimate={estimate} services={services} />
            {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => {
                  closeWithoutPrompt();
                  onDeleteEstimate(estimate);
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

export function DeleteEstimateRecordDialog({
  action,
  estimate,
  open,
  onOpenChange,
}: {
  action: (state: EstimateRecordMutationState, formData: FormData) => Promise<EstimateRecordMutationState>;
  estimate: EstimateRecordRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;
    router.refresh();
    onOpenChange(false);
  }, [onOpenChange, router, state.success]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete estimate?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {estimate?.description ?? "this estimate"} from the estimates dashboard.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={estimate?.id ?? ""} />
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

export function ConvertEstimateButton({
  action,
  className = "w-full",
  estimate,
  size = "lg",
}: {
  action: (state: EstimateRecordMutationState, formData: FormData) => Promise<EstimateRecordMutationState>;
  className?: string;
  estimate: EstimateRecordRow;
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;
    router.refresh();
  }, [router, state.success]);

  if (estimate.convertedJobId) {
    return (
      <Button asChild size={size} className={className} variant="outline">
        <a href={`/dashboard/jobs?job=${estimate.convertedJobId}`}>View converted job</a>
      </Button>
    );
  }

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="id" value={estimate.id} />
      <Button type="submit" size={size} className={className} disabled={isPending}>
        <BriefcaseBusiness />
        {isPending ? "Converting..." : "Convert to Job"}
      </Button>
      {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
    </form>
  );
}

export function PrintableEstimateButton({
  action,
  className = "w-full",
  estimate,
  size = "lg",
}: {
  action: (state: EstimateRecordMutationState, formData: FormData) => Promise<EstimateRecordMutationState>;
  className?: string;
  estimate: EstimateRecordRow;
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  if (estimate.printableEstimateId) {
    return (
      <Button asChild size={size} className={className} variant="outline">
        <a href={`/dashboard/estimates/${estimate.printableEstimateId}?from=estimates`}>
          <NotebookText />
          View PDF
        </a>
      </Button>
    );
  }

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="id" value={estimate.id} />
      <Button type="submit" size={size} className={className} variant="outline" disabled={isPending}>
        <NotebookText />
        {isPending ? "Creating..." : "Create PDF"}
      </Button>
      {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
    </form>
  );
}
