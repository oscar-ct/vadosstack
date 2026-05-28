"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Mail, Printer } from "lucide-react";
import { siGmail } from "simple-icons";
import { toast } from "sonner";

import { SimpleIcon } from "@/components/simple-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type EmailEstimateState = {
  success: boolean;
  message: string;
  reconnectRequired?: boolean;
  submittedAt?: number;
};

const initialState: EmailEstimateState = {
  success: false,
  message: "",
};

export function EstimateActions({
  action,
  customerEmail,
  customerName,
  estimateId,
  estimateNumber,
  estimatedTotal,
  gmailConnected,
  notice,
  returnTo,
  validThrough,
}: {
  action: (state: EmailEstimateState, formData: FormData) => Promise<EmailEstimateState>;
  customerEmail?: string | null;
  customerName?: string | null;
  estimateId: string;
  estimateNumber: string;
  estimatedTotal: string;
  gmailConnected: boolean;
  notice?: {
    message: string;
    type: "error" | "success";
  } | null;
  returnTo: string;
  validThrough: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [open, setOpen] = React.useState(false);
  const [showStateMessage, setShowStateMessage] = React.useState(false);
  const stateSubmittedAt = state.submittedAt;
  const canSendEmail = gmailConnected && (!state.reconnectRequired || open);
  const gmailConnectLabel = state.reconnectRequired ? "Reconnect Gmail" : "Connect Gmail";

  React.useEffect(() => {
    if (!notice?.message) {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (notice.type === "success") {
        toast.success(notice.message);
      } else {
        toast.error(notice.message);
      }

      router.replace(returnTo, { scroll: false });
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [notice?.message, notice?.type, returnTo, router]);

  React.useEffect(() => {
    if (!state.message || !stateSubmittedAt) {
      return;
    }

    setShowStateMessage(true);

    if (state.reconnectRequired) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowStateMessage(false);

      if (state.success) {
        setOpen(false);
      }
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [state.message, state.reconnectRequired, state.success, stateSubmittedAt]);

  return (
    <div className="grid gap-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => window.print()}>
          <Printer />
          Print / Save PDF
        </Button>
        {canSendEmail ? (
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);

              if (nextOpen) {
                setShowStateMessage(false);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={!customerEmail}>
                <Mail />
                Email estimate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send estimate?</DialogTitle>
                <DialogDescription>
                  Review the details before emailing this estimate from your connected Gmail account.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Estimate</span>
                  <span className="font-medium">{estimateNumber}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Recipient</span>
                  <span className="max-w-56 truncate font-medium">{customerEmail}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="max-w-56 truncate font-medium">{customerName ?? "No customer name"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Estimated total</span>
                  <span className="font-semibold text-sky-700 dark:text-sky-400">{estimatedTotal}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Valid through</span>
                  <span className="font-medium">{validThrough}</span>
                </div>
              </div>

              {showStateMessage && state.message ? (
                <p
                  className={
                    state.success
                      ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 text-sm dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm"
                  }
                >
                  {state.message}
                </p>
              ) : null}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isPending}>
                    Cancel
                  </Button>
                </DialogClose>
                <form action={formAction}>
                  <input type="hidden" name="estimateId" value={estimateId} />
                  <Button type="submit" disabled={isPending || state.reconnectRequired}>
                    <Mail />
                    {isPending ? "Sending..." : "Send estimate"}
                  </Button>
                </form>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={`/api/auth/google/mail?returnTo=${encodeURIComponent(returnTo)}`}>
              <SimpleIcon icon={siGmail} className="size-3.5 fill-current" />
              {gmailConnectLabel}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
