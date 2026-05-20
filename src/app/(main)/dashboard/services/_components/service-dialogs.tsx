"use client";

import * as React from "react";

import { Plus, Trash2 } from "lucide-react";

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

import type { ServiceTemplateMutationState } from "../actions";
import type { ServiceTemplateRow } from "../types";
import { ServiceFormFields } from "./service-form-fields";

const initialState: ServiceTemplateMutationState = {
  success: false,
  message: "",
};

export function CreateServiceDialog({
  action,
}: {
  action: (state: ServiceTemplateMutationState, formData: FormData) => Promise<ServiceTemplateMutationState>;
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
      <DialogContent
        className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-4xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="font-semibold tracking-tight">Create service</DialogTitle>
          <DialogDescription>Save reusable job details, labor, and materials.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="grid gap-4">
          <ServiceFormFields />
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

export function EditServiceDialog({
  action,
  onDeleteService,
  open,
  onOpenChange,
  service,
}: {
  action: (state: ServiceTemplateMutationState, formData: FormData) => Promise<ServiceTemplateMutationState>;
  onDeleteService: (service: ServiceTemplateRow) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceTemplateRow | null;
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
      <DialogContent
        className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-4xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="font-semibold tracking-tight">Service details</DialogTitle>
          <DialogDescription>View or update reusable job details, line items, and notes.</DialogDescription>
        </DialogHeader>
        {service ? (
          <form ref={formRef} action={formAction} className="grid gap-4">
            <input type="hidden" name="id" value={service.id} />
            <ServiceFormFields service={service} />
            {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => {
                  closeWithoutPrompt();
                  onDeleteService(service);
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

export function DeleteServiceDialog({
  action,
  onOpenChange,
  open,
  service,
}: {
  action: (state: ServiceTemplateMutationState, formData: FormData) => Promise<ServiceTemplateMutationState>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  service: ServiceTemplateRow | null;
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
          <AlertDialogTitle>Delete service?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {service?.title ?? "this service"} from your reusable service list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={service?.id ?? ""} />
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
