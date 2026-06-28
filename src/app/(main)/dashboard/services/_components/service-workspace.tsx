"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { CheckCircle2, PackageCheck, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BackButton } from "@/components/back-button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { ServiceTemplateMutationState } from "../actions";
import type { ServiceTemplateRow } from "../types";
import { ServiceFormFields } from "./service-form-fields";

const initialState: ServiceTemplateMutationState = {
  success: false,
  message: "",
};

function formatMoney(value?: string) {
  return value ? `$${Number(value).toFixed(2)}` : "$0.00";
}

function getSubtotal(items: Array<{ price: string }>) {
  return items.reduce((total, item) => total + Number(item.price || 0), 0);
}

function getWorkspaceCopy(mode: "create" | "edit") {
  if (mode === "edit") {
    return {
      eyebrow: "Service workspace",
      title: "Edit service",
      description: "Shape the reusable scope, pricing lines, and internal notes from one focused page.",
      submitLabel: "Save changes",
      pendingLabel: "Saving...",
    };
  }

  return {
    eyebrow: "Service workspace",
    title: "Create service",
    description: "Build a reusable service recipe your jobs and estimates can pick up later.",
    submitLabel: "Create service",
    pendingLabel: "Creating...",
  };
}

function getServiceDraftKey(mode: "create" | "edit", serviceId?: string) {
  return `service-template-draft:${mode}:${serviceId ?? "new"}`;
}

export function DeleteServiceButton({
  action,
  service,
}: {
  action: (state: ServiceTemplateMutationState, formData: FormData) => Promise<ServiceTemplateMutationState>;
  service: ServiceTemplateRow;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;

    setOpen(false);
    toast.success(state.message || "Service deleted.");
    router.replace(state.redirectTo ?? "/dashboard/services");
    router.refresh();
  }, [router, state]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm">
          <Trash2 />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete service?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {service.title} from your reusable service library. Jobs and estimates that already used this
            service are not changed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={service.id} />
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
            {isPending ? "Deleting..." : "Delete service"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ServiceWorkspace({
  action,
  deleteAction,
  mode,
  service,
}: {
  action: (state: ServiceTemplateMutationState, formData: FormData) => Promise<ServiceTemplateMutationState>;
  deleteAction?: (state: ServiceTemplateMutationState, formData: FormData) => Promise<ServiceTemplateMutationState>;
  mode: "create" | "edit";
  service?: ServiceTemplateRow;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [draftClearSignal, setDraftClearSignal] = React.useState(0);
  const copy = getWorkspaceCopy(mode);
  const draftKey = React.useMemo(() => getServiceDraftKey(mode, service?.id), [mode, service?.id]);
  const currentValue = service ? getSubtotal(service.laborItems) + getSubtotal(service.materials) : 0;

  React.useEffect(() => {
    if (!state.success) return;

    window.localStorage.removeItem(draftKey);
    setDraftClearSignal((current) => current + 1);
    toast.success(state.message || "Service saved.");

    if (state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
      return;
    }

    router.refresh();
  }, [draftKey, router, state]);

  return (
    <div className="@container/main mx-auto grid w-full max-w-7xl gap-4 md:gap-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <BackButton fallbackHref="/dashboard/services" />
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground text-sm">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <span className="min-w-0 truncate">
              {mode === "edit" ? "Working from saved service" : "Ready for jobs and estimates"}
            </span>
          </div>
          {mode === "edit" && service && deleteAction ? (
            <DeleteServiceButton action={deleteAction} service={service} />
          ) : null}
        </div>
      </div>

      <form ref={formRef} action={formAction} className="grid min-w-0 gap-4">
        {service ? <input type="hidden" name="id" value={service.id} /> : null}
        <Card className="min-w-0 overflow-visible rounded-lg">
          <CardHeader className="border-b bg-muted/20">
            <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="grid min-w-0 gap-1">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-normal">
                  <PackageCheck className="size-4" />
                  {copy.eyebrow}
                </div>
                <CardTitle className="text-xl">{copy.title}</CardTitle>
                <CardDescription>{copy.description}</CardDescription>
              </div>
              <div className="w-fit rounded-md border bg-background px-3 py-2 text-right sm:justify-self-end">
                <div className="text-muted-foreground text-xs">
                  {mode === "edit" ? "Saved value" : "Starting value"}
                </div>
                <div className="font-semibold text-lg tabular-nums">{formatMoney(currentValue.toFixed(2))}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-5">
            <ServiceFormFields clearDraftSignal={draftClearSignal} draftKey={draftKey} service={service} />
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
              <Link prefetch={false} href="/dashboard/services">
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
