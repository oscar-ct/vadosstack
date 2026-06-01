"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { BriefcaseBusiness, CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { ServiceTemplateRow } from "../../services/types";
import type { JobMutationState } from "../actions";
import { JobBackButton } from "./job-back-button";
import { DeleteJobButton } from "./job-record-action-buttons";
import { JobRecordFormFields } from "./job-record-form-fields";
import type { JobCustomer, JobRow } from "./jobs-table/schema";

const initialState: JobMutationState = {
  success: false,
  message: "",
};

function getJobDraftKey(mode: "create" | "edit", jobId?: string) {
  return `job-record-draft:${mode}:${jobId ?? "new"}`;
}

function formatMoney(value?: string) {
  return value ? `$${Number(value).toFixed(2)}` : "$0.00";
}

function getWorkspaceCopy(mode: "create" | "edit") {
  if (mode === "edit") {
    return {
      eyebrow: "Job workspace",
      title: "Edit job",
      description: "Tune the customer scope, schedule, pricing, measurements, and billing basis from one workspace.",
      submitLabel: "Save changes",
      pendingLabel: "Saving...",
    };
  }

  return {
    eyebrow: "Job workspace",
    title: "Create job",
    description: "Build the working job record with the same details your team needs in the field and office.",
    submitLabel: "Create job",
    pendingLabel: "Creating...",
  };
}

export function JobRecordWorkspace({
  action,
  customers,
  deleteAction,
  job,
  mode,
  services,
}: {
  action: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  customers: JobCustomer[];
  deleteAction?: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  job?: JobRow;
  mode: "create" | "edit";
  services: ServiceTemplateRow[];
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const copy = getWorkspaceCopy(mode);
  const draftKey = React.useMemo(() => getJobDraftKey(mode, job?.id), [job?.id, mode]);

  React.useEffect(() => {
    if (!state.success) return;

    window.localStorage.removeItem(draftKey);
    toast.success(state.message || "Job saved.");

    if (state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
      return;
    }

    if (mode === "edit") {
      router.push(job?.id ? `/dashboard/jobs/${job.id}` : "/dashboard/jobs");
      router.refresh();
    }
  }, [draftKey, job?.id, mode, router, state]);

  return (
    <div className="@container/main mx-auto grid w-full max-w-7xl gap-4 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <JobBackButton />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <CheckCircle2 className="size-4 text-emerald-600" />
            {mode === "edit" ? "Working from saved job" : "Autosave protects this job locally"}
          </div>
          {mode === "edit" && job && deleteAction ? <DeleteJobButton action={deleteAction} job={job} /> : null}
        </div>
      </div>

      <form ref={formRef} action={formAction} className="grid gap-4">
        {job ? <input type="hidden" name="id" value={job.id} /> : null}
        <Card className="overflow-visible rounded-lg">
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid gap-1">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-normal">
                  <BriefcaseBusiness className="size-4" />
                  {copy.eyebrow}
                </div>
                <CardTitle className="text-xl">{copy.title}</CardTitle>
                <CardDescription>{copy.description}</CardDescription>
              </div>
              <div className="rounded-md border bg-background px-3 py-2 text-right">
                <div className="text-muted-foreground text-xs">Current value</div>
                <div className="font-semibold text-lg tabular-nums">{formatMoney(job?.finalCost)}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-5">
            <JobRecordFormFields
              clearDraft={state.success}
              customers={customers}
              draftKey={draftKey}
              job={job}
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
              <Link prefetch={false} href="/dashboard/jobs">
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
