"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { CircleDollarSign, ReceiptText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toDateInputValue } from "@/lib/date-only";
import { cn } from "@/lib/utils";

import type { InvoiceMutationState } from "../../invoices/types";
import type { JobMutationState } from "../actions";
import { getJobBillingState } from "./job-billing-state";
import type { JobRow } from "./jobs-table/schema";

const initialState: JobMutationState = {
  success: false,
  message: "",
};

const initialInvoiceState: InvoiceMutationState = {
  success: false,
  message: "",
};

export function JobInvoiceButton({
  action,
  className,
  job,
  size = "sm",
}: {
  action: (state: InvoiceMutationState, formData: FormData) => Promise<InvoiceMutationState>;
  className?: string;
  job: JobRow;
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const [state, formAction, isPending] = React.useActionState(action, initialInvoiceState);
  const billingState = getJobBillingState(job);
  const createInvoiceLabel = billingState.kind === "paidNotInvoiced" ? "Create paid invoice" : "Create invoice";

  React.useEffect(() => {
    if (!state.message || state.success) return;

    toast.error(state.message);
  }, [state]);

  if (job.invoiceId) {
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
        <Link prefetch={false} href={`/dashboard/invoices/${job.invoiceId}`}>
          <ReceiptText />
          View invoice
        </Link>
      </Button>
    );
  }

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="jobId" value={job.id} />
      <Button
        type="submit"
        size={size}
        className={cn(
          "flex h-7 justify-center px-2",
          billingState.canCreateInvoice
            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950"
            : "border-muted bg-muted/30 text-muted-foreground hover:bg-muted/30 hover:text-muted-foreground",
          className,
        )}
        variant="outline"
        disabled={isPending || !billingState.canCreateInvoice}
        title={billingState.detail}
      >
        <ReceiptText />
        {isPending ? "Creating..." : billingState.canCreateInvoice ? createInvoiceLabel : billingState.label}
      </Button>
    </form>
  );
}

export function DeleteJobButton({
  action,
  className,
  job,
  redirectTo = "/dashboard/jobs",
  size = "sm",
}: {
  action: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  className?: string;
  job: JobRow;
  redirectTo?: string;
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function handleDelete() {
    setError(null);
    const formData = new FormData();
    formData.set("id", job.id);
    startTransition(async () => {
      const result = await action(initialState, formData);
      if (!result.success) {
        setError(result.message || "Could not delete job.");
        return;
      }
      toast.success(result.message || "Job deleted.");
      setOpen(false);
      router.replace(redirectTo);
    });
  }

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
          <AlertDialogTitle>Delete job?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the job, payment records, invoice link, and schedule details. Converted estimates
            are kept and returned to the estimate list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={isPending} onClick={handleDelete}>
            {isPending ? "Deleting..." : "Delete job"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CreateDepositButton({
  action,
  className,
  job,
  size = "sm",
}: {
  action: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  className?: string;
  job: JobRow;
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const paymentFormRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;
    paymentFormRef.current?.reset();
    setOpen(false);
    router.refresh();
    toast.success(state.message || "Deposit recorded.");
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size={size} className={className}>
          <CircleDollarSign className="size-4" />
          Create deposit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Record deposit</DialogTitle>
          <DialogDescription>
            Add a deposit collected before or during the job. Deposits reduce the future invoice balance.
          </DialogDescription>
        </DialogHeader>
        <form ref={paymentFormRef} action={formAction} className="grid gap-4">
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="paymentType" value="deposit" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`job-deposit-date-${job.id}`}>Date</Label>
              <Input
                id={`job-deposit-date-${job.id}`}
                name="paidOn"
                type="date"
                defaultValue={toDateInputValue(new Date())}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`job-deposit-amount-${job.id}`}>Amount</Label>
              <Input
                id={`job-deposit-amount-${job.id}`}
                name="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`job-deposit-method-${job.id}`}>Method</Label>
              <Input id={`job-deposit-method-${job.id}`} name="method" placeholder="Zelle, check, card" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`job-deposit-reference-${job.id}`}>Check / Ref #</Label>
              <Input id={`job-deposit-reference-${job.id}`} name="referenceNumber" placeholder="Optional" />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={`job-deposit-description-${job.id}`}>Description</Label>
              <Input
                id={`job-deposit-description-${job.id}`}
                name="description"
                placeholder="Deposit"
                defaultValue="Deposit"
                required
              />
            </div>
          </div>
          {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Recording..." : "Record deposit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// export function JobPaymentForm({
//   action,
//   job,
// }: {
//   action: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
//   job: JobRow;
// }) {
//   const router = useRouter();
//   const [state, formAction, isPending] = React.useActionState(action, initialState);
//
//   React.useEffect(() => {
//     if (!state.success) return;
//
//     toast.success(state.message || "Payment recorded.");
//     router.refresh();
//   }, [router, state]);
//
//   return (
//     <form action={formAction} className="grid gap-2 border-t pt-3">
//       <input type="hidden" name="jobId" value={job.id} />
//       <div className="grid grid-cols-2 gap-2">
//         <Input name="paidOn" type="date" required className="bg-background" />
//         <Input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount" required className="bg-background" />
//       </div>
//       <div className="grid grid-cols-2 gap-2">
//         <Select name="paymentType" defaultValue="deposit">
//           <SelectTrigger className="w-full bg-background">
//             <SelectValue />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectGroup>
//               <SelectItem value="deposit">Deposit</SelectItem>
//               <SelectItem value="invoice_payment">Invoice payment</SelectItem>
//             </SelectGroup>
//           </SelectContent>
//         </Select>
//         <Input name="method" placeholder="Method" required className="bg-background" />
//       </div>
//       <Input name="description" placeholder="Description" defaultValue="Job payment" required className="bg-background" />
//       <Input name="referenceNumber" placeholder="Reference number" className="bg-background" />
//       <Button type="submit" size="sm" disabled={isPending}>
//         <Plus />
//         {isPending ? "Recording..." : "Record payment"}
//       </Button>
//       {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
//     </form>
//   );
// }

// export function DeleteJobPaymentButton({
//   action,
//   paymentId,
// }: {
//   action: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
//   paymentId: string;
// }) {
//   const router = useRouter();
//   const [state, formAction, isPending] = React.useActionState(action, initialState);
//
//   React.useEffect(() => {
//     if (!state.success) return;
//
//     toast.success(state.message || "Payment deleted.");
//     router.refresh();
//   }, [router, state]);
//
//   return (
//     <form action={formAction}>
//       <input type="hidden" name="id" value={paymentId} />
//       <Button type="submit" variant="ghost" size="icon" className="size-7" disabled={isPending} aria-label="Delete payment">
//         <Trash2 className="size-3.5 text-destructive" />
//       </Button>
//     </form>
//   );
// }

export function DeleteDepositButton({
  action,
  paymentId,
}: {
  action: (state: JobMutationState, formData: FormData) => Promise<JobMutationState>;
  paymentId: string;
}) {
  // const formRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  // const [state, formAction, isPending] = React.useActionState(action, initialState);

  function handleDelete() {
    setError(null);
    const formData = new FormData();
    formData.set("id", paymentId);
    startTransition(async () => {
      const result = await action(initialState, formData);
      if (!result.success) {
        setError(result.message || "Could not delete deposit.");
        return;
      }
      toast.success(result.message || "Deposit deleted.");
      setOpen(false);
      router.refresh();
    });
  }
  // React.useEffect(() => {
  //   if (!state.success) return;
  //   setOpen(false);
  //   toast.success(state.message || "Deposit deleted.");
  //   router.refresh();
  //
  // }, [router, state]);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="submit"
          variant="destructive"
          size="icon"
          className="size-7"
          disabled={isPending}
          aria-label="Delete payment"
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete deposit?</AlertDialogTitle>
          <AlertDialogDescription>This removes the deposit permanently.</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {/*<form ref={formRef} action={formAction}>*/}
        {/*  <input type="hidden" name="id" value={paymentId/job.id} />*/}
        {/*</form>*/}
        {/*{state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}*/}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          {/*<AlertDialogAction*/}
          {/*    disabled={isPending}*/}
          {/*    onClick={(event) => {*/}
          {/*      event.preventDefault();*/}
          {/*      formRef.current?.requestSubmit();*/}
          {/*    }}*/}
          {/*>*/}
          {/*  {isPending ? "Deleting..." : "Delete deposit"}*/}
          {/*</AlertDialogAction>*/}
          <Button type="button" variant="destructive" disabled={isPending} onClick={handleDelete}>
            {isPending ? "Deleting..." : "Delete deposit"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
