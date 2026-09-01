"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { CheckCircle2, NotebookText, Save } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { discardLocalDraft } from "@/lib/drafts.client";

import type { JobCustomer } from "../../jobs/_components/jobs-table/schema";
import type { ServiceTemplateRow } from "../../services/types";
import type { EstimateLeadOption } from "../_lib/estimate-record-data";
import type { EstimateRecordMutationState } from "../records-actions";
import { EstimateBackButton } from "./estimate-back-button";
import { DeleteEstimateRecordButton } from "./estimate-record-action-buttons";
import { EstimateRecordFormFields, type LeadEstimatePrefill } from "./estimate-record-form-fields";
import type { EstimateRecordRow } from "./schema";

const initialState: EstimateRecordMutationState = {
  success: false,
  message: "",
};

function getEstimateDraftKey(mode: "create" | "edit", estimateId?: string, leadId?: string) {
  return `estimate-record-draft:${mode}:${estimateId ?? leadId ?? "new"}`;
}

function formatMoney(value?: string) {
  return value ? `$${Number(value).toFixed(2)}` : "$0.00";
}

function getWorkspaceCopy(mode: "create" | "edit") {
  if (mode === "edit") {
    return {
      eyebrow: "Estimate workspace",
      title: "Edit estimate",
      description: "Tune the customer scope, pricing, schedule, and next step from one focused workspace.",
      submitLabel: "Save changes",
      pendingLabel: "Saving...",
    };
  }

  return {
    eyebrow: "Estimate workspace",
    title: "Create estimate",
    description: "Build a clear scope and price before it moves into the customer-facing estimate.",
    submitLabel: "Create estimate",
    pendingLabel: "Creating...",
  };
}

function getSubmitCopy({ isPending, mode, status }: { isPending: boolean; mode: "create" | "edit"; status: string }) {
  if (mode === "edit") {
    return isPending ? "Saving..." : "Save changes";
  }

  if (status === "Waiting on Customer") {
    return isPending ? "Publishing..." : "Publish & mark waiting";
  }

  if (status === "Ready to Send") {
    return isPending ? "Publishing..." : "Create & publish";
  }

  const copy = getWorkspaceCopy(mode);
  return isPending ? copy.pendingLabel : copy.submitLabel;
}

export function EstimateRecordWorkspace({
  action,
  customers,
  deleteAction,
  estimate,
  leadPrefill,
  leads,
  mode,
  services,
}: {
  action: (state: EstimateRecordMutationState, formData: FormData) => Promise<EstimateRecordMutationState>;
  customers: JobCustomer[];
  deleteAction?: (state: EstimateRecordMutationState, formData: FormData) => Promise<EstimateRecordMutationState>;
  estimate?: EstimateRecordRow;
  leadPrefill?: LeadEstimatePrefill;
  leads: EstimateLeadOption[];
  mode: "create" | "edit";
  services: ServiceTemplateRow[];
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const syncExistingEstimateRef = React.useRef<HTMLInputElement>(null);
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [estimateSnapshotConfirmOpen, setEstimateSnapshotConfirmOpen] = React.useState(false);
  const [selectedStatus, setSelectedStatus] = React.useState(estimate?.status ?? "Draft");
  const copy = getWorkspaceCopy(mode);
  const draftKey = React.useMemo(
    () => getEstimateDraftKey(mode, estimate?.id, leadPrefill?.leadId),
    [estimate?.id, leadPrefill?.leadId, mode],
  );
  const requiresEstimateSnapshotSyncConfirmation = mode === "edit" && Boolean(estimate?.printableEstimateId);

  React.useEffect(() => {
    if (!state.success) return;

    window.localStorage.removeItem(draftKey);
    toast.success(state.message || "Estimate saved.");

    if (state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
      return;
    }

    if (mode === "edit") {
      router.push(estimate?.id ? `/dashboard/estimates/records/${estimate.id}` : "/dashboard/estimates");
      router.refresh();
    }
  }, [draftKey, estimate?.id, mode, router, state]);

  React.useEffect(() => {
    if (!state.success && state.message && syncExistingEstimateRef.current) {
      syncExistingEstimateRef.current.value = "false";
    }
  }, [state.message, state.success]);

  React.useEffect(() => {
    if (state.requiresCustomerCopyConfirmation) {
      setEstimateSnapshotConfirmOpen(true);
    }
  }, [state]);

  const returningPublishedEstimateToDraft = requiresEstimateSnapshotSyncConfirmation && selectedStatus === "Draft";
  const publishingOnSave =
    !estimate?.printableEstimateId && (selectedStatus === "Ready to Send" || selectedStatus === "Waiting on Customer");

  return (
    <div className="@container/main mx-auto grid w-full max-w-7xl gap-4 md:gap-6">
      <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <EstimateBackButton />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground text-sm">
            <CheckCircle2 className="size-4 text-emerald-600" />
            {mode === "edit" ? "Working from saved estimate" : "Drafts save into the estimate pipeline"}
          </div>
          {mode === "edit" && estimate && deleteAction ? (
            <DeleteEstimateRecordButton action={deleteAction} estimate={estimate} />
          ) : null}
        </div>
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="grid min-w-0 gap-4"
        onSubmit={(event) => {
          if (!returningPublishedEstimateToDraft || syncExistingEstimateRef.current?.value === "true") {
            return;
          }

          event.preventDefault();
          setEstimateSnapshotConfirmOpen(true);
        }}
      >
        {estimate ? <input type="hidden" name="id" value={estimate.id} /> : null}
        <input ref={syncExistingEstimateRef} type="hidden" name="syncExistingEstimate" defaultValue="false" />
        <Card className="min-w-0 overflow-visible rounded-lg">
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid gap-1">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-normal">
                  <NotebookText className="size-4" />
                  {copy.eyebrow}
                </div>
                <CardTitle className="text-xl">{copy.title}</CardTitle>
                <CardDescription>{copy.description}</CardDescription>
              </div>
              <div className="rounded-md border bg-background px-3 py-2 text-right">
                <div className="text-muted-foreground text-xs">Current value</div>
                <div className="font-semibold text-lg tabular-nums">{formatMoney(estimate?.estimatedTotal)}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-5">
            <EstimateRecordFormFields
              clearDraft={state.success}
              customers={customers}
              draftKey={draftKey}
              estimate={estimate}
              leadPrefill={leadPrefill}
              leads={leads}
              onStatusChange={setSelectedStatus}
              presentation="workspace"
              services={services}
            />
            {publishingOnSave ? (
              <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-100">
                <div className="font-medium text-sm">
                  {selectedStatus === "Waiting on Customer"
                    ? "Saving will publish this estimate and mark it as awaiting the customer’s response."
                    : "Saving will publish the latest customer estimate so it is ready to send."}
                </div>
                <p className="mt-1 text-sky-900/75 text-xs dark:text-sky-100/70">
                  Publishing assigns an estimate number and creates or refreshes the customer document.
                </p>
              </div>
            ) : null}
            {returningPublishedEstimateToDraft ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
                <div className="font-medium text-sm">Saving as Draft will unpublish the active customer document.</div>
                <p className="mt-1 text-amber-900/75 text-xs dark:text-amber-100/70">
                  The published customer copy will be removed. PDFs already downloaded or emailed cannot be recalled.
                </p>
              </div>
            ) : null}
            {state.message && !state.success && !state.requiresCustomerCopyConfirmation ? (
              <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
                {state.message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-10 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button asChild type="button" variant="outline">
              <Link prefetch={false} href="/dashboard/estimates" onClick={() => discardLocalDraft(draftKey)}>
                Cancel
              </Link>
            </Button>
            <Button type="submit" disabled={isPending}>
              <Save />
              {getSubmitCopy({
                isPending,
                mode,
                status: selectedStatus,
              })}
            </Button>
          </div>
        </div>
      </form>

      <AlertDialog
        open={estimateSnapshotConfirmOpen}
        onOpenChange={(open) => {
          setEstimateSnapshotConfirmOpen(open);
          if (!open && syncExistingEstimateRef.current) {
            syncExistingEstimateRef.current.value = "false";
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {returningPublishedEstimateToDraft ? "Return estimate to Draft?" : "Update published customer copy?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {returningPublishedEstimateToDraft
                ? "Saving will remove the active customer document and return this estimate to Draft."
                : "Saving will replace the active customer document with the latest customer details, scope, schedule, labor, materials, taxes, status, and total."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border bg-muted/40 p-3 text-muted-foreground text-sm leading-6">
            {returningPublishedEstimateToDraft
              ? estimate?.status === "Waiting on Customer"
                ? "This estimate was waiting on the customer. The published customer copy will be removed, but any PDF already emailed or downloaded cannot be recalled."
                : "The published customer copy will be removed until the estimate is published again."
              : "If the customer already received this estimate, you may need to resend the updated estimate after saving."}
            {!returningPublishedEstimateToDraft && state.customerCopyChangedFields?.length ? (
              <div className="mt-1 text-xs">Changed: {state.customerCopyChangedFields.join(", ")}.</div>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (syncExistingEstimateRef.current) {
                  syncExistingEstimateRef.current.value = "true";
                }
                formRef.current?.requestSubmit();
              }}
            >
              {returningPublishedEstimateToDraft
                ? "Save as Draft & unpublish"
                : selectedStatus !== estimate?.status
                  ? selectedStatus === "Waiting on Customer"
                    ? "Save changes & mark waiting"
                    : selectedStatus === "Ready to Send"
                      ? "Save changes & mark ready to send"
                      : `Save changes & mark ${selectedStatus.toLowerCase()}`
                  : "Save & update customer copy"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
