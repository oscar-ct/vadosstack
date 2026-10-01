"use client";

import { useActionState, useState } from "react";

import { Check, Copy, CreditCard, Link2, Unlink } from "lucide-react";

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
import { Input } from "@/components/ui/input";

import {
  createInvoicePaymentLinkAction,
  type PaymentLinkMutationState,
  revokeInvoicePaymentLinkAction,
} from "../actions";

const initialState: PaymentLinkMutationState = { success: false, message: "" };

export function PaymentLinkDialog({
  invoiceId,
  existingLink,
  stripeReady,
}: {
  invoiceId: string;
  existingLink?: { id: string; createdAt: string; paymentUrl?: string | null } | null;
  stripeReady: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 /> Payment Link
        </Button>
      </DialogTrigger>
      {open ? (
        <PaymentLinkDialogContent invoiceId={invoiceId} existingLink={existingLink} stripeReady={stripeReady} />
      ) : null}
    </Dialog>
  );
}

function PaymentLinkDialogContent({
  invoiceId,
  existingLink,
  stripeReady,
}: {
  invoiceId: string;
  existingLink?: { id: string; createdAt: string; paymentUrl?: string | null } | null;
  stripeReady: boolean;
}) {
  const [createState, createAction, creating] = useActionState(createInvoicePaymentLinkAction, initialState);
  const [revokeState, revokeAction, revoking] = useActionState(revokeInvoicePaymentLinkAction, initialState);
  const [copied, setCopied] = useState(false);
  const linkDisabled = revokeState.success;
  const currentPaymentUrl = linkDisabled
    ? undefined
    : (createState.paymentUrl ?? existingLink?.paymentUrl ?? undefined);
  const activeLinkId = linkDisabled ? undefined : (createState.linkId ?? existingLink?.id);
  const hasActiveLink = Boolean(activeLinkId);

  async function copyLink() {
    if (!currentPaymentUrl) return;
    await navigator.clipboard.writeText(currentPaymentUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Invoice payment link</DialogTitle>
        <DialogDescription>Create a secure customer link for the current outstanding balance.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        {!stripeReady ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Connect and finish setting up Stripe on the Payments page before creating a payment link.
          </div>
        ) : null}

        {currentPaymentUrl ? (
          <div className="grid gap-2">
            <label htmlFor="invoice-payment-url" className="font-medium text-sm">
              Share this link
            </label>
            <div className="flex gap-2">
              <Input id="invoice-payment-url" readOnly value={currentPaymentUrl} />
              <Button type="button" variant="outline" onClick={copyLink}>
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              This encrypted link remains available here until it is replaced or disabled.
            </p>
          </div>
        ) : hasActiveLink ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950 text-sm dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
            <div className="font-medium">Upgrade this existing link</div>
            <div className="mt-1 text-muted-foreground text-xs">
              This link was created before recoverable links were introduced, so its original URL cannot be displayed.
              Replacing it will disable the old URL and create one you can copy again later.
            </div>
          </div>
        ) : null}

        {!linkDisabled ? (
          <form action={createAction}>
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <Button
              type="submit"
              disabled={!stripeReady || creating}
              className="w-full"
              variant={currentPaymentUrl ? "outline" : "default"}
            >
              <CreditCard />{" "}
              {creating
                ? currentPaymentUrl
                  ? "Replacing…"
                  : "Generating…"
                : currentPaymentUrl
                  ? "Replace link"
                  : hasActiveLink
                    ? "Replace with copyable link"
                    : "Generate payment link"}
            </Button>
          </form>
        ) : null}
        {createState.message ? (
          <p className={createState.success ? "text-emerald-700 text-sm" : "text-destructive text-sm"}>
            {createState.message}
          </p>
        ) : null}
      </div>

      {activeLinkId || revokeState.message ? (
        <DialogFooter>
          {activeLinkId ? (
            <form action={revokeAction}>
              <input type="hidden" name="invoiceId" value={invoiceId} />
              <input type="hidden" name="linkId" value={activeLinkId} />
              <Button type="submit" variant="ghost" disabled={revoking}>
                <Unlink /> {revoking ? "Disabling…" : "Disable payment link"}
              </Button>
            </form>
          ) : null}
          {revokeState.message ? (
            <span className={revokeState.success ? "text-emerald-700 text-sm" : "text-destructive text-sm"}>
              {revokeState.message}
            </span>
          ) : null}
        </DialogFooter>
      ) : null}
    </DialogContent>
  );
}
