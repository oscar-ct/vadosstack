"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { CheckCircle2, RotateCcw, Trash2, UserRound, XCircle } from "lucide-react";
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

import type { LeadRow } from "../_lib/lead-data";
import type { LeadMutationState } from "../actions";

const initialState: LeadMutationState = {
  success: false,
  message: "",
};

function SubmitButton({
  children,
  className,
  icon,
  isPending,
  variant = "outline",
}: {
  children: React.ReactNode;
  className?: string;
  icon: React.ReactNode;
  isPending: boolean;
  variant?: "default" | "destructive" | "outline";
}) {
  return (
    <Button type="submit" size="sm" variant={variant} disabled={isPending} className={className}>
      {icon}
      {children}
    </Button>
  );
}

export function LeadStatusButton({
  action,
  lead,
  status,
}: {
  action: (state: LeadMutationState, formData: FormData) => Promise<LeadMutationState>;
  lead: LeadRow;
  status: "New" | "Contacted" | "Won" | "Lost";
}) {
  const router = useRouter();
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;
    toast.success(state.message || "Lead updated.");
    router.refresh();
  }, [router, state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={lead.id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton
        icon={status === "New" ? <RotateCcw /> : status === "Lost" ? <XCircle /> : <CheckCircle2 />}
        isPending={isPending}
        variant={status === "Lost" ? "destructive" : "outline"}
      >
        {status === "Contacted" ? "Mark contacted" : `Mark ${status.toLowerCase()}`}
      </SubmitButton>
    </form>
  );
}

export function ConvertLeadButton({
  action,
  lead,
}: {
  action: (state: LeadMutationState, formData: FormData) => Promise<LeadMutationState>;
  lead: LeadRow;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;
    toast.success(state.message || "Lead converted.");
    if (state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [router, state]);

  if (lead.customerId) {
    return (
      <Button asChild size="sm" className="w-full sm:w-auto">
        <Link prefetch={false} href={`/dashboard/customers/${lead.customerId}`}>
          <UserRound />
          Open customer
        </Link>
      </Button>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={lead.id} />
      <SubmitButton icon={<UserRound />} isPending={isPending} className="w-full sm:w-auto">
        Convert to customer
      </SubmitButton>
    </form>
  );
}

export function DeleteLeadButton({
  action,
  lead,
}: {
  action: (state: LeadMutationState, formData: FormData) => Promise<LeadMutationState>;
  lead: LeadRow;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;
    setOpen(false);
    toast.success(state.message || "Lead deleted.");
    if (state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [router, state]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="destructive">
          <Trash2 />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete lead?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {lead.name} from the lead pipeline. Linked customers, estimates, jobs, and invoices are not
            deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={lead.id} />
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
            {isPending ? "Deleting..." : "Delete lead"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
