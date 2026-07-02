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
import { cn } from "@/lib/utils";

import type { EstimateRecordMutationState } from "../records-actions";
import type { EstimateRecordRow } from "./schema";

const initialState: EstimateRecordMutationState = {
  success: false,
  message: "",
};

function formatDeleteMoney(value?: string) {
  return value ? `$${Number(value).toFixed(2)}` : "-";
}

function DeleteSnapshotRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value?.trim() || "-"}</dd>
    </div>
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
      <Button
        asChild
        size={size}
        className={cn(
          "flex h-7 justify-center border-sky-200 bg-sky-50 px-2 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950",
          className,
        )}
        variant="outline"
      >
        <a href={`/dashboard/estimates/${estimate.printableEstimateId}`}>
          <NotebookText />
          Final Estimate
        </a>
      </Button>
    );
  }

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="id" value={estimate.id} />
      <Button
        type="submit"
        size={size}
        className={cn(
          "flex h-7 justify-center border-amber-200 bg-amber-50 px-2 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950",
          className,
        )}
        variant="outline"
        disabled={isPending}
      >
        <NotebookText />
        {isPending ? "Creating..." : "Finalize Estimate"}
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
        <Button type="button" variant="destructive" size={size} className={className}>
          <Trash2 />
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
        <dl className="grid gap-2 rounded-md border bg-muted/30 p-3">
          <DeleteSnapshotRow label="Estimate" value={estimate.description} />
          <DeleteSnapshotRow
            label={estimate.leadName && !estimate.customerName ? "Lead" : "Customer"}
            value={estimate.customerName ?? estimate.leadName}
          />
          <DeleteSnapshotRow label="Location" value={estimate.serviceLocation} />
          <DeleteSnapshotRow label="Status" value={estimate.status} />
          <DeleteSnapshotRow label="Total" value={formatDeleteMoney(estimate.estimatedTotal)} />
        </dl>

        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={estimate.id} />
        </form>

        {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
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
