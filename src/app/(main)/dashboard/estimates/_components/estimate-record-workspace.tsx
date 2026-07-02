"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { CheckCircle2, NotebookText, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { discardLocalDraft } from "@/lib/drafts.client";

import type { JobCustomer } from "../../jobs/_components/jobs-table/schema";
import type { ServiceTemplateRow } from "../../services/types";
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

export function EstimateRecordWorkspace({
  action,
  customers,
  deleteAction,
  estimate,
  leadPrefill,
  mode,
  services,
}: {
  action: (state: EstimateRecordMutationState, formData: FormData) => Promise<EstimateRecordMutationState>;
  customers: JobCustomer[];
  deleteAction?: (state: EstimateRecordMutationState, formData: FormData) => Promise<EstimateRecordMutationState>;
  estimate?: EstimateRecordRow;
  leadPrefill?: LeadEstimatePrefill;
  mode: "create" | "edit";
  services: ServiceTemplateRow[];
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const copy = getWorkspaceCopy(mode);
  const draftKey = React.useMemo(
    () => getEstimateDraftKey(mode, estimate?.id, leadPrefill?.leadId),
    [estimate?.id, leadPrefill?.leadId, mode],
  );

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

  return (
    <div className="@container/main mx-auto grid w-full max-w-7xl gap-4 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <EstimateBackButton />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <CheckCircle2 className="size-4 text-emerald-600" />
            {mode === "edit" ? "Working from saved estimate" : "Drafts save into the estimate pipeline"}
          </div>
          {mode === "edit" && estimate && deleteAction ? (
            <DeleteEstimateRecordButton action={deleteAction} estimate={estimate} />
          ) : null}
        </div>
      </div>

      <form ref={formRef} action={formAction} className="grid gap-4">
        {estimate ? <input type="hidden" name="id" value={estimate.id} /> : null}
        <Card className="overflow-visible rounded-lg">
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
              presentation="workspace"
              services={services}
            />
            {state.message && !state.success ? (
              <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
                {state.message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button asChild type="button" variant="outline">
              <Link prefetch={false} href="/dashboard/estimates" onClick={() => discardLocalDraft(draftKey)}>
                Cancel
              </Link>
            </Button>
            <Button type="submit" disabled={isPending}>
              <Save />
              {isPending ? copy.pendingLabel : copy.submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
