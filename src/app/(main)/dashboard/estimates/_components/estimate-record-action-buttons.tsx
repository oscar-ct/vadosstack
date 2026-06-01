"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { BriefcaseBusiness, NotebookText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import type { EstimateRecordMutationState } from "../records-actions";
import type { EstimateRecordRow } from "./schema";

const initialState: EstimateRecordMutationState = {
  success: false,
  message: "",
};

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
    toast.success(state.message || "Estimate converted to job.");
  }, [router, state]);

  if (estimate.convertedJobId) {
    return (
      <Button asChild size={size} className={className} variant="outline">
        <a href={`/dashboard/jobs/${estimate.convertedJobId}`}>View converted job</a>
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

export function UpdateEstimateStatusButton({
  action,
  children,
  className,
  estimate,
  size = "sm",
  status,
  variant = "outline",
}: {
  action: (state: EstimateRecordMutationState, formData: FormData) => Promise<EstimateRecordMutationState>;
  children: React.ReactNode;
  className?: string;
  estimate: EstimateRecordRow;
  size?: React.ComponentProps<typeof Button>["size"];
  status: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;
    router.refresh();
    toast.success(state.message || `Estimate marked ${status}.`);
  }, [router, state, status]);

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="id" value={estimate.id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" size={size} variant={variant} className={className} disabled={isPending}>
        {isPending ? "Updating..." : children}
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
  const router = useRouter();
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;
    router.refresh();
    toast.success(state.message || "Estimate PDF created.");
  }, [router, state]);

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

export function DeleteEstimateRecordButton({
  action,
  className,
  estimate,
  redirectTo = "/dashboard/estimates",
  size = "sm",
}: {
  action: (state: EstimateRecordMutationState, formData: FormData) => Promise<EstimateRecordMutationState>;
  className?: string;
  estimate: EstimateRecordRow;
  redirectTo?: string;
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;

    setOpen(false);
    toast.success(state.message || "Estimate deleted.");
    router.replace(redirectTo);
  }, [redirectTo, router, state]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size={size} className={className}>
          <Trash2 className="text-destructive" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete estimate?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the working estimate record and any generated customer PDF linked to it. Converted jobs are not
            deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={estimate.id} />
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
            {isPending ? "Deleting..." : "Delete estimate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
